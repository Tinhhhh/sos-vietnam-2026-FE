import { useState } from 'react';

import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';

import styles from './stats-top-bar.module.css';

const AGENCY_PILLS = [
  {
    agency: 'police',
    cls: styles.policePill,
    icon: 'shield',
    color: 'blue',
    label: 'CA',
    title: 'Công An Khu Vực',
  },
  {
    agency: 'csgt',
    cls: styles.csgtPill,
    icon: 'car',
    color: 'amber',
    label: 'GT',
    title: 'Cảnh Sát Giao Thông',
  },
  { agency: 'fire', cls: styles.firePill, icon: 'flame', color: 'red', label: 'PC', title: 'PCCC & CNCH' },
  {
    agency: 'hospital',
    cls: styles.hospitalPill,
    icon: 'building',
    color: 'emerald',
    label: '115',
    title: 'Cấp Cứu Y Tế 115',
  },
  {
    agency: 'traffic-rescue',
    cls: styles.rescuePill,
    icon: 'wrench',
    color: 'amber',
    label: 'CH',
    title: 'Cứu Hộ Giao Thông',
  },
];

/**
 * Strip above the map (legacy #tacticalMapTopBar): national map badge, resolved
 * rate and per-agency incident counters. Incident numbers arrive with the queue
 * module; until then every counter is 0.
 *
 * @param {{ provinceCount?: number, counts?: Record<string, number>, resolved?: {done:number,total:number}, fakeAlarmCount?: number, onFakeArchive?: () => void }} props
 */
export function StatsTopBar({ provinceCount, counts = {}, resolved, fakeAlarmCount = 0, onFakeArchive }) {
  const [active, setActive] = useState('all');
  const total = AGENCY_PILLS.reduce((sum, p) => sum + (counts[p.agency] || 0), 0);
  const rate = resolved?.total
    ? `${Math.round((resolved.done / resolved.total) * 100)}% (${resolved.done}/${resolved.total})`
    : '--';

  return (
    <div className={styles.tacticalMapTopBar}>
      <div className={styles.tacticalStripeLeft}>
        <div
          className={`${styles.topBarPill} ${styles.nationalBannerPill}`}
          title={`Bản đồ Quốc gia 2026 — ${provinceCount ?? 34} Tỉnh thành`}
        >
          <SvgIcon name="map" color="purple" className={styles.nationalFlagIcon} />
          <span className={styles.nationalBadgeTitle}>QUỐC GIA 2026</span>
          <span className={styles.nationalBadgeSub}>
            {provinceCount ? `${provinceCount} TỈNH` : 'ĐANG NẠP ĐỊA GIỚI'}
          </span>
        </div>

        <div className={`${styles.topBarPill} ${styles.resolvedPill}`} title="Tỷ lệ đã xử lý">
          <SvgIcon name="users" color="emerald" className={styles.topBarIcon} />
          <span className={styles.topBarLabel}>
            Xử lý: <b>{rate}</b>
          </span>
        </div>
      </div>

      <div className={styles.tacticalStripeCenter}>
        <div
          className={`${styles.topBarPill} ${styles.totalPill} ${styles.statCardBtn} ${active === 'all' ? styles.isActive : ''}`}
          title="Tổng số ca sự cố"
          style={{ cursor: 'pointer' }}
          onClick={() => setActive('all')}
        >
          <span className={styles.topBarIcon}>Tổng</span>
          <span className={styles.topBarLabel}>
            <b>{total}</b>
          </span>
        </div>

        {AGENCY_PILLS.map((p) => (
          <div
            key={p.agency}
            className={`${styles.topBarPill} ${p.cls} ${styles.statCardBtn} ${active === p.agency ? styles.isActive : ''}`}
            title={p.title}
            onClick={() => setActive(p.agency)}
          >
            <SvgIcon name={p.icon} color={p.color} className={styles.topBarIcon} />
            <span className={styles.topBarLabel}>
              {p.label} <b>{counts[p.agency] || 0}</b>
            </span>
          </div>
        ))}

        <div
          className={`${styles.topBarPill} ${styles.statCardBtn} ${styles.fakeArchivePill}`}
          title="Xem Danh Sách Hồ Sơ Báo Khống & Dấu Vết OSINT"
          style={{
            background: 'rgba(239, 68, 68, 0.18)',
            borderColor: 'rgba(239, 68, 68, 0.5)',
            color: '#fca5a5',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
          }}
          onClick={onFakeArchive}
        >
          <span className={styles.topBarIcon}>🚨</span>
          <span className={styles.topBarLabel}>
            Báo Khống <b>{fakeAlarmCount}</b>
          </span>
        </div>
      </div>
    </div>
  );
}
