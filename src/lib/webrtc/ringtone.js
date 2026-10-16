/*
 * Ring tones made with the Web Audio API (no sound files to download on a weak network).
 *   incoming: phone ringing (two-tone burst every 2 s) + vibration on phones
 *   outgoing: ring-back tone the caller hears while waiting
 * Browsers only play sound after the user has tapped the page once; if blocked we stay silent.
 */
const PATTERNS = {
  incoming: { tones: [880, 660], beep: 0.18, gap: 0.06, repeats: 4, every: 2000, volume: 0.18 },
  outgoing: { tones: [440, 480], beep: 1.2, gap: 0, repeats: 1, every: 4000, volume: 0.06 },
};

/** @param {'incoming' | 'outgoing'} kind @returns {() => void} stop */
export function startRingtone(kind) {
  const pattern = PATTERNS[kind];
  let ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return () => {};
  }

  const play = () => {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    let t = ctx.currentTime + 0.02;
    for (let i = 0; i < pattern.repeats; i += 1) {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(pattern.volume, t + 0.02);
      gain.gain.setValueAtTime(pattern.volume, t + pattern.beep - 0.03);
      gain.gain.linearRampToValueAtTime(0, t + pattern.beep);
      gain.connect(ctx.destination);
      // Two frequencies at once = classic phone tone
      pattern.tones.forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start(t);
        osc.stop(t + pattern.beep);
      });
      t += pattern.beep + pattern.gap;
    }
    if (kind === 'incoming') navigator.vibrate?.([400, 200, 400]);
  };

  play();
  const timer = setInterval(play, pattern.every);
  return () => {
    clearInterval(timer);
    navigator.vibrate?.(0);
    ctx.close().catch(() => {});
  };
}
