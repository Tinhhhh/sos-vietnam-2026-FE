/**
 * Spoken prompt played when the citizen taps SOS (port of legacy
 * speakSosPrompt / fallbackSpeechSynthesis). Plays the studio MP3 for the
 * configured voice; falls back to the browser's vi-VN speech synthesis.
 */
const PROMPT_TEXT = 'Hãy cho tôi biết sự cố bạn đang gặp phải, bằng cách chọn các đơn vị mà bạn muốn báo.';
const VOICE_CONFIG_KEY = 'sos_voice_config'; // written by the dispatcher admin panel

const VOICE_KEY_BY_TYPE = {
  'female-north': 'mai_anh',
  'male-north': 'minh_quan',
  'male-south': 'thai_son',
  'female-central': 'quang_son',
  'male-central': 'quang_son',
  'female-north-soft': 'truc_ly',
};

let currentAudio = null;

function readVoiceConfig() {
  try {
    return JSON.parse(localStorage.getItem(VOICE_CONFIG_KEY) || 'null') || {};
  } catch {
    return {};
  }
}

function pickVoiceKey(cfg) {
  return VOICE_KEY_BY_TYPE[cfg.voiceType] || cfg.voiceKey || 'thuy_dung';
}

const VOICE_NAME_HINTS = {
  'female-south': ['south', 'miền nam', 'nam', 'hoaimy', 'linh', 'an', 'female', 'nữ'],
  'male-south': ['male', 'nam', 'namminh', 'minh', 'trai'],
  'female-north': ['north', 'miền bắc', 'bắc', 'maianh', 'thu'],
  'male-north': ['north', 'miền bắc', 'bắc', 'minhquan'],
};

function speakWithSynthesis(cfg) {
  if (!('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();

  const voiceType = cfg.voiceType || 'female-south';
  const utterance = new SpeechSynthesisUtterance(PROMPT_TEXT);
  utterance.lang = 'vi-VN';
  utterance.rate = cfg.rate || 0.88;
  utterance.pitch = cfg.pitch || (voiceType.startsWith('female') ? 1.1 : 0.95);

  const speak = () => {
    const viVoices = synth.getVoices().filter((v) => /^vi|VIE|vi_VN|vi-VN/.test(v.lang));
    const hints = VOICE_NAME_HINTS[voiceType] || [];
    utterance.voice =
      viVoices.find((v) => hints.some((h) => v.name.toLowerCase().includes(h))) || viVoices[0] || null;
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

export function speakSosPrompt() {
  const cfg = readVoiceConfig();

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }

  try {
    currentAudio = new Audio(`/assets/sounds/sos_prompt_${pickVoiceKey(cfg)}.mp3`);
    currentAudio.preload = 'auto';
    currentAudio.play().catch(() => speakWithSynthesis(cfg));
  } catch {
    speakWithSynthesis(cfg);
  }
}
