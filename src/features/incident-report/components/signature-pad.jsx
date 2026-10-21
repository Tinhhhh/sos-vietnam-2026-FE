import { useEffect, useRef, useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';

import styles from './signature-pad.module.css';

const MIN_REASON = 5;

/**
 * "Ký tên điện tử" (legacy #signaturePadModal): draw with finger / mouse, or type the full name.
 * proxy = officer signs the citizen box: also a reason + "I was authorised by the citizen" checkbox.
 * Mount it only while open (state starts fresh each time).
 *
 * @param {{ open: boolean, title: string, defaultName?: string, proxy?: boolean, busy?: boolean,
 *           onClose: () => void, onSign: (sign: { name, type, signatureData, reason?, authorized? }) => void }} props
 */
export function SignaturePad({
  open,
  title,
  defaultName = '',
  proxy = false,
  busy = false,
  onClose,
  onSign,
}) {
  const [tab, setTab] = useState('DRAW');
  const [name, setName] = useState(defaultName);
  const [reason, setReason] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  // Size the canvas to its box (sharp on high-DPI screens)
  useEffect(() => {
    if (!open || tab !== 'DRAW') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e3a8a';
  }, [open, tab]);

  const point = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const down = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  };
  const up = () => {
    drawing.current = false;
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const reasonOk = !proxy || reason.trim().length >= MIN_REASON;
  const ready = name.trim().length > 0 && (tab === 'TYPE' || hasInk) && reasonOk && (!proxy || authorized);

  const submit = (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    onSign({
      name: name.trim(),
      type: tab,
      signatureData: tab === 'DRAW' ? canvasRef.current.toDataURL('image/png') : null,
      ...(proxy ? { reason: reason.trim(), authorized } : {}),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      solid
      containerStyle={{ maxWidth: 480, width: 'min(480px, calc(100vw - 16px))', zIndex: 2 }}
      titleStyle={{ color: '#38bdf8' }}
      title={title}
    >
      <form className={styles.pad} onSubmit={submit}>
        {proxy && (
          <div className={styles.proxyBox}>
            <div className={styles.proxyTitle}>Cán bộ ký hộ người dân</div>
            <label className={styles.field}>
              <span>Lý do ký hộ *</span>
              <textarea
                rows={2}
                maxLength={500}
                value={reason}
                placeholder="Ví dụ: người dân bị thương ở tay, đã đồng ý qua điện thoại lúc 09:45"
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {reason.trim().length > 0 && !reasonOk && (
              <div className={styles.error}>Ít nhất {MIN_REASON} ký tự</div>
            )}
            <label className={styles.check}>
              <input type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} />
              <span>
                Tôi xác nhận đã được người dân uỷ quyền ký thay vào văn bản này và ký đúng hồ sơ của người dân
                nêu trên.
              </span>
            </label>
          </div>
        )}

        <div className={styles.tabs} role="tablist">
          {[
            ['DRAW', 'Vẽ nét tay'],
            ['TYPE', 'Gõ họ tên'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? styles.tabOn : styles.tab}
              onClick={() => {
                setTab(key);
                setHasInk(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'DRAW' ? (
          <div className={styles.canvasWrap}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerLeave={up}
              aria-label="Vùng ký tên"
            />
            {!hasInk && <span className={styles.canvasHint}>Ký vào đây</span>}
            <button type="button" className={styles.clear} onClick={clear}>
              Xoá nét
            </button>
          </div>
        ) : (
          <div className={styles.typedPreview}>{name.trim() || 'Họ và tên'}</div>
        )}

        <label className={styles.field}>
          <span>Họ và tên người ký *</span>
          <input maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <button type="submit" className={styles.submit} disabled={!ready || busy}>
          {busy ? 'Đang lưu chữ ký...' : 'Xác nhận ký'}
        </button>
      </form>
    </Modal>
  );
}
