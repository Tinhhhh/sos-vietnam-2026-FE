import { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';
import { useToast } from '@/components/ui/toast/toast-context';

import { claimIncident, getIncidentDetail, requestDispatch } from '../api/incidents';
import styles from './incident-detail.module.css';

const TIME = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const fmt = (d) => (d ? TIME.format(d) : null);

const STATUS_TONE = {
  PENDING: styles.toneRed,
  VERIFYING: styles.toneAmber,
  RESOLVING: styles.toneBlue,
  RESOLVED: styles.toneGreen,
  CANCELLED: styles.toneGray,
};

/**
 * "Chi tiết" box of one incident (queue and history windows): info, photos / videos / audio the
 * citizen sent (click a photo to enlarge), dispatched units and who took / released the case.
 *
 * Footer (queue only, `live` = the live queue card): "Tiếp nhận ca" while nobody holds it,
 * "Yêu cầu điều động" while the officer is verifying it. History cases have no footer.
 *
 * @param {{ incidentId: string|null, onClose: () => void,
 *           live?: object|null, holding?: object|null, onChange?: (incident) => void,
 *           onRequestDispatch?: (incident) => void, onOpenDispatch?: (incident) => void }} props
 *   onRequestDispatch = confirm dialog + dispatch window, onOpenDispatch = "Chi tiết điều động".
 *   live = the incident from the queue (heldByMe, canHandle...), holding = the case the officer holds.
 */
export function IncidentDetailDialog({
  incidentId,
  onClose,
  live,
  holding,
  onChange,
  onRequestDispatch,
  onOpenDispatch,
}) {
  const toast = useToast();
  // Result of the last request; it belongs to `key` (a stale one shows as loading)
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const [reload, setReload] = useState(0);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const requestKey = incidentId ? `${incidentId}|${reload}` : null;
  const loading = !!incidentId && result.key !== requestKey && !result.data;
  const data = result.data && result.data.id === incidentId ? result.data : null;
  const error = result.key === requestKey ? result.error : null;

  useEffect(() => {
    if (!incidentId) return undefined;
    let alive = true;
    getIncidentDetail(incidentId)
      .then((d) => alive && setResult({ key: requestKey, data: d, error: null }))
      .catch((err) => alive && setResult({ key: requestKey, data: null, error: err.message }));
    return () => {
      alive = false;
    };
  }, [incidentId, requestKey]);

  const act = async (fn, success) => {
    setBusy(true);
    try {
      const updated = await fn(incidentId);
      if (updated) onChange?.(updated);
      toast.show(success, { tone: 'success' });
      setReload((n) => n + 1);
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setPreview(null);
    onClose();
  };

  return (
    <Modal
      open={!!incidentId}
      onClose={preview ? () => setPreview(null) : close}
      solid
      containerStyle={{ maxWidth: 760 }}
      title={<span className={styles.title}>Chi tiết ca {incidentId || ''}</span>}
    >
      {loading && <div className={styles.note}>Đang tải chi tiết...</div>}
      {error && <div className={styles.error}>Không tải được chi tiết ca: {error}</div>}
      {data && <DetailBody data={data} onPreview={setPreview} />}
      {data && live && (
        <DetailFooter
          live={live}
          holding={holding}
          busy={busy}
          onClaim={() => act(claimIncident, `Đã tiếp nhận ca ${incidentId}`)}
          onDispatch={() =>
            onRequestDispatch
              ? onRequestDispatch(live)
              : act(requestDispatch, `Đã gửi yêu cầu điều động cho ca ${incidentId}`)
          }
          onOpenDispatch={onOpenDispatch ? () => onOpenDispatch(live) : null}
        />
      )}

      {preview && (
        <div className={styles.lightbox} role="dialog" aria-label="Xem ảnh" onClick={() => setPreview(null)}>
          <img src={preview.url} alt={preview.name || 'Ảnh hiện trường'} />
          <button type="button" className={styles.lightboxClose} aria-label="Đóng ảnh">
            ×
          </button>
        </div>
      )}
    </Modal>
  );
}

function DetailBody({ data, onPreview }) {
  const place = [data.address, data.ward, data.province].filter(Boolean).join(', ');
  const mapsUrl =
    data.lat != null ? `https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}` : null;
  const rows = [
    ['Loại sự cố', data.typeLabel],
    ['Nội dung', data.tags.length ? data.tags.join(', ') : 'Chưa chọn loại'],
    ['Mô tả', data.description || null],
    ['Người báo', data.citizenName || 'Không để tên'],
    ['Hình thức báo', data.reportTypeLabel],
    [
      'Cảnh báo IP',
      data.ipFalseAlarmCount > 0
        ? `Cùng IP có ${data.ipFalseAlarmCount} ca báo khống trong 24 giờ qua`
        : null,
    ],
    ['Số điện thoại', data.phone || null, data.phone ? `tel:${data.phone}` : null],
    ['Địa điểm', place || null],
    [
      'Toạ độ',
      data.lat != null
        ? `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}${data.accuracy ? ` (±${data.accuracy} m)` : ''}`
        : null,
      mapsUrl,
    ],
    ['Đơn vị tiếp nhận', data.handlingUnit],
  ].filter(([, v]) => v);

  const timeline = [
    ['Báo tin', data.createdAt],
    ['Tiếp nhận', data.acceptedAt],
    ['Hạn chuyển tỉnh', data.escalatedAt ? null : data.escalateAt],
    ['Chuyển lên tỉnh', data.escalatedAt],
    ['Huỷ', data.cancelledAt],
    ['Cập nhật cuối', data.updatedAt],
  ].filter(([, d]) => d);

  return (
    <div className={styles.body}>
      <div className={styles.statusRow}>
        <span className={`${styles.status} ${STATUS_TONE[data.status] || styles.toneGray}`}>
          {data.statusLabel}
        </span>
        {data.cancelReasonLabel && <span className={styles.muted}>Lý do huỷ: {data.cancelReasonLabel}</span>}
      </div>
      {data.transferredFromLabel && (
        <div className={styles.muted} style={{ margin: '-4px 0 10px' }}>
          Chuyển từ lực lượng {data.transferredFromLabel}
          {data.transferReason ? ` · Lý do: "${data.transferReason}"` : ''}
        </div>
      )}
      {data.escalatedAt && (data.escalationReasonLabel || data.escalationNote) && (
        <div className={styles.muted} style={{ margin: '-4px 0 10px' }}>
          Chuyển lên tỉnh: {data.escalationReasonLabel}
          {data.escalationNote ? ` · Lý do cán bộ ghi: "${data.escalationNote}"` : ''}
        </div>
      )}

      <dl className={styles.grid}>
        {rows.map(([k, v, href]) => (
          <div key={k} className={styles.row}>
            <dt>{k}</dt>
            <dd>
              {href ? (
                <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                  {v}
                </a>
              ) : (
                v
              )}
            </dd>
          </div>
        ))}
      </dl>

      <Section title={`Ảnh / video hiện trường (${data.media.length})`}>
        {data.media.length === 0 ? (
          <div className={styles.note}>Người dân không gửi ảnh hay video.</div>
        ) : (
          <div className={styles.gallery}>
            {data.media.map((m) => (
              <MediaItem key={m.url} item={m} onPreview={onPreview} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Mốc thời gian">
        <ul className={styles.times}>
          {timeline.map(([k, d]) => (
            <li key={k}>
              <span>{k}</span>
              <b>{fmt(d)}</b>
            </li>
          ))}
        </ul>
      </Section>

      {data.dispatches.length > 0 && (
        <Section title={`Lực lượng được điều động (${data.dispatches.length})`}>
          <ul className={styles.list}>
            {data.dispatches.map((d, i) => (
              <li key={i}>
                <b>{d.stationName}</b>
                <span>
                  {[d.agencyLabel, d.phone, d.dispatchedBy && `bởi ${d.dispatchedBy}`, fmt(d.dispatchedAt)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {d.note && <span>Ghi chú: {d.note}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Lịch sử nhận ca (${data.claims.length})`}>
        {data.claims.length === 0 ? (
          <div className={styles.note}>Chưa có cán bộ nào nhận ca.</div>
        ) : (
          <ul className={styles.list}>
            {data.claims.map((c, i) => (
              <li key={i}>
                <b>{c.officerName || 'Cán bộ'}</b>
                <span>
                  Nhận {fmt(c.claimedAt)}
                  {c.releasedAt ? ` → ${fmt(c.releasedAt)}` : ' · đang giữ ca'}
                  {c.endReasonLabel ? ` · ${c.endReasonLabel}` : ''}
                  {c.handedToName ? ` cho ${c.handedToName}` : ''}
                </span>
                {/* reason of a release / handover: only on the turn that ended */}
                {c.note && c.releasedAt && <span>Lý do: {c.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function MediaItem({ item, onPreview }) {
  if (item.type === 'IMAGE') {
    return (
      <button type="button" className={styles.thumb} onClick={() => onPreview(item)} title="Bấm để phóng to">
        <img src={item.url} alt={item.name || 'Ảnh hiện trường'} loading="lazy" />
      </button>
    );
  }
  if (item.type === 'VIDEO') {
    return (
      <video className={styles.video} src={item.url} controls preload="metadata">
        <track kind="captions" />
      </video>
    );
  }
  return (
    <div className={styles.audio}>
      <span>{item.type === 'CALL_RECORDING' ? 'Ghi âm cuộc gọi' : 'Ghi âm'}</span>
      <audio src={item.url} controls preload="metadata" />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

/** Next step for this case, at the bottom of the box. */
function DetailFooter({ live, holding, busy, onClaim, onDispatch, onOpenDispatch }) {
  if (live.heldByMe && live.status === 'RESOLVING' && onOpenDispatch) {
    return (
      <div className={styles.footer}>
        <span className={styles.footerHint}>
          Ca đang điều động: xem điểm xuất phát, uỷ quyền và theo dõi lực lượng.
        </span>
        <button type="button" className={styles.footerDispatch} onClick={onOpenDispatch}>
          Chi tiết điều động
        </button>
      </div>
    );
  }
  if (live.heldByMe && live.status === 'VERIFYING') {
    return (
      <div className={styles.footer}>
        <span className={styles.footerHint}>
          Đã xác minh với người báo? Gửi yêu cầu điều động lực lượng tới hiện trường.
        </span>
        <button type="button" className={styles.footerDispatch} disabled={busy} onClick={onDispatch}>
          {busy ? 'Đang gửi...' : 'Yêu cầu điều động'}
        </button>
      </div>
    );
  }
  if (live.status === 'PENDING' && !live.handler && live.canHandle) {
    const blocked = holding && holding.id !== live.id;
    return (
      <div className={styles.footer}>
        <span className={styles.footerHint}>
          {blocked
            ? `Bạn đang giữ ca ${holding.id}: hoàn tất hoặc trả ca đó trước khi nhận ca mới.`
            : 'Ca chưa có cán bộ nhận. Tiếp nhận để xác minh với người báo.'}
        </span>
        <button type="button" className={styles.footerClaim} disabled={busy || blocked} onClick={onClaim}>
          {busy ? 'Đang nhận...' : 'Tiếp nhận ca'}
        </button>
      </div>
    );
  }
  return null;
}
