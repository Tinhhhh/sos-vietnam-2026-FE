import { useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';

import styles from './location-permission-dialog.module.css';

// shown once per tab session; "Thử lại" that is still refused shows it again
const SEEN_KEY = 'sos_location_denied_seen';
const seen = () => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
};
const markSeen = () => {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // storage blocked: shows again on the next visit
  }
};

function platform() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

const STEPS = {
  ios: [
    'Mở Cài đặt của iPhone → Quyền riêng tư & Bảo mật → Dịch vụ định vị: bật lên.',
    'Trong danh sách đó chọn Safari (hoặc trình duyệt bạn dùng) → "Khi dùng ứng dụng" và bật "Vị trí chính xác".',
    'Quay lại trang này, bấm "aA" cạnh thanh địa chỉ → Cài đặt trang web → Vị trí → Cho phép.',
  ],
  android: [
    'Bấm biểu tượng ổ khoá / cài đặt cạnh địa chỉ trang web.',
    'Chọn Quyền (hoặc Cài đặt trang web) → Vị trí → Cho phép.',
    'Nếu vẫn không được: Cài đặt điện thoại → Vị trí: bật, và cho phép trình duyệt dùng vị trí.',
  ],
  desktop: [
    'Bấm biểu tượng ổ khoá cạnh địa chỉ trang web.',
    'Ở mục Vị trí chọn Cho phép, rồi tải lại trang.',
  ],
};

/**
 * Warning when the citizen refused location: without GPS the rescue forces can hardly find them.
 * The browser never asks a second time by itself, so it explains how to turn location on.
 * @param {{ geo: ReturnType<import('../hooks/use-geolocation').useGeolocation>, onPickOnMap?: () => void }} props
 */
export function LocationPermissionDialog({ geo, onPickOnMap }) {
  const [dismissed, setDismissed] = useState(seen);
  const [retrying, setRetrying] = useState(false);
  const [stillDenied, setStillDenied] = useState(false);
  const open = geo.permissionDenied && !dismissed;

  const close = () => {
    markSeen();
    setDismissed(true);
  };
  const retry = async () => {
    setRetrying(true);
    const fix = await geo.refresh();
    setRetrying(false);
    if (fix && !fix.permissionDenied) close();
    else setStillDenied(true);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      solid
      containerStyle={{ maxWidth: 460 }}
      title="Chưa cho phép truy cập vị trí"
    >
      <div className={styles.body}>
        <div className={styles.warn} role="alert">
          <strong>Lực lượng cứu hộ sẽ rất khó tìm thấy bạn.</strong> Khi không cho phép vị trí, tin báo SOS
          chỉ có vị trí ước lượng theo mạng, có thể lệch vài km, hoặc không có vị trí.
        </div>
        <p className={styles.lead}>Cách bật lại vị trí:</p>
        <ol className={styles.steps}>
          {STEPS[platform()].map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {stillDenied && (
          <p className={styles.still}>Vẫn chưa được cho phép. Làm theo các bước trên rồi bấm "Thử lại".</p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={retry} disabled={retrying}>
            {retrying ? 'Đang thử lại...' : 'Thử lại'}
          </button>
          {onPickOnMap && (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                close();
                onPickOnMap();
              }}
            >
              Chọn vị trí trên bản đồ
            </button>
          )}
          <button type="button" className={styles.ghost} onClick={close}>
            Để sau
          </button>
        </div>
      </div>
    </Modal>
  );
}
