/**
 * /officer/dashboard — officer console after login (legacy dispatcher.html main screen).
 * Composes header, command map, incident panels and station directory.
 */
import '@/styles/officer-theme.css';

import { useEffect, useMemo, useRef, useState } from 'react';

import { OfficerLayout } from '@/components/layouts/officer-layout/officer-layout';
import { useToast } from '@/components/ui/toast/toast-context';
import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';
import { buildOfficerProfile, useAuth } from '@/features/auth';
import { CommandMap, ServiceDirectoryPanel, StationDirectory, useStations } from '@/features/command-map';
import { IncidentHistoryPanel, IncidentQueuePanel, StatsTopBar } from '@/features/incident-queue';
import { OfficerHeader } from '@/features/officer-header';

const LATER = {
  admin: 'Phân quyền & quản trị thuộc module Quản trị (làm sau).',
  officer: 'Hồ sơ cán bộ & giao ca trực thuộc module Ca trực (làm sau).',
  incidents: 'Danh sách sự cố sẽ có ở module Hàng đợi sự cố.',
  fake: 'Hồ sơ báo khống & OSINT thuộc module Báo giả (làm sau).',
  directory: 'Quản lý danh bạ thuộc module Quản trị (làm sau).',
};

export function OfficerDashboardRoute() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const officer = useMemo(() => buildOfficerProfile(user), [user]);
  const { stations, status: stationsStatus } = useStations();
  const mapApi = useRef(null);
  const [activeTab, setActiveTab] = useState('incidents');
  const [unitCoords, setUnitCoords] = useState(null);

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
      label: <>Sự Cố (0)</>,
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
    incidents: <IncidentQueuePanel />,
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
      topBar={<StatsTopBar provinceCount={34} onFakeArchive={later('fake')} />}
      map={<CommandMap ref={mapApi} officer={officer} stations={stations} onUnitLocated={setUnitCoords} />}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClearIncidents={later('incidents')}
      panel={panels[activeTab]}
    />
  );
}
