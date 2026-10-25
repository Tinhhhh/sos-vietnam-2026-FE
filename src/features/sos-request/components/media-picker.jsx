import { useCallback, useRef, useState } from 'react';

import { CameraCapture } from './camera-capture';
import styles from './sos-request-form.module.css';
import { canUseInPageCamera } from '../utils/camera';
import { MAX_IMAGES, MAX_VIDEOS, MAX_VIDEO_BYTES } from '../utils/media';

/**
 * "Ảnh / Video hiện trường": camera capture or gallery pick, with removable previews.
 * "Chụp Camera" opens the in-page camera (torch off by default, so no automatic flash); browsers that
 * can't do that, or a denied camera, fall back to the phone's own camera app.
 */
export function MediaPicker({ attachments, processing, onAddFiles, onRemove, disabled }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const closeCamera = useCallback(() => setCameraOpen(false), []);
  const captured = useCallback((file) => onAddFiles([file]), [onAddFiles]);
  const nativeCamera = useCallback(() => {
    setCameraOpen(false);
    cameraRef.current?.click();
  }, []);
  const photosLeft = MAX_IMAGES - attachments.filter((a) => a.type === 'image').length;
  const videosLeft = MAX_VIDEOS - attachments.filter((a) => a.type === 'video').length;

  const handleChange = (e) => {
    onAddFiles(e.target.files);
    e.target.value = ''; // allow picking the same file again
  };

  return (
    <div className={styles.mediaBox}>
      <div className={styles.mediaHeader}>
        <span className={styles.mediaLabel}>
          <svg className="svg-ico ico-md ico-blue" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>{' '}
          Ảnh / Video Hiện Trường Sự Cố
        </span>
        <span className={styles.mediaOptional}>(Tùy chọn)</span>
      </div>
      <div style={{ fontSize: 11.5, color: '#94a3b8', margin: '-2px 0 8px' }}>
        Tối đa {MAX_IMAGES} ảnh và {MAX_VIDEOS} video (video ≤ {MAX_VIDEO_BYTES / 1024 / 1024}MB, nên quay
        dưới 30 giây).
      </div>

      <div className={styles.mediaButtons}>
        <button
          type="button"
          className={`btn-refresh-loc ${styles.cameraButton}`}
          disabled={disabled}
          onClick={() => (canUseInPageCamera() ? setCameraOpen(true) : cameraRef.current.click())}
        >
          <svg className="svg-ico ico-sm" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>{' '}
          Chụp Camera
        </button>
        <button
          type="button"
          className={`btn-refresh-loc ${styles.galleryButton}`}
          disabled={disabled}
          onClick={() => galleryRef.current.click()}
        >
          <svg className="svg-ico ico-sm" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>{' '}
          Chọn Từ Thư Viện
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className={styles.hiddenInput}
        onChange={handleChange}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className={styles.hiddenInput}
        onChange={handleChange}
      />

      <CameraCapture
        open={cameraOpen}
        onClose={closeCamera}
        onCapture={captured}
        onFallback={nativeCamera}
        photosLeft={photosLeft}
        videosLeft={videosLeft}
        // each shot is reviewed first: only "Xác nhận" attaches it to the report, "Huỷ bỏ" drops it
        confirm
        confirmLabel="Xác nhận"
        discardLabel="Huỷ bỏ"
        reviewText={(kind) =>
          kind === 'video' ? 'Đính kèm video này vào tin báo?' : 'Đính kèm ảnh này vào tin báo?'
        }
      />

      {processing && <div className={styles.processing}>Đang xử lý ảnh/video…</div>}

      {attachments.length > 0 && (
        <div className={styles.previewGrid}>
          {attachments.map((a) => (
            <div key={a.id} className={styles.previewItem}>
              {a.type === 'video' ? (
                <video src={a.previewUrl} className={styles.previewThumb} controls playsInline muted />
              ) : (
                <img src={a.previewUrl} className={styles.previewThumb} alt="Ảnh hiện trường" />
              )}
              <button
                type="button"
                className={styles.removeButton}
                aria-label={`Bỏ ${a.name}`}
                disabled={disabled}
                onClick={() => onRemove(a.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
