import { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';

import { getHandoverCandidates } from '../api/incidents';

/**
 * "Giao ca": pick an idle officer of the same unit to take over the incident the
 * officer is holding. Busy officers (already holding one) are listed but disabled:
 * an officer holds at most one incident.
 *
 * @param {{ incident: object|null, onClose: () => void, onConfirm: (toAccountId: string, note: string) => Promise<void> }} props
 */
const MIN_REASON = 5;

export function HandoverDialog({ incident, onClose, onConfirm }) {
  const open = Boolean(incident);
  const [state, setState] = useState({ status: 'idle', candidates: [], error: null });
  const [chosen, setChosen] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!incident) return undefined;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: 'loading', candidates: [], error: null });
    setChosen('');
    setNote('');
    getHandoverCandidates(incident.id)
      .then((candidates) => alive && setState({ status: 'ready', candidates, error: null }))
      .catch((err) => alive && setState({ status: 'error', candidates: [], error: err.message }));
    return () => {
      alive = false;
    };
  }, [incident]);

  // Giao ca bắt buộc ghi lý do (lưu vào lịch sử giữ ca); BE cũng kiểm tra
  const reasonOk = note.trim().length >= MIN_REASON;
  const submit = async () => {
    if (!chosen || !reasonOk) return;
    setSending(true);
    try {
      await onConfirm(chosen, note.trim());
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Giao ca ${incident?.id || ''}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 2px' }}>
        <div style={{ fontSize: 12.5, color: '#cbd5e1' }}>
          Chọn cán bộ cùng đơn vị để nhận lại ca. Người đang giữ ca khác thì không giao được.
        </div>

        {state.status === 'loading' && (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Đang tải danh sách...</div>
        )}
        {state.status === 'error' && <div style={{ fontSize: 12, color: '#f87171' }}>{state.error}</div>}
        {state.status === 'ready' && state.candidates.length === 0 && (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Đơn vị chưa có cán bộ nào khác.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
          {state.candidates.map((c) => (
            <label
              key={c.accountId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${chosen === c.accountId ? '#38bdf8' : 'rgba(255,255,255,0.12)'}`,
                background: chosen === c.accountId ? 'rgba(56,189,248,0.12)' : 'rgba(15,23,42,0.6)',
                opacity: c.busy ? 0.5 : 1,
                cursor: c.busy ? 'not-allowed' : 'pointer',
              }}
            >
              <input
                type="radio"
                name="handover-to"
                value={c.accountId}
                disabled={c.busy}
                checked={chosen === c.accountId}
                onChange={() => setChosen(c.accountId)}
              />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{c.fullName}</span>
              <span style={{ fontSize: 11, color: c.online ? '#34d399' : '#64748b' }}>
                {c.online ? '● Đang trực tuyến' : '○ Ngoại tuyến'}
              </span>
              {c.busy && <span style={{ fontSize: 11, color: '#fbbf24' }}>Đang giữ ca khác</span>}
            </label>
          ))}
        </div>

        <label htmlFor="handover-note" style={{ fontSize: 12.5, fontWeight: 700, color: '#e2e8f0' }}>
          Lý do giao ca <span style={{ color: '#f87171' }}>*</span>
        </label>
        <textarea
          id="handover-note"
          className="textarea-field"
          rows={3}
          maxLength={255}
          required
          aria-required="true"
          placeholder="Ví dụ: hết ca trực, cần đi hiện trường khác, chuyển cán bộ gần hiện trường hơn..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {note.length > 0 && !reasonOk && (
          <div style={{ fontSize: 12, color: '#fca5a5' }}>Lý do cần ít nhất {MIN_REASON} ký tự.</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn-refresh-loc" onClick={onClose}>
            Huỷ
          </button>
          <button
            type="button"
            className="btn-submit-sos"
            style={{ width: 'auto', padding: '8px 16px', opacity: chosen && reasonOk && !sending ? 1 : 0.5 }}
            disabled={!chosen || !reasonOk || sending}
            title={!reasonOk ? 'Nhập lý do giao ca trước' : undefined}
            onClick={submit}
          >
            {sending ? 'Đang giao...' : 'Giao ca'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
