import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/toast/toast-context';

import { getOfficerStatus, getProvinceOptions, getWardOptions, releaseIncident } from '../api/incidents';
import { Pager } from './list-controls';
import styles from './officer-status.module.css';

const MIN_REASON = 5;
const REFRESH_MS = 15000;
const PAGE_SIZE = 50;
const FILTER_KEY = 'officerStatusFilter'; // ADMIN's last unit, per browser
const EMPTY_FILTER = { level: '', provinceId: '', wardId: '', agency: '' };
// Mirrors be-v2 AgencyType; CSGT / PCCC call their levels Đội / Phòng
const AGENCIES = [
  ['POLICE', 'Công an'],
  ['CSGT', 'Cảnh sát giao thông'],
  ['FIRE', 'PCCC & CNCH'],
  ['HOSPITAL', 'Y tế 115'],
];

function readFilter(key) {
  try {
    return { ...EMPTY_FILTER, ...JSON.parse(localStorage.getItem(key) || '{}') };
  } catch {
    return EMPTY_FILTER;
  }
}

/**
 * Window "Thành viên" (also Settings → "Trạng thái cán bộ"): one page of the officers of ONE unit with
 * their status (online = command console open, busy = holding a case) and basic info. While I hold a
 * case I can hand it over to a colleague who is online and free (reason required, like the handover dialog).
 * A ward officer always sees their own unit; a province officer sees their own unit or picks one ward of
 * their province (same force's ward unit); an ADMIN first picks the unit: level + province (+ ward for
 * ward units), force optional (the BE refuses to list the whole country). "Chỉ trực tuyến" for everyone.
 *
 * @param {{ holding?: object|null, onChange?: (incident) => void, isAdmin?: boolean,
 *           provinceScope?: string|null }} props
 *   holding = the case I hold (from the live queue), onChange = apply the handed-over case to the queue,
 *   provinceScope = province_id of a province-level officer (enables the ward picker), null otherwise.
 */
export function OfficerStatusPanel({ holding, onChange, isAdmin = false, provinceScope = null }) {
  const pickWard = !isAdmin && !!provinceScope; // province officer: own unit or one ward of the province
  const filterKey = `${FILTER_KEY}:${isAdmin ? 'admin' : 'province'}`;
  const toast = useToast();
  const [result, setResult] = useState({
    status: 'loading',
    items: [],
    total: 0,
    totalPages: 1,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const [handoverTo, setHandoverTo] = useState(null); // memberId with the reason box open
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilterState] = useState(() =>
    isAdmin || pickWard ? readFilter(`${FILTER_KEY}:${isAdmin ? 'admin' : 'province'}`) : EMPTY_FILTER,
  );
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [provinces, setProvinces] = useState([]);
  const [wards, setWards] = useState([]);

  // ADMIN must pick one unit before anything is fetched; a province officer picking "cấp xã" needs a ward
  const ready = isAdmin
    ? !!filter.level && !!filter.provinceId && (filter.level !== 'WARD' || !!filter.wardId)
    : !pickWard || filter.level !== 'WARD' || !!filter.wardId;
  const wardProvince = isAdmin ? filter.provinceId : provinceScope;

  const setFilter = (patch) => {
    setFilterState((f) => {
      const next = { ...f, ...patch };
      try {
        localStorage.setItem(filterKey, JSON.stringify(next));
      } catch {
        // storage blocked: the filter only lasts while the window is open
      }
      return next;
    });
    setPage(0);
  };

  useEffect(() => {
    if (!isAdmin) return undefined;
    let alive = true;
    getProvinceOptions()
      .then((list) => alive && setProvinces(list))
      .catch(() => alive && setProvinces([]));
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if ((!isAdmin && !pickWard) || filter.level !== 'WARD' || !wardProvince) return undefined;
    let alive = true;
    getWardOptions(wardProvince)
      .then((list) => alive && setWards(list))
      .catch(() => alive && setWards([]));
    return () => {
      alive = false;
    };
  }, [isAdmin, pickWard, filter.level, wardProvince]);

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    // an officer's unit filters: only "this ward" (province officers); the BE keeps them in their scope
    const params = isAdmin
      ? filter
      : pickWard && filter.level === 'WARD'
        ? { level: 'WARD', wardId: filter.wardId }
        : {};
    getOfficerStatus({ ...params, online: onlineOnly, pageNo: page, pageSize: PAGE_SIZE })
      .then((r) => alive && setResult({ status: 'ready', ...r, error: null }))
      .catch((err) => alive && setResult((r) => ({ ...r, status: 'error', error: err.message })));
    const t = setTimeout(() => setTick((n) => n + 1), REFRESH_MS);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [tick, ready, isAdmin, pickWard, filter, onlineOnly, page]);

  const items = ready ? result.items : [];
  const onlineCount = items.filter((o) => o.online).length;
  // a case is only handed over inside my own unit, not to the ward unit I am looking at
  const canHandOver = holding && holding.heldByMe && !(pickWard && filter.level === 'WARD');

  const confirm = async (officer) => {
    if (note.trim().length < MIN_REASON) return;
    setBusy(true);
    try {
      const updated = await releaseIncident(holding.id, {
        toMemberId: officer.memberId,
        note: note.trim(),
      });
      if (updated) onChange?.(updated);
      toast.show(`Đã giao ca ${holding.id} cho ${officer.fullName}`, { tone: 'success' });
      setHandoverTo(null);
      setNote('');
      setTick((n) => n + 1);
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.panel}>
      {pickWard && (
        <div className={styles.filters}>
          <select
            className={styles.select}
            aria-label="Đơn vị"
            value={filter.level}
            onChange={(e) => setFilter({ level: e.target.value, wardId: '' })}
          >
            <option value="">Đơn vị của tôi (cấp tỉnh)</option>
            <option value="WARD">Đơn vị cấp xã trong tỉnh</option>
          </select>
          {filter.level === 'WARD' && (
            <select
              className={styles.select}
              aria-label="Xã / phường"
              value={filter.wardId}
              onChange={(e) => setFilter({ wardId: e.target.value })}
            >
              <option value="">Chọn xã / phường</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {isAdmin && (
        <div className={styles.filters}>
          <select
            className={styles.select}
            aria-label="Cấp đơn vị"
            value={filter.level}
            onChange={(e) => setFilter({ level: e.target.value, wardId: '' })}
          >
            <option value="">Chọn cấp</option>
            <option value="PROVINCE">Cấp tỉnh / phòng</option>
            <option value="WARD">Cấp xã / đội</option>
          </select>
          <select
            className={styles.select}
            aria-label="Tỉnh / thành phố"
            value={filter.provinceId}
            onChange={(e) => setFilter({ provinceId: e.target.value, wardId: '' })}
          >
            <option value="">Chọn tỉnh / thành phố</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {filter.level === 'WARD' && (
            <select
              className={styles.select}
              aria-label="Xã / phường"
              value={filter.wardId}
              disabled={!filter.provinceId}
              onChange={(e) => setFilter({ wardId: e.target.value })}
            >
              <option value="">{filter.provinceId ? 'Chọn xã / phường' : 'Chọn tỉnh trước'}</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
          <select
            className={styles.select}
            aria-label="Lực lượng"
            value={filter.agency}
            onChange={(e) => setFilter({ agency: e.target.value })}
          >
            <option value="">Tất cả lực lượng</option>
            {AGENCIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className={styles.summary}>
        <span>
          {ready && result.status === 'loading' && items.length === 0 ? (
            'Đang tải…'
          ) : ready ? (
            <>
              {result.total} cán bộ · <b className={styles.onlineText}>{onlineCount} trực tuyến</b>
              {result.totalPages > 1 && ' (trang này)'}
            </>
          ) : (
            'Chưa chọn đơn vị'
          )}
        </span>
        <span className={styles.summaryActions}>
          <label className={styles.onlineToggle}>
            <input
              type="checkbox"
              checked={onlineOnly}
              onChange={(e) => {
                setOnlineOnly(e.target.checked);
                setPage(0);
              }}
            />
            Chỉ trực tuyến
          </label>
          <button
            type="button"
            className={styles.refresh}
            disabled={!ready}
            onClick={() => setTick((n) => n + 1)}
          >
            Làm mới
          </button>
        </span>
      </div>
      {canHandOver && (
        <div className={styles.holding}>
          Bạn đang giữ ca <b>{holding.id}</b>. Chọn cán bộ đang trực tuyến và rảnh để giao ca.
        </div>
      )}

      <div className={styles.list}>
        {!ready && (
          <div className={styles.note}>
            {pickWard
              ? 'Chọn xã / phường để xem cán bộ của đơn vị cấp xã.'
              : 'Chọn cấp và tỉnh / thành phố (cấp xã: chọn thêm xã / phường) để xem cán bộ của một đơn vị.'}
          </div>
        )}
        {ready && result.status === 'loading' && items.length === 0 && (
          <div className={styles.note}>Đang tải...</div>
        )}
        {ready && result.status === 'error' && (
          <div className={styles.error}>Không tải được danh sách: {result.error}</div>
        )}
        {ready && result.status === 'ready' && items.length === 0 && (
          <div className={styles.note}>
            {onlineOnly ? 'Không có cán bộ nào đang trực tuyến.' : 'Đơn vị chưa có tài khoản cán bộ nào.'}
          </div>
        )}
        {items.map((o) => {
          const canTake = canHandOver && !o.isMe && o.online && !o.busy;
          const open = handoverTo === o.memberId;
          return (
            <div key={o.memberId} className={`${styles.row} ${o.online ? '' : styles.offline}`}>
              <div className={styles.rowMain}>
                <span className={styles.avatar} aria-hidden="true">
                  {initials(o.fullName)}
                  <i className={o.online ? styles.dotOn : styles.dotOff} />
                </span>
                <div className={styles.info}>
                  <div className={styles.name}>
                    {o.fullName}
                    {o.isMe && <span className={styles.me}>Bạn</span>}
                  </div>
                  <div className={styles.sub}>
                    {[o.unitLabel, o.ward || o.province].filter(Boolean).join(' · ')}
                  </div>
                  <div className={styles.sub}>
                    {o.phone ? <a href={`tel:${o.phone}`}>{o.phone}</a> : 'Chưa có SĐT'} · {o.email}
                  </div>
                </div>
                <div className={styles.state}>
                  <span className={o.online ? styles.chipOn : styles.chipOff}>
                    {o.online ? 'Trực tuyến' : 'Ngoại tuyến'}
                  </span>
                  {o.heldIncident ? (
                    <span className={styles.chipBusy} title={o.heldIncident.statusLabel}>
                      Giữ ca {o.heldIncident.id}
                    </span>
                  ) : (
                    o.online && <span className={styles.chipFree}>Đang rảnh</span>
                  )}
                </div>
              </div>
              {canTake && !open && (
                <button
                  type="button"
                  className={styles.handoverBtn}
                  onClick={() => {
                    setHandoverTo(o.memberId);
                    setNote('');
                  }}
                >
                  Giao ca {holding.id} cho cán bộ này
                </button>
              )}
              {open && (
                <div className={styles.handoverBox}>
                  <label className={styles.reasonLabel} htmlFor={`reason-${o.memberId}`}>
                    Lý do giao ca *
                  </label>
                  <textarea
                    id={`reason-${o.memberId}`}
                    className={styles.reason}
                    rows={2}
                    maxLength={255}
                    value={note}
                    placeholder="Ví dụ: hết ca trực, chuyển cho đồng chí trực đêm"
                    onChange={(e) => setNote(e.target.value)}
                  />
                  {note.trim().length > 0 && note.trim().length < MIN_REASON && (
                    <div className={styles.reasonError}>Lý do ít nhất {MIN_REASON} ký tự</div>
                  )}
                  <div className={styles.handoverActions}>
                    <button type="button" className={styles.cancel} onClick={() => setHandoverTo(null)}>
                      Huỷ
                    </button>
                    <button
                      type="button"
                      className={styles.confirm}
                      disabled={busy || note.trim().length < MIN_REASON}
                      onClick={() => confirm(o)}
                    >
                      {busy ? 'Đang giao...' : 'Xác nhận giao ca'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {ready && result.totalPages > 1 && (
        <Pager page={page} totalPages={result.totalPages} onPage={setPage} />
      )}
    </div>
  );
}

function initials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'CB';
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}
