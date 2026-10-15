import { useCallback, useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';
import { saveActiveIncident } from '@/stores/active-incident';

import { createIncident, uploadIncidentMedia } from '../api/incidents';
import { DEFAULT_AGENCY_ID, findAgency } from '../data/agencies';
import { useMediaAttachments } from '../hooks/use-media-attachments';
import { AgencyPicker } from './agency-picker';
import { IncidentChips } from './incident-chips';
import { MediaPicker } from './media-picker';
import { ServiceDirectoryNotice } from './service-directory-notice';
import formStyles from './sos-request-form.module.css';
import styles from './sos-request-modal.module.css';

const DEFAULT_REPORTER_NAME = 'Người dân cần cứu hộ';
const PHONE_PATTERN = /^(\+?84|0)\d{8,10}$/;
const HOTLINE_HINT = 'Vui lòng gọi trực tiếp 113 / 114 / 115.';

/**
 * "Bạn cần trợ giúp gì?" — pick a force, describe the incident, attach
 * scene media and send the SOS with the citizen's GPS position.
 *
 * @param {{ open: boolean, onClose: () => void, location: object,
 *           notify: Function, onSubmitted: (result: { incident: object, mediaError?: string }) => void }} props
 */
export function SosRequestModal({ open, onClose, location, notify, onSubmitted }) {
  const [agencyId, setAgencyId] = useState(DEFAULT_AGENCY_ID);
  const [tags, setTags] = useState([]);
  const [notes, setNotes] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const notifyWarning = useCallback((message) => notify(message, { tone: 'warning' }), [notify]);
  const media = useMediaAttachments({ onError: notifyWarning });

  const agency = findAgency(agencyId);

  const close = () => {
    if (submitting) return;
    window.speechSynthesis?.cancel();
    setTags([]); // legacy cleared the quick picks every time the form reopened
    onClose();
  };

  const selectAgency = (id) => {
    setAgencyId(id);
    setTags([]); // tags belong to one force
  };

  const toggleTag = (label) =>
    setTags((list) => (list.includes(label) ? list.filter((t) => t !== label) : [...list, label]));

  const resetForm = () => {
    setTags([]);
    setNotes('');
    media.clear();
  };

  const handleSubmit = async () => {
    const phone = reporterPhone.replace(/[\s.-]/g, '');
    if (phone && !PHONE_PATTERN.test(phone)) {
      notifyWarning('Số điện thoại chưa đúng định dạng (ví dụ 0912345678).');
      return;
    }

    setSubmitting(true);
    try {
      const body = await createIncident({
        emergency_type: agency.emergencyType,
        incident_tags: tags,
        description: notes.trim() || null,
        citizen_name: reporterName.trim() || DEFAULT_REPORTER_NAME,
        phone: phone || null,
        address: location.address || null,
        latitude: location.coords.lat,
        longitude: location.coords.lng,
        accuracy: location.accuracy != null ? Math.round(location.accuracy) : null,
      });
      // body = { http_status, message, data: { incident, citizen_access_token } }
      const result = body?.data;
      if (!result?.incident) throw new Error(body?.message || 'Máy chủ không xác nhận tin báo');

      saveActiveIncident(result.incident, result.citizen_access_token);

      // The SOS is already recorded; a failed upload must not hide that.
      let mediaError;
      if (media.attachments.length > 0) {
        try {
          await uploadIncidentMedia({
            incidentId: result.incident.id,
            citizenAccessToken: result.citizen_access_token,
            attachments: media.attachments,
          });
        } catch (err) {
          mediaError = err.message;
        }
      }

      resetForm();
      onSubmitted({ incident: result.incident, mediaError });
    } catch (err) {
      notify(`Không gửi được tín hiệu SOS: ${err.message}. ${HOTLINE_HINT}`, {
        tone: 'error',
        duration: 9000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={
        <>
          <svg className="svg-ico ico-lg ico-red" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>{' '}
          BẠN CẦN TRỢ GIÚP GÌ?
        </>
      }
    >
      <div className={formStyles.stepLabel}>1. Chọn Lực Lượng Cần Hỗ Trợ Gấp</div>
      <AgencyPicker value={agencyId} onChange={selectAgency} />

      {agency.directory ? (
        <ServiceDirectoryNotice directory={agency.directory} />
      ) : (
        <>
          <div className={formStyles.sectionTitle}>
            <svg className="svg-ico ico-md ico-amber" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
            </svg>{' '}
            Gợi ý sự cố (Chọn nhanh)
          </div>
          <IncidentChips agencyId={agency.id} selected={tags} onToggle={toggleTag} />

          <label className={formStyles.notesLabel} htmlFor="sosNotes">
            Mô tả thêm tình trạng / Vị trí cụ thể (Không bắt buộc)
          </label>
          <textarea
            id="sosNotes"
            className="textarea-field"
            placeholder="Ví dụ: Gần ngã tư cột đèn, có 2 người bị thương, xe màu đen chết máy..."
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
          />

          <MediaPicker
            attachments={media.attachments}
            processing={media.processing}
            onAddFiles={media.addFiles}
            onRemove={media.remove}
            disabled={submitting}
          />

          <div className={formStyles.contactRow}>
            <div>
              <label className={formStyles.fieldLabel} htmlFor="sosReporterName">
                Tên của bạn
              </label>
              <input
                id="sosReporterName"
                type="text"
                className="input-field"
                placeholder="Họ và tên"
                autoComplete="name"
                maxLength={150}
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
              />
            </div>
            <div>
              <label className={formStyles.fieldLabel} htmlFor="sosReporterPhone">
                Số điện thoại
              </label>
              <input
                id="sosReporterPhone"
                type="tel"
                className="input-field"
                placeholder="09xxxxxxxx"
                autoComplete="tel"
                maxLength={20}
                value={reporterPhone}
                onChange={(e) => setReporterPhone(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      <div className={styles.modalLegalBannerAmber}>
        <div className={styles.legalBannerHead}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
            <path
              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              fill="rgba(245, 158, 11, 0.25)"
              stroke="#f59e0b"
              strokeWidth="2"
            />
            <path d="M12 8v5M12 16h.01" stroke="#fef3c7" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <span>CẢNH BÁO PHÁP LÝ (NGHỊ ĐỊNH 144/2021/NĐ-CP)</span>
        </div>
        <div className={styles.legalBannerBody}>
          Hệ thống tự động lưu trữ tọa độ GPS, IP và số máy. Mọi hành vi báo tin giả sẽ bị phạt{' '}
          <strong>4.000.000đ - 6.000.000đ</strong> hoặc truy cứu trách nhiệm hình sự.
        </div>
      </div>

      {!agency.directory && (
        <button
          type="button"
          className={`btn-submit-sos${submitting ? ` ${formStyles.submitBusy}` : ''}`}
          disabled={submitting || media.processing}
          onClick={handleSubmit}
        >
          {submitting ? (
            <>
              <svg
                className={formStyles.spinner}
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
              </svg>
              ĐANG PHÁT TÍN HIỆU CẤP CỨU...
            </>
          ) : (
            <>
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              XÁC NHẬN PHÁT TÍN HIỆU CỨU HỘ
            </>
          )}
        </button>
      )}
    </Modal>
  );
}
