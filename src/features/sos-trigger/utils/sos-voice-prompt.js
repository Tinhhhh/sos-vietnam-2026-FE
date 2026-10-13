/**
 * Spoken prompt played when the citizen taps SOS (port of legacy
 * speakSosPrompt / fallbackSpeechSynthesis). Plays the studio MP3 for the
 * configured voice; falls back to the browser's vi-VN speech synthesis.
 */
const PROMPT_TEXT =
  'Hệ thống cứu nạn khẩn cấp quốc gia xin nghe. Vui lòng bấm chọn loại hình sự cố trên màn hình để kết nối tới lực lượng ứng trực gần nhất.';
const VOICE_CONFIG_KEY = 'sos_voice_config'; // written by the dispatcher admin panel

export function detectVoiceRegion(location = null) {
  // 1. Kiểm tra cấu hình người dùng lưu trong localStorage nếu có chỉ định thủ công
  try {
    const saved = localStorage.getItem(VOICE_CONFIG_KEY);
    if (saved) {
      const cfg = JSON.parse(saved);
      if (cfg.region) return cfg.region; // 'tay_nam_bo' | 'mien_nam' | 'mien_trung' | 'mien_bac'
      if (cfg.voiceKey) {
        if (cfg.voiceKey.includes('tay_nam_bo') || cfg.voiceKey === 'my_duyen') return 'tay_nam_bo';
        if (cfg.voiceKey.includes('mien_nam') || cfg.voiceKey === 'thuy_dung') return 'mien_nam';
        if (cfg.voiceKey.includes('mien_trung') || cfg.voiceKey === 'ngoc_tran') return 'mien_trung';
        if (cfg.voiceKey.includes('mien_bac') || cfg.voiceKey === 'mai_anh') return 'mien_bac';
        return cfg.voiceKey;
      }
    }
  } catch {}

  // 2. Tự động nhận diện theo Tỉnh/Thành phố hoặc Tọa độ GPS của người dân (34 Tỉnh Thành)
  const provinceName = location?.jurisdiction?.provinceName || location?.province || '';
  const address = location?.address || '';
  const normProv = (provinceName + ' ' + address).toLowerCase();

  // VÙNG 1: TÂY NAM BỘ (Đồng bằng sông Cửu Long - Cần Thơ, An Giang, Cà Mau, Đồng Tháp...)
  const TAY_NAM_BO_KEYWORDS = [
    'cần thơ', 'an giang', 'cà mau', 'đồng tháp', 'vĩnh long', 'kiên giang',
    'bạc liêu', 'sóc trăng', 'bến tre', 'trà vinh', 'hậu giang', 'tiền giang', 'long an'
  ];
  for (const kw of TAY_NAM_BO_KEYWORDS) {
    if (normProv.includes(kw)) return 'tay_nam_bo';
  }

  // VÙNG 2: MIỀN NAM / ĐÔNG NAM BỘ (TP.HCM, Bình Dương, Đồng Nai, Tây Ninh...)
  const MIEN_NAM_KEYWORDS = [
    'hồ chí minh', 'sài gòn', 'bình dương', 'đồng nai', 'vũng tàu', 'bà rịa', 'tây ninh', 'bình phước'
  ];
  for (const kw of MIEN_NAM_KEYWORDS) {
    if (normProv.includes(kw)) return 'mien_nam';
  }

  // VÙNG 3: MIỀN TRUNG & TÂY NGUYÊN (Đà Nẵng, Huế, Quảng Trị, Khánh Hòa, Tây Nguyên...)
  const MIEN_TRUNG_KEYWORDS = [
    'đà nẵng', 'huế', 'thừa thiên', 'quảng trị', 'quảng ngãi', 'quảng nam', 'quảng bình',
    'hà tĩnh', 'nghệ an', 'thanh hóa', 'khánh hòa', 'bình định', 'phú yên', 'ninh thuận',
    'bình thuận', 'gia lai', 'đắk lắk', 'đắc lắk', 'kon tum', 'lâm đồng', 'đắk nông'
  ];
  for (const kw of MIEN_TRUNG_KEYWORDS) {
    if (normProv.includes(kw)) return 'mien_trung';
  }

  // VÙNG 4: MIỀN BẮC (Hà Nội, Hải Phòng, Quảng Ninh, Bắc Ninh, Hưng Yên...)
  const MIEN_BAC_KEYWORDS = [
    'hà nội', 'hải phòng', 'quảng ninh', 'bắc ninh', 'hưng yên', 'ninh bình', 'thái nguyên',
    'phú thọ', 'tuyên quang', 'lạng sơn', 'cao bằng', 'lào cai', 'sơn la', 'lai châu',
    'điện biên', 'hải dương', 'nam định', 'thái bình', 'hà nam', 'vĩnh phúc', 'bắc giang',
    'hòa bình', 'yên bái', 'bắc kạn', 'hà giang'
  ];
  for (const kw of MIEN_BAC_KEYWORDS) {
    if (normProv.includes(kw)) return 'mien_bac';
  }

  // 3. Fallback theo Vĩ độ GPS
  const lat = location?.coords?.lat;
  const lng = location?.coords?.lng;
  if (lat && lng) {
    if (lat < 10.7 && lng < 106.3) return 'tay_nam_bo';
    if (lat >= 10.3 && lat <= 12.0 && lng >= 106.3 && lng <= 108.0) return 'mien_nam';
    if (lat > 11.8 && lat < 19.8) return 'mien_trung';
    if (lat >= 19.8) return 'mien_bac';
  }

  return 'tay_nam_bo';
}

let currentAudio = null;

export function speakSosPrompt(location = null) {
  const voiceKey = detectVoiceRegion(location);

  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
  }

  try {
    currentAudio = new Audio(`/assets/sounds/sos_prompt_${voiceKey}.mp3`);
    currentAudio.preload = 'auto';
    currentAudio.play().catch(() => speakWithSynthesis(voiceKey));
  } catch {
    speakWithSynthesis(voiceKey);
  }
}

function speakWithSynthesis(voiceKey = 'tay_nam_bo') {
  if (!('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(PROMPT_TEXT);
  utterance.lang = 'vi-VN';
  utterance.rate = 1.0;
  utterance.pitch = 1.05;

  const speak = () => {
    const viVoices = synth.getVoices().filter((v) => /^vi|VIE|vi_VN|vi-VN/.test(v.lang));
    utterance.voice = viVoices[0] || null;
    setTimeout(() => {
      synth.resume();
      synth.speak(utterance);
    }, 200);
  };

  if (synth.getVoices().length === 0) {
    synth.addEventListener('voiceschanged', speak, { once: true });
  } else {
    speak();
  }
}
