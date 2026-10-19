const PHONE_KEYS = ['sos_family_phone_1', 'sos_family_phone_2'];

export function loadFamilyPhones() {
  try {
    return PHONE_KEYS.map((key) => localStorage.getItem(key) || '');
  } catch {
    return ['', ''];
  }
}

export function saveFamilyPhones(phones) {
  phones.forEach((phone, i) => {
    if (phone) localStorage.setItem(PHONE_KEYS[i], phone);
  });
}

/** SMS text sent to relatives: time, address, GPS and a Google Maps link. */
export function buildFamilyMessage({ coords, address }) {
  // No fix yet (GPS / IP unavailable): say so instead of sending a made-up position
  const lat = coords ? Number(coords.lat).toFixed(5) : null;
  const lng = coords ? Number(coords.lng).toFixed(5) : null;
  const mapUrl = coords ? `https://maps.google.com/?q=${lat},${lng}` : 'chưa xác định được vị trí';
  const timeVN = new Date().toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const body =
    `[🚨 SOS KHẨN CẤP VIỆT NAM - ${timeVN}]\n` +
    `Tôi đang gặp sự cố nguy hiểm cần trợ giúp gấp!\n` +
    `📍 Vị trí: ${address || 'Chưa xác định'}\n` +
    (coords ? `🌐 Tọa độ GPS: ${lat}, ${lng}\n` : '🌐 Tọa độ GPS: chưa lấy được, hãy gọi lại cho tôi\n') +
    `🗺️ Xem bản đồ trực tiếp: ${mapUrl}`;

  return { body, mapUrl };
}

/** iOS uses `&body=`, everything else `?body=`. */
export function buildSmsUri(phone, body) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return `sms:${phone}${isIOS ? '&' : '?'}body=${encodeURIComponent(body)}`;
}
