import { useEffect, useMemo, useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';

import { buildFamilyMessage, buildSmsUri, loadFamilyPhones, saveFamilyPhones } from '../utils/family-message';
import styles from './family-sos-modal.module.css';

/**
 * "SOS Người Thân": stores two family numbers and sends them an SMS with the
 * current GPS position (Web Share on mobile, sms: link otherwise).
 */
export function FamilySosModal({ open, onClose, location, notify }) {
  const [phones, setPhones] = useState(loadFamilyPhones);
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  // Rebuilt on every open so the message carries the latest position and time.
  const message = useMemo(
    () => buildFamilyMessage({ coords: location.coords, address: location.address }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `open` refreshes the timestamp
    [location.coords, location.address, open],
  );
  const targetPhone = phones[0].trim() || phones[1].trim();
  const smsUri = buildSmsUri(targetPhone, message.body);

  const setPhone = (index) => (e) => {
    const value = e.target.value;
    setPhones((prev) => prev.map((p, i) => (i === index ? value : p)));
  };

  const handleSave = () => {
    saveFamilyPhones(phones.map((p) => p.trim()));
    notify('✅ Đã lưu danh bạ khẩn cấp người thân thành công!', { tone: 'success' });
  };

  const handleSend = async () => {
    if (!targetPhone) {
      notify('⚠️ Vui lòng nhập ít nhất 1 số điện thoại người thân để gửi tin nhắn khẩn cấp!', {
        tone: 'warning',
      });
      return;
    }
    saveFamilyPhones(phones.map((p) => p.trim()));
    setShowPreview(true);

    if (navigator.share && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: '🚨 SOS KHẨN CẤP - ĐỊNH VỊ NGƯỜI THÂN',
          text: message.body,
          url: message.mapUrl,
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    await navigator.clipboard?.writeText(message.body).catch(() => {});
    window.location.href = smsUri;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.body);
      setCopied(true);
    } catch {
      notify('Đã chọn nội dung, hãy nhấn Ctrl+C để sao chép.', { tone: 'info' });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      containerStyle={{ maxWidth: 500 }}
      titleStyle={{ color: '#f472b6' }}
      title={
        <>
          <svg className="svg-ico ico-lg ico-purple" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>{' '}
          SOS NGƯỜI THÂN (FAMILY ALERT)
        </>
      }
    >
      <p className={styles.intro}>
        Thiết lập số điện thoại người thân trong gia đình. Khi gặp nguy hiểm, 1-chạm sẽ tự động soạn tin nhắn
        SMS khẩn cấp kèm tọa độ GPS và link Google Maps gửi ngay cho người thân!
      </p>

      <div className={styles.fields}>
        <div>
          <label className={styles.label} htmlFor="familyPhone1">
            Số điện thoại người thân 1 (Bố/Mẹ/Vợ/Chồng)
          </label>
          <input
            id="familyPhone1"
            type="tel"
            className="input-field"
            placeholder="09xxxxxxxx"
            value={phones[0]}
            onChange={setPhone(0)}
          />
        </div>
        <div>
          <label className={styles.label} htmlFor="familyPhone2">
            Số điện thoại người thân 2 (Anh/Chị/Em)
          </label>
          <input
            id="familyPhone2"
            type="tel"
            className="input-field"
            placeholder="09xxxxxxxx"
            value={phones[1]}
            onChange={setPhone(1)}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={`btn-submit-sos ${styles.sendButton}`} onClick={handleSend}>
          <svg className="svg-ico ico-lg ico-white" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>{' '}
          GỬI TIN NHẮN ĐỊNH VỊ CHO NGƯỜI THÂN NGAY
        </button>
        <button type="button" className={`btn-refresh-loc ${styles.saveButton}`} onClick={handleSave}>
          <svg className="svg-ico ico-sm ico-blue" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>{' '}
          Lưu số điện thoại người thân
        </button>

        {showPreview && (
          <div className={styles.preview}>
            <div className={styles.previewHeader}>
              <span className={styles.previewTitle}>
                <svg className="svg-ico ico-sm ico-purple" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>{' '}
                NỘI DUNG TIN NHẮN KHẨN CẤP:
              </span>
              <button type="button" className={styles.copyButton} onClick={handleCopy}>
                {copied ? '✅ Đã chép!' : '📋 Sao chép'}
              </button>
            </div>
            <div className={styles.previewText}>{message.body}</div>
            <div className={styles.previewLinks}>
              <a href={smsUri} className={styles.smsLink}>
                <svg className="svg-ico ico-sm" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>{' '}
                Mở Ứng Dụng SMS
              </a>
              <a href={message.mapUrl} target="_blank" rel="noopener noreferrer" className={styles.mapLink}>
                <svg className="svg-ico ico-sm ico-blue" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>{' '}
                Xem Trên Google Maps
              </a>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
