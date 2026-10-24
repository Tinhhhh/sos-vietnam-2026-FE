import { useEffect, useState } from 'react';

import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';

import { getIncidentHistory } from '../api/incidents';
import { TYPE_LOOK } from '../utils/incident-model';
import { DETAIL_BUTTON_STYLE, PAGE_SIZE } from '../utils/list-paging';
import styles from './incident-panels.module.css';
import { Pager, RangeTabs } from './list-controls';

const FILTERS = [
  { key: 'all', label: 'Tất cả', agency: null },
  { key: 'police', label: 'Công an', agency: 'POLICE' },
  { key: 'csgt', label: 'CSGT', agency: 'CSGT' },
  { key: 'fire', label: 'PCCC & CNCH', agency: 'FIRE' },
];

const STATUS_LOOK = {
  RESOLVED: { bg: 'rgba(16, 185, 129, 0.18)', fg: '#34d399', border: 'rgba(16, 185, 129, 0.45)' },
  CANCELLED: { bg: 'rgba(148, 163, 184, 0.14)', fg: '#cbd5e1', border: 'rgba(148, 163, 184, 0.35)' },
};

const TIME = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const fmt = (d) => (d ? TIME.format(d) : '--');

/**
 * Window "Lịch sử sự cố": closed incidents (resolved / cancelled) of the officer's area, from be-v2
 * GET /incidents/history, PAGE_SIZE per page, filtered by 1 / 7 / 30 days, search and (command
 * centre only) force.
 *
 * @param {{ agency: string, onExportExcel?: () => void, onClear?: () => void, onOpenDetail?: (id) => void,
 *           onOpenDocument?: (id) => void, refreshKey?: any }} props
 *   agency = officer agency key ('all' for the command centre); onOpenDetail opens the "Chi tiết" box;
 *   onOpenDocument opens the report document of a resolved incident (create / view); refreshKey reloads the page.
 */
export function IncidentHistoryPanel({
  agency,
  onExportExcel,
  onClear,
  onOpenDetail,
  onOpenDocument,
  refreshKey,
}) {
  const isAdmin = agency === 'all';
  const [days, setDays] = useState(7);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  // Result of the last finished request; "loading" = its key is not the current one
  const [result, setResult] = useState({
    key: null,
    status: 'loading',
    items: [],
    total: 0,
    totalPages: 0,
    error: null,
  });
  const agencyParam = isAdmin ? FILTERS.find((f) => f.key === filter)?.agency : null;
  const requestKey = `${days}|${query}|${agencyParam}|${page}|${reloadKey}|${refreshKey ?? ''}`;
  const state = result.key === requestKey ? result : { ...result, status: 'loading', error: null };

  // Search after the officer stops typing
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let alive = true;
    getIncidentHistory({ days, q: query, agency: agencyParam, pageNo: page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (!alive) return;
        // The page emptied (e.g. narrower range): go back to the last real page
        if (res.items.length === 0 && page > 0 && res.totalPages > 0) {
          setPage(res.totalPages - 1);
          return;
        }
        setResult({ key: requestKey, status: 'ready', ...res, error: null });
      })
      .catch(
        (err) => alive && setResult((r) => ({ ...r, key: requestKey, status: 'error', error: err.message })),
      );
    return () => {
      alive = false;
    };
  }, [days, query, agencyParam, page, requestKey]);

  const changeRange = (d) => {
    setDays(d);
    setPage(0);
  };
  const reload = () => setReloadKey((k) => k + 1);

  return (
    <div
      className={styles.panelHistoryView}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
    >
      <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* buttons: flex 0 0 auto, the legacy .btn-refresh-loc grows to 100% on phones and squeezes the search */}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="search"
            className="input-field"
            placeholder="Tìm mã SOS, người báo, SĐT, địa chỉ, xã/phường..."
            aria-label="Tìm trong lịch sử"
            style={{ flex: 1, padding: '7px 10px', fontSize: 12, minWidth: 0, boxSizing: 'border-box' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="btn-refresh-loc"
            title="Tải lại"
            aria-label="Tải lại lịch sử"
            style={{ flex: '0 0 auto', padding: '4px 9px' }}
            onClick={reload}
          >
            <SvgIcon name="refresh" color="blue" />
          </button>
          <button
            type="button"
            className="btn-refresh-loc"
            title="Xuất bảng kê lịch sử ra Excel (.xlsx)"
            aria-label="Xuất Excel"
            style={{ flex: '0 0 auto', padding: '4px 9px', color: '#34d399', borderColor: '#10b981' }}
            onClick={onExportExcel}
          >
            <SvgIcon name="file" color="emerald" />
          </button>
          <button
            type="button"
            className="btn-refresh-loc"
            title="Dọn dẹp danh sách lịch sử"
            aria-label="Dọn dẹp lịch sử"
            style={{
              flex: '0 0 auto',
              padding: '4px 9px',
              color: '#f87171',
              borderColor: 'rgba(239,68,68,0.4)',
            }}
            onClick={onClear}
          >
            <SvgIcon name="trash" color="red" />
          </button>
        </div>
        <RangeTabs value={days} onChange={changeRange} />
        {isAdmin && (
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`btn-refresh-loc ${styles.historyFilterBtn} ${filter === f.key ? `${styles.isActive} is-active` : ''}`}
                style={{ flex: '0 0 auto', padding: '3px 8px', fontSize: 11 }}
                aria-pressed={filter === f.key}
                onClick={() => {
                  setFilter(f.key);
                  setPage(0);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className={styles.incidentQueueList}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingRight: 2,
          opacity: state.status === 'loading' && state.items.length > 0 ? 0.55 : 1,
        }}
        aria-busy={state.status === 'loading'}
      >
        {state.status === 'error' ? (
          <EmptyNote title="Không tải được lịch sử" text={state.error}>
            <button type="button" className="btn-refresh-loc" style={{ marginTop: 10 }} onClick={reload}>
              Thử lại
            </button>
          </EmptyNote>
        ) : state.status === 'ready' && state.items.length === 0 ? (
          <EmptyNote
            title={`Không có ca nào đã đóng trong ${days} ngày qua`}
            text={query ? `Không khớp với "${query}".` : 'Ca hoàn tất hoặc bị huỷ sẽ được lưu ở đây.'}
          />
        ) : (
          state.items.map((item) => (
            <HistoryCard
              key={item.id}
              item={item}
              onOpenDetail={onOpenDetail}
              onOpenDocument={onOpenDocument}
            />
          ))
        )}
        {state.status === 'loading' && state.items.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Đang tải...</div>
        )}
      </div>

      <Pager
        page={page}
        totalPages={state.totalPages}
        onPage={setPage}
        disabled={state.status === 'loading'}
      />
    </div>
  );
}

const DOC_LOOK = {
  NONE: {
    label: 'Tạo văn bản',
    title: 'Lập văn bản báo cáo cho ca này',
    color: '#34d399',
    border: '#10b981',
  },
  DRAFT: {
    label: 'Xem văn bản',
    title: 'Văn bản đã lập, chưa đủ chữ ký 2 bên',
    color: '#fbbf24',
    border: '#f59e0b',
  },
  SIGNED: { label: 'Xem văn bản', title: 'Văn bản đã đủ chữ ký 2 bên', color: '#93c5fd', border: '#3b82f6' },
};

function HistoryCard({ item, onOpenDetail, onOpenDocument }) {
  const doc = DOC_LOOK[item.documentStatus] || DOC_LOOK.NONE;
  const look = TYPE_LOOK[item.type] || TYPE_LOOK.POLICE;
  const status = STATUS_LOOK[item.status] || STATUS_LOOK.CANCELLED;
  const location =
    item.address || [item.ward, item.province].filter(Boolean).join(', ') || 'Chưa xác định vị trí';
  return (
    <div className={styles.queueCard}>
      <div className={styles.queueCardTop}>
        <span className={`${styles.queueAgencyTag} ${styles.police}`}>
          {look.icon} {look.label}
        </span>
        <span className={styles.queueTime}>
          {fmt(item.createdAt)} · {item.id}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '6px 0 4px' }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            padding: '1px 7px',
            borderRadius: 4,
            background: status.bg,
            color: status.fg,
            border: `1px solid ${status.border}`,
          }}
        >
          {item.statusLabel}
        </span>
        {item.cancelReasonLabel && (
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{item.cancelReasonLabel}</span>
        )}
        {onOpenDetail && (
          <button
            type="button"
            style={DETAIL_BUTTON_STYLE}
            title="Xem chi tiết ca, ảnh / video người dân gửi"
            onClick={() => onOpenDetail(item.id)}
          >
            Chi tiết
          </button>
        )}
        {onOpenDocument && item.status === 'RESOLVED' && (
          <button
            type="button"
            style={{
              ...DETAIL_BUTTON_STYLE,
              marginLeft: 0,
              color: doc.color,
              border: `1px solid ${doc.border}`,
            }}
            title={doc.title}
            onClick={() => onOpenDocument(item.id)}
          >
            {doc.label}
            {item.documentStatus === 'DRAFT'
              ? ' · chưa ký đủ'
              : item.documentStatus === 'SIGNED'
                ? ' · đã ký'
                : ''}
          </button>
        )}
      </div>
      {item.tags.length > 0 && (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#f1f5f9' }}>{item.tags.join(', ')}</div>
      )}
      <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2 }}>{location}</div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2px 12px',
          marginTop: 6,
          fontSize: 11,
          color: '#94a3b8',
        }}
      >
        <span>Người báo: {item.citizenName || 'Người dân'}</span>
        {item.handlerName && <span>Cán bộ: {item.handlerName}</span>}
        {item.dispatchCount > 0 && <span>{item.dispatchCount} đơn vị điều động</span>}
        <span>Đóng: {fmt(item.closedAt)}</span>
      </div>
    </div>
  );
}

function EmptyNote({ title, text, children }) {
  return (
    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 15px' }}>
      <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}>
        <SvgIcon name="file" size="2xl" style={{ color: 'rgba(148,163,184,0.5)' }} />
      </div>
      <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{title}</div>
      {text && <div style={{ fontSize: 12, marginTop: 4 }}>{text}</div>}
      {children}
    </div>
  );
}
