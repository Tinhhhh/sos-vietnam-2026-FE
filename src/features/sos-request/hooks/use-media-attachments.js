import { useCallback, useEffect, useRef, useState } from 'react';

import { MAX_IMAGES, MAX_VIDEOS, prepareAttachment } from '../utils/media';

/** Picked scene photos/videos with object-URL previews that are freed on removal. */
export function useMediaAttachments({ onError }) {
  const [attachments, setAttachments] = useState([]);
  const [processing, setProcessing] = useState(false);
  const attachmentsRef = useRef(attachments);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const addFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []);
      if (files.length === 0) return;

      // Tối đa MAX_IMAGES ảnh + MAX_VIDEOS video mỗi lần báo (BE kiểm lại)
      const count = (type) => attachmentsRef.current.filter((a) => a.type === type).length;
      const room = { image: MAX_IMAGES - count('image'), video: MAX_VIDEOS - count('video') };
      let skipped = false;

      setProcessing(true);
      const added = [];
      for (const file of files) {
        const type = file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('image/')
            ? 'image'
            : null;
        if (type && room[type] <= 0) {
          skipped = true;
          continue;
        }
        if (type) room[type] -= 1;
        const { attachment, error } = await prepareAttachment(file);
        if (error) onError(error);
        if (attachment) added.push(attachment);
      }
      if (skipped) onError(`Tối đa ${MAX_IMAGES} ảnh và ${MAX_VIDEOS} video cho mỗi lần báo sự cố.`);
      setAttachments((list) => [...list, ...added]);
      setProcessing(false);
    },
    [onError],
  );

  const remove = useCallback((id) => {
    setAttachments((list) => {
      const target = list.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return list.filter((a) => a.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setAttachments((list) => {
      list.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      return [];
    });
  }, []);

  // Free previews when the form unmounts.
  useEffect(() => () => attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.previewUrl)), []);

  return { attachments, processing, addFiles, remove, clear };
}
