import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';

import styles from './officer-layout.module.css';
import { useTacticalLayout } from './use-tactical-layout';

const TAB_ID_CLASS = {
  incidents: styles.tabBtnIncidents,
  history: styles.tabBtnHistory,
  stations: styles.tabBtnStations,
  enterprises: styles.tabBtnEnterprises,
  hospitals: styles.tabBtnHospitals,
};

/**
 * Officer console shell (legacy dispatcher.html .dispatcher-layout):
 * header, map area (top bar + map), right sidebar with tabs, detail panel
 * (3-zone layout) and the mobile tab bar.
 *
 * @param {{
 *   header: React.ReactNode,
 *   topBar: React.ReactNode,
 *   map: React.ReactNode,
 *   tabs: { key: string, label: React.ReactNode, icon: React.ReactNode, title?: string }[],
 *   activeTab: string,
 *   onTabChange: (key: string) => void,
 *   onClearIncidents?: () => void,
 *   panel: React.ReactNode,
 *   queueCount?: number,
 * }} props
 */
export function OfficerLayout({
  header,
  topBar,
  map,
  tabs,
  activeTab,
  onTabChange,
  onClearIncidents,
  panel,
  queueCount = 0,
}) {
  const { mode, mobileView, setMobileView } = useTacticalLayout({ incidentSelected: false });

  const goMobile = (view) => {
    setMobileView(view);
    if (view === 'queue' && activeTab !== 'incidents' && activeTab !== 'history') onTabChange('incidents');
  };

  return (
    <>
      {header}

      <div className={styles.dispatcherLayout}>
        <div className={styles.dispatcherMapArea}>
          {topBar}
          <div className={styles.dispatcherMapCanvasWrap}>{map}</div>
        </div>

        <aside className={`${styles.dispatcherSidebar} ${styles.dispatcherSidebarRoot} liquid-glass`}>
          <div className={styles.sidebarHeaderNew}>
            <div className={styles.sidebarTitleGroup}>
              <h2 className={styles.sidebarMainTitle}>Danh Sách Sự Cố</h2>
            </div>
            <div className={styles.sidebarHeaderActions}>
              <button
                type="button"
                className={styles.sidebarViewAllBtn}
                title="Xóa / Dọn dẹp danh sách sự cố"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={onClearIncidents}
              >
                <SvgIcon name="trash" color="red" /> Xóa
              </button>
            </div>
          </div>

          <div className={`${styles.sidebarTabsNav} ${styles.sidebarTabsNavRoot}`}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                title={tab.title}
                className={`${styles.sidebarTabBtn} ${TAB_ID_CLASS[tab.key] || ''} ${activeTab === tab.key ? styles.isActive : ''}`}
                onClick={() => onTabChange(tab.key)}
              >
                {tab.icon}
                <span className={styles.tabBtnText}>{tab.label}</span>
              </button>
            ))}
          </div>

          {panel}
        </aside>

        <section
          className={`${styles.tacticalDetailPanel} ${styles.tacticalDetailPanelRoot}`}
          aria-label="Chi tiết hồ sơ sự cố"
        >
          <div className={styles.tacticalDetailHeader}>
            <h2 className={styles.tacticalDetailTitle}>
              <span className={styles.tacDot} /> CHI TIẾT SỰ CỐ TÁC CHIẾN
            </h2>
          </div>
          <div className={styles.tacticalDetailBody}>
            <div className={`${styles.tacticalDetailEmpty} ${styles.tacticalDetailEmptyRoot}`}>
              <div className={styles.tacEmptyRing}>
                <SvgIcon name="clock" size="lg" />
              </div>
              <strong>Chưa chọn sự cố</strong>
              <span>Nhấp vào sự cố trong danh sách hoặc trên bản đồ để chỉ huy điều phối.</span>
            </div>
          </div>
        </section>
      </div>

      {mode === 'mobile' && (
        <nav
          className={`${styles.tacticalTabbar} ${styles.tacticalTabbarRoot}`}
          aria-label="Điều hướng bảng điều hành"
        >
          <button
            type="button"
            className={mobileView === 'map' ? styles.isActive : ''}
            onClick={() => goMobile('map')}
          >
            <SvgIcon name="map" size="sm" />
            <span>Bản đồ</span>
          </button>
          <button
            type="button"
            className={mobileView === 'queue' ? styles.isActive : ''}
            onClick={() => goMobile('queue')}
          >
            <SvgIcon name="alert" size="sm" />
            <span>Sự cố</span>
            <em className={`${styles.tacTabBadge} ${queueCount > 0 ? styles.isVisible : ''}`}>
              {queueCount}
            </em>
          </button>
          <button
            type="button"
            className={mobileView === 'detail' ? styles.isActive : ''}
            onClick={() => goMobile('detail')}
          >
            <SvgIcon name="file" size="sm" />
            <span>Chi tiết</span>
          </button>
        </nav>
      )}
    </>
  );
}
