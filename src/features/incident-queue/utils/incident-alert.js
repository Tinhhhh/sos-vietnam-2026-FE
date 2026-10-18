/**
 * New-incident alert for the officer console (migrated from legacy dispatcher.js playAlarm /
 * playVoiceChime / speakVoiceAlert):
 *   1. police siren sweep (Web Audio, 1.15 s)
 *   2. "ding-dong" chime
 *   3. Vietnamese voice announcement (speech synthesis), repeated 3 times, 1 s apart
 * A newer alert replaces the one playing; stopIncidentAlert() silences it (officer opened / took the case).
 *
 * Browsers only allow sound after the user has interacted with the page once: the officer has
 * clicked at least once (login), and unlockIncidentAlertAudio() resumes the audio on every tap.
 */
import { cleanIncidentLabel } from '@/config/incident-suggestions';

const REPEATS = 3;
const RATE = 0.88;

let audioCtx = null;
let session = 0; // increments on every alert / stop: pending callbacks of an older alert do nothing
let pendingTimer = null;
let _speaking = null; // only kept referenced, Chromium may garbage-collect a speaking utterance

function ctx() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

/** Dual-sweep emergency siren (legacy playAlarm). */
function playSiren() {
  const ac = ctx();
  if (!ac) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(700, now);
  osc.frequency.linearRampToValueAtTime(1250, now + 0.25);
  osc.frequency.linearRampToValueAtTime(700, now + 0.5);
  osc.frequency.linearRampToValueAtTime(1250, now + 0.75);
  osc.frequency.linearRampToValueAtTime(700, now + 1.0);
  gain.gain.setValueAtTime(0.28, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 1.15);
}

/** Crystal "ding-dong" before the voice (legacy playVoiceChime), starts after the siren. */
function playChime(delay = 1.2) {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const tone = (freq, endFreq, start, end, volume) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + 0.12);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(start);
    osc.stop(end);
  };
  tone(880, 1320, t, t + 0.35, 0.25);
  tone(1760, null, t + 0.15, t + 0.55, 0.2);
}

function vietnameseVoice() {
  const voices = window.speechSynthesis.getVoices() || [];
  return (
    voices.find((v) => /^vi|vi[-_]VN|VIE/i.test(v.lang || '')) ||
    voices.find((v) => /vietnam|tiếng việt|hoaimy|namminh/i.test(v.name || '')) ||
    null
  );
}

/** "0912345678" -> "0 9 1 2 ..." so the voice reads digits, not a big number. */
const spellDigits = (phone) => phone.replace(/\D/g, '').split('').join(' ');

function message(inc, escalated) {
  // Tags keep the chip icon ("⚔️ Bạo lực..."): the voice would read the emoji out
  const what = inc.tags?.length ? inc.tags.map(cleanIncidentLabel).join(', ') : 'khẩn cấp';
  const where = inc.address || [inc.ward, inc.province].filter(Boolean).join(', ') || 'vị trí trên bản đồ';
  const area = inc.address ? [inc.ward, inc.province].filter(Boolean).join(', ') : '';
  const reporter = inc.citizenName || 'người dân';
  const phone = inc.phone ? `, số điện thoại ${spellDigits(inc.phone)}` : '';
  const prefix = escalated ? 'Khẩn cấp! Ca cứu hộ đã chuyển lên cấp tỉnh chỉ đạo. ' : '';
  return (
    `${prefix}Khẩn cấp! Khẩn cấp! Hệ thống ét ô ét thông báo có sự cố ${what} tại ${where}` +
    `${area ? `, thuộc ${area}` : ''}. Người báo là ${reporter}${phone}. ` +
    'Đề nghị cán bộ tiếp nhận và điều động lực lượng xử lý ngay!'
  );
}

function speak(text, mySession, repeat) {
  if (mySession !== session || repeat > REPEATS || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(
    repeat === 1 ? text : `Thông báo lặp lại lần thứ ${repeat}: ${text}`,
  );
  utterance.lang = 'vi-VN';
  utterance.rate = RATE;
  utterance.volume = 1;
  const voice = vietnameseVoice();
  if (voice) utterance.voice = voice;
  const next = () => {
    _speaking = null;
    if (mySession === session) pendingTimer = setTimeout(() => speak(text, mySession, repeat + 1), 1000);
  };
  utterance.onend = next;
  utterance.onerror = (e) => {
    if (e.error !== 'canceled' && e.error !== 'interrupted') next();
  };
  _speaking = utterance;
  synth.cancel();
  pendingTimer = setTimeout(() => {
    if (mySession !== session) return;
    try {
      synth.resume(); // Chromium sometimes leaves the queue paused
    } catch {
      /* ignore */
    }
    synth.speak(utterance);
  }, 220);
}

/**
 * Siren + chime + voice for a new (or escalated) incident the officer can take.
 * @param {object} inc normalized incident (see incident-model.js)
 * @param {{ escalated?: boolean }} [options]
 */
export function playIncidentAlert(inc, { escalated = false } = {}) {
  stopIncidentAlert();
  const mySession = session;
  try {
    playSiren();
    playChime();
  } catch {
    // audio not allowed yet: the voice may still work
  }
  // Voice starts after the siren and chime (~1.8 s)
  pendingTimer = setTimeout(() => speak(message(inc, escalated), mySession, 1), 1800);
}

export function stopIncidentAlert() {
  session += 1;
  clearTimeout(pendingTimer);
  pendingTimer = null;
  _speaking = null;
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

/** Call from a pointerdown listener: resumes audio that the browser suspended until a user gesture. */
export function unlockIncidentAlertAudio() {
  try {
    if (audioCtx?.state === 'suspended') audioCtx.resume();
    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.getVoices(); // loads the voice list early
    }
  } catch {
    /* ignore */
  }
}
