import styles from './citizen-dock.module.css';

/** Bottom floating "liquid glass" dock of the citizen portal. */
export function CitizenDock({
  onInstallApp,
  onOpenFamilySos,
  onOpenSurvivalGuide,
  onOpenLookup,
  dispatcherHref,
}) {
  return (
    <header className={styles.headerNavCenter}>
      <nav className={`${styles.navCenterPill} liquid-glass`} aria-label="Tiện ích">
        <button
          type="button"
          className={styles.navPillItem}
          title="Tạo lối tắt ra Màn hình chính"
          onClick={onInstallApp}
        >
          <svg className="svg-ico ico-md ico-emerald" viewBox="0 0 24 24" aria-hidden="true">
            <rect
              x="5"
              y="2"
              width="14"
              height="20"
              rx="2"
              ry="2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <line x1="12" y1="18" x2="12.01" y2="18" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 7v6m-3-3l3 3 3-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>{' '}
          Cài Lối Tắt
        </button>

        <button type="button" className={styles.navPillItem} onClick={onOpenFamilySos}>
          <svg className="svg-ico ico-md ico-blue" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>{' '}
          SOS Người Thân
        </button>

        <button type="button" className={styles.navPillItem} onClick={onOpenSurvivalGuide}>
          <svg className="svg-ico ico-md ico-amber" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>{' '}
          Cẩm Nang
        </button>

        <button
          type="button"
          className={styles.navPillItem}
          title="Xem lại thông tin cứu hộ bằng mã tra cứu"
          onClick={onOpenLookup}
        >
          <svg className="svg-ico ico-md ico-blue" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>{' '}
          Tra Cứu
        </button>

        <a
          href={dispatcherHref}
          className={`${styles.navPillItem} ${styles.btnPillDispatcherLink}`}
          target="_blank"
          rel="noopener"
        >
          <svg className="svg-ico ico-md ico-blue" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>{' '}
          Cổng Cán Bộ
        </a>
      </nav>
    </header>
  );
}
