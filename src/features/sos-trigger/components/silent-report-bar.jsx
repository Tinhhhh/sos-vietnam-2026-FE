import { useState } from 'react';

import { useToast } from '@/components/ui/toast/toast-context';

import styles from './silent-report-bar.module.css';

/**
 * Bar under the SOS orb for someone who cannot speak (being followed, threatened): hovering (or tapping, on
 * phones) opens it and shows "Báo cáo cứu hộ trong yên lặng". The silent report itself is not built yet.
 */
export function SilentReportBar() {
  const notify = useToast().show;
  const [open, setOpen] = useState(false);

  return (
    <div className={`${styles.bar} ${open ? styles.open : ''}`} onMouseLeave={() => setOpen(false)}>
      <button type="button" className={styles.head} aria-expanded={open} onClick={() => setOpen(true)}>
        <span className={styles.icon} aria-hidden="true">
          <svg className="svg-ico ico-sm" viewBox="0 0 24 24">
            <path d="M2 2l20 20" />
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          </svg>
        </span>
        <span className={styles.text}>Không thể nói chuyện, đang bị theo dõi, đe doạ.</span>
      </button>
      <div className={styles.more}>
        <div>
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
  );
}
