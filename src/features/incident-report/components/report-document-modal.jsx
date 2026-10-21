import { useCallback, useEffect, useRef, useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';
import { useToast } from '@/components/ui/toast/toast-context';

import { downloadDocx, getDocument, saveDocument, signAsOfficer, signForCitizen } from '../api/report-api';
import { printDocument } from '../utils/print-document';
import { DocumentSheet } from './document-sheet';
import sheetStyles from './document-sheet.module.css';
import styles from './report-modal.module.css';
import { SignaturePad } from './signature-pad';

const POLL_MS = 6000;
const TIME = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Officer window "Văn bản báo cáo" of a resolved incident (legacy #incidentReportDocxModal): the sheet with
 * inline fields (pre-filled by BE), save, officer signature, signing for the citizen (reason + authorisation),
 * Word download and print / PDF once saved. While waiting for the citizen's signature it re-reads every few
 * seconds.
 *
 * @param {{ incidentId: string | null, onClose: () => void }} props
 */
export function ReportDocumentModal({ incidentId, onClose }) {
  const open = !!incidentId;
  return open ? <ReportDocumentWindow key={incidentId} incidentId={incidentId} onClose={onClose} /> : null;
}

function ReportDocumentWindow({ incidentId, onClose }) {
  const toast = useToast();
  const [doc, setDoc] = useState(null);
  const [fields, setFields] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // 'save' | 'sign' | 'docx'
  const [pad, setPad] = useState(null); // 'officer' | 'proxy'
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const apply = useCallback((d, { keepFields = false } = {}) => {
    setDoc(d);
    if (!keepFields) {
      setFields(d.fields);
      setDirty(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    getDocument(incidentId)
      .then((d) => alive && apply(d))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [incidentId, apply]);

  // Waiting for the citizen to sign from their phone: refresh the signatures, keep what is being typed
  const waiting = !!doc?.saved && !doc.locked;
  useEffect(() => {
    if (!waiting) return undefined;
    const t = setInterval(() => {
      getDocument(incidentId)
        .then((d) => apply(d, { keepFields: dirtyRef.current }))
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(t);
  }, [waiting, incidentId, apply]);

  const change = (key, value) => {
    setFields((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    setBusy('save');
    try {
      const d = await saveDocument(incidentId, fields);
      apply(d);
      toast.show(doc.saved ? 'Đã lưu văn bản' : 'Đã lập văn bản báo cáo', { tone: 'success' });
      return d;
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
      return null;
    } finally {
      setBusy(null);
    }
  };

  // Signing needs the current content saved first
  const openPad = async (which) => {
    if (!doc.saved || dirty) {
      const d = await save();
      if (!d) return;
    }
    setPad(which);
  };

  const sign = async (signature) => {
    setBusy('sign');
    try {
      const d =
        pad === 'proxy'
          ? await signForCitizen(incidentId, signature)
          : await signAsOfficer(incidentId, signature);
      apply(d);
      setPad(null);
      toast.show(d.locked ? 'Văn bản đã đủ chữ ký 2 bên' : 'Đã ký', { tone: 'success' });
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const docx = async () => {
    setBusy('docx');
    try {
      await downloadDocx(incidentId);
    } catch (err) {
      toast.show(`Không tải được file Word: ${err.message}`, { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const close = () => {
    if (dirty && !window.confirm('Văn bản có thay đổi chưa lưu. Đóng và bỏ thay đổi?')) return;
    onClose();
  };

  const signed = !!doc && (!!doc.officerSignature || !!doc.citizenSignature);
  const canEdit = !!doc?.editable;

  return (
    <Modal
      open
      onClose={close}
      solid
      containerStyle={{
        maxWidth: 880,
        width: 'min(880px, calc(100vw - 16px))',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
      }}
      titleStyle={{ color: '#38bdf8' }}
      title={
        <span className={styles.title}>
          Văn bản báo cáo · Ca {incidentId}
          <small>Phiếu thông báo và tiếp nhận thông tin ứng phó sự cố khẩn cấp</small>
        </span>
      }
    >
      {!doc ? (
        <div className={styles.loading}>{error || 'Đang tải văn bản...'}</div>
      ) : (
        <>
          <div className={styles.toolbar}>
            {canEdit && (
              <button
                type="button"
                className={styles.save}
                disabled={busy !== null || (doc.saved && !dirty)}
                onClick={save}
              >
                {busy === 'save'
                  ? 'Đang lưu...'
                  : !doc.saved
                    ? 'Lập văn bản'
                    : dirty && signed
                      ? 'Lưu (xoá chữ ký cũ)'
                      : 'Lưu thay đổi'}
              </button>
            )}
            <button
              type="button"
              className={styles.word}
              disabled={!doc.saved || dirty || busy !== null}
              title={!doc.saved ? 'Lập văn bản trước khi tải' : dirty ? 'Lưu thay đổi trước khi tải' : ''}
              onClick={docx}
            >
              {busy === 'docx' ? 'Đang tạo file...' : 'Tải Word (.docx)'}
            </button>
            <button
              type="button"
              className={styles.pdf}
              disabled={!doc.saved || dirty}
              title="In hoặc chọn 'Lưu thành PDF' trong hộp thoại in"
              onClick={() => printDocument(doc)}
            >
              In / PDF
            </button>
            <span className={styles.meta}>
              {doc.locked
                ? 'Đã đủ chữ ký 2 bên · không sửa được'
                : doc.saved
                  ? `Lưu lần cuối: ${doc.updatedByName || 'cán bộ'} · ${doc.updatedAt ? TIME.format(doc.updatedAt) : ''}`
                  : 'Bản nháp tự điền từ dữ liệu ca, chưa lưu'}
            </span>
          </div>
          {dirty && signed && (
            <div className={styles.warn}>
              Nội dung đã thay đổi: lưu lại sẽ xoá chữ ký đã có, hai bên phải ký lại.
            </div>
          )}
          <div className={styles.scroll}>
            <DocumentSheet
              doc={doc}
              fields={fields}
              editable={canEdit}
              onChange={change}
              officerAction={
                canEdit &&
                !doc.officerSignature && (
                  <button
                    type="button"
                    className={sheetStyles.sigBtn}
                    disabled={busy !== null}
                    onClick={() => openPad('officer')}
                  >
                    Cán bộ ký xác nhận
                  </button>
                )
              }
              citizenAction={
                canEdit &&
                !doc.citizenSignature && (
                  <>
                    <span className={sheetStyles.sigMeta}>
                      Người dân tự ký trong màn theo dõi hoặc mục Tra Cứu (mã tra cứu + 4 số cuối SĐT)
                    </span>
                    <button
                      type="button"
                      className={sheetStyles.sigBtnAlt}
                      disabled={busy !== null}
                      onClick={() => openPad('proxy')}
                    >
                      Cán bộ ký hộ (được uỷ quyền)
                    </button>
                  </>
                )
              }
            />
          </div>
        </>
      )}
      {pad && (
        <SignaturePad
          open
          proxy={pad === 'proxy'}
          title={pad === 'proxy' ? 'KÝ HỘ NGƯỜI DÂN' : 'CÁN BỘ KÝ XÁC NHẬN'}
          defaultName={pad === 'proxy' ? fields.reporter_name : fields.officer_name}
          busy={busy === 'sign'}
          onClose={() => setPad(null)}
          onSign={sign}
        />
      )}
    </Modal>
  );
}
