import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';

import styles from './settings-dialog.module.css';

/** "Đổi mật khẩu" -> "doi mat khau" so the search ignores Vietnamese accents. */
function fold(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const PHONE_QUERY = '(max-width: 720px)';
const subscribePhone = (cb) => {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const isPhoneNow = () => window.matchMedia(PHONE_QUERY).matches;

const Chevron = ({ left }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={left ? styles.backIcon : styles.chevron}>
    <polyline points={left ? '15 18 9 12 15 6' : '9 6 15 12 9 18'} />
  </svg>
);

/**
 * Settings window: left = profile card on top, grouped sections, search box pinned at the bottom
 * (translucent, blurs the rows scrolling under it); right = the picked section's content (like a
 * desktop app's settings). On phones (iOS style): a full-screen list of grouped rounded cards
 * (icon, label, chevron); tapping an item opens its page with a back button.
 * Sections are given by the caller, so features stay independent:
 *   groups = [{ label, items: [{ id, icon, color?, label, keywords?, render: () => node }] }]
 *   profile = { initials, name, sub, itemId? }  (optional card; tapping it opens item `itemId`)
 *   item.hidden: not listed in the menu (reached another way, e.g. the profile card)
 * Only the picked section is rendered. Sits under the legacy Modal (z-index 100000), so dialogs a
 * section opens (change password...) show on top of it.
 */
export function SettingsDialog({ open, onClose, title = 'Cài đặt', groups, profile }) {
  const titleId = useId();
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(null);
  const panelRef = useRef(null);
  const activeIdRef = useRef(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  const isPhone = useSyncExternalStore(subscribePhone, isPhoneNow, () => false);
  // closing the window on a phone: next open starts from the list
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open && isPhone) setActiveId(null);
  }

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) => !it.hidden && (!q || fold(`${g.label} ${it.label} ${it.keywords || ''}`).includes(q)),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const picked = allItems.find((it) => it.id === activeId) || null;
  // desktop always shows a section; phone shows the list until an item is tapped
  const active = isPhone ? picked : picked || allItems[0] || null;
  const onPage = isPhone && !!active;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      // a dialog opened from a section handles its own Escape first
      if (e.key === 'Escape' && !document.querySelector('.modal-backdrop.is-open')) {
        if (isPhoneNow() && activeIdRef.current) setActiveId(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className={`${styles.header} ${isPhone ? styles.headerPhone : ''}`}>
          {onPage ? (
            <button
              type="button"
              className={styles.back}
              aria-label="Quay lại"
              onClick={() => setActiveId(null)}
            >
              <Chevron left />
            </button>
          ) : null}
          <h2 id={titleId} className={styles.title}>
            {onPage ? active.label : title}
          </h2>
          <button type="button" className={styles.close} aria-label="Đóng" onClick={onClose}>
            <SvgIcon name="x" size="sm" />
          </button>
        </header>

        <div className={`${styles.body} ${onPage ? styles.bodyPage : ''}`}>
          <nav className={styles.nav} aria-label="Mục cài đặt">
            {profile && (
              <button
                type="button"
                className={`${styles.profile} ${profile.itemId && active?.id === profile.itemId ? styles.profileActive : ''}`}
                title={profile.itemId ? 'Xem hồ sơ' : undefined}
                onClick={profile.itemId ? () => setActiveId(profile.itemId) : undefined}
              >
                <span className={styles.avatar} aria-hidden="true">
                  {profile.initials}
                </span>
                <span className={styles.profileText}>
                  <span className={styles.profileName}>{profile.name}</span>
                  <span className={styles.profileSub}>{profile.sub}</span>
                </span>
                {profile.itemId && <Chevron />}
              </button>
            )}
            <div className={styles.navScroll}>
              {filtered.map((g) => (
                <div key={g.label} className={styles.group}>
                  <div className={styles.groupLabel}>{g.label}</div>
                  <div className={styles.groupCard}>
                    {g.items.map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        className={`${styles.navItem} ${active?.id === it.id ? styles.navActive : ''}`}
                        aria-current={active?.id === it.id ? 'page' : undefined}
                        onClick={() => setActiveId(it.id)}
                      >
                        <SvgIcon name={it.icon} size="sm" color={it.color} />
                        <span className={styles.navLabel}>{it.label}</span>
                        <Chevron />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <div className={styles.empty}>Không có mục nào khớp</div>}
              {/* pinned to the bottom of the list (sticky): rows scrolling under it show blurred */}
              <div className={styles.searchDock}>
                <label className={styles.search}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    type="search"
                    placeholder="Tìm kiếm"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
            </div>
          </nav>

          {active && (
            <section className={styles.content} aria-label={active.label}>
              {active.render()}
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** A titled block inside a section ("General", "Code appearance" in the reference). */
export function SettingsSection({ title, children }) {
  return (
    <div className={styles.section}>
      {title && <h3 className={styles.sectionTitle}>{title}</h3>}
      {children}
    </div>
  );
}

/** One setting: title + muted description on the left, the control on the right. */
export function SettingsRow({ title, desc, children }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <div className={styles.rowTitle}>{title}</div>
        {desc && <div className={styles.rowDesc}>{desc}</div>}
      </div>
      {children && <div className={styles.rowControl}>{children}</div>}
    </div>
  );
}

/**
 * Wraps a panel built for the console windows (flex: 1 + its own scrolling list) so it takes the
 * remaining height of the section and scrolls inside, instead of growing the whole section.
 */
export function SettingsFill({ children }) {
  return <div className={styles.fill}>{children}</div>;
}

/** @param {{ variant?: 'primary' | 'secondary' }} props */
export function SettingsButton({ variant = 'secondary', className = '', ...props }) {
  return (
    <button
      type="button"
      className={`${variant === 'primary' ? styles.btnPrimary : styles.btn} ${className}`}
      {...props}
    />
  );
}

export function SettingsSelect({ className = '', ...props }) {
  return <select className={`${styles.select} ${className}`} {...props} />;
}
