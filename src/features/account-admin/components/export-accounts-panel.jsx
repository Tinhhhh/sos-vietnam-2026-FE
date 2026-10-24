import { useEffect, useState } from 'react';

import {
  SettingsButton,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
} from '@/components/ui/settings-dialog/settings-dialog';
import { useToast } from '@/components/ui/toast/toast-context';

import { exportAccounts, getProvinces } from '../api/accounts';
import { AGENCIES } from '../data/agencies';

const LEVEL_LABELS = { NATIONAL: 'Toàn quốc', PROVINCE: 'Cấp tỉnh / phòng', WARD: 'Cấp xã / đội' };

/** "20261024-1642" (local time) for the file name. */
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Settings → Quản trị → "Xuất danh sách tài khoản" (ADMIN): pick province / force / level (all optional)
 * and download the .xlsx (accounts sheet + officers sheet).
 */
export function ExportAccountsPanel() {
  const toast = useToast();
  const [provinces, setProvinces] = useState([]);
  const [provinceId, setProvinceId] = useState('');
  const [agency, setAgency] = useState('');
  const [level, setLevel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getProvinces()
      .then((list) => alive && setProvinces(list))
      .catch(() => alive && setError('Không tải được danh sách tỉnh/thành phố'));
    return () => {
      alive = false;
    };
  }, []);

  // a force only has some levels (HOSPITAL: province only); without a force any level can be picked
  const levels = agency
    ? AGENCIES.find((a) => a.value === agency)?.levels || []
    : [
        ['PROVINCE', LEVEL_LABELS.PROVINCE],
        ['WARD', LEVEL_LABELS.WARD],
      ];

  const pickAgency = (value) => {
    setAgency(value);
    const allowed = value ? AGENCIES.find((a) => a.value === value)?.levels.map(([v]) => v) || [] : null;
    if (allowed && level && !allowed.includes(level)) setLevel('');
  };

  const download = async () => {
    setBusy(true);
    setError('');
    try {
      const blob = await exportAccounts({ provinceId, agency, level });
      const province = provinces.find((p) => p.code === provinceId);
      const scope = [province?.name, AGENCIES.find((a) => a.value === agency)?.label]
        .filter(Boolean)
        .join('-')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/gi, 'd')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .toLowerCase();
      saveBlob(blob, `danh-sach-tai-khoan${scope ? `-${scope}` : ''}-${stamp()}.xlsx`);
      toast.show('Đã tải file Excel danh sách tài khoản', { tone: 'success' });
    } catch (err) {
      setError(err.message || 'Xuất file thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection title="Xuất danh sách tài khoản">
      <SettingsRow title="Tỉnh / thành phố" desc="Bỏ trống để xuất toàn quốc.">
        <SettingsSelect value={provinceId} onChange={(e) => setProvinceId(e.target.value)} disabled={busy}>
          <option value="">Toàn quốc</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </SettingsSelect>
      </SettingsRow>
      <SettingsRow title="Lực lượng">
        <SettingsSelect value={agency} onChange={(e) => pickAgency(e.target.value)} disabled={busy}>
          <option value="">Tất cả lực lượng</option>
          {AGENCIES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </SettingsSelect>
      </SettingsRow>
      <SettingsRow title="Cấp đơn vị">
        <SettingsSelect value={level} onChange={(e) => setLevel(e.target.value)} disabled={busy}>
          <option value="">Tất cả các cấp</option>
          {levels.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </SettingsSelect>
      </SettingsRow>
      <SettingsRow
        title="File Excel (.xlsx)"
        desc={
          <>
            Sheet <b>Danh sách tài khoản</b> (kèm chỉ huy, trực ban hiện tại) và sheet <b>Cán bộ</b>. Cột mật
            khẩu / PIN chỉ hiện giá trị seed còn dùng; đã đổi thì ghi “không xem được”. Toàn quốc mất khoảng
            10–20 giây.
          </>
        }
      >
        <SettingsButton variant="primary" onClick={download} disabled={busy}>
          {busy ? 'Đang xuất…' : 'Tải file Excel'}
        </SettingsButton>
      </SettingsRow>
      {error && (
        <div role="alert" style={{ marginTop: 12, color: '#fca5a5', fontSize: 13 }}>
          {error}
        </div>
      )}
    </SettingsSection>
  );
}
