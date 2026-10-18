import { useState } from 'react';

import { CallIcon } from '@/components/ui/call-icons/call-icons';
import { useToast } from '@/components/ui/toast/toast-context';
import { useNow } from '@/hooks/use-now';

import { claimIncident, escalateIncident, releaseIncident, requestDispatch } from '../api/incidents';
import { TYPE_LOOK, formatCountdown, secondsToEscalation } from '../utils/incident-model';
import { DETAIL_BUTTON_STYLE, PAGE_SIZE } from '../utils/list-paging';
import callStyles from './call-button.module.css';
import { HandoverDialog } from './handover-dialog';
import { Pager, RangeTabs } from './list-controls';
import styles from './incident-panels.module.css';

const AGENCY_TAG_CLASS = {
  police: styles.police,
  csgt: styles.rescue,
  fire: styles.rescue,
  hospital: styles.hospital,
};

const STATUS_LABEL = {
  PENDING: 'Chờ tiếp nhận',
  VERIFYING: 'Đang xác minh',
  RESOLVING: 'Đang điều động xử lý',
};

const actionButtonStyle = (bg, border, color) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  background: bg,
  border: `1.5px solid ${border}`,
  color,
  padding: '4px 10px',
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
});

const CONNECTION_LOOK = {
  live: { color: '#34d399', text: 'Trực tuyến' },
  connecting: { color: '#fbbf24', text: 'Đang kết nối...' },
  reconnecting: { color: '#f87171', text: 'Mất kết nối, đang thử lại...' },
};

const badgeStyle = (bg, fg, border = 'transparent') => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  background: bg,
  color: fg,
  border: `1px solid ${border}`,
  fontSize: 10,
  fontWeight: 800,
  padding: '1px 6px',
  borderRadius: 4,
});

/**
 * Window "Hàng đợi sự cố" (legacy #panelIncidentsView + renderQueue()): live queue of the
 * officer's unit, with claim / release / hand over. The whole live queue is in memory (STOMP
 * updates), so the 1 / 7 / 30 day filter and the pages (PAGE_SIZE cards) are applied here. Like booking a ride: the first
 * officer to press "Tiếp nhận" holds the incident, the others still see it locked.
 * An officer holds at most one incident at a time.
 *
 * @param {{
 *   incidents: object[], status: 'loading'|'ready'|'unavailable'|'error', error?: string|null,
 *   connection: 'connecting'|'live'|'reconnecting', officerLevel: string,
 *   selectedId?: string|null, onSelect: (inc) => void, onRetry: () => void,
 *   onChange: (inc) => void,   // incident returned by claim / release, applied right away
 *   onCall?: (inc) => void,    // start a video call with the citizen (incident already held by me)
 *   inCall?: boolean,          // a call is already open: call buttons are disabled
 *   onOpenDetail?: (id) => void, // "Chi tiết" box (info, photos / videos, claim history)
 * }} props
 */
export function IncidentQueuePanel({
  incidents,
  status,
  error,
  connection,
  officerLevel,
  selectedId,
  onSelect,
  onRetry,
  onChange,
  onCall,
  inCall = false,
  onOpenDetail,
}) {
  const toast = useToast();
  // Every card shows a countdown or the time waited, so tick while there is any card
  const now = useNow(incidents.length > 0);
  const conn = CONNECTION_LOOK[connection] || CONNECTION_LOOK.connecting;
  const holding = incidents.find((i) => i.heldByMe) || null;
  const [busyId, setBusyId] = useState(null);
  const [handoverOf, setHandoverOf] = useState(null);
  const [days, setDays] = useState(null); // null = every open incident
  const [page, setPage] = useState(0);

  const since = days ? now - days * 24 * 3600 * 1000 : null;
  const inRange = since ? incidents.filter((i) => !i.createdAt || i.createdAt.getTime() >= since) : incidents;
  const totalPages = Math.max(1, Math.ceil(inRange.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1); // the list shrinks when incidents are closed
  const pageItems = inRange.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const changeRange = (d) => {
    setDays(d);
    setPage(0);
  };

  const run = async (inc, action, success) => {
    setBusyId(inc.id);
    try {
      const updated = await action();
      onChange(updated);
      toast.show(success, { tone: 'success' });
      return true;
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
      // 409: someone else was faster / the incident changed: show the current state
      if (err.status === 409) onRetry();
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const actions = {
    claim: (inc) => run(inc, () => claimIncident(inc.id), `Đã tiếp nhận ca ${inc.id}`),
    release: (inc) => run(inc, () => releaseIncident(inc.id), `Đã trả ca ${inc.id} về hàng đợi chung`),
    handover: (inc) => setHandoverOf(inc),
    // Verified with the citizen: ask for forces to be dispatched (VERIFYING -> RESOLVING)
    dispatch: (inc) =>
      run(inc, () => requestDispatch(inc.id), `Đã gửi yêu cầu điều động lực lượng cho ca ${inc.id}`),
    // Cannot handle it at ward level: hand it to the province right now
    escalate: async (inc) => {
      if (!window.confirm(`Chuyển ca ${inc.id} lên cấp tỉnh/thành phố ngay? Bạn sẽ không giữ ca này nữa.`))
        return;
      setBusyId(inc.id);
      try {
        await escalateIncident(inc.id);
        toast.show(`Đã chuyển ca ${inc.id} lên cấp tỉnh/thành phố`, { tone: 'success' });
        onRetry();
      } catch (err) {
        toast.show(err.message, { tone: 'error' });
        if (err.status === 409) onRetry();
      } finally {
        setBusyId(null);
      }
    },
    // Red phone: calling = taking the case (two officers never call the same citizen)
    call: async (inc) => {
      if (!onCall) return;
      if (inc.heldByMe) {
        onCall(inc);
        return;
      }
      setBusyId(inc.id);
      try {
        const updated = await claimIncident(inc.id);
        onChange(updated);
        onCall(updated || inc);
      } catch (err) {
        toast.show(err.message, { tone: 'error' });
        if (err.status === 409) onRetry();
      } finally {
        setBusyId(null);
      }
    },
  };

  return (
    <div
      className={styles.panelIncidentsView}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          padding: '8px 4px',
          fontSize: 11,
          color: '#94a3b8',
        }}
      >
        <span>
          Đang mở: <b style={{ color: '#f8fafc' }}>{incidents.length}</b>
          {' · '}chờ tiếp nhận:{' '}
          <b style={{ color: '#fca5a5' }}>{incidents.filter((i) => i.status === 'PENDING').length}</b>
        </span>
        <span
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          title="Kênh nhận sự cố thời gian thực"
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: conn.color,
              boxShadow: `0 0 8px ${conn.color}`,
            }}
          />
          {conn.text}
        </span>
      </div>

      <div style={{ padding: '0 4px 8px' }}>
        <RangeTabs value={days} onChange={changeRange} allowAll />
      </div>

      {status === 'ready' && incidents.length > 0 && inRange.length === 0 ? (
        <div style={{ flex: 1, padding: '32px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          Không có ca nào đang mở được báo trong {days} ngày qua.
        </div>
      ) : status === 'ready' && incidents.length > 0 ? (
        <div
          className={styles.incidentQueueList}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            paddingRight: 2,
          }}
        >
          {pageItems.map((inc) => (
            <QueueCard
              key={inc.id}
              incident={inc}
              now={now}
              officerLevel={officerLevel}
              selected={inc.id === selectedId}
              holding={holding}
              busy={busyId === inc.id}
              canCall={!!onCall && !inCall}
              actions={actions}
              onSelect={onSelect}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      ) : (
        <WaitingShield status={status} error={error} onRetry={onRetry} />
      )}

      {status === 'ready' && incidents.length > 0 && (
        <Pager page={safePage} totalPages={totalPages} total={inRange.length} onPage={setPage} />
      )}

      <HandoverDialog
        incident={handoverOf}
        onClose={() => setHandoverOf(null)}
        onConfirm={async (toAccountId, note) => {
          const ok = await run(
            handoverOf,
            () => releaseIncident(handoverOf.id, { toAccountId, note }),
            `Đã giao ca ${handoverOf.id}`,
          );
          if (ok) setHandoverOf(null);
        }}
      />
    </div>
  );
}

function QueueCard({
  incident: inc,
  now,
  officerLevel,
  selected,
  holding,
  busy,
  canCall,
  actions,
  onSelect,
  onOpenDetail,
}) {
  const look = TYPE_LOOK[inc.type] || TYPE_LOOK.POLICE;
  const time = inc.createdAt
    ? inc.createdAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const secondsLeft = secondsToEscalation(inc, now);
  const location =
    inc.address ||
    [inc.ward, inc.province].filter(Boolean).join(', ') ||
    (inc.lat != null ? `Toạ độ GPS: ${inc.lat.toFixed(5)}, ${inc.lng.toFixed(5)}` : 'Chưa xác định vị trí');
  const destination = inc.lat != null ? `${inc.lat},${inc.lng}` : null;

  return (
    <div
      role="button"
      tabIndex={0}
      className={`${styles.queueCard} ${selected ? styles.active : ''}`}
      onClick={() => onSelect(inc)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(inc);
        }
      }}
    >
      <div className={styles.queueCardTop}>
        <span className={`${styles.queueAgencyTag} ${AGENCY_TAG_CLASS[inc.agency] || styles.police}`}>
          {look.icon} {look.label}
        </span>
        <span className={styles.queueTime}>
          {time} · {inc.id}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        <LevelBadge incident={inc} officerLevel={officerLevel} />
        {secondsLeft != null ? (
          <CountdownBadge seconds={secondsLeft} />
        ) : (
          <ElapsedBadge incident={inc} now={now} />
        )}
        {onOpenDetail && (
          <button
            type="button"
            style={DETAIL_BUTTON_STYLE}
            title="Xem chi tiết ca, ảnh / video người dân gửi"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(inc.id);
            }}
          >
            ⓘ Chi tiết
          </button>
        )}
      </div>

      <div className={styles.queueLocation} style={{ marginBottom: 6 }}>
        📍 {location}
      </div>

      <div className={styles.queueIncidentText} style={{ marginBottom: 8 }}>
        Sự cố: <b>{inc.tags.length ? inc.tags.join(', ') : 'Chưa chọn loại'}</b>
        {inc.description ? ` — ${inc.description}` : ''}
        {inc.mediaCount > 0 && <span style={{ marginLeft: 6 }}>· 📷 {inc.mediaCount} tệp</span>}
      </div>

      {(inc.citizenName || inc.phone) && (
        <div style={{ fontSize: 11.5, color: '#cbd5e1', marginBottom: 8 }}>
          Người báo: {inc.citizenName || 'Không để tên'}
          {inc.phone && (
            <>
              {' · '}
              <a href={`tel:${inc.phone}`} onClick={(e) => e.stopPropagation()} style={{ color: '#38bdf8' }}>
                {inc.phone}
              </a>
            </>
          )}
        </div>
      )}

      <div
        className={styles.queueCardActions}
        style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}
      >
        <ClaimControls incident={inc} holding={holding} busy={busy} canCall={canCall} actions={actions} />
        {destination && (
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <DirectionLink destination={destination} mode="driving" label="Ô tô ↗" color="#38bdf8" />
            <DirectionLink destination={destination} mode="two_wheeler" label="Xe máy ↗" color="#34d399" />
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Claim / lock area of a card:
 * - held by me: release to the shared queue or hand over
 * - held by someone else: locked with their name (still visible, like a booked ride)
 * - free and my level handles it: "Tiếp nhận ngay" (disabled while I hold another one)
 * - otherwise (watch-only): status label
 */
function ClaimControls({ incident: inc, holding, busy, canCall, actions }) {
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn(inc);
  };
  if (inc.heldByMe) {
    const verifying = inc.status === 'VERIFYING';
    const canEscalate = inc.level === 'ward' && !inc.escalatedAt;
    return (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span style={badgeStyle('rgba(52, 211, 153, 0.18)', '#6ee7b7', 'rgba(52, 211, 153, 0.5)')}>
          {verifying ? '🔎 Bạn đang xác minh' : '🚓 Đang điều động lực lượng'}
        </span>
        <CallButton
          disabled={busy || !canCall}
          title="Gọi video cho người báo"
          onClick={stop(actions.call)}
        />
        {verifying && (
          <button
            type="button"
            disabled={busy}
            style={actionButtonStyle('rgba(52, 211, 153, 0.18)', '#34d399', '#d1fae5')}
            title="Đã xác minh với người báo: gửi yêu cầu điều động lực lượng tới hiện trường"
            onClick={stop(actions.dispatch)}
          >
            🚓 Yêu cầu điều động
          </button>
        )}
        {canEscalate && (
          <button
            type="button"
            disabled={busy}
            style={actionButtonStyle('rgba(255, 42, 75, 0.15)', '#ff6b81', '#fecdd3')}
            title="Cấp xã không xử lý được: chuyển ca lên cấp tỉnh/thành phố ngay"
            onClick={stop(actions.escalate)}
          >
            ⚡ Chuyển lên tỉnh
          </button>
        )}
        {verifying && (
          <button
            type="button"
            disabled={busy}
            style={actionButtonStyle('rgba(148, 163, 184, 0.15)', '#94a3b8', '#e2e8f0')}
            title="Trả ca về hàng đợi chung cho cán bộ khác nhận (đồng hồ leo thang tính tiếp)"
            onClick={stop(actions.release)}
          >
            ↩ Trả về hàng đợi
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          style={actionButtonStyle('rgba(56, 189, 248, 0.15)', '#38bdf8', '#bae6fd')}
          title="Giao thẳng cho một cán bộ khác cùng đơn vị"
          onClick={stop(actions.handover)}
        >
          🤝 Giao ca
        </button>
      </span>
    );
  }
  if (inc.handler) {
    return (
      <span
        style={badgeStyle('rgba(100, 116, 139, 0.2)', '#cbd5e1', '#64748b')}
        title="Ca đã có cán bộ khác tiếp nhận"
      >
        🔒 {inc.status === 'RESOLVING' ? 'Đang điều động' : 'Đang xác minh'}: {inc.handler.fullName}
      </span>
    );
  }
  if (inc.canHandle && inc.status === 'PENDING') {
    const blocked = holding && holding.id !== inc.id;
    return (
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          disabled={busy || blocked}
          style={{
            ...actionButtonStyle('rgba(234, 179, 8, 0.22)', '#eab308', '#fef08a'),
            opacity: busy || blocked ? 0.5 : 1,
            cursor: busy || blocked ? 'not-allowed' : 'pointer',
          }}
          title={
            blocked
              ? `Bạn đang giữ ca ${holding.id}: hoàn tất hoặc trả ca đó trước`
              : 'Bấm để TIẾP NHẬN ca này ngay (người khác sẽ thấy ca bị khoá)'
          }
          onClick={stop(actions.claim)}
        >
          {busy ? 'Đang nhận...' : '⏳ TIẾP NHẬN NGAY'}
        </button>
        <CallButton
          ringing
          disabled={busy || blocked || !canCall}
          title={
            blocked
              ? `Bạn đang giữ ca ${holding.id}: hoàn tất hoặc trả ca đó trước`
              : 'Tiếp nhận ca và gọi video ngay cho người báo'
          }
          onClick={stop(actions.call)}
        />
      </span>
    );
  }
  return (
    <span style={badgeStyle('rgba(234, 179, 8, 0.18)', '#fde68a', 'rgba(234, 179, 8, 0.5)')}>
      {STATUS_LABEL[inc.status] || inc.status} · chỉ theo dõi
    </span>
  );
}

function LevelBadge({ incident: inc, officerLevel }) {
  if (inc.escalatedAt) {
    return (
      <span style={badgeStyle('rgba(255, 42, 75, 0.2)', '#ff6b81', '#ff2a4b')}>
        ⚡ ĐÃ LEO THANG TỈNH/TP{!inc.canHandle && officerLevel === 'ward' ? ' · Tỉnh đang thụ lý' : ''}
      </span>
    );
  }
  if (inc.level === 'province') {
    return <span style={badgeStyle('rgba(139, 92, 246, 0.2)', '#c4b5fd')}>🏛️ CẤP TỈNH/TP</span>;
  }
  return (
    <span style={badgeStyle('rgba(0, 136, 255, 0.2)', '#60a5fa')}>
      📍 CẤP XÃ/PHƯỜNG{inc.ward ? ` (${inc.ward})` : ''}
      {!inc.canHandle ? ' · Xã đang thụ lý' : ''}
    </span>
  );
}

function CountdownBadge({ seconds }) {
  const urgent = seconds < 5 * 60;
  const warning = seconds < 10 * 60;
  const [bg, fg] = urgent
    ? ['rgba(255, 42, 75, 0.2)', '#ff6b81']
    : warning
      ? ['rgba(251, 191, 36, 0.18)', '#fde68a']
      : ['rgba(148, 163, 184, 0.18)', '#cbd5e1'];
  return (
    <span style={badgeStyle(bg, fg)} title="Quá 15 phút chưa tiếp nhận thì tự chuyển lên cấp tỉnh/thành phố">
      ⏱ Leo thang sau {formatCountdown(seconds)}
    </span>
  );
}

function CallButton({ ringing = false, disabled, title, onClick }) {
  return (
    <button
      type="button"
      className={`${callStyles.callBtn} ${ringing && !disabled ? callStyles.ringing : ''}`}
      disabled={disabled}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      <CallIcon name="phone" />
    </button>
  );
}

/** Time since the report: cards that will not escalate (CSGT, PCCC, province, already taken). */
function ElapsedBadge({ incident, now }) {
  if (!incident.createdAt) return null;
  const seconds = Math.max(0, Math.floor((now - incident.createdAt.getTime()) / 1000));
  return (
    <span
      style={badgeStyle('rgba(56, 189, 248, 0.15)', '#bae6fd', 'rgba(56, 189, 248, 0.35)')}
      title="Thời gian đã trôi qua từ lúc người dân báo tin"
    >
      ⏱ Đã trôi qua {formatElapsed(seconds)}
    </span>
  );
}

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const mmss = formatCountdown(seconds % 3600);
  return h > 0 ? `${h}:${mmss}` : mmss;
}

function DirectionLink({ destination, mode, label, color }) {
  return (
    <a
      href={`https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=${mode}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={styles.btnGmapsDirect}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: `${color}2e`,
        border: `1px solid ${color}`,
        color,
        padding: '3px 7px',
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 800,
        textDecoration: 'none',
      }}
    >
      {label}
    </a>
  );
}

const SHIELD_TEXT = {
  loading: ['Đang tải hàng đợi sự cố...', 'Vui lòng chờ trong giây lát.'],
  ready: [
    'Đang trực tín hiệu khẩn cấp...',
    'Chưa có sự cố nào đang chờ ở đơn vị của bạn. Ca mới sẽ hiện ngay tại đây.',
  ],
  unavailable: ['Máy chủ chưa có hàng đợi sự cố', 'Backend chưa có API GET /api/v1/incidents/queue.'],
};

function WaitingShield({ status, error, onRetry }) {
  const [title, desc] = SHIELD_TEXT[status] || [
    'Không tải được hàng đợi sự cố',
    error || 'Lỗi không xác định.',
  ];
  return (
    <div
      className={`${styles.queueEmptyCosmicState} ${styles.queueEmptyCosmicStateRoot}`}
      style={{ display: 'flex' }}
    >
      <div className={styles.cosmicShieldSphereWrap}>
        <div className={`${styles.cosmicShieldOrbitRing} ${styles.ring1}`} />
        <div className={`${styles.cosmicShieldOrbitRing} ${styles.ring2}`} />
        <div className={`${styles.cosmicShieldOrbitRing} ${styles.ring3}`} />

        <div className={styles.cosmicShieldSphere}>
          <div className={styles.cosmicSphereHighlight} />
          <div className={styles.cosmicShieldCore}>
            <svg
              viewBox="0 0 24 24"
              className={styles.cosmicShieldSvg}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
        </div>

        <div className={`${styles.floatingParticle} ${styles.p1}`} />
        <div className={`${styles.floatingParticle} ${styles.p2}`} />
        <div className={`${styles.floatingParticle} ${styles.p3}`} />
      </div>

      <div className={styles.cosmicWaitingTitle}>{title}</div>
      <div className={styles.cosmicWaitingDesc}>{desc}</div>
      {status === 'error' && (
        <button type="button" className="btn-refresh-loc" style={{ marginTop: 12 }} onClick={onRetry}>
          Thử lại
        </button>
      )}
    </div>
  );
}
