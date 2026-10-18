import { useEffect, useRef, useState } from 'react';

import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';

import styles from './officer-console.module.css';

const SIDE_KEY = 'callMapWidth';
const MIN_SIDE = 280;
const MIN_CALL = 380;
const DEFAULT_SIDE_RATIO = 0.34; // GPS widget about a third of the stage, on the right
const ACTIONS_KEY = 'consoleActionsHidden';

function readActionsHidden() {
  try {
    return localStorage.getItem(ACTIONS_KEY) === '1';
  } catch {
    return false;
  }
}

function readSideWidth() {
  try {
    const v = Number(localStorage.getItem(SIDE_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/**
 * Officer console shell (national dispatch layout):
 *
 *   [ header                                                       ]
 *   [rail] [ action bar: tiles that open the console windows        ]
 *   [rail] [ stage: map full size | during a call: call  ║  GPS map ]
 *
 * The map element keeps one place in the tree, so MapLibre is not re-created when a call starts:
 * CSS moves its cell to the right column (the "real-time GPS tracking" widget) and the call pane
 * takes the main cell. The border between them can be dragged (width remembered per browser).
 * `window` is drawn over the stage (queue, history, directories...).
 *
 * @param {{
 *   header: React.ReactNode,
 *   rail: React.ReactNode,
 *   actions: React.ReactNode,
 *   map: React.ReactNode,
 *   mapTitle: React.ReactNode,
 *   callPane?: React.ReactNode,
 *   mapOverlay?: React.ReactNode,
 *   window?: React.ReactNode,
 * }} props
 */
export function OfficerLayout({
  header,
  rail,
  actions,
  map,
  mapTitle,
  callPane,
  mapOverlay,
  window: consoleWindow,
}) {
  const inCall = !!callPane;
  const stageRef = useRef(null);
  const [sideWidth, setSideWidth] = useState(readSideWidth);
  const [dragging, setDragging] = useState(false);
  // The tile bar can be folded away (arrow at its right end) to give the map more room
  const [actionsHidden, setActionsHidden] = useState(readActionsHidden);
  const toggleActions = () =>
    setActionsHidden((hidden) => {
      try {
        localStorage.setItem(ACTIONS_KEY, hidden ? '0' : '1');
      } catch {
        // storage blocked: only lasts this session
      }
      return !hidden;
    });

  useEffect(() => {
    if (!inCall || sideWidth != null || !stageRef.current) return;
    setSideWidth(Math.round(stageRef.current.clientWidth * DEFAULT_SIDE_RATIO));
  }, [inCall, sideWidth]);

  const clamp = (w) => {
    const total = stageRef.current?.clientWidth || 0;
    return Math.round(Math.min(Math.max(w, MIN_SIDE), Math.max(MIN_SIDE, total - MIN_CALL)));
  };

  const startDrag = (e) => {
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    setDragging(true);
    const move = (ev) => setSideWidth(clamp(stage.getBoundingClientRect().right - ev.clientX));
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setSideWidth((w) => {
        try {
          localStorage.setItem(SIDE_KEY, String(w));
        } catch {
          // storage blocked: width only lasts this session
        }
        return w;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setSideWidth((w) => clamp((w || 0) + (e.key === 'ArrowLeft' ? 40 : -40)));
  };

  return (
    <div className={styles.console}>
      {header}
      <div className={styles.body}>
        <nav className={styles.rail} aria-label="Thanh công cụ cán bộ">
          {rail}
        </nav>
        <div className={styles.workspace}>
          <div className={`${styles.actionsRow} ${actionsHidden ? styles.actionsHidden : ''}`}>
            {!actionsHidden && <div className={styles.actions}>{actions}</div>}
            <button
              type="button"
              className={styles.actionsToggle}
              aria-expanded={!actionsHidden}
              aria-label={actionsHidden ? 'Hiện thanh chức năng' : 'Ẩn thanh chức năng'}
              title={actionsHidden ? 'Hiện thanh chức năng' : 'Ẩn thanh chức năng'}
              onClick={toggleActions}
            >
              <SvgIcon
                name="chevronUp"
                size="sm"
                style={actionsHidden ? { transform: 'rotate(180deg)' } : undefined}
              />
            </button>
          </div>
          <div
            ref={stageRef}
            className={`${styles.stage} ${inCall ? styles.inCall : ''} ${dragging ? styles.dragging : ''}`}
            style={inCall && sideWidth ? { '--side-width': `${sideWidth}px` } : undefined}
          >
            {inCall && (
              <section key="call" className={`${styles.panel} ${styles.callCell}`}>
                {callPane}
              </section>
            )}
            <section key="map" className={`${styles.panel} ${styles.mapCell}`}>
              <header className={styles.panelHeader}>
                <span className={styles.panelTitle}>
                  <SvgIcon name={inCall ? 'target' : 'map'} color="blue" />
                  {mapTitle}
                </span>
                {inCall && <span className={styles.panelBadge}>GPS</span>}
              </header>
              <div className={styles.mapBody}>
                {map}
                {inCall && mapOverlay}
              </div>
              {inCall && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Kéo để đổi độ rộng bản đồ"
                  tabIndex={0}
                  className={styles.handle}
                  onPointerDown={startDrag}
                  onKeyDown={onKey}
                />
              )}
            </section>
            {consoleWindow}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One rail button (icon + short label). `tone="danger"` for logout. */
export function RailButton({ icon, label, title, active, tone, onClick, buttonRef, badge }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      title={title || label}
      className={`${styles.railBtn} ${active ? styles.railActive : ''} ${tone === 'danger' ? styles.railDanger : ''}`}
      onClick={onClick}
    >
      <SvgIcon name={icon} size="sm" />
      <span className={styles.railLabel}>{label}</span>
      {badge ? <em className={styles.railBadge}>{badge}</em> : null}
    </button>
  );
}

export function RailSpacer() {
  return <div className={styles.railSpacer} />;
}

/**
 * Action-bar tile like the reference design: coloured border, title + subtitle.
 * @param {{ tone?: 'red'|'amber'|'orange'|'blue'|'cyan'|'purple'|'green', active?: boolean, count?: number }} props
 */
export function ActionTile({ icon, title, subtitle, tone = 'blue', active, count, onClick }) {
  return (
    <button
      type="button"
      className={`${styles.tile} ${styles[`tone_${tone}`] || ''} ${active ? styles.tileActive : ''}`}
      aria-pressed={!!active}
      onClick={onClick}
    >
      <span className={styles.tileIcon}>
        <SvgIcon name={icon} size="sm" />
      </span>
      <span className={styles.tileText}>
        <span className={styles.tileTitle}>{title}</span>
        <span className={styles.tileSub}>{subtitle}</span>
      </span>
      {count > 0 && <em className={styles.tileCount}>{count}</em>}
    </button>
  );
}

/**
 * Window over the stage (incident queue, history, directories). Drag it by its title bar
 * (it stays inside the stage); Esc or × closes it. On phones it covers the whole stage.
 */
export function ConsoleWindow({ title, icon, onClose, children }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const ref = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (e.target.closest?.('input, textarea, select, [role="dialog"]')) return;
      if (document.querySelector('.modal-backdrop.is-open')) return; // the modal on top closes first
      onClose();
    };
    // Capture phase: runs before the modal's own Esc handler, while the modal is still open
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const startDrag = (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const el = ref.current;
    const stage = el?.parentElement;
    if (!el || !stage) return;
    e.preventDefault();
    const start = { px: e.clientX, py: e.clientY, x: offset.x, y: offset.y };
    const rect = el.getBoundingClientRect();
    const box = stage.getBoundingClientRect();
    const min = { x: start.x + box.left - rect.left, y: start.y + box.top - rect.top };
    const max = { x: start.x + box.right - rect.right, y: start.y + box.bottom - rect.top - 48 };
    const move = (ev) => {
      const x = Math.min(Math.max(start.x + ev.clientX - start.px, min.x), Math.max(min.x, max.x));
      const y = Math.min(Math.max(start.y + ev.clientY - start.py, min.y), Math.max(min.y, max.y));
      setOffset({ x, y });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <section
      ref={ref}
      className={styles.window}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <header className={styles.windowBar} onPointerDown={startDrag}>
        <span className={styles.windowTitle}>
          {icon}
          {title}
        </span>
        <button type="button" className={styles.windowClose} aria-label="Đóng cửa sổ" onClick={onClose}>
          <SvgIcon name="x" size="sm" />
        </button>
      </header>
      <div className={styles.windowBody}>{children}</div>
    </section>
  );
}
