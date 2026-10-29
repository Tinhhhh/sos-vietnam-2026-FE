/**
 * SOS Voice Prompt — migrated từ sos-vietnam-2026/js/app.js
 *
 * Phát file MP3 giọng vùng miền khi citizen bấm SOS.
 * Tự động nhận diện vùng miền theo:
 *   1. localStorage config (sos_voice_config)
 *   2. Tên tỉnh/thành phố (34 tỉnh thành)
 *   3. Tọa độ GPS
 *   4. Mặc định: Tây Nam Bộ
 *
 * Fallback: Web Speech API (vi-VN) nếu MP3 không phát được.
 */

import { CITIZEN_VOICE, isVoiceMuted, subscribeVoiceMuted } from '@/hooks/use-voice-muted';

// Static ?url imports: see REGION_MP3
import tayNamBoMp3 from '../sounds/sos_prompt_tay_nam_bo.mp3?url';
import mienNamMp3 from '../sounds/sos_prompt_mien_nam.mp3?url';
import mienTrungMp3 from '../sounds/sos_prompt_mien_trung.mp3?url';
import mienBacMp3 from '../sounds/sos_prompt_mien_bac.mp3?url';

const VOICE_CONFIG_KEY = 'sos_voice_config';
const PROMPT_TEXT =
  'Hệ thống khẩn cấp ét-ô-ét đã kích hoạt. Xin giữ bình tĩnh, vui lòng chọn đơn vị bạn muốn báo trên màn hình. Sau đó, thông tin sẽ được chuyển tiếp ngay đến lực lượng chức năng của đơn vị để điều phối lực lượng cứu hộ.';

// ── Region detection (ported from app.js detectVoiceRegion) ────────────────

const TAY_NAM_BO = [
  'cần thơ',
  'an giang',
  'cà mau',
  'đồng tháp',
  'vĩnh long',
  'kiên giang',
  'bạc liêu',
  'sóc trăng',
  'bến tre',
  'trà vinh',
  'hậu giang',
  'tiền giang',
  'long an',
];
const MIEN_NAM = [
  'hồ chí minh',
  'sài gòn',
  'bình dương',
  'đồng nai',
  'vũng tàu',
  'bà rịa',
  'tây ninh',
  'bình phước',
];
const MIEN_TRUNG = [
  'đà nẵng',
  'huế',
  'thừa thiên',
  'quảng trị',
  'quảng ngãi',
  'quảng nam',
  'quảng bình',
  'hà tĩnh',
  'nghệ an',
  'thanh hóa',
  'khánh hòa',
  'bình định',
  'phú yên',
  'ninh thuận',
  'bình thuận',
  'gia lai',
  'đắk lắk',
  'đắc lắk',
  'kon tum',
  'lâm đồng',
  'đắk nông',
];
const MIEN_BAC = [
  'hà nội',
  'hải phòng',
  'quảng ninh',
  'bắc ninh',
  'hưng yên',
  'ninh bình',
  'thái nguyên',
  'phú thọ',
  'tuyên quang',
  'lạng sơn',
  'cao bằng',
  'lào cai',
  'sơn la',
  'lai châu',
  'điện biên',
  'hải dương',
  'nam định',
  'thái bình',
  'hà nam',
  'vĩnh phúc',
  'bắc giang',
  'hòa bình',
  'yên bái',
  'bắc kạn',
  'hà giang',
];

/**
 * @param {{ province?: string; address?: string; lat?: number; lng?: number }} hint
 * @returns {'tay_nam_bo'|'mien_nam'|'mien_trung'|'mien_bac'}
 */
export function detectVoiceRegion({ province = '', address = '', lat, lng } = {}) {
  // 1. localStorage override
  try {
    const cfg = JSON.parse(localStorage.getItem(VOICE_CONFIG_KEY) || 'null') || {};
    if (cfg.region) return cfg.region;
    if (cfg.voiceKey) {
      if (cfg.voiceKey.includes('tay_nam_bo') || cfg.voiceKey === 'my_duyen') return 'tay_nam_bo';
      if (cfg.voiceKey.includes('mien_nam') || cfg.voiceKey === 'thuy_dung') return 'mien_nam';
      if (cfg.voiceKey.includes('mien_trung') || cfg.voiceKey === 'ngoc_tran') return 'mien_trung';
      if (cfg.voiceKey.includes('mien_bac') || cfg.voiceKey === 'mai_anh') return 'mien_bac';
    }
  } catch {
    /* ignore */
  }

  // 2. Province / address name match
  const norm = `${province} ${address}`.toLowerCase();
  if (TAY_NAM_BO.some((kw) => norm.includes(kw))) return 'tay_nam_bo';
  if (MIEN_NAM.some((kw) => norm.includes(kw))) return 'mien_nam';
  if (MIEN_TRUNG.some((kw) => norm.includes(kw))) return 'mien_trung';
  if (MIEN_BAC.some((kw) => norm.includes(kw))) return 'mien_bac';

  // 3. GPS coordinates
  if (lat != null && lng != null) {
    if (lat < 10.7 && lng < 106.3) return 'tay_nam_bo';
    if (lat >= 10.3 && lat <= 12.0 && lng >= 106.3 && lng <= 108.0) return 'mien_nam';
    if (lat > 11.8 && lat < 19.8) return 'mien_trung';
    if (lat >= 19.8) return 'mien_bac';
  }

  return 'tay_nam_bo'; // default: Cần Thơ
}

// ── MP3 map ───────────────────────────────────────────────────────────────
// Static ?url imports only give the file URLs (the audio is fetched when played). They must be known
// synchronously: iOS Safari only lets audio start inside the tap itself, an `await import()` before
// play() leaves the gesture and the sound is blocked.

const REGION_MP3 = {
  tay_nam_bo: tayNamBoMp3,
  mien_nam: mienNamMp3,
  mien_trung: mienTrungMp3,
  mien_bac: mienBacMp3,
};

// ── Speech Synthesis fallback ─────────────────────────────────────────────

const VOICE_NAME_HINTS = {
  'female-south': ['south', 'miền nam', 'nam', 'hoaimy', 'linh', 'an', 'female', 'nữ'],
  'male-south': ['male', 'nam', 'namminh', 'minh', 'trai'],
  'female-north': ['north', 'miền bắc', 'bắc', 'maianh', 'thu'],
  'male-north': ['north', 'miền bắc', 'bắc', 'minhquan'],
  'female-central': ['central', 'miền trung', 'trung'],
};

function speakWithSynthesis() {
  if (!('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();

  let cfg = {};
  try {
    cfg = JSON.parse(localStorage.getItem(VOICE_CONFIG_KEY) || 'null') || {};
  } catch {
    /* */
  }
  const voiceType = cfg.voiceType || 'female-south';

  const utterance = new SpeechSynthesisUtterance(PROMPT_TEXT);
  utterance.lang = 'vi-VN';
  utterance.rate = Math.min(2.0, (cfg.rate || 0.88) * 1.2);
  utterance.pitch = cfg.pitch || (voiceType.startsWith('female') ? 1.1 : 0.95);
  utterance.volume = 1.0;

  const speak = () => {
    const viVoices = synth.getVoices().filter((v) => /^vi|VIE|vi_VN|vi-VN/.test(v.lang));
    const hints = VOICE_NAME_HINTS[voiceType] || [];
    utterance.voice =
      viVoices.find((v) => hints.some((h) => v.name.toLowerCase().includes(h))) ||
      viVoices.find((v) => /google|vietnam/i.test(v.name)) ||
      viVoices[0] ||
      null;
    setTimeout(() => {
      synth.resume();
      synth.speak(utterance);
    }, 220);
  };

  if (synth.getVoices().length === 0) {
    synth.addEventListener('voiceschanged', speak, { once: true });
  } else {
    speak();
  }
}

// ── Public API ────────────────────────────────────────────────────────────

let currentAudio = null;

/**
 * Play the regional SOS voice prompt. Call it straight from the tap handler (no await before it).
 * A new call always stops the previous one first, so the prompt can never play twice at once.
 * @param {{ province?: string; address?: string; lat?: number; lng?: number }} [locationHint]
 */
export function speakSosPrompt(locationHint = {}) {
  stopSosPrompt();
  if (isVoiceMuted(CITIZEN_VOICE)) return; // silent report: "Tắt tiếng" on the home top bar

  const region = detectVoiceRegion(locationHint);
  const audio = new Audio(REGION_MP3[region] ?? REGION_MP3.tay_nam_bo);
  audio.preload = 'auto';
  currentAudio = audio;
  audio.play().catch((err) => {
    // Only fall back if this is still the current prompt (not replaced / stopped meanwhile)
    if (currentAudio !== audio) return;
    console.warn('[SOS Voice] MP3 playback failed, falling back to Speech Synthesis:', err);
    currentAudio = null;
    speakWithSynthesis();
  });
}

/** Stop any in-progress SOS audio immediately. */
export function stopSosPrompt() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// "Tắt tiếng" pressed while the prompt plays: stop it at once, not only the next one
subscribeVoiceMuted(() => {
  if (isVoiceMuted(CITIZEN_VOICE)) stopSosPrompt();
});
