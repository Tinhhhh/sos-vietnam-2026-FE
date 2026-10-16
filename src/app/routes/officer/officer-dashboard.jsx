/**
 * /officer/dashboard — officer console after login (legacy dispatcher.html main screen).
 * Composes header, command map, incident panels and station directory.
 */
import '@/styles/officer-theme.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import { OfficerLayout } from '@/components/layouts/officer-layout/officer-layout';
import { paths } from '@/config/paths';
import { useToast } from '@/components/ui/toast/toast-context';
import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';
import { buildOfficerProfile, useAuth } from '@/features/auth';
import { CommandMap, ServiceDirectoryPanel, StationDirectory, useStations } from '@/features/command-map';
import { CallMapCard, IncomingCallDialog, OfficerCallView, useOfficerCall } from '@/features/incident-call';
import {
  IncidentHistoryPanel,
  IncidentQueuePanel,
  TYPE_LOOK,
  useIncidentQueue,
} from '@/features/incident-queue';
import { OfficerHeader } from '@/features/officer-header';

const LATER = {
  admin: 'Phân quyền & quản trị thuộc module Quản trị (làm sau).',
  officer: 'Hồ sơ cán bộ thuộc module Quản trị (làm sau).',
  incidents: 'Xoá / xuất danh sách sự cố thuộc module Lịch sử & Thống kê (làm sau).',
  directory: 'Quản lý danh bạ thuộc module Quản trị (làm sau).',
};

export function OfficerDashboardRoute() {
  const { user, accessToken, logout } = useAuth();
  const toast = useToast();
  const officer = useMemo(() => buildOfficerProfile(user), [user]);
  const { stations, status: stationsStatus } = useStations();
  const mapApi = useRef(null);
  const [activeTab, setActiveTab] = useState('incidents');
  const [unitCoords, setUnitCoords] = useState(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);

  // The socket reads the token on every (re)connect, so it picks up refreshed tokens.
  const tokenRef = useRef(accessToken);
  useEffect(() => {
    tokenRef.current = accessToken;
  }, [accessToken]);

  const queue = useIncidentQueue({
    getToken: () => tokenRef.current,
    onNewIncident: (inc) =>
      toast.show(`🆘 SOS mới ${inc.id}: ${inc.tags.join(', ') || 'Cần hỗ trợ khẩn cấp'}`, {
        tone: 'error',
        duration: 8000,
      }),
    onEscalated: (inc) =>
      toast.show(`⚡ Ca ${inc.id} đã quá 15 phút chưa tiếp nhận, chuyển lên cấp tỉnh/thành phố.`, {
        tone: 'warning',
        duration: 8000,
      }),
  });

  // Video call with the citizen (one at a time). Calling from a card claims the incident first.
  const phone = useOfficerCall({ getToken: () => tokenRef.current });
  const { call } = phone;
  const inCall = !!call && call.state !== 'incoming';
  const callIncident = call ? queue.incidents.find((i) => i.id === call.incidentId) || null : null;

  const selectIncident = (inc) => {
    setSelectedIncidentId(inc.id);
    setActiveTab('incidents');
    mapApi.current?.flyToIncident(inc);
  };

  // Legacy put the agency theme on <body> (CSS variables + per-theme accents).
  useEffect(() => {
    const body = document.body;
    body.classList.add(officer.theme, 'officer-authenticated');
    return () => body.classList.remove(officer.theme, 'officer-authenticated');
  }, [officer.theme]);

  const later = (key) => () => toast.show(LATER[key], { tone: 'info' });

  const tabs = [
    {
      key: 'incidents',
      title: 'Danh sách sự cố khẩn cấp tiếp nhận',
      icon: <SvgIcon name="alert" color="red" />,
      label: <>Sự Cố ({queue.incidents.length})</>,
    },
    {
      key: 'history',
      title: 'Lịch sử sự cố đã điều phối',
      icon: <SvgIcon name="file" color="blue" />,
      label: <>Lịch Sử (0)</>,
    },
    {
      key: 'stations',
      title: 'Danh bạ trụ sở cơ quan',
      icon: <SvgIcon name="building" color="blue" />,
      label: officer.stationsTabTitle,
    },
    ...(officer.isAdmin
      ? [
          {
            key: 'enterprises',
            title: 'Mạng lưới doanh nghiệp cứu hộ giao thông',
            icon: <SvgIcon name="car" color="amber" />,
            label: 'Cứu Hộ',
          },
          {
            key: 'hospitals',
            title: 'Mạng lưới bệnh viện & trạm cấp cứu 115',
            icon: <SvgIcon name="building" color="emerald" />,
            label: 'Bệnh Viện',
          },
        ]
      : []),
  ];

  const panels = {
    incidents: (
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
        }}
        inCall={!!call && call.state !== 'ended'}
      />
    ),
    history: (
      <IncidentHistoryPanel
        agency={officer.agency}
        onExportExcel={later('incidents')}
        onClear={later('incidents')}
      />
    ),
    stations: (
      <StationDirectory
        officer={officer}
        stations={stations}
        status={stationsStatus}
        onFlyTo={(st) => mapApi.current?.flyToStation(st)}
        onAdminAction={later('directory')}
      />
    ),
    enterprises: <ServiceDirectoryPanel kind="enterprises" onAdminAction={later('directory')} />,
    hospitals: <ServiceDirectoryPanel kind="hospitals" onAdminAction={later('directory')} />,
  };

  return (
    <>
      <OfficerLayout
        header={
          <OfficerHeader
            officer={officer}
            unitCoords={unitCoords}
            onLocateUnit={() => mapApi.current?.focusUnit()}
            onOpenAdmin={later('admin')}
            onOpenOfficerInfo={later('officer')}
            onLogout={logout}
          />
        }
        topBar={<StatisticsShortcut />}
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
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClearIncidents={later('incidents')}
        panel={panels[activeTab]}
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

/** Shortcut (top-left of the map) to the statistics dashboard, which opens full screen. */
function StatisticsShortcut() {
  return (
    <Link
      to={paths.officer.statistics.getHref()}
      title="Mở bảng thống kê sự cố của đơn vị (toàn màn hình)"
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 1000, // above the MapLibre canvas, which sits after this link in the map area
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 10,
        // Solid (not glass) so it stays readable over any map tile
        border: '1.5px solid #38bdf8',
        background: '#0b1220',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.55)',
        color: '#f8fafc',
        fontSize: 12.5,
        fontWeight: 800,
        textDecoration: 'none',
      }}
    >
      <SvgIcon name="target" color="blue" /> Thống kê
    </Link>
  );
}
