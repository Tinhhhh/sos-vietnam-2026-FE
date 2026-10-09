// Limits match be-v2 IncidentServiceImpl.
export const MAX_ATTACHMENTS = 10;
export const MAX_VIDEO_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const IMAGE_MAX_DIMENSION = 1280;
const IMAGE_QUALITY = 0.75;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh'));
    };
    img.src = url;
  });
}

/** Downscales to 1280px and re-encodes as JPEG q0.75 (legacy compressImage). */
export async function compressImage(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', IMAGE_QUALITY));
  if (!blob) throw new Error('Không nén được ảnh');
  return blob;
}

const baseName = (name) => name.replace(/\.[^/.]+$/, '') || 'anh-hien-truong';

/**
 * Turns a picked File into an attachment ready to preview and upload.
 * @returns {Promise<{ attachment?: object, error?: string }>}
 */
export async function prepareAttachment(file) {
  const id = crypto.randomUUID();

  if (file.type.startsWith('video/')) {
    if (file.size > MAX_VIDEO_BYTES) {
      return {
        error: `Video "${file.name}" quá lớn (> 15MB). Vui lòng chọn video ngắn hơn 30 giây để cứu hộ tiếp nhận kịp thời.`,
      };
    }
    return {
      attachment: { id, type: 'video', name: file.name, blob: file, previewUrl: URL.createObjectURL(file) },
    };
  }

  if (file.type.startsWith('image/')) {
    try {
      const blob = await compressImage(file);
      const name = `${baseName(file.name)}.jpg`;
      return { attachment: { id, type: 'image', name, blob, previewUrl: URL.createObjectURL(blob) } };
    } catch {
      if (file.size > MAX_IMAGE_BYTES) return { error: `Ảnh "${file.name}" quá lớn (> 10MB).` };
      return {
        attachment: { id, type: 'image', name: file.name, blob: file, previewUrl: URL.createObjectURL(file) },
      };
    }
  }

  return { error: `Tệp "${file.name}" không phải ảnh hoặc video.` };
}
