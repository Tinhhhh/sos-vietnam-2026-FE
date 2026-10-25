import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';

import {
  assignDuty,
  createMember,
  deleteMember,
  getDuty,
  getMembers,
  resetMemberPin,
  updateMember,
} from '../api/unit';
import styles from './unit-settings.module.css';

// Mirrors be-v2 PoliceRank (cấp bậc hàm CAND)
const RANKS = [
  ['BINH_NHI', 'Binh nhì'],
  ['BINH_NHAT', 'Binh nhất'],
  ['HA_SI', 'Hạ sĩ'],
  ['TRUNG_SI', 'Trung sĩ'],
  ['THUONG_SI', 'Thượng sĩ'],
  ['THIEU_UY', 'Thiếu uý'],
  ['TRUNG_UY', 'Trung uý'],
  ['THUONG_UY', 'Thượng uý'],
  ['DAI_UY', 'Đại uý'],
  ['THIEU_TA', 'Thiếu tá'],
  ['TRUNG_TA', 'Trung tá'],
  ['THUONG_TA', 'Thượng tá'],
  ['DAI_TA', 'Đại tá'],
  ['THIEU_TUONG', 'Thiếu tướng'],
  ['TRUNG_TUONG', 'Trung tướng'],
  ['THUONG_TUONG', 'Thượng tướng'],
  ['DAI_TUONG', 'Đại tướng'],
];

const EMPTY = { full_name: '', badge_number: '', rank: '', position: '', unit_role: 'MEMBER', phone: '' };

/**
 * Settings → "Cán bộ & trực ban" of a unit account: the unit's officer list (add / edit / remove,
 * reissue PIN — PINs are never shown) and the duty officer (current + history, hand over).
 * Commander and the current duty officer can change things; others only look.
 *
 * `embedded`: shown inside the Settings window (no full-page box, no back link / title bar).
 *
 * @param {{ backHref?: string, me: object, embedded?: boolean }} props  me = GET /auth/me (me.member = signed-in officer)
 */
export function UnitSettingsPage({ backHref, me, embedded = false }) {
  const [tab, setTab] = useState('members');
  const [members, setMembers] = useState(null);
  const [duty, setDuty] = useState({ current: null, history: [] });
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | member
  const [codeShown, setCodeShown] = useState(null); // { name, code, expires }
  const [busyId, setBusyId] = useState(null);

  const self = me?.member;
  const canManage = !!self && (self.unit_role === 'COMMANDER' || self.is_duty_officer);

  const reload = useCallback(async () => {
    try {
      const [list, d] = await Promise.all([getMembers(), getDuty()]);
      setMembers(list);
      setDuty(d);
      setError('');
    } catch (err) {
      setError(err.message || 'Không tải được danh sách cán bộ');
      setMembers((m) => m || []);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([getMembers(), getDuty()])
      .then(([list, d]) => {
        if (!alive) return;
        setMembers(list);
        setDuty(d);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message || 'Không tải được danh sách cán bộ');
        setMembers([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function run(id, fn) {
    setBusyId(id);
    setError('');
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err.message || 'Thao tác thất bại');
    } finally {
      setBusyId(null);
    }
  }

  const onReset = (m) =>
    run(m.member_id, async () => {
      if (!window.confirm(`Cấp lại PIN cho ${m.full_name}? PIN cũ hết hiệu lực, phiên đang mở bị đăng xuất.`))
        return;
      const r = await resetMemberPin(m.member_id);
      setCodeShown({ name: m.full_name, code: r.activation_code, expires: r.activation_expires_at });
    });

  const onDelete = (m) =>
    run(m.member_id, async () => {
      if (!window.confirm(`Xoá ${m.full_name} khỏi danh sách cán bộ đơn vị?`)) return;
      await deleteMember(m.member_id);
    });

  const onAssign = (m) =>
    run(m.member_id, async () => {
      if (!window.confirm(`Giao trực ban cho ${m.full_name}?`)) return;
      await assignDuty(m.member_id);
    });

  return (
    <div className={embedded ? `${styles.page} ${styles.embedded}` : styles.page}>
      {embedded ? (
        <div className={styles.subtitle}>
          {me?.full_name || 'Đơn vị'}
          {self && ` · Đang trực: ${self.full_name}`}
        </div>
      ) : (
        <header className={styles.topBar}>
          <Link to={backHref} className={styles.back}>
            ← Bàn chỉ huy
          </Link>
          <div>
            <h1 className={styles.title}>Cán bộ & trực ban</h1>
            <div className={styles.subtitle}>
              {me?.full_name || 'Đơn vị'}
              {self && ` · Đang trực: ${self.full_name}`}
            </div>
          </div>
        </header>
      )}

      <div className={styles.tabs}>
        <div className={styles.segment} role="tablist" style={{ width: '100%' }}>
          {[
            ['members', `Cán bộ đơn vị${members ? ` (${members.length})` : ''}`],
            ['duty', 'Trực ban'],
          ].map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={tab === v}
              className={tab === v ? styles.segOn : styles.seg}
              onClick={() => setTab(v)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className={styles.error} style={{ width: '100%', maxWidth: 760 }}>
          {error}
        </div>
      )}

      {codeShown && (
        <section className={styles.card}>
          <div className={styles.success}>Mã kích hoạt cho {codeShown.name}</div>
          <div className={styles.code}>{codeShown.code}</div>
          <p className={styles.hint}>
            Mã chỉ hiện một lần{codeShown.expires ? `, hết hạn ${formatTime(codeShown.expires)}` : ''}. Đưa
            cho cán bộ: lúc đăng nhập chọn tên mình, nhập mã này rồi tự đặt PIN.
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => setCodeShown(null)}>
              Đã ghi lại mã
            </button>
          </div>
        </section>
      )}

      {tab === 'members' && editing && (
        <MemberForm
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={async (result) => {
            setEditing(null);
            if (result?.activation_code) {
              setCodeShown({
                name: result.member?.full_name,
                code: result.activation_code,
                expires: result.activation_expires_at,
              });
            }
            await reload();
          }}
        />
      )}

      {tab === 'members' && !editing && (
        <section className={styles.card}>
          {canManage && (
            <div className={styles.actions} style={{ marginTop: 0 }}>
              <button type="button" className={styles.primary} onClick={() => setEditing('new')}>
                + Thêm cán bộ
              </button>
            </div>
          )}
          {!members ? (
            <div className={styles.hint}>Đang tải...</div>
          ) : (
            <div className={styles.list}>
              {members.map((m) => (
                <div key={m.member_id} className={styles.member}>
                  <div className={styles.memberText}>
                    <span className={styles.memberName}>
                      {m.rank_label ? `${m.rank_label} ` : ''}
                      {m.full_name}
                      {m.unit_role === 'COMMANDER' && <span className={styles.tag}>Chỉ huy</span>}
                      {m.is_duty_officer && <span className={styles.tag}>Trực ban</span>}
                      {m.locked && <span className={`${styles.tag} ${styles.tagWarn}`}>Đã khoá</span>}
                      {!m.activated && !m.locked && (
                        <span className={`${styles.tag} ${styles.tagWarn}`}>Chưa kích hoạt</span>
                      )}
                    </span>
                    <span className={styles.memberSub}>
                      {[m.position, m.badge_number && `SH ${m.badge_number}`, m.phone]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </span>
                  </div>
                  {canManage && (
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.small}
                        disabled={busyId === m.member_id}
                        onClick={() => setEditing(m)}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className={styles.small}
                        disabled={busyId === m.member_id}
                        onClick={() => onReset(m)}
                      >
                        Cấp lại PIN
                      </button>
                      {m.member_id !== self?.member_id && (
                        <button
                          type="button"
                          className={styles.small}
                          disabled={busyId === m.member_id}
                          onClick={() => onDelete(m)}
                        >
                          Xoá
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {members.length === 0 && <div className={styles.hint}>Đơn vị chưa có cán bộ nào.</div>}
            </div>
          )}
        </section>
      )}

      {tab === 'duty' && (
        <section className={styles.card}>
          <fieldset className={styles.group}>
            <legend>Trực ban hiện tại</legend>
            {duty.current ? (
              <div className={styles.member}>
                <div className={styles.memberText}>
                  <span className={styles.memberName}>
                    {duty.current.rank_label ? `${duty.current.rank_label} ` : ''}
                    {duty.current.full_name}
                  </span>
                  <span className={styles.memberSub}>
                    Nhận trực từ {formatTime(duty.current.started_at)}
                    {duty.current.assigned_by_name && ` · Giao bởi ${duty.current.assigned_by_name}`}
                  </span>
                </div>
              </div>
            ) : (
              <div className={styles.hint}>Đơn vị chưa có trực ban.</div>
            )}
          </fieldset>

          {canManage && members && (
            <fieldset className={styles.group}>
              <legend>Giao trực ban</legend>
              <div className={styles.list}>
                {members
                  .filter((m) => m.member_id !== duty.current?.member_id && !m.locked)
                  .map((m) => (
                    <div key={m.member_id} className={styles.member}>
                      <div className={styles.memberText}>
                        <span className={styles.memberName}>
                          {m.rank_label ? `${m.rank_label} ` : ''}
                          {m.full_name}
                        </span>
                        <span className={styles.memberSub}>{m.position || '—'}</span>
                      </div>
                      <button
                        type="button"
                        className={styles.small}
                        disabled={busyId === m.member_id}
                        onClick={() => onAssign(m)}
                      >
                        Giao trực ban
                      </button>
                    </div>
                  ))}
              </div>
            </fieldset>
          )}

          <fieldset className={styles.group}>
            <legend>Lịch sử trực ban</legend>
            <div className={styles.list}>
              {duty.history.map((d) => (
                <div key={d.id} className={styles.member}>
                  <div className={styles.memberText}>
                    <span className={styles.memberName}>
                      {d.rank_label ? `${d.rank_label} ` : ''}
                      {d.full_name}
                    </span>
                    <span className={styles.memberSub}>
                      {formatTime(d.started_at)} → {d.ended_at ? formatTime(d.ended_at) : 'đang trực'}
                      {d.assigned_by_name && ` · Giao bởi ${d.assigned_by_name}`}
                    </span>
                  </div>
                </div>
              ))}
              {duty.history.length === 0 && <div className={styles.hint}>Chưa có lịch sử.</div>}
            </div>
          </fieldset>
        </section>
      )}
    </div>
  );
}

function MemberForm({ initial, onCancel, onSaved }) {
  const [form, setForm] = useState(() =>
    initial
      ? {
          full_name: initial.full_name || '',
          badge_number: initial.badge_number || '',
          rank: initial.rank || '',
          position: initial.position || '',
          unit_role: initial.unit_role || 'MEMBER',
          phone: initial.phone || '',
        }
      : EMPTY,
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.full_name.trim()) return setError('Nhập họ tên');
    if (form.phone && !/^0\d{9}$/.test(form.phone))
      return setError('Số điện thoại gồm 10 số, bắt đầu bằng 0');
    setSaving(true);
    setError('');
    const payload = {
      full_name: form.full_name.trim(),
      badge_number: form.badge_number.trim() || null,
      rank: form.rank || null,
      position: form.position.trim() || null,
      unit_role: form.unit_role,
      phone: form.phone || null,
    };
    try {
      const result = initial ? await updateMember(initial.member_id, payload) : await createMember(payload);
      await onSaved(initial ? null : result);
    } catch (err) {
      setError(err.message || 'Lưu thất bại');
      setSaving(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={submit} noValidate>
      <fieldset className={styles.group}>
        <legend>{initial ? 'Sửa cán bộ' : 'Thêm cán bộ'}</legend>
        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Họ tên *</span>
            <input value={form.full_name} onChange={set('full_name')} autoFocus />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Số hiệu</span>
            <input value={form.badge_number} onChange={set('badge_number')} />
          </label>
        </div>
        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Cấp bậc hàm</span>
            <select value={form.rank} onChange={set('rank')}>
              <option value="">— Chưa chọn —</option>
              {RANKS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Chức vụ</span>
            <input value={form.position} onChange={set('position')} placeholder="vd: Phó trưởng Công an xã" />
          </label>
        </div>
        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Vai trò trong đơn vị</span>
            <select value={form.unit_role} onChange={set('unit_role')}>
              <option value="MEMBER">Cán bộ</option>
              <option value="COMMANDER">Chỉ huy</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Số điện thoại</span>
            <input inputMode="tel" value={form.phone} onChange={set('phone')} />
          </label>
        </div>
        {!initial && (
          <p className={styles.hint}>Lưu xong hệ thống hiện mã kích hoạt một lần để cán bộ tự đặt PIN.</p>
        )}
      </fieldset>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={saving}>
          {saving ? 'Đang lưu...' : 'Lưu'}
        </button>
        <button type="button" className={styles.secondary} onClick={onCancel} disabled={saving}>
          Huỷ
        </button>
      </div>
    </form>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
