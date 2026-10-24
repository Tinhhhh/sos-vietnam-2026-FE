import styles from './account-panels.module.css';

const AGENCY = { POLICE: 'Công an', CSGT: 'Cảnh sát giao thông', FIRE: 'PCCC & CNCH', HOSPITAL: 'Y tế 115' };
const LEVEL = { NATIONAL: 'Cấp Bộ / quốc gia', PROVINCE: 'Cấp tỉnh / thành phố', WARD: 'Cấp xã / phường' };
const ROLE = { ADMIN: 'Quản trị hệ thống', OFFICER: 'Cán bộ', CITIZEN: 'Người dân' };
const DATE = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Settings → "Hồ sơ": the signed-in account (GET /auth/me), read-only.
 * @param {{ user: object, unitName?: string }} props  user = /auth/me data (snake_case)
 */
export function OfficerInfoPanel({ user, unitName }) {
  if (!user) return null;
  const created = user.created_date ? new Date(user.created_date) : null;
  const rows = [
    ['Họ và tên', user.full_name],
    ['Email', user.email],
    ['Số điện thoại', user.phone],
    ['Vai trò', ROLE[user.role_name] || user.role_name],
    ['Đơn vị', unitName],
    ['Lực lượng', AGENCY[user.agency_type]],
    ['Cấp', LEVEL[user.unit_level]],
    ['Xã / phường', user.ward],
    ['Tỉnh / thành phố', user.province],
    ['Địa chỉ trụ sở', user.full_address || user.address],
    ['Ngày tạo tài khoản', created && !Number.isNaN(created.getTime()) ? DATE.format(created) : null],
  ];
  return (
    <div className={styles.info}>
      <div className={styles.infoHead}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(user.full_name)}
        </span>
        <div>
          <div className={styles.infoName}>{user.full_name || user.email}</div>
          <div className={styles.infoSub}>{unitName}</div>
        </div>
      </div>
      <dl className={styles.rows}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.row}>
            <dt>{label}</dt>
            <dd>{value || 'Chưa cập nhật'}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.hint}>
        Cần sửa thông tin? Liên hệ quản trị hệ thống. Đổi mật khẩu / PIN ở mục Bảo mật.
      </div>
    </div>
  );
}

function initials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'CB';
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}
