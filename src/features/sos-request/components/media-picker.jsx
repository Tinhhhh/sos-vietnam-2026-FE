import { useRef } from 'react';

import styles from './sos-request-form.module.css';

/** "Ảnh / Video hiện trường": camera capture or gallery pick, with removable previews. */
export function MediaPicker({ attachments, processing, onAddFiles, onRemove, disabled }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

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

      <div className={styles.mediaButtons}>
        <button
          type="button"
          className={`btn-refresh-loc ${styles.cameraButton}`}
          disabled={disabled}
          onClick={() => cameraRef.current.click()}
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
