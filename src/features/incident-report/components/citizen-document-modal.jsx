import { useCallback, useEffect, useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';
import { ZoomBar } from '@/components/ui/zoom-bar/zoom-bar';

import { getCitizenDocument, signAsCitizen } from '../api/report-api';
import { printDocument } from '../utils/print-document';
import { DocumentSheet } from './document-sheet';
import sheetStyles from './document-sheet.module.css';
import styles from './report-modal.module.css';
import { SignaturePad } from './signature-pad';

const POLL_MS = 8000;
// zoom of the document for reading on a phone: 50 % to 200 %, 25 % a step
const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_STEP = 25;

/**
 * Citizen reads and signs the report of their incident. access = { incidentId, token } from the tracking screen,
 * or { lookupCode, phoneLast4 } from "Tra Cứu". Before officers save it the BE sends the auto-filled draft
 * (saved = false): the citizen can read and check it right away, signing comes once it is saved.
 *
 * @param {{ access: object | null, onClose: () => void, notify?: (msg, opts) => void }} props
 */
export function CitizenDocumentModal({ access, onClose, notify, onSigned }) {
  return access ? (
    <CitizenDocumentWindow access={access} onClose={onClose} notify={notify} onSigned={onSigned} />
  ) : null;
}

function CitizenDocumentWindow({ access, onClose, notify, onSigned }) {
  const [state, setState] = useState({ status: 'loading', doc: null, error: null });
  const [padOpen, setPadOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      getCitizenDocument(access)
        .then((doc) => setState({ status: doc ? 'ready' : 'none', doc, error: null }))
        .catch((err) => setState((s) => ({ ...s, status: s.doc ? s.status : 'error', error: err.message }))),
    [access],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Not written yet, or waiting for the officer's signature: look again now and then
  const locked = state.doc?.locked;
  useEffect(() => {
    if (locked) return undefined;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [locked, load]);

  const sign = async (signature) => {
    setBusy(true);
    try {
      const doc = await signAsCitizen(access, signature);
      setState({ status: 'ready', doc, error: null });
      setPadOpen(false);
      onSigned?.();
      notify?.('Đã ký văn bản báo cáo. Cảm ơn bạn!', { tone: 'success' });
    } catch (err) {
      notify?.(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const doc = state.doc;
  const [zoom, setZoom] = useState(100);
  const zoomTo = (next) => setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)));
  return (
    <Modal
      open
      onClose={onClose}
      solid
      containerStyle={{
        maxWidth: 860,
        width: 'min(860px, calc(100vw - 12px))',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
      }}
      titleStyle={{ color: '#38bdf8' }}
      title={
        <span className={styles.title}>
          Văn bản báo cáo sự việc
          <small>Phiếu thông báo và tiếp nhận thông tin ứng phó sự cố khẩn cấp</small>
        </span>
      }
    >
      {state.status === 'loading' ? (
        <div className={styles.loading}>Đang tải văn bản...</div>
      ) : state.status === 'error' ? (
        <div className={styles.empty}>
          Không tải được văn bản: {state.error}
          <button type="button" className={styles.ghost} onClick={load}>
            Thử lại
          </button>
        </div>
      ) : state.status === 'none' ? (
        <div className={styles.empty}>
          <b>Lực lượng chức năng chưa lập văn bản báo cáo cho sự việc này.</b>
          <span>
            Khi lực lượng chức năng lập xong, văn bản sẽ hiện ở đây để bạn đọc lại và ký xác nhận. Bạn cũng có
            thể xem lại sau bằng mục "Tra Cứu" với mã tra cứu và 4 số cuối số điện thoại.
          </span>
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.pdf} onClick={() => printDocument(doc)}>
              In / PDF
            </button>
            <ZoomBar
              pct={zoom}
              onOut={() => zoomTo(zoom - ZOOM_STEP)}
              onIn={() => zoomTo(zoom + ZOOM_STEP)}
              onReset={() => setZoom(100)}
              label="Thu phóng văn bản"
            />
            <span className={styles.meta}>
              {!doc.saved
                ? 'Bản nháp: lực lượng chức năng đang hoàn thiện văn bản, bạn ký được khi văn bản được lưu'
                : doc.locked
                  ? 'Văn bản đã đủ chữ ký 2 bên'
                  : doc.citizenSignature
                    ? 'Bạn đã ký · chờ lực lượng chức năng ký xác nhận'
                    : 'Đọc kỹ nội dung rồi ký xác nhận ở ô "Người báo tin / người dân"'}
            </span>
          </div>
          <div className={`${styles.scroll} ${styles.zoomScroll}`}>
            {/* CSS zoom re-flows the page (unlike a transform), so scrolling follows the zoomed size */}
            <div style={{ zoom: zoom / 100 }}>
              <DocumentSheet
                doc={doc}
                fields={doc.fields}
                editable={false}
                citizenAction={
                  doc.saved &&
                  !doc.citizenSignature &&
                  !doc.locked && (
                    <button type="button" className={sheetStyles.sigBtn} onClick={() => setPadOpen(true)}>
                      Ký xác nhận
                    </button>
                  )
                }
              />
            </div>
          </div>
        </>
      )}
      {padOpen && (
        <SignaturePad
          open
          title="KÝ XÁC NHẬN VĂN BẢN"
          defaultName={doc?.fields.reporter_name || ''}
          busy={busy}
          onClose={() => setPadOpen(false)}
          onSign={sign}
        />
      )}
    </Modal>
  );
}
