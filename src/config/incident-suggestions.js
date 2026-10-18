// Port of legacy public/js/incident-dictionary.js (quick-pick incident chips per force).
// Shared: the SOS form shows them as chips, the statistics page groups incidents by them.
export const INCIDENT_SUGGESTIONS = {
  police: [
    '🚨 Bị cướp giật / Móc túi',
    '⚔️ Bạo lực / Gây rối trật tự',
    '🏠 Trộm cắp đột nhập',
    '👁️ Bị theo dõi / Đe dọa',
    '👶 Người già / Trẻ em đi lạc',
    '⚠️ Sự cố an ninh địa bàn khác',
  ],
  csgt: [
    '🚗 Tai nạn giao thông va chạm nghiêm trọng',
    '💥 Xe lật / Chắn ngang đường quốc lộ/cao tốc',
    '🚦 Sự cố giao thông gây ùn tắc kéo dài',
    '🚧 Chướng ngại vật / Dầu tràn trơn trượt trên đường',
    '🚨 Báo cáo vi phạm giao thông / Xe gây tai nạn bỏ chạy',
  ],
  fire: [
    '🔥 Cháy nhà dân / Chung cư / Nhà xưởng',
    '🆘 Có người mắc kẹt trong đám cháy',
    '🏚️ Sập đổ công trình xây dựng',
    '🌊 Đuối nước / Cứu nạn sông suối',
    '🛗 Mắc kẹt thang máy / Hầm sâu / Vực cao',
  ],
  'traffic-rescue': [
    '⚙️ Ô tô / Xe máy chết máy giữa đường',
    '🛞 Nổ lốp / Bể bánh xe cần thay thế',
    '🔋 Hết bình ắc quy / Cần kích nổ bình',
    '⛽ Hết xăng / Dầu khẩn cấp',
    '🌊 Xe ngập nước / Sa lầy lún cát',
    '🏗️ Cần xe cẩu kéo cứu hộ giao thông',
  ],
  hospital: [
    '🩸 Chấn thương nặng / Chảy máu cấp',
    '❤️ Đau tim / Nghi đột quỵ hôn mê',
    '😵 Bất tỉnh / Ngất xỉu đột ngột',
    '🫁 Khó thở / Co giật cấp cứu',
    '🤢 Ngộ độc thực phẩm / Hóa chất',
    '🤰 Cấp cứu sản phụ chuyển dạ sinh nở',
  ],
};

/** Forces that receive SOS incidents (traffic rescue and hospital are directories only). */
export const INCIDENT_CATEGORY_AGENCIES = ['police', 'csgt', 'fire'];

/** "🚨 Bị cướp giật / Móc túi" -> "Bị cướp giật / Móc túi" (tags are stored with the chip's icon). */
export function cleanIncidentLabel(label) {
  return String(label || '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim();
}
