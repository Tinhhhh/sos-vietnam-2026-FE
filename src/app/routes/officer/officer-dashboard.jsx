/**
 * /officer/dashboard — officer console after login (national dispatch layout).
 * Header, left rail (bottom tab bar on phones) with every console tool: map, incident queue (red
 * count dot), the case being dispatched, directories, statistics, unit GPS, settings, logout.
 * History has its own rail button (red dot = newly closed cases); officer status and profile live in Settings. The stage: the command map, or
 * during a video call the call in the main panel with the map as the GPS widget on the right.
 */
import '@/styles/officer-theme.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  ConsoleWindow,
  OfficerLayout,
  RailButton,
  RailSpacer,
} from '@/components/layouts/officer-layout/officer-layout';
import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';
import { useToast } from '@/components/ui/toast/toast-context';
import { paths } from '@/config/paths';
import { ChangePasswordDialog, ChangePinDialog, buildOfficerProfile, useAuth } from '@/features/auth';
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
  useHistoryUnseen,
  useIncidentQueue,
} from '@/features/incident-queue';
import { OfficerHeader } from '@/features/officer-header';

import { OfficerSettingsDialog } from './officer-settings-dialog';

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
  const [pinOpen, setPinOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // stable callbacks: the settings window memoizes its sections on them
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const openPassword = useCallback(() => setPasswordOpen(true), []);
  const openPin = useCallback(() => setPinOpen(true), []);
  const openCreateAccount = useCallback(() => navigate(paths.officer.newAccount.getHref()), [navigate]);
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
  // Red dot on "Lịch sử": cases closed since this officer last opened it (recount when a case leaves the queue)
  const historyUnseen = useHistoryUnseen({
    who: user?.member?.member_id || user?.email || null,
    open: openWindow === 'history',
    closedSignal: queue.incidents.map((i) => i.id).join(','),
  });

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

  // "Yêu cầu điều động" -> confirm -> VERIFYING to RESOLVING -> dispatch window (field officer: its step 2)
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
  const historyLater = useCallback(() => toast.show(LATER.incidents, { tone: 'info' }), [toast]);
  const toggleWindow = (key) => setOpenWindow((cur) => (cur === key ? null : key));
  const closeWindow = useCallback(() => setOpenWindow(null), []);
  // Phones: a window covers the whole stage, so map tools close it first to show the map
  const showMap = () => {
    if (window.matchMedia('(max-width: 992px)').matches) setOpenWindow(null);
  };

  const holding = queue.incidents.find((i) => i.heldByMe) || null;
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
      icon: <SvgIcon name="clock" color="amber" />,
      body: (
        <IncidentHistoryPanel
          agency={officer.agency}
          onExportExcel={historyLater}
          onClear={historyLater}
          onOpenDetail={setDetailId}
          onOpenDocument={setReportId}
          refreshKey={historyKey}
        />
      ),
    },
    // shortcut to Settings → "Trạng thái cán bộ": who is online / holding a case, hand over
    members: {
      title: 'Thành viên đơn vị',
      icon: <SvgIcon name="users" color="blue" />,
      body: (
        <OfficerStatusPanel
          holding={holding}
          onChange={queue.upsert}
          isAdmin={officer.isAdmin}
          provinceScope={officer.level === 'province' ? user?.province_id : null}
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
    hospitals: {
      title: 'Bệnh viện & cấp cứu 115',
      icon: <SvgIcon name="building" color="emerald" />,
      body: <ServiceDirectoryPanel kind="hospitals" onAdminAction={later('directory')} />,
    },
  };
  const current = openWindow ? windows[openWindow] : null;

  // Shortcut back into the dispatch window of the case I am dispatching (the queue card may be far down)
  const dispatching = queue.incidents.find((i) => i.heldByMe && i.status === 'RESOLVING') || null;

  // Left rail (bottom tab bar on phones): every console tool. Profile and security are in Settings;
  // "Thành viên" is a shortcut to the officer status that Settings also lists. The queue / history
  // buttons carry a red count (cases waiting for me / newly closed), like the bell.
  const rail = (
    <>
      <RailButton
        icon="home"
        label="Chỉ huy"
        title="Bàn chỉ huy: đóng cửa sổ đang mở, xem bản đồ"
        active={!openWindow}
        onClick={closeWindow}
        desktopOnly
      />
      <RailButton
        icon="alert"
        label="Sự cố"
        title={
          pendingCount > 0
            ? `Hàng đợi sự cố: ${pendingCount} ca chờ tiếp nhận`
            : `Hàng đợi sự cố: ${queue.incidents.length} ca đang mở`
        }
        badge={pendingCount}
        active={openWindow === 'incidents'}
        onClick={() => toggleWindow('incidents')}
      />
      <RailButton
        icon="clock"
        label="Lịch sử"
        title={
          historyUnseen > 0 ? `Lịch sử sự cố: ${historyUnseen} ca mới đóng` : 'Lịch sử sự cố: ca đã đóng'
        }
        badge={historyUnseen}
        active={openWindow === 'history'}
        onClick={() => toggleWindow('history')}
      />
      <RailButton
        icon="users"
        label="Thành viên"
        title="Thành viên đơn vị: ai đang trực tuyến, ai đang giữ ca, giao ca"
        active={openWindow === 'members'}
        onClick={() => toggleWindow('members')}
      />
      {dispatching && (
        <RailButton
          icon="car"
          label="Điều động"
          title={`Ca đang điều động ${dispatching.id}: mở lại cửa sổ điều động`}
          active={dispatchId === dispatching.id}
          onClick={() => openDispatch(dispatching)}
        />
      )}
      <RailButton
        icon="building"
        label={officer.stationsTabTitle}
        title={`${officer.stationsTabTitle}: danh bạ trụ sở`}
        active={openWindow === 'stations'}
        onClick={() => toggleWindow('stations')}
      />
      {officer.isAdmin && (
        <>
          <RailButton
            icon="car"
            label="Cứu hộ"
            title="Doanh nghiệp cứu hộ"
            active={openWindow === 'enterprises'}
            onClick={() => toggleWindow('enterprises')}
          />
          <RailButton
            icon="plus"
            label="Bệnh viện"
            title="Bệnh viện & cấp cứu 115"
            active={openWindow === 'hospitals'}
            onClick={() => toggleWindow('hospitals')}
          />
        </>
      )}
      <RailButton
        icon="chart"
        label="Thống kê"
        title="Thống kê: báo cáo đơn vị"
        onClick={() => navigate(paths.officer.statistics.getHref())}
      />
      <RailButton
        icon="pin"
        label="GPS"
        title={`GPS đơn vị: ${officer.unitName}`}
        onClick={() => {
          showMap();
          mapApi.current?.focusUnit();
        }}
      />
      <RailButton
        icon="gear"
        label="Cài đặt"
        title="Cài đặt: hồ sơ, bảo mật, cán bộ, quản trị"
        active={settingsOpen}
        onClick={() => setSettingsOpen(true)}
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
        mapTitle={inCall ? 'Theo dõi GPS thời gian thực' : officer.unitName}
        mapTitlePrefix={inCall ? null : 'Bản đồ tác chiến · '}
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
        holding={holding}
        onChange={queue.upsert}
        onRequestDispatch={askDispatch}
        onOpenDispatch={openDispatch}
      />
      <OfficerSettingsDialog
        open={settingsOpen}
        onClose={closeSettings}
        user={user}
        officer={officer}
        onChangePassword={openPassword}
        onChangePin={openPin}
        onCreateAccount={openCreateAccount}
        holding={holding}
        onIncidentChange={queue.upsert}
        onOpenDetail={setDetailId}
        onOpenDocument={setReportId}
        onHistoryAction={historyLater}
        historyKey={historyKey}
      />
      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <ChangePinDialog open={pinOpen} onClose={() => setPinOpen(false)} />
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
