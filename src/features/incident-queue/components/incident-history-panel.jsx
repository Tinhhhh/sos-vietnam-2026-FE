import { useEffect, useState } from 'react';

import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';

import styles from './incident-panels.module.css';

const FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'police', label: 'Công an khu vực' },
  { key: 'csgt', label: 'CSGT' },
  { key: 'fire', label: 'PCCC & CNCH' },
  { key: 'hospital', label: '115' },
  { key: 'traffic-rescue', label: 'Cứu Hộ' },
];

/**
 * Sidebar tab "Lịch Sử" (legacy #panelHistoryView): search, agency filter and the
 * archive list. Archived incidents arrive with the dispatch module.
 *
 * @param {{ agency: string, onExportExcel?: () => void, onClear?: () => void }} props
 *   agency = officer agency ('all' for the command centre); officers only see their own filter.
 */
export function IncidentHistoryPanel({ agency, onExportExcel, onClear }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(agency === 'all' ? 'all' : agency);
  const [expanded, setExpanded] = useState(false);
  const filters = agency === 'all' ? FILTERS : FILTERS.filter((f) => f.key === agency);

  // Mobile: the pull handle stretches the history panel over the sidebar header.
  useEffect(() => {
    document.body.classList.toggle('has-expanded-history', expanded);
    return () => document.body.classList.remove('has-expanded-history');
  }, [expanded]);

  return (
    <div
      className={styles.panelHistoryView}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
    >
      <div
        className={`${styles.historyPullHandle} ${styles.historyPullHandleRoot}`}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label="Mở rộng hoặc thu gọn lịch sử"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className={styles.historyPullPill} />
        <div className={styles.historyPullText}>
          <SvgIcon
            name="chevronUp"
            color="blue"
            style={{ transform: expanded ? 'rotate(180deg)' : undefined }}
          />
          <span>{expanded ? 'Kéo xuống để thu gọn' : 'Kéo lên để xem rộng'}</span>
        </div>
      </div>

      <div className={styles.sidebarHeader} style={{ paddingTop: 4, flexWrap: 'wrap', gap: 6 }}>
        <div
          className={styles.queueTitle}
          style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <SvgIcon name="file" color="blue" /> Lịch Sử Sự Cố Đã Xử Lý
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className="btn-refresh-loc"
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 800,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.25))',
              borderColor: '#10b981',
              color: '#34d399',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Xuất toàn bộ bảng kê các ca sự cố lịch sử ra file Excel (.xlsx)"
            onClick={onExportExcel}
          >
            <SvgIcon name="file" color="emerald" /> Xuất Excel (.xlsx)
          </button>
          <button
            type="button"
            className="btn-refresh-loc"
            title="Dọn dẹp danh sách lịch sử"
            style={{
              padding: '4px 6px',
              fontSize: 10,
              color: '#f87171',
              borderColor: 'rgba(239,68,68,0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
            onClick={onClear}
          >
            <SvgIcon name="trash" color="red" /> Dọn dẹp
          </button>
        </div>
      </div>

      <div
        style={{
          padding: '0 10px 8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <input
          type="text"
          className="input-field"
          placeholder="Tìm theo mã SOS, người dân, địa chỉ, xã/phường..."
          style={{ padding: '6px 10px', fontSize: 11, width: '100%', boxSizing: 'border-box' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', overflowX: 'auto', paddingBottom: 2 }}>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`btn-refresh-loc ${styles.historyFilterBtn} ${filter === f.key ? `${styles.isActive} is-active` : ''}`}
              style={{ padding: '3px 6px', fontSize: 10 }}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`${styles.incidentQueueList} ${styles.incidentHistoryListRoot}`}
        style={{ flex: 1, overflowY: 'auto' }}
      >
        <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '30px 15px' }}>
          <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}>
            <SvgIcon name="file" size="2xl" style={{ color: 'rgba(148,163,184,0.5)' }} />
          </div>
          <div>Chưa có ca sự cố nào trong lịch sử</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            Khi các ca cứu hộ được xử lý xong và bấm Hoàn Tất, hồ sơ sẽ tự động chuyển vào đây để lưu trữ &
            xuất file.
          </div>
        </div>
      </div>
    </div>
  );
}
