import { useCallback, useRef, useState } from 'react';

import { uploadIncidentMedia } from '../api/incidents';
import { canUseInPageCamera } from '../utils/camera';
import { MAX_IMAGES, MAX_VIDEO_BYTES, MAX_VIDEOS, prepareAttachment } from '../utils/media';

import { CameraCapture } from './camera-capture';
import styles from './supplement-media-button.module.css';

/**
 * "Bổ sung ảnh / video" on the tracking screen once an officer took the report: shoot with the in-page
 * camera (torch off by default) or pick from the gallery, same compression and limits as the SOS form
 * (BE counts what was already sent: 5 photos + 1 video in total). Each shot is shown first and only
 * sent after "Gửi" ("Chụp lại / Quay lại" throws it away).
 *
 * @param {{ incidentId: string, token: string, notify: Function, className?: string, style?: object }} props
 */
export function SupplementMediaButton({ incidentId, token, notify, className, style }) {
  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const send = useCallback(
    async (files) => {
      if (files.length === 0) return;
      setBusy(true);
      try {
        const attachments = [];
        for (const file of files) {
          const { attachment, error } = await prepareAttachment(file);
          if (error) notify(error, { tone: 'warning' });
          if (attachment) attachments.push(attachment);
        }
        if (attachments.length === 0) return;
        await uploadIncidentMedia({ incidentId, citizenAccessToken: token, attachments });
        attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
        notify(`Đã gửi thêm ${attachments.length} ảnh/video cho lực lượng chức năng.`, { tone: 'success' });
      } catch (err) {
        notify(`Không gửi được ảnh/video: ${err.message}`, { tone: 'error', duration: 8000 });
      } finally {
        setBusy(false);
      }
    },
    [incidentId, token, notify],
  );

  const pick = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    send(files);
  };
  const closeCamera = useCallback(() => setCameraOpen(false), []);
  // confirm mode: only a shot the citizen accepted with "Gửi" arrives here; back to the call screen
  const captured = useCallback(
    (file) => {
      setCameraOpen(false);
      send([file]);
    },
    [send],
  );
  const nativeCamera = useCallback(() => {
    setCameraOpen(false);
    cameraInputRef.current?.click();
  }, []);

  const limits = `Tối đa ${MAX_IMAGES} ảnh và ${MAX_VIDEOS} video cho cả tin báo (video ≤ ${MAX_VIDEO_BYTES / 1024 / 1024}MB)`;
  const cls = className ? `${styles.btn} ${className}` : styles.btn;
  return (
    <div className={styles.row} style={style}>
      {busy ? (
        <span className={cls}>Đang gửi ảnh/video…</span>
      ) : (
        <>
          <button
            type="button"
            className={cls}
            title={limits}
            onClick={() => (canUseInPageCamera() ? setCameraOpen(true) : cameraInputRef.current?.click())}
          >
            Chụp / quay bổ sung
          </button>
          <button type="button" className={cls} title={limits} onClick={() => inputRef.current?.click()}>
            Thư viện
          </button>
        </>
      )}
      <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={pick} />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        hidden
        onChange={pick}
      />
      <CameraCapture
        open={cameraOpen}
        onClose={closeCamera}
        onCapture={captured}
        onFallback={nativeCamera}
        photosLeft={MAX_IMAGES}
        videosLeft={MAX_VIDEOS}
        confirm
        confirmLabel="Gửi"
      />
    </div>
  );
}
