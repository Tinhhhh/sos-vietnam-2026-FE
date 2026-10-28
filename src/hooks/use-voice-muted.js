import { useCallback, useSyncExternalStore } from 'react';

/**
 * "Tắt tiếng" switches for the spoken SOS voices, kept per browser:
 *   CITIZEN_VOICE = the voice prompt when a citizen taps SOS (silent report)
 *   OFFICER_VOICE = the voice reading out a new SOS on the officer console (siren / chime still play)
 */
export const CITIZEN_VOICE = 'sos_voice_muted';
export const OFFICER_VOICE = 'sos_officer_voice_muted';

const listeners = new Set();
const memory = {}; // storage blocked (private mode): the switch still works until reload

export function isVoiceMuted(key) {
  try {
    const v = localStorage.getItem(key);
    if (v != null) return v === '1';
  } catch {
    // storage blocked: fall back to memory
  }
  return memory[key] === true;
}

export function setVoiceMuted(key, muted) {
  memory[key] = muted;
  try {
    localStorage.setItem(key, muted ? '1' : '0');
  } catch {
    // storage blocked: memory only
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  window.addEventListener('storage', fn); // another tab changed it
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', fn);
  };
}

/** @returns {[boolean, (muted: boolean) => void]} */
export function useVoiceMuted(key) {
  const muted = useSyncExternalStore(subscribe, () => isVoiceMuted(key));
  const set = useCallback((v) => setVoiceMuted(key, v), [key]);
  return [muted, set];
}
