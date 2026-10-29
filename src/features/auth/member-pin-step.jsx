/**
 * Step 2 of the unit-account login: pick who is on duty from the unit's officer list, then enter
 * that officer's PIN. An officer who has no PIN yet (new, or PIN reset) types the one-time
 * activation code from the duty officer / commander and sets a PIN here.
 *
 * Uses the login modal's CSS module (passed in as `s`) so it looks like step 1.
 */
import { useEffect, useMemo, useState } from 'react';

import { getUnitMembersApi } from './auth-api';
import { useAuth } from './use-auth';

const PIN_RE = /^\d{4,6}$/;

const ROLE_LABEL = { COMMANDER: 'Chỉ huy', MEMBER: 'Cán bộ' };

const COARSE_POINTER = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/**
 * @param {{ unitToken: string, s: Record<string, string>, onDone: () => Promise<void> | void, onBack: () => void }} props
 */
export function MemberPinStep({ unitToken, s, onDone, onBack }) {
  const { loginMember } = useAuth();
  const [members, setMembers] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    getUnitMembersApi(unitToken)
      .then((list) => alive && setMembers(list))
      .catch((err) => {
        if (!alive) return;
        setLoadError(
          err?.status === 401
            ? 'Phiên chọn cán bộ đã hết hạn. Vui lòng đăng nhập lại.'
            : err?.message || 'Không tải được danh sách cán bộ của đơn vị.',
        );
      });
    return () => {
      alive = false;
    };
  }, [unitToken]);

  const shown = useMemo(() => {
    const q = fold(query);
    if (!members || !q) return members || [];
    return members.filter((m) => fold(`${m.full_name} ${m.badge_number || ''}`).includes(q));
  }, [members, query]);

  const activating = picked && !picked.activated;

  function pick(m) {
    setPicked(m);
    setPin('');
    setConfirm('');
    setCode('');
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting || !picked) return;
    if (!PIN_RE.test(pin)) return setError('PIN gồm 4–6 chữ số.');
    if (activating) {
      if (!code.trim()) return setError('Nhập mã kích hoạt do trực ban / chỉ huy cấp.');
      if (confirm !== pin) return setError('PIN nhập lại không khớp.');
    }
    setError(null);
    setSubmitting(true);
    try {
      await loginMember(unitToken, {
        memberId: picked.member_id,
        pin,
        activationCode: activating ? code.trim() : undefined,
      });
      await onDone();
    } catch (err) {
      setSubmitting(false);
      if (err?.status === 423) {
        setPicked({ ...picked, locked: true });
        setError(null);
      } else {
        setError(err?.message || (activating ? 'Mã kích hoạt không đúng hoặc đã hết hạn.' : 'Sai mã PIN.'));
      }
    }
  }

  if (loadError) {
    return (
      <div className={s.form}>
        <div className={s.errorBox} role="alert">
          {loadError}
        </div>
        <button type="button" className={s.submitBtn} onClick={onBack}>
          ← Đăng nhập lại
        </button>
      </div>
    );
  }

  if (!members) {
    return (
      <div className={s.form} style={{ alignItems: 'center' }}>
        <span className={s.spinner} /> Đang tải danh sách cán bộ...
      </div>
    );
  }

  if (!picked) {
    return (
      <div className={s.form}>
        <div className={s.fieldLabel}>Chọn cán bộ đang trực ({members.length})</div>
        {members.length > 6 && (
          <div className={s.inputWrap}>
            <input
              className={s.input}
              placeholder="Tìm theo tên hoặc số hiệu..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // not on touch screens: the keyboard would pop up and eat the first tap on a name
              autoFocus={!COARSE_POINTER}
            />
          </div>
        )}
        <div style={{ display: 'grid', gap: 8, maxHeight: 300, overflowY: 'auto', paddingRight: 2 }}>
          {shown.map((m) => (
            <button key={m.member_id} type="button" onClick={() => pick(m)} style={memberBtnStyle}>
              <span style={{ fontWeight: 700 }}>
                {m.rank_label ? `${m.rank_label} ` : ''}
                {m.full_name}
              </span>
              <span style={{ fontSize: 12, opacity: 0.75 }}>
                {[m.position || ROLE_LABEL[m.unit_role], m.badge_number && `SH ${m.badge_number}`]
                  .filter(Boolean)
                  .join(' · ')}
                {m.locked ? ' · Đã khoá' : !m.activated ? ' · Chưa kích hoạt' : ''}
              </span>
            </button>
          ))}
          {shown.length === 0 && (
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              {members.length === 0
                ? 'Đơn vị chưa có cán bộ nào. Liên hệ quản trị hệ thống.'
                : 'Không tìm thấy cán bộ.'}
            </div>
          )}
        </div>
        <button type="button" className={s.modalCloseBtn} style={{ position: 'static' }} onClick={onBack}>
          ← Đổi tài khoản đơn vị
        </button>
      </div>
    );
  }

  return (
    <form className={s.form} onSubmit={handleSubmit} noValidate>
      <div style={memberBtnStyle}>
        <span style={{ fontWeight: 700 }}>
          {picked.rank_label ? `${picked.rank_label} ` : ''}
          {picked.full_name}
        </span>
        <span style={{ fontSize: 12, opacity: 0.75 }}>{picked.position || ROLE_LABEL[picked.unit_role]}</span>
      </div>

      {picked.locked ? (
        <div className={s.errorBox} role="alert">
          Hồ sơ này đã bị khoá do nhập sai PIN nhiều lần. Liên hệ trực ban hoặc chỉ huy để cấp lại PIN.
        </div>
      ) : (
        <>
          {activating && (
            <div>
              <label className={s.fieldLabel} htmlFor="member-code">
                Mã kích hoạt *
              </label>
              <div className={s.inputWrap}>
                <input
                  id="member-code"
                  className={s.input}
                  placeholder="Mã do trực ban / chỉ huy cấp"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  autoComplete="one-time-code"
                  disabled={submitting}
                  autoFocus
                />
              </div>
            </div>
          )}
          <div>
            <label className={s.fieldLabel} htmlFor="member-pin">
              {activating ? 'Đặt mã PIN mới (4–6 số) *' : 'Mã PIN cá nhân *'}
            </label>
            <div className={s.inputWrap}>
              <input
                id="member-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                className={s.input}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                autoComplete={activating ? 'new-password' : 'current-password'}
                disabled={submitting}
                autoFocus={!activating}
              />
            </div>
          </div>
          {activating && (
            <div>
              <label className={s.fieldLabel} htmlFor="member-pin2">
                Nhập lại PIN *
              </label>
              <div className={s.inputWrap}>
                <input
                  id="member-pin2"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  className={s.input}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
                  autoComplete="new-password"
                  disabled={submitting}
                />
              </div>
            </div>
          )}
          {error && (
            <div className={s.errorBox} role="alert">
              {error}
            </div>
          )}
          <button type="submit" className={s.submitBtn} disabled={submitting || !pin}>
            {submitting ? (
              <>
                <span className={s.spinner} /> Đang xác thực...
              </>
            ) : activating ? (
              'KÍCH HOẠT & VÀO TRỰC'
            ) : (
              'VÀO TRỰC'
            )}
          </button>
        </>
      )}
      <button
        type="button"
        className={s.modalCloseBtn}
        style={{ position: 'static' }}
        onClick={() => pick(null)}
        disabled={submitting}
      >
        ← Chọn cán bộ khác
      </button>
    </form>
  );
}

const memberBtnStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(148, 163, 184, 0.3)',
  background: 'rgba(15, 23, 42, 0.6)',
  color: '#e8eef8',
  textAlign: 'left',
  cursor: 'pointer',
  touchAction: 'manipulation', // no double-tap zoom: one tap picks
};

/** lowercase without Vietnamese diacritics, for search */
function fold(text) {
  return (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
}
