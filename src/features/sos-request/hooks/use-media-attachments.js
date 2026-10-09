import { useCallback, useEffect, useRef, useState } from 'react';

import { MAX_ATTACHMENTS, prepareAttachment } from '../utils/media';

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

      const room = MAX_ATTACHMENTS - attachmentsRef.current.length;
      if (files.length > room) {
        onError(`Tối đa ${MAX_ATTACHMENTS} ảnh/video cho mỗi lần báo sự cố.`);
      }

      setProcessing(true);
      const added = [];
      for (const file of files.slice(0, Math.max(room, 0))) {
        const { attachment, error } = await prepareAttachment(file);
        if (error) onError(error);
        if (attachment) added.push(attachment);
      }
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
