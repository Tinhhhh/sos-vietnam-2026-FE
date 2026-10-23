import { useState } from 'react';

import { CallIcon } from '@/components/ui/call-icons/call-icons';
import { SvgIcon } from '@/components/ui/svg-icon/svg-icon';
import { useToast } from '@/components/ui/toast/toast-context';
import { useNow } from '@/hooks/use-now';

import {
  cancelByOfficer,
  claimIncident,
  escalateIncident,
  transferIncident,
  forceFinishIncident,
  releaseIncident,
  requestDispatch,
} from '../api/incidents';
import { TYPE_LOOK, formatCountdown, secondsToEscalation } from '../utils/incident-model';
import { DETAIL_BUTTON_STYLE, PAGE_SIZE } from '../utils/list-paging';
import callStyles from './call-button.module.css';
import { ConfirmReasonDialog } from './confirm-reason-dialog';
import { HandoverDialog } from './handover-dialog';
import { Pager } from './list-controls';
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
  // fixed height so the badges and the "Chi tiết" button sit on one line, same size
  height: 22,
  boxSizing: 'border-box',
  padding: '0 6px',
  borderRadius: 4,
  whiteSpace: 'nowrap',
});

/**
 * Window "Hàng đợi sự cố" (legacy #panelIncidentsView + renderQueue()): live queue of the
 * officer's unit, with claim / release / hand over. The whole live queue is in memory (STOMP
 * updates), so the pages (PAGE_SIZE cards) are cut here. Like booking a ride: the first
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
 *   onRequestDispatch?: (incident) => void, // confirm dialog + dispatch window (else plain API call)
 *   onOpenDispatch?: (incident) => void, // reopen the dispatch window of a RESOLVING case
 *   renderDelegation?: (incident) => React.ReactNode, // controls of a case delegated to my (ward) unit
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
  onRequestDispatch,
  onOpenDispatch,
  renderDelegation,
}) {
  const toast = useToast();
  // Every card shows a countdown or the time waited, so tick while there is any card
  const now = useNow(incidents.length > 0);
  const conn = CONNECTION_LOOK[connection] || CONNECTION_LOOK.connecting;
  const holding = incidents.find((i) => i.heldByMe) || null;
  const [busyId, setBusyId] = useState(null);
  const [handoverOf, setHandoverOf] = useState(null);
  const [confirmOf, setConfirmOf] = useState(null); // { kind: 'finish' | 'cancel' | 'escalate' | 'transfer', inc }
  const [transferTo, setTransferTo] = useState(''); // force picked in the "Chuyển lực lượng" dialog
  // The queue only holds open incidents (they are dealt with now), so no 1 / 7 / 30 day filter here
  const [page, setPage] = useState(0);

  // My own work first (the case I hold, a case delegated to me), so it never hides on a later page
  const mine = (i) => (i.heldByMe ? 0 : i.delegation?.assignedToMe ? 1 : 2);
  const ordered = [...incidents].sort((a, b) => mine(a) - mine(b));
  const totalPages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1); // the list shrinks when incidents are closed
  const pageItems = ordered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

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
    // Taking the case opens its detail box right away (info, photos / videos, next step)
    claim: async (inc) => {
      const ok = await run(inc, () => claimIncident(inc.id), `Đã tiếp nhận ca ${inc.id}`);
      if (ok) onOpenDetail?.(inc.id);
    },
    release: (inc) => run(inc, () => releaseIncident(inc.id), `Đã trả ca ${inc.id} về hàng đợi chung`),
    handover: (inc) => setHandoverOf(inc),
    // Verified with the citizen: ask for forces to be dispatched (VERIFYING -> RESOLVING)
    dispatch: (inc) =>
      onRequestDispatch
        ? onRequestDispatch(inc)
        : run(inc, () => requestDispatch(inc.id), `Đã gửi yêu cầu điều động lực lượng cho ca ${inc.id}`),
    openDispatch: (inc) => onOpenDispatch?.(inc),
    // Both ask first (dialog with a required reason): end once forces are dispatched / cancel at any step
    forceFinish: (inc) => setConfirmOf({ kind: 'finish', inc }),
    cancel: (inc) => setConfirmOf({ kind: 'cancel', inc }),
    canOpenDispatch: !!onOpenDispatch,
    // Cannot handle it at ward level: hand it to the province right now
    // wrong force picked by the citizen: hand the case to another force's queue (reason required)
    transfer: (inc) => {
      setTransferTo('');
      setConfirmOf({ kind: 'transfer', inc });
    },
    // asks for the reason first (saved on the incident: escalation_note)
    escalate: (inc) => setConfirmOf({ kind: 'escalate', inc }),
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

      {status === 'ready' && incidents.length > 0 ? (
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
              renderDelegation={renderDelegation}
            />
          ))}
        </div>
      ) : (
        <WaitingShield status={status} error={error} onRetry={onRetry} />
      )}

      {status === 'ready' && incidents.length > 0 && (
        <Pager page={safePage} totalPages={totalPages} onPage={setPage} />
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

      {confirmOf && (
        <ConfirmReasonDialog
          key={`${confirmOf.kind}-${confirmOf.inc.id}`}
          busy={busyId === confirmOf.inc.id}
          {...(confirmOf.kind === 'transfer'
            ? {
                title: `Chuyển ca ${confirmOf.inc.id} sang lực lượng khác?`,
                message:
                  'Dùng khi người dân chọn nhầm lực lượng. Ca về hàng đợi của lực lượng mới (chờ nhận lại), bạn sẽ không giữ ca này nữa.',
                confirmLabel: 'Chuyển lực lượng',
                placeholder: 'Ví dụ: xác minh qua điện thoại là cháy nhà, cần PCCC',
                canConfirm: !!transferTo,
                extra: (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0 10px' }}>
                    {TRANSFER_TARGETS.filter((t) => t.key !== confirmOf.inc.agency).map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        aria-pressed={transferTo === t.value}
                        onClick={() => setTransferTo(t.value)}
                        style={actionButtonStyle(
                          ...(transferTo === t.value
                            ? ['rgba(56, 189, 248, 0.25)', '#38bdf8', '#e0f2fe']
                            : ['rgba(148, 163, 184, 0.12)', '#94a3b8', '#e2e8f0']),
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                ),
              }
            : confirmOf.kind === 'escalate'
              ? {
                  title: `Chuyển ca ${confirmOf.inc.id} lên cấp tỉnh/thành phố?`,
                  message:
                    'Ca về hàng đợi cấp tỉnh/thành phố ngay, bạn sẽ không giữ ca này nữa. Lý do được lưu vào hồ sơ ca và cấp tỉnh thấy được.',
                  confirmLabel: 'Chuyển lên tỉnh',
                  placeholder: 'Ví dụ: vượt khả năng lực lượng xã, cần CSCĐ / nhiều đơn vị phối hợp',
                }
              : confirmOf.kind === 'finish'
                ? {
                    title: `Kết thúc ca ${confirmOf.inc.id}?`,
                    message:
                      'Ca sẽ đóng ngay (đã xử lý xong), không chờ người dân xác nhận và không lập văn bản đầy đủ. Lý do được lưu vào hồ sơ ca.',
                    confirmLabel: 'Kết thúc ca',
                    placeholder: 'Ví dụ: đã xử lý xong, người báo không trả lời để xác nhận',
                  }
                : {
                    title: `Huỷ ca ${confirmOf.inc.id}?`,
                    message:
                      'Ca sẽ bị huỷ và rời hàng đợi, không thể khôi phục. Người báo tin sẽ thấy tin báo đã bị huỷ.',
                    confirmLabel: 'Huỷ ca',
                    placeholder: 'Ví dụ: xác minh là báo nhầm / trùng với ca khác',
                  })}
          onClose={() => setConfirmOf(null)}
          onConfirm={async (reason) => {
            const { kind, inc } = confirmOf;
            const ok =
              kind === 'transfer'
                ? await run(
                    inc,
                    () => transferIncident(inc.id, transferTo, reason),
                    `Đã chuyển ca ${inc.id} sang ${TRANSFER_TARGETS.find((t) => t.value === transferTo)?.label}`,
                  )
                : kind === 'escalate'
                  ? await run(
                      inc,
                      () => escalateIncident(inc.id, reason),
                      `Đã chuyển ca ${inc.id} lên cấp tỉnh/thành phố`,
                    )
                  : kind === 'finish'
                    ? await run(inc, () => forceFinishIncident(inc.id, reason), `Đã kết thúc ca ${inc.id}`)
                    : await run(inc, () => cancelByOfficer(inc.id, reason), `Đã huỷ ca ${inc.id}`);
            if (ok) {
              setConfirmOf(null);
              onRetry();
            }
          }}
        />
      )}
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
  renderDelegation,
}) {
  const look = TYPE_LOOK[inc.type] || TYPE_LOOK.POLICE;
  const delegatedHere = !!inc.delegation?.delegatedToMyUnit && !!renderDelegation;
  const time = inc.createdAt
    ? inc.createdAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const secondsLeft = secondsToEscalation(inc, now);
  const location =
    inc.address ||
    [inc.ward, inc.province].filter(Boolean).join(', ') ||
    (inc.lat != null ? `Toạ độ GPS: ${inc.lat.toFixed(5)}, ${inc.lng.toFixed(5)}` : 'Chưa xác định vị trí');

  return (
    <div
      role="button"
      tabIndex={0}
      className={`${styles.queueCard} ${selected ? styles.active : ''}`}
      onClick={() => onSelect(inc)}
      onKeyDown={(e) => {
        // only the card itself: keys typed in inputs/modals inside it (React portals bubble here) stay untouched
        if (e.target !== e.currentTarget) return;
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

      {/* badges on the left (they wrap among themselves), "Chi tiết" always on the right, centred */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}
        >
          <LevelBadge incident={inc} officerLevel={officerLevel} />
          {secondsLeft != null ? (
            <CountdownBadge seconds={secondsLeft} />
          ) : (
            <ElapsedBadge incident={inc} now={now} />
          )}
        </div>
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
            Chi tiết
          </button>
        )}
      </div>

      <div className={styles.queueLocation} style={{ marginBottom: 6 }}>
        {location}
      </div>

      <div className={styles.queueIncidentText} style={{ marginBottom: 8 }}>
        Sự cố: <b>{inc.tags.length ? inc.tags.join(', ') : 'Chưa chọn loại'}</b>
        {inc.description ? ` — ${inc.description}` : ''}
        {inc.transferredFromLabel && (
          <div style={{ fontSize: 11.5, color: '#7dd3fc', marginTop: 2 }}>
            Chuyển từ {inc.transferredFromLabel}
            {inc.transferReason ? `: ${inc.transferReason}` : ''}
          </div>
        )}
        <MediaBadges
          images={inc.imageCount}
          videos={inc.videoCount}
          other={inc.mediaCount - inc.imageCount - inc.videoCount}
        />
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
        {delegatedHere ? (
          renderDelegation(inc)
        ) : (
          <ClaimControls incident={inc} holding={holding} busy={busy} canCall={canCall} actions={actions} />
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
/** Forces that take SOS cases (transfer targets); key = normalized agency key of the card */
const TRANSFER_TARGETS = [
  { value: 'POLICE', key: 'police', label: 'Công an' },
  { value: 'CSGT', key: 'csgt', label: 'CSGT' },
  { value: 'FIRE', key: 'fire', label: 'PCCC & CNCH' },
];

function ClaimControls({ incident: inc, holding, busy, canCall, actions }) {
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn(inc);
  };
  if (inc.heldByMe) {
    const verifying = inc.status === 'VERIFYING';
    const canEscalate = inc.level === 'ward' && !inc.escalatedAt;
    const buttons = [
      verifying && {
        key: 'dispatch',
        label: 'Yêu cầu điều động',
        title: 'Đã xác minh với người báo: gửi yêu cầu điều động lực lượng tới hiện trường',
        look: ['rgba(52, 211, 153, 0.18)', '#34d399', '#d1fae5'],
        onClick: actions.dispatch,
      },
      inc.status === 'RESOLVING' &&
        actions.canOpenDispatch && {
          key: 'dispatch-detail',
          label: 'Chi tiết điều động',
          title: 'Mở lại cửa sổ điều động: điểm xuất phát, uỷ quyền, theo dõi',
          look: ['rgba(52, 211, 153, 0.18)', '#34d399', '#d1fae5'],
          onClick: actions.openDispatch,
        },
      canEscalate && {
        key: 'escalate',
        label: 'Chuyển lên tỉnh',
        title: 'Cấp xã không xử lý được: chuyển ca lên cấp tỉnh/thành phố ngay',
        look: ['rgba(255, 42, 75, 0.15)', '#ff6b81', '#fecdd3'],
        onClick: actions.escalate,
      },
      verifying && {
        key: 'transfer',
        label: 'Chuyển lực lượng',
        title: 'Người dân chọn nhầm lực lượng: chuyển ca sang Công an / CSGT / PCCC',
        look: ['rgba(56, 189, 248, 0.15)', '#38bdf8', '#bae6fd'],
        onClick: actions.transfer,
      },
      verifying && {
        key: 'release',
        label: 'Trả về hàng đợi',
        title: 'Trả ca về hàng đợi chung cho cán bộ khác nhận (đồng hồ leo thang tính tiếp)',
        look: ['rgba(148, 163, 184, 0.15)', '#94a3b8', '#e2e8f0'],
        onClick: actions.release,
      },
      // Only once the forces are on the way / at the scene (step 3 "Theo dõi" or later)
      inc.status === 'RESOLVING' &&
        inc.dispatchStep >= 3 && {
          key: 'force-finish',
          label: 'Kết thúc ca',
          title: 'Kết thúc ca ngay (ghi lý do), không chờ xác nhận / văn bản',
          look: ['rgba(245, 158, 11, 0.15)', '#fbbf24', '#fde68a'],
          onClick: actions.forceFinish,
        },
      {
        key: 'cancel',
        label: 'Huỷ ca',
        title: 'Huỷ ca này (ghi lý do), ở bất kỳ bước nào',
        look: ['rgba(239, 68, 68, 0.15)', '#f87171', '#fecaca'],
        onClick: actions.cancel,
      },
      {
        key: 'handover',
        label: 'Giao ca',
        title: 'Giao thẳng cho một cán bộ khác cùng đơn vị',
        look: ['rgba(56, 189, 248, 0.15)', '#38bdf8', '#bae6fd'],
        onClick: actions.handover,
      },
    ].filter(Boolean);
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={badgeStyle('rgba(52, 211, 153, 0.18)', '#6ee7b7', 'rgba(52, 211, 153, 0.5)')}>
            {verifying ? 'Bạn đang xác minh' : 'Đang điều động lực lượng'}
          </span>
          <CallButton
            disabled={busy || !canCall}
            title="Gọi video cho người báo"
            onClick={stop(actions.call)}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
          {buttons.map((btn) => (
            <button
              key={btn.key}
              type="button"
              disabled={busy}
              style={{ ...actionButtonStyle(...btn.look), justifyContent: 'center', width: '100%' }}
              title={btn.title}
              onClick={stop(btn.onClick)}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (inc.handler) {
    return (
      <span
        style={badgeStyle('rgba(100, 116, 139, 0.2)', '#cbd5e1', '#64748b')}
        title="Ca đã có cán bộ khác tiếp nhận"
      >
        {inc.status === 'RESOLVING' ? 'Đang điều động' : 'Đang xác minh'}: {inc.handler.fullName}
      </span>
    );
  }
  if (inc.canHandle && inc.status === 'PENDING') {
    const blocked = holding && holding.id !== inc.id;
    return (
      // Claim button ~80% of the row, the call button takes the rest
      <div style={{ width: '100%', display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          disabled={busy || blocked}
          style={{
            ...actionButtonStyle('rgba(234, 179, 8, 0.22)', '#eab308', '#fef08a'),
            flex: '0 0 80%',
            justifyContent: 'center',
            padding: '8px 10px',
            fontSize: 12.5,
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
          {busy ? 'Đang nhận...' : 'TIẾP NHẬN NGAY'}
        </button>
        <span style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
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
      </div>
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
        ĐÃ LEO THANG TỈNH/TP{!inc.canHandle && officerLevel === 'ward' ? ' · Tỉnh đang thụ lý' : ''}
      </span>
    );
  }
  if (inc.level === 'province') {
    return <span style={badgeStyle('rgba(139, 92, 246, 0.2)', '#c4b5fd')}>CẤP TỈNH/TP</span>;
  }
  return (
    <span style={badgeStyle('rgba(0, 136, 255, 0.2)', '#60a5fa')}>
      CẤP XÃ/PHƯỜNG{inc.ward ? ` (${inc.ward})` : ''}
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

/** Photo / video counts of a card: coloured icons that stand out on the dark card. */
export function MediaBadges({ images = 0, videos = 0, other = 0 }) {
  if (!images && !videos && !other) return null;
  const chip = (color, bg) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
    padding: '1px 7px',
    borderRadius: 6,
    background: bg,
    color,
    fontSize: 11.5,
    fontWeight: 800,
    verticalAlign: 'middle',
  });
  return (
    <>
      {images > 0 && (
        <span style={chip('#38bdf8', 'rgba(56, 189, 248, 0.16)')} title={`${images} ảnh hiện trường`}>
          <SvgIcon name="image" size="sm" style={{ color: '#38bdf8' }} /> {images}
        </span>
      )}
      {videos > 0 && (
        <span style={chip('#f472b6', 'rgba(244, 114, 182, 0.16)')} title={`${videos} video hiện trường`}>
          <SvgIcon name="video" size="sm" style={{ color: '#f472b6' }} /> {videos}
        </span>
      )}
      {other > 0 && (
        <span style={chip('#a3e635', 'rgba(163, 230, 53, 0.14)')} title={`${other} ghi âm`}>
          {other} ghi âm
        </span>
      )}
    </>
  );
}
