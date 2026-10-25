import { Modal } from '@/components/ui/modal/modal';

import { isIosSafari } from './install-prompt';

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={iconStyle}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={iconStyle}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);
const DotsIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    aria-hidden="true"
    style={{ ...iconStyle, fill: 'currentColor' }}
  >
    <circle cx="12" cy="5" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="12" cy="19" r="1.8" />
  </svg>
);
const iconStyle = {
  verticalAlign: '-4px',
  margin: '0 3px',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const STEPS = {
  ios: [
    <>
      Bấm nút <b>Chia sẻ</b> <ShareIcon /> ở thanh dưới (iPad: góc trên bên phải).
    </>,
    <>
      Kéo xuống, chọn <b>Thêm vào MH chính</b> <PlusIcon />.
    </>,
    <>
      Bấm <b>Thêm</b>. Biểu tượng SOS Việt Nam sẽ nằm trên màn hình chính.
    </>,
  ],
  android: [
    <>
      Bấm nút <b>menu</b> <DotsIcon /> ở góc trên bên phải trình duyệt.
    </>,
    <>
      Chọn <b>Thêm vào màn hình chính</b> (hoặc <b>Cài đặt ứng dụng</b>).
    </>,
    <>
      Bấm <b>Thêm</b> / <b>Cài đặt</b> để xác nhận.
    </>,
  ],
  desktop: [
    <>
      Bấm biểu tượng <b>cài đặt</b> <PlusIcon /> ở cuối thanh địa chỉ (Chrome / Edge).
    </>,
    <>
      Hoặc mở menu <DotsIcon />, chọn <b>Cài đặt SOS Việt Nam</b>.
    </>,
  ],
};

/**
 * Manual steps when the browser can't show its own install dialog: always on iOS, and on Android /
 * desktop browsers without `beforeinstallprompt` (Firefox, Zalo / Facebook in-app browsers...).
 */
export function InstallGuideModal({ open, onClose, platform }) {
  const steps = STEPS[platform] || STEPS.android;
  const iosOtherBrowser = platform === 'ios' && !isIosSafari();
  return (
    <Modal
      open={open}
      onClose={onClose}
      containerStyle={{ maxWidth: 440 }}
      titleStyle={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: 8 }}
      title="CÀI LỐI TẮT RA MÀN HÌNH CHÍNH"
    >
      <p style={{ margin: '0 0 12px', color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>
        Mở SOS Việt Nam bằng một chạm từ màn hình chính, toàn màn hình như ứng dụng.
      </p>
      {iosOtherBrowser && (
        <p style={warnStyle}>
          Nếu không thấy mục <b>Thêm vào MH chính</b>, mở trang này bằng <b>Safari</b> rồi làm lại.
        </p>
      )}
      <ol
        style={{
          margin: 0,
          paddingLeft: 20,
          display: 'grid',
          gap: 10,
          color: '#f1f5f9',
          fontSize: 15,
          lineHeight: 1.5,
        }}
      >
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {platform === 'android' && (
        <p style={{ ...warnStyle, marginTop: 14 }}>
          Đang mở trong Zalo / Facebook? Bấm <DotsIcon /> chọn <b>Mở bằng trình duyệt</b> (Chrome) trước.
        </p>
      )}
      <button
        type="button"
        className="btn-refresh-loc"
        onClick={onClose}
        style={{
          marginTop: 16,
          width: '100%',
          justifyContent: 'center',
          padding: 12,
          fontWeight: 800,
          borderRadius: 12,
        }}
      >
        Đã hiểu
      </button>
    </Modal>
  );
}

const warnStyle = {
  margin: '0 0 12px',
  padding: '8px 10px',
  borderRadius: 10,
  background: 'rgba(251, 191, 36, 0.12)',
  color: '#fde68a',
  fontSize: 13,
  lineHeight: 1.45,
};
