import { useRef, useState } from 'react';

import { useToast } from '@/components/ui/toast/toast-context';

import styles from './silent-report-bar.module.css';

/**
 * Bar under the SOS orb for someone who cannot speak (being followed, threatened): hovering (or tapping, on
 * phones) opens it with a short explanation and "Báo cáo cứu hộ trong yên lặng". The silent report itself is
 * not built yet.
 */
/** Eye-off icon + title: the same in the bar and in its invisible height copy. */
function TitleRow() {
  return (
    <>
      <span className={styles.icon} aria-hidden="true">
        <svg className="svg-ico ico-sm" viewBox="0 0 24 24">
          <path d="M2 2l20 20" />
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        </svg>
      </span>
      <span className={styles.text}>Không thể nói chuyện, đang bị theo dõi, đe doạ.</span>
    </>
  );
}

/** Room kept free above the bottom of the window for the citizen dock (fixed, over everything). */
const DOCK_ROOM_PX = 60;

export function SilentReportBar() {
  const notify = useToast().show;
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const liveRef = useRef(null);
  const moreRef = useRef(null);

  // Opens downward; only when the opened bar would reach the dock (short phone screens) it opens upward.
  const pickDirection = () => {
    const live = liveRef.current;
    const more = moreRef.current;
    if (!live || !more) return;
    const openedBottom = live.getBoundingClientRect().top + live.offsetHeight + more.scrollHeight;
    setUp(openedBottom > window.innerHeight - DOCK_ROOM_PX);
  };

  return (
    // The slot keeps the closed bar's height in the page (an invisible copy of the title row); the real bar is
    // pinned over it and opens as a layer (down, or up when the dock is in the way), so the page never gets taller.
    <div className={styles.slot}>
      <div className={`${styles.bar} ${styles.ghost}`} aria-hidden="true">
        <div className={styles.head}>
          <TitleRow />
        </div>
      </div>
      <div
        ref={liveRef}
        className={`${styles.bar} ${styles.live} ${up ? styles.up : ''} ${open ? styles.open : ''}`}
        onMouseEnter={pickDirection}
        onFocus={pickDirection}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          type="button"
          className={styles.head}
          aria-expanded={open}
          onClick={() => {
            pickDirection();
            setOpen(true);
          }}
        >
          <TitleRow />
        </button>
        <div className={styles.more}>
          <div ref={moreRef}>
            <p className={styles.hint}>
              Báo cáo yên lặng là trường hợp đặc biệt không thể gọi thoại, nói chuyện, chỉ có thể truyền tin
              bằng tin nhắn, hình ảnh, hoặc quay video nhưng giữ màn hình tắt tránh bị chú ý...
            </p>
            <button
              type="button"
              className={styles.action}
              tabIndex={open ? 0 : -1}
              onClick={() => {
                notify('Tính năng báo cáo cứu hộ trong yên lặng đang chờ phát triển.', { tone: 'info' });
              }}
            >
              Báo cáo cứu hộ trong yên lặng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
