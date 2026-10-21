import { useRef, useState } from 'react';

import { uploadIncidentMedia } from '../api/incidents';
import { MAX_IMAGES, MAX_VIDEO_BYTES, MAX_VIDEOS, prepareAttachment } from '../utils/media';

/**
 * "Bổ sung ảnh / video" on the tracking screen once an officer took the report: pick from camera / gallery,
 * same compression and limits as the SOS form (BE counts what was already sent: 5 photos + 1 video in total).
 *
 * @param {{ incidentId: string, token: string, notify: Function, className?: string, style?: object }} props
 */
export function SupplementMediaButton({ incidentId, token, notify, className, style }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
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
      notify(`Đã gửi thêm ${attachments.length} ảnh/video cho cán bộ.`, { tone: 'success' });
    } catch (err) {
      notify(`Không gửi được ảnh/video: ${err.message}`, { tone: 'error', duration: 8000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={className}
        style={style}
        disabled={busy}
        title={`Tối đa ${MAX_IMAGES} ảnh và ${MAX_VIDEOS} video cho cả tin báo (video ≤ ${MAX_VIDEO_BYTES / 1024 / 1024}MB)`}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Đang gửi ảnh/video…' : 'Bổ sung ảnh / video'}
      </button>
      <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={pick} />
    </>
  );
}
