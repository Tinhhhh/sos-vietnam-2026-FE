import styles from '@/components/layouts/citizen-layout/citizen-desktop.module.css';

const HOTLINES = [
  {
    number: '113',
    name: 'Công an',
    tag: 'Khẩn cấp',
    color: '#f87171',
    tint: 'rgba(239, 68, 68, 0.18)',
    border: 'rgba(239, 68, 68, 0.35)',
    icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  },
  {
    number: '114',
    name: 'Cứu hoả',
    tag: 'Cứu nạn',
    color: '#fbbf24',
    tint: 'rgba(245, 158, 11, 0.18)',
    border: 'rgba(245, 158, 11, 0.35)',
    icon: <path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-10z" />,
  },
  {
    number: '115',
    name: 'Cấp cứu',
    tag: 'Y tế',
    color: '#34d399',
    tint: 'rgba(16, 185, 129, 0.18)',
    border: 'rgba(16, 185, 129, 0.35)',
    icon: <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" />,
  },
];

/** 113 / 114 / 115 call cards under the SOS orb (desktop only; phones have the dialer anyway). */
export function HotlineCards() {
  return (
    <div className={styles.hotlines}>
      {HOTLINES.map((h) => (
        <a
          key={h.number}
          href={`tel:${h.number}`}
          className={`${styles.hotline} ${styles.glass}`}
          style={{ borderColor: h.border }}
          title={`Gọi ${h.number} - ${h.name}`}
        >
          <span className={styles.hotlineMain}>
            <span
              className={styles.hotlineIcon}
              style={{ background: h.tint, border: `1px solid ${h.border}`, color: h.color }}
            >
              <svg className="svg-ico ico-sm" viewBox="0 0 24 24" aria-hidden="true">
                {h.icon}
              </svg>
            </span>
            <span>
              <span className={styles.hotlineNum} style={{ color: h.color, display: 'block' }}>
                {h.number}
              </span>
              <span className={styles.hotlineName} style={{ display: 'block' }}>
                {h.name}
              </span>
            </span>
          </span>
          <span className={styles.hotlineTag} style={{ color: h.color, background: h.tint }}>
            {h.tag}
          </span>
        </a>
      ))}
    </div>
  );
}
