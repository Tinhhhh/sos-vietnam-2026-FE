import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import styles from './camera-capture.module.css';

const MAX_VIDEO_SECONDS = 30;
// MediaRecorder picks what the browser can encode: MP4 on Safari, WebM on Chrome/Android
const VIDEO_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];

function pickVideoType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return VIDEO_TYPES.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
}

const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

/**
 * In-page camera for the SOS form ("Chụp Camera"): photo or ≤30 s video, a torch button (off by
 * default, so the phone camera app's auto flash no longer fires) and front/back switch.
 * Each shot goes to `onCapture(file)` and the camera stays open for more; "Xong" closes it.
 * If the camera can't be opened (denied, no device) a button runs `onFallback()` to open the phone
 * camera app (it must come from a tap: browsers block opening the file picker on their own).
 *
 * @param {{ open: boolean, onClose: () => void, onCapture: (file: File) => void, onFallback: () => void,
 *   photosLeft: number, videosLeft: number }} props
 */
export function CameraCapture({ open, onClose, onCapture, onFallback, photosLeft, videosLeft }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const [mode, setMode] = useState('photo'); // 'photo' | 'video'
  const [facing, setFacing] = useState('environment');
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState({ supported: false, on: false });
  const [recording, setRecording] = useState(null); // { startedAt }
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState(null);
  const [blocked, setBlocked] = useState(false); // camera could not be opened in the page

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  // (Re)open the camera: on open, on front/back switch, and with the microphone in video mode.
  // The torch always starts off (a new stream = light off).
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const get = (audio) =>
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio,
      });
    (async () => {
      setError(null);
      setBlocked(false);
      setTorch({ supported: false, on: false });
      let stream;
      try {
        try {
          stream = await get(mode === 'video');
        } catch (e) {
          if (mode !== 'video') throw e;
          stream = await get(false); // no microphone: video without sound
          if (!cancelled) setError('Không mở được micro, video sẽ không có tiếng.');
        }
      } catch {
        if (cancelled) return;
        stopStream();
        setBlocked(true);
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      stopStream();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() || {};
      // iOS Safari has reported torch as unsupported while it works; offer it whenever the API exists
      const maybe = !!caps.torch || !!navigator.mediaDevices.getSupportedConstraints?.().torch;
      setTorch({ supported: maybe, on: false });
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, facing, mode, stopStream]);

  // Closed or unmounted: release the camera (the light goes off with it)
  useEffect(() => {
    if (!open) return undefined;
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  // Escape closes the camera only, not the SOS form underneath (window capture runs first)
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (!recorderRef.current) onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  // Recording clock + auto stop at 30 s
  useEffect(() => {
    if (!recording) return undefined;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t - recording.startedAt >= MAX_VIDEO_SECONDS * 1000) recorderRef.current?.stop();
    }, 250);
    return () => clearInterval(id);
  }, [recording]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorch({ supported: true, on: next });
    } catch {
      setTorch({ supported: false, on: false });
      setError('Máy này không cho bật đèn từ trình duyệt.');
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || photosLeft <= 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `anh-hien-truong-${stamp()}.jpg`, { type: 'image/jpeg' }));
        setFlash(true);
        setTimeout(() => setFlash(false), 180);
      },
      'image/jpeg',
      0.92,
    );
  };

  const startRecording = () => {
    const stream = streamRef.current;
    const type = pickVideoType();
    if (!stream || type === null || videosLeft <= 0) {
      if (type === null) setError('Trình duyệt này không quay video trong trang được.');
      return;
    }
    const recorder = new MediaRecorder(stream, {
      ...(type ? { mimeType: type } : {}),
      videoBitsPerSecond: 2_500_000, // ~9 MB for 30 s, under the 20 MB limit
    });
    const chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      recorderRef.current = null;
      setRecording(null);
      const mime = recorder.mimeType || type || 'video/webm';
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      if (blob.size) {
        const ext = mime.includes('mp4') ? 'mp4' : 'webm';
        onCapture(new File([blob], `video-hien-truong-${stamp()}.${ext}`, { type: blob.type }));
      }
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    const t = Date.now();
    setNow(t);
    setRecording({ startedAt: t });
  };

  const shutter = () => {
    if (mode === 'photo') takePhoto();
    else if (recording) recorderRef.current?.stop();
    else startRecording();
  };

  if (!open) return null;
  const seconds = recording ? Math.min(MAX_VIDEO_SECONDS, Math.floor((now - recording.startedAt) / 1000)) : 0;
  const left = mode === 'photo' ? photosLeft : videosLeft;

  return createPortal(
    <div
      className={styles.camera}
      role="dialog"
      aria-modal="true"
      aria-label="Chụp ảnh / quay video hiện trường"
    >
      <video
        ref={videoRef}
        className={`${styles.preview} ${facing === 'user' ? styles.mirrored : ''}`}
        playsInline
        muted
        autoPlay
      />
      {flash && <div className={styles.flashFx} />}

      <div className={styles.top}>
        <button
          type="button"
          className={styles.roundBtn}
          onClick={onClose}
          disabled={!!recording}
          aria-label="Đóng camera"
        >
          ✕
        </button>
        {recording ? (
          <span className={styles.rec}>
            <i /> {String(seconds).padStart(2, '0')} / {MAX_VIDEO_SECONDS} giây
          </span>
        ) : (
          <span className={styles.left}>
            Còn {left} {mode === 'photo' ? 'ảnh' : 'video'}
          </span>
        )}
        <button
          type="button"
          className={`${styles.roundBtn} ${torch.on ? styles.torchOn : ''}`}
          onClick={toggleTorch}
          disabled={!ready || !torch.supported}
          aria-pressed={torch.on}
          aria-label={torch.on ? 'Tắt đèn' : 'Bật đèn'}
          title={
            torch.supported ? (torch.on ? 'Tắt đèn' : 'Bật đèn') : 'Máy này không bật đèn được từ trình duyệt'
          }
        >
          <TorchIcon on={torch.on} />
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {blocked && (
        <div className={styles.blocked}>
          <p>Không mở được camera trên trang (chưa cho phép quyền camera hoặc trình duyệt không hỗ trợ).</p>
          <button type="button" className={styles.fallbackBtn} onClick={onFallback}>
            Mở app camera của máy
          </button>
        </div>
      )}

      <div className={styles.bottom}>
        <div className={styles.modes} role="tablist" aria-label="Chế độ">
          {[
            ['photo', 'Ảnh'],
            ['video', 'Video'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={`${styles.modeBtn} ${mode === id ? styles.modeOn : ''}`}
              disabled={!!recording}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.controls}>
          <button type="button" className={styles.doneBtn} onClick={onClose} disabled={!!recording}>
            Xong
          </button>
          <button
            type="button"
            className={`${styles.shutter} ${mode === 'video' ? styles.shutterVideo : ''} ${recording ? styles.shutterRec : ''}`}
            onClick={shutter}
            disabled={!ready || (!recording && left <= 0)}
            aria-label={mode === 'photo' ? 'Chụp ảnh' : recording ? 'Dừng quay' : 'Bắt đầu quay'}
          >
            <span />
          </button>
          <button
            type="button"
            className={styles.roundBtn}
            onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            disabled={!ready || !!recording}
            aria-label="Đổi camera trước / sau"
          >
            <SwitchIcon />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TorchIcon({ on }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={on ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
      {!on && <line x1="3" y1="3" x2="21" y2="21" strokeLinecap="round" />}
    </svg>
  );
}

function SwitchIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 7h-3l-2-3H9L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <polyline points="15 11 17 13 15 15" />
      <path d="M17 13H9a2 2 0 0 1-2-2" />
    </svg>
  );
}
