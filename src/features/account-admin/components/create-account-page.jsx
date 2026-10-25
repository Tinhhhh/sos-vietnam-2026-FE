import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { createAccount, getProvinces, getWardsOfProvince } from '../api/accounts';
import { AGENCIES } from '../data/agencies';
import styles from './create-account.module.css';

const EMPTY = {
  role_name: 'OFFICER',
  agency_type: 'POLICE',
  unit_level: 'WARD',
  last_name: '',
  first_name: '',
  email: '',
  phone: '',
  password: '',
  confirm: '',
  province_id: '',
  ward_id: '',
  address: '',
};

// be-v2 validation errors are keyed by Java field name
const SERVER_FIELD = {
  lastName: 'last_name',
  firstName: 'first_name',
  email: 'email',
  password: 'password',
  phone: 'phone',
  address: 'address',
  roleName: 'role_name',
  agencyType: 'agency_type',
  unitLevel: 'unit_level',
  provinceId: 'province_id',
  wardId: 'ward_id',
};

const NAME_RE = /^[\p{L}\s]*$/u;

function validate(f) {
  const e = {};
  if (!f.last_name.trim()) e.last_name = 'Nhập họ';
  else if (!NAME_RE.test(f.last_name)) e.last_name = 'Họ chỉ được chứa chữ cái';
  if (!f.first_name.trim()) e.first_name = 'Nhập tên';
  else if (!NAME_RE.test(f.first_name)) e.first_name = 'Tên chỉ được chứa chữ cái';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Email không hợp lệ';
  if (f.phone && !/^0\d{9}$/.test(f.phone)) e.phone = 'Gồm 10 số, bắt đầu bằng 0';
  if (f.password.length < 8) e.password = 'Ít nhất 8 ký tự';
  if (f.confirm !== f.password) e.confirm = 'Mật khẩu nhập lại không khớp';
  if (!f.province_id) e.province_id = 'Chọn tỉnh/thành phố';
  if (!f.ward_id) e.ward_id = 'Chọn xã/phường';
  return e;
}

/**
 * ADMIN creates an officer / admin account. Address keeps only the detail part;
 * ward + province are picked from the lists and the full address is previewed.
 *
 * @param {{ backHref: string }} props
 */
export function CreateAccountPage({ backHref }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const [provinces, setProvinces] = useState([]);
  const [wards, setWards] = useState([]);
  const [wardsLoading, setWardsLoading] = useState(false);
  const [wardQuery, setWardQuery] = useState('');

  const isOfficer = form.role_name === 'OFFICER';
  const agency = AGENCIES.find((a) => a.value === form.agency_type);
  const wardIsHeadquarters = !isOfficer || form.unit_level === 'PROVINCE';

  useEffect(() => {
    getProvinces()
      .then((list) => setProvinces([...list].sort((a, b) => a.name.localeCompare(b.name, 'vi'))))
      .catch(() => setSubmitError('Không tải được danh sách tỉnh/thành phố'));
  }, []);

  useEffect(() => {
    if (!form.province_id) {
      setWards([]);
      return;
    }
    let alive = true;
    setWardsLoading(true);
    getWardsOfProvince(form.province_id)
      .then((list) => alive && setWards([...list].sort((a, b) => a.name.localeCompare(b.name, 'vi'))))
      .catch(() => alive && setWards([]))
      .finally(() => alive && setWardsLoading(false));
    return () => {
      alive = false;
    };
  }, [form.province_id]);

  const shownWards = useMemo(() => {
    const q = wardQuery.trim().toLowerCase();
    if (!q) return wards;
    return wards.filter((w) => w.name.toLowerCase().includes(q) || String(w.id) === form.ward_id);
  }, [wards, wardQuery, form.ward_id]);

  const provinceName = provinces.find((p) => p.code === form.province_id)?.name;
  const wardName = wards.find((w) => String(w.id) === form.ward_id)?.name;
  const fullAddress = [form.address.trim(), wardName, provinceName].filter(Boolean).join(', ');

  function set(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === 'agency_type') {
        const levels = AGENCIES.find((a) => a.value === value).levels.map(([v]) => v);
        if (!levels.includes(next.unit_level)) next.unit_level = levels[0];
      }
      if (field === 'province_id') {
        next.ward_id = '';
        setWardQuery('');
      }
      return next;
    });
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
    setSubmitError('');
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const account = await createAccount({
        role_name: form.role_name,
        agency_type: isOfficer ? form.agency_type : null,
        unit_level: isOfficer ? form.unit_level : null,
        last_name: form.last_name.trim(),
        first_name: form.first_name.trim(),
        email: form.email.trim(),
        phone: form.phone || null,
        password: form.password,
        province_id: form.province_id,
        ward_id: Number(form.ward_id),
        address: form.address.trim() || null,
      });
      setCreated(account);
    } catch (err) {
      const fieldErrors = err.data?.data && typeof err.data.data === 'object' ? err.data.data : null;
      if (fieldErrors) {
        const mapped = {};
        for (const [k, v] of Object.entries(fieldErrors)) mapped[SERVER_FIELD[k] || k] = v;
        setErrors(mapped);
      }
      if (err.status === 409) setErrors((x) => ({ ...x, email: err.message }));
      setSubmitError(err.message || 'Tạo tài khoản thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setCreated(null);
    setForm((f) => ({
      ...EMPTY,
      role_name: f.role_name,
      agency_type: f.agency_type,
      unit_level: f.unit_level,
      province_id: f.province_id,
    }));
    setErrors({});
  }

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <Link to={backHref} className={styles.back}>
          ← Bàn chỉ huy
        </Link>
        <div>
          <h1 className={styles.title}>Tạo tài khoản</h1>
          <div className={styles.subtitle}>Trung tâm chỉ huy · Tài khoản cán bộ và quản trị</div>
        </div>
      </header>

      {created ? (
        <section className={styles.card}>
          <div className={styles.success}>Đã tạo tài khoản {created.email}</div>
          <dl className={styles.summary}>
            <dt>Họ tên</dt>
            <dd>{created.full_name}</dd>
            <dt>Vai trò</dt>
            <dd>{created.role_name === 'ADMIN' ? 'Quản trị' : 'Cán bộ'}</dd>
            {created.agency_type && (
              <>
                <dt>Đơn vị</dt>
                <dd>
                  {AGENCIES.find((a) => a.value === created.agency_type)?.label} ·{' '}
                  {
                    AGENCIES.find((a) => a.value === created.agency_type)?.levels.find(
                      ([v]) => v === created.unit_level,
                    )?.[1]
                  }
                </dd>
              </>
            )}
            <dt>Địa chỉ</dt>
            <dd>{created.full_address || '—'}</dd>
            <dt>Điện thoại</dt>
            <dd>{created.phone || '—'}</dd>
            {created.activation_code && (
              <>
                <dt>Mã kích hoạt</dt>
                <dd>
                  <strong style={{ fontSize: 18, letterSpacing: 3 }}>{created.activation_code}</strong>
                  <div className={styles.hint} style={{ margin: '4px 0 0' }}>
                    Chỉ hiện một lần, hết hạn sau 72 giờ. Người được tạo là chỉ huy của đơn vị: đăng nhập bằng
                    email + mật khẩu đơn vị, chọn tên mình, nhập mã này rồi tự đặt PIN.
                  </div>
                </dd>
              </>
            )}
          </dl>
          <p className={styles.hint}>
            Gửi mật khẩu ban đầu cho cán bộ qua kênh riêng, nhắc họ đổi sau khi đăng nhập.
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={startOver}>
              Tạo tài khoản khác
            </button>
            <Link to={backHref} className={styles.secondary}>
              Về bàn chỉ huy
            </Link>
          </div>
        </section>
      ) : (
        <form className={styles.card} onSubmit={onSubmit} noValidate>
          <fieldset className={styles.group}>
            <legend>Vai trò & đơn vị</legend>
            <div className={styles.segment} role="radiogroup" aria-label="Vai trò">
              {[
                ['OFFICER', 'Cán bộ'],
                ['ADMIN', 'Quản trị'],
              ].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={form.role_name === v}
                  className={form.role_name === v ? styles.segOn : styles.seg}
                  onClick={() => set('role_name', v)}
                >
                  {label}
                </button>
              ))}
            </div>
            {isOfficer ? (
              <div className={styles.row}>
                <Field label="Lực lượng *" error={errors.agency_type}>
                  <select value={form.agency_type} onChange={(e) => set('agency_type', e.target.value)}>
                    {AGENCIES.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cấp *" error={errors.unit_level}>
                  <select value={form.unit_level} onChange={(e) => set('unit_level', e.target.value)}>
                    {agency.levels.map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : (
              <p className={styles.hint}>
                Tài khoản quản trị thuộc Trung tâm chỉ huy (cấp Bộ), xem được toàn quốc.
              </p>
            )}
          </fieldset>

          <fieldset className={styles.group}>
            <legend>Thông tin cá nhân</legend>
            <div className={styles.row}>
              <Field label="Họ và tên đệm *" error={errors.last_name}>
                <input
                  value={form.last_name}
                  onChange={(e) => set('last_name', e.target.value)}
                  placeholder="Nguyễn Văn"
                  autoComplete="off"
                />
              </Field>
              <Field label="Tên *" error={errors.first_name}>
                <input
                  value={form.first_name}
                  onChange={(e) => set('first_name', e.target.value)}
                  placeholder="An"
                  autoComplete="off"
                />
              </Field>
            </div>
            <div className={styles.row}>
              <Field label="Email đăng nhập *" error={errors.email}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="congan.tanan@sos.vn"
                  autoComplete="off"
                />
              </Field>
              <Field label="Số điện thoại" error={errors.phone}>
                <input
                  inputMode="numeric"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="0912345678"
                />
              </Field>
            </div>
            <div className={styles.row}>
              <Field label="Mật khẩu ban đầu *" error={errors.password}>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Nhập lại mật khẩu *" error={errors.confirm}>
                <input
                  type="password"
                  value={form.confirm}
                  onChange={(e) => set('confirm', e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>Địa bàn & trụ sở</legend>
            <div className={styles.row}>
              <Field label="Tỉnh/thành phố *" error={errors.province_id}>
                <select value={form.province_id} onChange={(e) => set('province_id', e.target.value)}>
                  <option value="">— Chọn tỉnh/thành phố —</option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={wardIsHeadquarters ? 'Xã/phường đặt trụ sở *' : 'Xã/phường phụ trách *'}
                error={errors.ward_id}
              >
                <input
                  className={styles.search}
                  value={wardQuery}
                  onChange={(e) => setWardQuery(e.target.value)}
                  placeholder={form.province_id ? 'Tìm xã/phường…' : 'Chọn tỉnh trước'}
                  disabled={!form.province_id}
                />
                <select
                  value={form.ward_id}
                  onChange={(e) => set('ward_id', e.target.value)}
                  disabled={!form.province_id || wardsLoading}
                >
                  <option value="">
                    {wardsLoading ? 'Đang tải…' : `— Chọn xã/phường (${shownWards.length}) —`}
                  </option>
                  {shownWards.map((w) => (
                    <option key={w.id} value={String(w.id)}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Địa chỉ chi tiết" error={errors.address}>
              <input
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Số nhà, đường, khu vực (không ghi xã/tỉnh)"
                maxLength={255}
              />
            </Field>
            <div className={styles.preview}>
              <span>Địa chỉ đầy đủ:</span> {fullAddress || '—'}
            </div>
          </fieldset>

          {submitError && <div className={styles.error}>{submitError}</div>}
          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Đang tạo…' : 'Tạo tài khoản'}
            </button>
            <Link to={backHref} className={styles.secondary}>
              Huỷ
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </label>
  );
}
