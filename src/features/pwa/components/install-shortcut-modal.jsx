import { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';

import styles from './install-shortcut-modal.module.css';

export function InstallShortcutModal({ open, onClose }) {
  const [activeTab, setActiveTab] = useState('ios');
  const [isInApp, setIsInApp] = useState(false);
  const [desktopDownloaded, setDesktopDownloaded] = useState(false);
  const [showBeacon, setShowBeacon] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);
    if (isIOS) setActiveTab('ios');
    else if (isAndroid) setActiveTab('android');
    else setActiveTab('desktop');

    const inApp = /FBAN|FBAV|Instagram|Line|KAKAOTALK|Zalo|Snapchat|MicroMessenger/i.test(ua);
    setIsInApp(inApp);
  }, [open]);

  const handleDownloadDesktopShortcut = () => {
    try {
      const currentUrl = window.location.origin + window.location.pathname;
      const shortcutContent = `[InternetShortcut]\r\nURL=${currentUrl}\r\nIconIndex=0\r\nIconFile=${window.location.origin}/assets/icons/icon-192x192.png\r\nHotKey=0\r\n`;
      const blob = new Blob([shortcutContent], { type: 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'SOS_Viet_Nam_2026.url';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      setDesktopDownloaded(true);
    } catch (err) {
      console.warn('Error downloading desktop shortcut:', err);
    }
  };

  const handleTriggerIosShare = () => {
    setShowBeacon(true);
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="TẠO LỐI TẮT RA MÀN HÌNH CHÍNH"
        titleStyle={{ color: '#34d399', fontSize: '15px', fontWeight: 800 }}
        containerStyle={{ maxWidth: '500px' }}
      >
        <div className={styles.appIconPreview}>
          <img
            src="/assets/icons/icon-192x192.png"
            alt="SOS Việt Nam Icon"
            className={styles.appIconImg}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: '14px', color: '#ffffff' }}>SOS CỨU HỘ VIỆT NAM</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Mở khẩn cấp chỉ với 1-chạm không cần tìm link web</div>
          </div>
        </div>

        <div className={styles.installDeviceTabs}>
          <button
            type="button"
            className={`${styles.installTabBtn}${activeTab === 'ios' ? ` ${styles.isActive}` : ''}`}
            onClick={() => setActiveTab('ios')}
          >
            iPhone / iPad
          </button>
          <button
            type="button"
            className={`${styles.installTabBtn}${activeTab === 'android' ? ` ${styles.isActive}` : ''}`}
            onClick={() => setActiveTab('android')}
          >
            Android
          </button>
          <button
            type="button"
            className={`${styles.installTabBtn}${activeTab === 'desktop' ? ` ${styles.isActive}` : ''}`}
            onClick={() => setActiveTab('desktop')}
          >
            PC / Laptop
          </button>
        </div>

        {activeTab === 'ios' && (
          <div className={styles.installTabContent}>
            <div className={styles.installNativeActionBox}>
              <button
                type="button"
                className={`${styles.btnInstallNative} ${styles.btnInstallIosNative}`}
                onClick={handleTriggerIosShare}
              >
                👇 CHỈ DẪN TẠO LỐI TẮT BẰNG SAFARI (BẤM NÚT [↑])
              </button>
              <div className={styles.iosAlertBox}>
                ⚠️ <strong>Quy định bảo mật của Apple iOS:</strong> Web không được phép tự động ghim icon mà <em>bắt buộc</em> người dùng bấm biểu tượng <strong>Chia sẻ [↑]</strong> ở thanh dưới cùng Safari rồi chọn <strong>"Thêm vào MH chính"</strong>.
              </div>
              {isInApp && (
                <div className={styles.inAppBrowserAlert}>
                  🚨 <strong>Bạn đang mở trong ứng dụng khác (Zalo / Facebook / Messenger):</strong> Hãy nhấn dấu <strong>⋯</strong> hoặc <strong>⋮</strong> ở góc trên và chọn <strong>"Mở bằng trình duyệt Safari"</strong> để tạo lối tắt ra màn hình chính.
                </div>
              )}
            </div>

            <div className={styles.installStepCard}>
              <div className={styles.stepNumBadge}>1</div>
              <div className={styles.stepDescWrap}>
                <div className={styles.stepTitle}>Nhấn nút Chia sẻ (Share)</div>
                <div className={styles.stepSub}>
                  Trên trình duyệt Safari, bấm vào biểu tượng hình vuông có mũi tên trỏ lên <span className={styles.iosShareBadge}>[↑] Chia sẻ</span> ở thanh công cụ dưới màn hình.
                </div>
              </div>
            </div>

            <div className={styles.installStepCard}>
              <div className={styles.stepNumBadge}>2</div>
              <div className={styles.stepDescWrap}>
                <div className={styles.stepTitle}>Chọn "Thêm vào MH chính"</div>
                <div className={styles.stepSub}>
                  Cuộn menu bảng chia sẻ xuống dưới và nhấn chọn mục <strong>"Thêm vào MH chính"</strong> (hoặc <em>"Add to Home Screen ⊞"</em>).
                </div>
              </div>
            </div>

            <div className={styles.installStepCard}>
              <div className={styles.stepNumBadge}>3</div>
              <div className={styles.stepDescWrap}>
                <div className={styles.stepTitle}>Xác nhận "Thêm"</div>
                <div className={styles.stepSub}>
                  Nhấn nút <strong>"Thêm" (Add)</strong> ở góc trên bên phải màn hình để hoàn tất!
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'android' && (
          <div className={styles.installTabContent}>
            <div className={styles.installStepCard}>
              <div className={styles.stepNumBadge}>1</div>
              <div className={styles.stepDescWrap}>
                <div className={styles.stepTitle}>Mở Menu trình duyệt</div>
                <div className={styles.stepSub}>
                  Nhấn vào biểu tượng <strong>Menu 3 chấm ⋮</strong> ở góc trên bên phải Google Chrome hoặc Samsung Internet.
                </div>
              </div>
            </div>

            <div className={styles.installStepCard}>
              <div className={styles.stepNumBadge}>2</div>
              <div className={styles.stepDescWrap}>
                <div className={styles.stepTitle}>Chọn "Cài đặt ứng dụng"</div>
                <div className={styles.stepSub}>
                  Chọn dòng <strong>"Cài đặt ứng dụng"</strong> (hoặc <em>"Thêm vào Màn hình chính" / "Install App"</em>). Biểu tượng SOS sẽ xuất hiện ngay ngoài màn hình chính.
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'desktop' && (
          <div className={styles.installTabContent}>
            <div className={styles.installNativeActionBox}>
              <button
                type="button"
                className={`${styles.btnInstallNative} ${styles.btnInstallDesktopNative}`}
                onClick={handleDownloadDesktopShortcut}
              >
                CÀI ỨNG DỤNG LỐI TẮT MÀN HÌNH CHÍNH (1 CLICK)
              </button>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                {desktopDownloaded ? (
                  <strong style={{ color: '#34d399' }}>✅ Đã tải tệp lối tắt (.url) về máy! Hãy kéo ra Desktop.</strong>
                ) : (
                  'Bấm nút để tải tệp lối tắt Desktop mở ngay lập tức'
                )}
              </div>
            </div>

            <div className={styles.installStepCard}>
              <div className={styles.stepNumBadge}>1</div>
              <div className={styles.stepDescWrap}>
                <div className={styles.stepTitle}>Cài đặt PWA trên Chrome / Edge</div>
                <div className={styles.stepSub}>
                  Nhìn lên góc phải thanh địa chỉ, bấm biểu tượng <strong>Cài đặt [ ⊕ ]</strong> để mở như ứng dụng riêng.
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: '16px' }}>
          <button
            type="button"
            className="btn-refresh-loc"
            style={{ width: '100%', justifyContent: 'center', minHeight: '42px', fontWeight: 700 }}
            onClick={onClose}
          >
            Đã Hiểu, Đóng Hướng Dẫn
          </button>
        </div>
      </Modal>

      {showBeacon && (
        <div className={styles.iosBeacon} aria-hidden="false">
          <div className={styles.iosBeaconContent}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={styles.iosBeaconBadge}>3 BƯỚC TẠO LỐI TẮT</span>
                <span style={{ fontWeight: 800, fontSize: '12px', color: '#38bdf8' }}>Thêm vào MH chính</span>
              </div>
              <button
                type="button"
                className={styles.iosBeaconClose}
                onClick={() => setShowBeacon(false)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>
            <div className={styles.iosBeaconText}>
              <div>1. Bấm biểu tượng <strong>Chia sẻ [↑]</strong> ở thanh công cụ dưới cùng Safari 👇</div>
              <div>2. Kéo lên và chọn dòng <strong>"Thêm vào MH chính"</strong> (Add to Home Screen)</div>
              <div>3. Bấm <strong>"Thêm" (Add)</strong> ở góc trên bên phải để hoàn tất!</div>
            </div>
          </div>
          <div className={styles.iosBeaconPointer}>
            <div className={styles.iosBeaconArrow}>▼</div>
          </div>
        </div>
      )}
    </>
  );
}
