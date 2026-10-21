/**
 * /officer/dashboard — officer console after login (national dispatch layout).
 * Header, left rail (home, ward officer status, settings, logout), action tiles that open the
 * console windows (queue, history, directories, statistics), and the stage: the command map,
 * or during a video call the call in the main panel with the map as the GPS widget on the right.
 */
import '@/styles/officer-theme.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  ActionTile,
  ConsoleWindow,
  OfficerLayout,
  RailButton,
  RailSpacer,
} from '@/components/layouts/officer-layout/officer-layout';
import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';
import { useToast } from '@/components/ui/toast/toast-context';
import { paths } from '@/config/paths';
import { ChangePasswordDialog, OfficerInfoPanel, buildOfficerProfile, useAuth } from '@/features/auth';
import { CommandMap, ServiceDirectoryPanel, StationDirectory, useStations } from '@/features/command-map';
import { CallMapCard, IncomingCallDialog, OfficerCallView, useOfficerCall } from '@/features/incident-call';
import { DelegationControls, DispatchConfirmDialog, DispatchWindow } from '@/features/incident-dispatch';
import { ReportDocumentModal, ReportPromptDialog } from '@/features/incident-report';
import { LocationPicker } from '@/features/location/components/location-picker';
import {
  IncidentDetailDialog,
  IncidentHistoryPanel,
  IncidentQueuePanel,
  OfficerStatusPanel,
  TYPE_LOOK,
  requestDispatch,
  playIncidentAlert,
  stopIncidentAlert,
  unlockIncidentAlertAudio,
  useIncidentQueue,
} from '@/features/incident-queue';
import { OfficerHeader, SettingsMenu } from '@/features/officer-header';

const LATER = {
  incidents: 'Xoá / xuất danh sách sự cố thuộc module Lịch sử & Thống kê (làm sau).',
  directory: 'Quản lý danh bạ thuộc module Quản trị (làm sau).',
};

export function OfficerDashboardRoute() {
  const { user, accessToken, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const officer = useMemo(() => buildOfficerProfile(user), [user]);
  const { stations, status: stationsStatus } = useStations();
  const mapApi = useRef(null);
  // Window open over the stage; the queue is open on arrival like the old always-visible list
  const [openWindow, setOpenWindow] = useState('incidents');
  const [unitCoords, setUnitCoords] = useState(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [detailId, setDetailId] = useState(null); // "Chi tiết" box
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [dispatchConfirm, setDispatchConfirm] = useState(null); // incident waiting for "Xác nhận điều động"
  const [dispatchBusy, setDispatchBusy] = useState(false);
  const [dispatchId, setDispatchId] = useState(null); // dispatch window
  const [reportPromptId, setReportPromptId] = useState(null); // "Ca đã kết thúc · lập văn bản ngay?"
  const [reportId, setReportId] = useState(null); // report document window
  const [historyKey, setHistoryKey] = useState(0); // reload the history after a document changes

  // The socket reads the token on every (re)connect, so it picks up refreshed tokens.
  const tokenRef = useRef(accessToken);
  useEffect(() => {
    tokenRef.current = accessToken;
  }, [accessToken]);

  const queue = useIncidentQueue({
    getToken: () => tokenRef.current,
    // Legacy: siren + chime + voice only for incidents this officer can take (not watch-only ones)
    onNewIncident: (inc) => {
      toast.show(`🆘 SOS mới ${inc.id}: ${inc.tags.join(', ') || 'Cần hỗ trợ khẩn cấp'}`, {
        tone: 'error',
        duration: 8000,
      });
      if (inc.canHandle) {
        playIncidentAlert(inc);
        setOpenWindow('incidents');
      }
    },
    onEscalated: (inc) => {
      toast.show(`⚡ Ca ${inc.id} đã chuyển lên cấp tỉnh/thành phố.`, {
        tone: 'warning',
        duration: 8000,
      });
      if (inc.canHandle) playIncidentAlert(inc, { escalated: true });
    },
  });
  const pendingCount = queue.incidents.filter((i) => i.status === 'PENDING' && i.canHandle).length;

  // Video call with the citizen (one at a time). Calling from a card claims the incident first.
  const phone = useOfficerCall({ getToken: () => tokenRef.current });
  const { call } = phone;
  const inCall = !!call && call.state !== 'incoming';
  const callIncident = call ? queue.incidents.find((i) => i.id === call.incidentId) || null : null;

  // Browsers keep audio suspended until a tap; resume it on every tap. Leaving the page stops the voice.
  useEffect(() => {
    window.addEventListener('pointerdown', unlockIncidentAlertAudio, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockIncidentAlertAudio);
      stopIncidentAlert();
    };
  }, []);

  const selectIncident = (inc) => {
    stopIncidentAlert(); // the officer is looking at it: stop reading it out
    setSelectedIncidentId(inc.id);
    mapApi.current?.flyToIncident(inc);
  };

  // Legacy put the agency theme on <body> (CSS variables + per-theme accents).
  useEffect(() => {
    const body = document.body;
    body.classList.add(officer.theme, 'officer-authenticated');
    return () => body.classList.remove(officer.theme, 'officer-authenticated');
  }, [officer.theme]);

  // "Yêu cầu điều động" -> confirm -> VERIFYING to RESOLVING -> dispatch window
  const askDispatch = (inc) => {
    setDetailId(null);
    setDispatchConfirm(inc);
  };
  const confirmDispatch = async () => {
    const inc = dispatchConfirm;
    setDispatchBusy(true);
    try {
      const updated = await requestDispatch(inc.id);
      if (updated) queue.upsert(updated);
      setDispatchConfirm(null);
      setDispatchId(inc.id);
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setDispatchBusy(false);
    }
  };
  const openDispatch = (inc) => {
    setDetailId(null);
    setDispatchId(inc.id);
  };
  const dispatchIncident = dispatchId ? queue.incidents.find((i) => i.id === dispatchId) || null : null;

  const later = (key) => () => toast.show(LATER[key], { tone: 'info' });
  const toggleWindow = (key) => setOpenWindow((cur) => (cur === key ? null : key));
  const closeWindow = useCallback(() => setOpenWindow(null), []);

  const windows = {
    incidents: {
      title: `Hàng đợi sự cố (${queue.incidents.length})`,
      icon: <SvgIcon name="alert" color="red" />,
      body: (
        <IncidentQueuePanel
          incidents={queue.incidents}
          status={queue.status}
          error={queue.error}
          connection={queue.connection}
          officerLevel={officer.level}
          selectedId={selectedIncidentId}
          onSelect={selectIncident}
          onRetry={queue.reload}
          onChange={queue.upsert}
          onCall={(inc) => {
            selectIncident(inc);
            phone.callCitizen(inc);
            setOpenWindow(null); // the call takes the main panel
          }}
          inCall={!!call && call.state !== 'ended'}
          onOpenDetail={setDetailId}
          onRequestDispatch={askDispatch}
          onOpenDispatch={openDispatch}
          renderDelegation={(inc) => <DelegationControls incident={inc} onFinished={setReportPromptId} />}
        />
      ),
    },
    history: {
      title: 'Lịch sử sự cố',
      icon: <SvgIcon name="file" color="amber" />,
      body: (
        <IncidentHistoryPanel
          agency={officer.agency}
          onExportExcel={later('incidents')}
          onClear={later('incidents')}
          onOpenDetail={setDetailId}
          onOpenDocument={setReportId}
          refreshKey={historyKey}
        />
      ),
    },
    stations: {
      title: officer.stationsTabTitle,
      icon: <SvgIcon name="building" color="blue" />,
      body: (
        <StationDirectory
          officer={officer}
          stations={stations}
          status={stationsStatus}
          onFlyTo={(st) => mapApi.current?.flyToStation(st)}
          onAdminAction={later('directory')}
        />
      ),
    },
    enterprises: {
      title: 'Doanh nghiệp cứu hộ',
      icon: <SvgIcon name="car" color="amber" />,
      body: <ServiceDirectoryPanel kind="enterprises" onAdminAction={later('directory')} />,
    },
    officers: {
      title: 'Cán bộ đơn vị',
      icon: <SvgIcon name="users" color="blue" />,
      body: (
        <OfficerStatusPanel
          holding={queue.incidents.find((i) => i.heldByMe) || null}
          onChange={queue.upsert}
        />
      ),
    },
    profile: {
      title: 'Hồ sơ cán bộ',
      icon: <SvgIcon name="user" color="blue" />,
      body: <OfficerInfoPanel user={user} unitName={officer.unitName} />,
    },
    hospitals: {
      title: 'Bệnh viện & cấp cứu 115',
      icon: <SvgIcon name="building" color="emerald" />,
      body: <ServiceDirectoryPanel kind="hospitals" onAdminAction={later('directory')} />,
    },
  };
  const current = openWindow ? windows[openWindow] : null;

  // Shortcut back into the dispatch window of the case I am dispatching (the queue card may be far down)
  const dispatching = queue.incidents.find((i) => i.heldByMe && i.status === 'RESOLVING') || null;

  const actions = (
    <>
      {dispatching && (
        <ActionTile
          icon="car"
          tone="green"
          title="Ca đang điều động"
          subtitle={`${dispatching.id} · mở lại`}
          active={dispatchId === dispatching.id}
          onClick={() => openDispatch(dispatching)}
        />
      )}
      <ActionTile
        icon="alert"
        tone="red"
        title="Hàng đợi sự cố"
        subtitle={
          pendingCount > 0 ? `${pendingCount} ca chờ tiếp nhận` : `${queue.incidents.length} ca đang mở`
        }
        count={pendingCount}
        active={openWindow === 'incidents'}
        onClick={() => toggleWindow('incidents')}
      />
      <ActionTile
        icon="file"
        tone="amber"
        title="Lịch sử"
        subtitle="Ca đã điều phối"
        active={openWindow === 'history'}
        onClick={() => toggleWindow('history')}
      />
      <ActionTile
        icon="building"
        tone="blue"
        title={officer.stationsTabTitle}
        subtitle="Danh bạ trụ sở"
        active={openWindow === 'stations'}
        onClick={() => toggleWindow('stations')}
      />
      {officer.isAdmin && (
        <>
          <ActionTile
            icon="car"
            tone="orange"
            title="Cứu hộ"
            subtitle="Doanh nghiệp cứu hộ"
            active={openWindow === 'enterprises'}
            onClick={() => toggleWindow('enterprises')}
          />
          <ActionTile
            icon="plus"
            tone="green"
            title="Bệnh viện"
            subtitle="Cấp cứu 115"
            active={openWindow === 'hospitals'}
            onClick={() => toggleWindow('hospitals')}
          />
        </>
      )}
      <ActionTile
        icon="chart"
        tone="purple"
        title="Thống kê"
        subtitle="Báo cáo đơn vị"
        onClick={() => navigate(paths.officer.statistics.getHref())}
      />
      <ActionTile
        icon="pin"
        tone="cyan"
        title="GPS đơn vị"
        subtitle={officer.unitName}
        onClick={() => mapApi.current?.focusUnit()}
      />
    </>
  );

  const rail = (
    <>
      <RailButton icon="home" label="Chỉ huy" title="Bàn chỉ huy" active />
      <RailButton
        icon="users"
        label="Cán bộ"
        title="Cán bộ của đơn vị: trực tuyến / ngoại tuyến / đang giữ ca, giao ca"
        active={openWindow === 'officers'}
        onClick={() => toggleWindow('officers')}
      />
      <RailButton
        icon="user"
        label="Hồ sơ"
        title="Thông tin cán bộ: hồ sơ, đơn vị công tác"
        active={openWindow === 'profile'}
        onClick={() => toggleWindow('profile')}
      />
      <SettingsMenu
        isAdmin={officer.isAdmin}
        onOpenAdmin={() => navigate(paths.officer.newAccount.getHref())}
        onChangePassword={() => setPasswordOpen(true)}
        renderTrigger={({ ref, onClick, open }) => (
          <RailButton
            buttonRef={ref}
            icon="gear"
            label="Cài đặt"
            title="Cài đặt hệ thống & quản trị"
            active={open}
            onClick={onClick}
          />
        )}
      />
      <RailSpacer />
      <RailButton icon="logout" label="Đăng xuất" title="Đăng xuất" tone="danger" onClick={logout} />
    </>
  );

  return (
    <>
      <OfficerLayout
        header={
          <OfficerHeader
            officer={officer}
            unitCoords={unitCoords}
            onLocateUnit={() => mapApi.current?.focusUnit()}
            pendingCount={pendingCount}
            onOpenQueue={() => setOpenWindow('incidents')}
          />
        }
        rail={rail}
        actions={actions}
        mapTitle={inCall ? 'Theo dõi GPS thời gian thực' : `Bản đồ tác chiến · ${officer.unitName}`}
        map={
          <CommandMap
            ref={mapApi}
            officer={officer}
            stations={stations}
            incidents={queue.incidents}
            selectedIncidentId={selectedIncidentId}
            onIncidentClick={selectIncident}
            onUnitLocated={setUnitCoords}
          />
        }
        callPane={
          inCall ? (
            <OfficerCallView
              call={call}
              incident={callIncident}
              onHangUp={phone.hangUp}
              onRecall={() => {
                const target = callIncident || { id: call.incidentId, citizenName: call.peer?.name };
                phone.dismiss();
                phone.callCitizen(target);
              }}
              onClose={phone.dismiss}
              onToggleMic={phone.setMic}
              onToggleCamera={phone.setCamera}
              onQuality={phone.requestQuality}
            />
          ) : null
        }
        mapOverlay={
          <CallMapCard
            incident={callIncident}
            typeLabel={callIncident && TYPE_LOOK[callIncident.type]?.label}
          />
        }
        window={
          current ? (
            <ConsoleWindow key={openWindow} title={current.title} icon={current.icon} onClose={closeWindow}>
              {current.body}
            </ConsoleWindow>
          ) : null
        }
      />
      <IncidentDetailDialog
        incidentId={detailId}
        onClose={() => setDetailId(null)}
        live={detailId ? queue.incidents.find((i) => i.id === detailId) || null : null}
        holding={queue.incidents.find((i) => i.heldByMe) || null}
        onChange={queue.upsert}
        onRequestDispatch={askDispatch}
        onOpenDispatch={openDispatch}
      />
      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <DispatchConfirmDialog
        incident={dispatchConfirm}
        busy={dispatchBusy}
        onConfirm={confirmDispatch}
        onCancel={() => setDispatchConfirm(null)}
      />
      {dispatchIncident && (
        <DispatchWindow
          key={dispatchIncident.id}
          incident={dispatchIncident}
          typeLabel={TYPE_LOOK[dispatchIncident.type]?.label}
          officer={officer}
          stations={stations}
          stationsStatus={stationsStatus}
          LocationPicker={LocationPicker}
          onClose={() => setDispatchId(null)}
          onFinished={setReportPromptId}
        />
      )}
      <ReportPromptDialog
        incidentId={reportPromptId}
        onLater={() => setReportPromptId(null)}
        onCreate={(id) => {
          setReportPromptId(null);
          setReportId(id);
        }}
      />
      <ReportDocumentModal
        incidentId={reportId}
        onClose={() => {
          setReportId(null);
          setHistoryKey((k) => k + 1);
        }}
      />
      {call?.state === 'incoming' && (
        <IncomingCallDialog
          call={call}
          onAccept={() => {
            if (callIncident) selectIncident(callIncident);
            phone.accept();
          }}
          onReject={phone.reject}
        />
      )}
    </>
  );
}
