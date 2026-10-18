import { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';

import { getIncidentDetail } from '../api/incidents';
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
 * @param {{ incidentId: string|null, onClose: () => void }} props
 */
export function IncidentDetailDialog({ incidentId, onClose }) {
  // Result of the last request; it belongs to `key` (a stale one shows as loading)
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const [preview, setPreview] = useState(null);
  const loading = !!incidentId && result.key !== incidentId;
  const data = result.key === incidentId ? result.data : null;
  const error = result.key === incidentId ? result.error : null;

  useEffect(() => {
    if (!incidentId) return undefined;
    let alive = true;
    getIncidentDetail(incidentId)
      .then((d) => alive && setResult({ key: incidentId, data: d, error: null }))
      .catch((err) => alive && setResult({ key: incidentId, data: null, error: err.message }));
    return () => {
      alive = false;
    };
  }, [incidentId]);

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
                {c.note && <span>Lý do: {c.note}</span>}
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
      <span>{item.type === 'CALL_RECORDING' ? '📞 Ghi âm cuộc gọi' : '🎙️ Ghi âm'}</span>
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
