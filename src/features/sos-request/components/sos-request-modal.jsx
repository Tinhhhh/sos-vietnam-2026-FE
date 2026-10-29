import { useCallback, useRef, useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';
import { VoiceMuteIcon } from '@/components/ui/voice-mute-icon';
import { CITIZEN_VOICE, useVoiceMuted } from '@/hooks/use-voice-muted';
import { cleanIncidentLabel } from '@/config/incident-suggestions';
import { saveActiveIncident } from '@/stores/active-incident';

import { createIncident, uploadIncidentMedia } from '../api/incidents';
import { DEFAULT_AGENCY_ID, findAgency } from '../data/agencies';
import { useMediaAttachments } from '../hooks/use-media-attachments';
import { AgencyPicker } from './agency-picker';
import { IncidentChips } from './incident-chips';
import loc from './location-check.module.css';
import { MediaPicker } from './media-picker';
import { ServiceDirectoryNotice } from './service-directory-notice';
import formStyles from './sos-request-form.module.css';
import styles from './sos-request-modal.module.css';

const DEFAULT_REPORTER_NAME = 'Người dân cần cứu hộ';
// Same rule as be-v2 (Incident.phone): 10 digits starting with 0
const PHONE_PATTERN = /^0\d{9}$/;
const PHONE_ERROR = 'Số điện thoại phải gồm đúng 10 chữ số, bắt đầu bằng 0 (ví dụ 0912345678).';
const HOTLINE_HINT = 'Vui lòng gọi trực tiếp 113 / 114 / 115.';
const NO_LOCATION_ERROR =
  'Chưa có vị trí của bạn: bật định vị (GPS) cho trình duyệt hoặc chọn vị trí trên bản đồ trước khi gửi.';

/**
 * "Bạn cần trợ giúp gì?" — pick a force, describe the incident, attach
 * scene media and send the SOS with the citizen's GPS position.
 *
 * Never sends a made-up position: without a GPS / IP / map-picked fix (location.hasFix) the
 * submit button is locked and the citizen is asked to turn location on or pick the spot on the map.
 *
 * @param {{ open: boolean, onClose: () => void, location: object, onPickLocation?: () => void,
 *           notify: Function, onSubmitted: (result: { incident: object, mediaError?: string }) => void,
 *           onOpenLookup?: () => void }} props
 *   The phone already has open SOS cases (docs/spec-multi-case.md): BE answers 409 OPEN_CASE_EXISTS (1 open:
 *   "Tra cứu ngay" / "Báo sự việc khác" = send again with new_case / "Trở lại menu") or OPEN_CASE_LIMIT (2 open:
 *   "Tra cứu" / "Trở lại menu"). Older BE still answers with the open incident itself (resumed = true).
 */
export function SosRequestModal({
  open,
  onClose,
  location,
  onPickLocation,
  notify,
  onSubmitted,
  onOpenLookup,
}) {
  const [agencyId, setAgencyId] = useState(DEFAULT_AGENCY_ID);
  const [tags, setTags] = useState([]);
  const [notes, setNotes] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [phoneError, setPhoneError] = useState(null);
  const phoneInputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  // 'exists' (1 open case for this phone) | 'limit' (2 open) | null
  const [openCases, setOpenCases] = useState(null);

  const notifyWarning = useCallback((message) => notify(message, { tone: 'warning' }), [notify]);
  const media = useMediaAttachments({ onError: notifyWarning });

  const agency = findAgency(agencyId);
  // the voice prompt plays while this form is open and covers the top bar: mute it from here too
  const [muted, setMuted] = useVoiceMuted(CITIZEN_VOICE);

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

  // Only one suggestion at a time: picking another replaces it, tapping the same one clears it
  const toggleTag = (label) => setTags((list) => (list.includes(label) ? [] : [label]));

  const resetForm = () => {
    setTags([]);
    setNotes('');
    media.clear();
  };

  const handleSubmit = async ({ newCase = false } = {}) => {
    setOpenCases(null);
    if (!location.hasFix) {
      notifyWarning(NO_LOCATION_ERROR);
      return;
    }
    const phone = reporterPhone;
    if (phone && !PHONE_PATTERN.test(phone)) {
      setPhoneError(PHONE_ERROR);
      phoneInputRef.current?.focus();
      notifyWarning(PHONE_ERROR);
      return;
    }

    setSubmitting(true);
    try {
      const body = await createIncident({
        emergency_type: agency.emergencyType,
        report_type: 'SELF', // báo hộ (PROXY) chưa mở
        incident_tags: tags.map(cleanIncidentLabel), // emoji chỉ để hiển thị trên ô chọn
        description: notes.trim() || null,
        citizen_name: reporterName.trim() || DEFAULT_REPORTER_NAME,
        phone: phone || null,
        address: location.address || null,
        latitude: location.coords.lat,
        longitude: location.coords.lng,
        accuracy: location.accuracy != null ? Math.round(location.accuracy) : null,
        // "Báo sự việc khác" after the "đã có 1 tin báo đang mở" window
        ...(newCase ? { new_case: true } : {}),
      });
      // body = { http_status, message, data: { incident, citizen_access_token } }
      const result = body?.data;
      if (!result?.incident) throw new Error(body?.message || 'Máy chủ không xác nhận tin báo');

      saveActiveIncident(result.incident, result.citizen_access_token);
      if (result.resumed) {
        notify(`Bạn đang có tin báo ${result.incident.id} chưa kết thúc, đã mở lại màn hình theo dõi.`, {
          tone: 'info',
          duration: 8000,
        });
      }

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
      const code = err.data?.data?.code || err.data?.code;
      if (err.status === 409 && (code === 'OPEN_CASE_EXISTS' || code === 'OPEN_CASE_LIMIT')) {
        setOpenCases(code === 'OPEN_CASE_LIMIT' ? 'limit' : 'exists');
        return;
      }
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
      solid
      title={
        <>
          <svg className="svg-ico ico-lg ico-red" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>{' '}
          BẠN CẦN TRỢ GIÚP GÌ?
          <button
            type="button"
            className={`${styles.muteBtn} ${muted ? styles.muteOn : ''}`}
            aria-pressed={muted}
            aria-label={muted ? 'Đang tắt tiếng hướng dẫn, bấm để bật' : 'Tắt tiếng hướng dẫn'}
            title={muted ? 'Đang tắt tiếng hướng dẫn, bấm để bật' : 'Tắt tiếng hướng dẫn'}
            onClick={() => setMuted(!muted)}
          >
            <VoiceMuteIcon muted={muted} size={16} />
          </button>
        </>
      }
    >
      <div className={formStyles.stepLabel}>1. Chọn Lực Lượng Cần Hỗ Trợ Gấp</div>
      <AgencyPicker value={agencyId} onChange={selectAgency} />

      {agency.directory ? (
        <ServiceDirectoryNotice directory={agency.directory} location={location} />
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

          {/* who reports: only "Tự báo" for now; "Báo hộ" (reporting for someone else) comes later */}
          <div className={formStyles.reportType} role="radiogroup" aria-label="Người báo tin">
            <span className={formStyles.fieldLabel}>Người báo tin</span>
            <div className={formStyles.reportTypeRow}>
              <button type="button" role="radio" aria-checked="true" className={formStyles.reportTypeOn}>
                Tự báo
              </button>
              <button
                type="button"
                role="radio"
                aria-checked="false"
                disabled
                className={formStyles.reportTypeOff}
                title="Báo hộ cho người khác: tính năng sắp có"
              >
                Báo hộ <small>Sắp có</small>
              </button>
            </div>
          </div>

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
                ref={phoneInputRef}
                id="sosReporterPhone"
                type="tel"
                inputMode="numeric"
                pattern="0[0-9]{9}"
                className="input-field"
                placeholder="09xxxxxxxx"
                autoComplete="tel"
                aria-invalid={!!phoneError}
                aria-describedby={phoneError ? 'sosReporterPhoneError' : undefined}
                style={
                  phoneError
                    ? { borderColor: '#f87171', boxShadow: '0 0 0 2px rgba(248, 113, 113, 0.25)' }
                    : undefined
                }
                value={reporterPhone}
                onChange={(e) => {
                  // Digits only (typed or pasted "+84 912..." / "0912.345.678"): keep the first 10
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setReporterPhone(digits);
                  if (phoneError && (!digits || PHONE_PATTERN.test(digits))) setPhoneError(null);
                }}
                onBlur={() =>
                  setPhoneError(reporterPhone && !PHONE_PATTERN.test(reporterPhone) ? PHONE_ERROR : null)
                }
              />
              {phoneError && (
                <div
                  id="sosReporterPhoneError"
                  role="alert"
                  style={{ marginTop: 6, fontSize: 12, lineHeight: 1.4, color: '#fca5a5' }}
                >
                  {phoneError}
                </div>
              )}
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

      {!agency.directory && <LocationCheck location={location} onPickLocation={onPickLocation} />}

      {!agency.directory && (
        <button
          type="button"
          className={`btn-submit-sos${submitting ? ` ${formStyles.submitBusy}` : ''}`}
          disabled={submitting || media.processing || !location.hasFix}
          title={location.hasFix ? undefined : 'Cần vị trí của bạn trước khi gửi'}
          style={
            location.hasFix ? undefined : { opacity: 0.45, cursor: 'not-allowed', filter: 'grayscale(0.6)' }
          }
          onClick={() => handleSubmit()}
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
              {/* phones: the short label fits on one line */}
              <span className={styles.longLabel}>XÁC NHẬN PHÁT TÍN HIỆU CỨU HỘ</span>
              <span className={styles.shortLabel}>XÁC NHẬN</span>
            </>
          )}
        </button>
      )}
      {openCases && (
        <OpenCaseDialog
          limit={openCases === 'limit'}
          busy={submitting}
          onLookup={() => {
            setOpenCases(null);
            onOpenLookup?.();
          }}
          // Ca thứ 2 cho cùng số tạm khoá ở FE (BE đã nhận new_case): chỉ báo đang phát triển
          onNewCase={() => notify('Tính năng đang được phát triển', { tone: 'info' })}
          onMenu={() => {
            setOpenCases(null);
            close();
          }}
        />
      )}
    </Modal>
  );
}

/**
 * The phone already has open SOS cases. No details of them here (anyone can type a phone number): the citizen
 * goes back to a case through "Tra cứu" with its code.
 */
function OpenCaseDialog({ limit, busy, onLookup, onNewCase, onMenu }) {
  const btn = { flex: 1, justifyContent: 'center', padding: '11px 12px', fontWeight: 800 };
  return (
    <Modal
      open
      onClose={busy ? () => {} : onMenu}
      solid
      containerStyle={{ maxWidth: 440 }}
      title={limit ? 'Không thể tạo thêm tin báo' : 'Bạn đã có tin báo đang mở'}
    >
      <p role="status" style={{ margin: '0 0 14px', color: '#e2e8f0', fontSize: 14.5, lineHeight: 1.5 }}>
        {limit
          ? 'Số điện thoại này đã có 2 tin báo đang mở. Quay lại tin báo bằng Tra cứu (mã ca + 4 số cuối số điện thoại). Cần hỗ trợ gấp: gọi 113 / 114 / 115.'
          : 'Số điện thoại này đã có 1 tin báo đang mở. Quay lại tin đang mở bằng Tra cứu (mã ca + 4 số cuối số điện thoại), hoặc báo một sự việc khác.'}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" className="btn-refresh-loc" style={btn} disabled={busy} onClick={onLookup}>
          {limit ? 'Tra cứu' : 'Tra cứu ngay'}
        </button>
        {!limit && (
          <button type="button" className="btn-submit-sos" style={btn} disabled={busy} onClick={onNewCase}>
            {busy ? 'Đang gửi...' : 'Báo sự việc khác'}
          </button>
        )}
        <button
          type="button"
          className="btn-refresh-loc"
          style={{ ...btn, opacity: 0.8 }}
          disabled={busy}
          onClick={onMenu}
        >
          Trở lại menu
        </button>
      </div>
    </Modal>
  );
}

/** Where the SOS will be sent from, or why it cannot be sent yet. */
function LocationCheck({ location, onPickLocation }) {
  if (location.hasFix) {
    const label = location.jurisdiction?.label || location.address;
    return (
      <div className={loc.ok}>
        <span>
          📍 Gửi từ: <b>{label || `${location.coords.lat.toFixed(5)}, ${location.coords.lng.toFixed(5)}`}</b>
          {location.status === 'manual' ? ' (bạn chọn trên bản đồ)' : ''}
        </span>
        {onPickLocation && (
          <button type="button" className={loc.link} onClick={onPickLocation}>
            Sai vị trí? Chọn lại
          </button>
        )}
      </div>
    );
  }
  const locating = location.status === 'locating';
  return (
    <div className={loc.warn} role="alert">
      <div className={loc.warnTitle}>
        {locating ? '⏳ Đang lấy vị trí của bạn...' : '⚠️ Chưa lấy được vị trí của bạn'}
      </div>
      {!locating && (
        <div className={loc.warnText}>
          Lực lượng chức năng cần vị trí chính xác để tới cứu. Hãy bật định vị (GPS) cho trình duyệt rồi thử
          lại, hoặc tự chọn vị trí trên bản đồ.
        </div>
      )}
      <div className={loc.warnActions}>
        <button type="button" className={loc.btn} onClick={location.refresh} disabled={locating}>
          📡 Thử lấy lại vị trí
        </button>
        {onPickLocation && (
          <button type="button" className={loc.btnPrimary} onClick={onPickLocation}>
            🗺️ Chọn trên bản đồ
          </button>
        )}
      </div>
    </div>
  );
}
