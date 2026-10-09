import { useEffect, useRef } from 'react';

import { useNetworkStatus } from '@/hooks/use-network-status';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { isLowPowerDevice } from '@/lib/device-profile';

import styles from './citizen-background.module.css';

const POSTER = '/assets/videos/sos-citizen-bg-poster.jpg';
const VIDEO_BY_TIER = {
  full: '/assets/videos/sos-citizen-bg-hq.mp4',
  '4g': '/assets/videos/sos-citizen-bg-hq.mp4',
  lite: '/assets/videos/sos-citizen-bg-lite.mp4',
  none: '',
};
const LITE_VIDEO = VIDEO_BY_TIER.lite;

// The "hands cupping the SOS sphere" intro plays once per page load; after
// that (or when motion is unwanted) the video only shows its final frame.
let introPlayed = false;

function whenIdle(fn) {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(fn, { timeout: 1200 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 500);
  return () => window.clearTimeout(id);
}

/** Background "hands" video picked by connection quality, plus glow orbs. */
export function CitizenBackground() {
  const videoRef = useRef(null);
  const loadedRef = useRef(false);
  const { tier } = useNetworkStatus();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const video = videoRef.current;
    if (!video || loadedRef.current || !VIDEO_BY_TIER[tier]) return undefined;

    const lowPower = reducedMotion || isLowPowerDevice();
    const staticOnly = introPlayed || lowPower;
    // A single still frame decodes fine from the small file on weak devices.
    const source = lowPower ? LITE_VIDEO : VIDEO_BY_TIER[tier];

    // Load only when the browser is idle so it never delays the SOS button.
    return whenIdle(() => {
      loadedRef.current = true;
      video.src = source;
      if (staticOnly) {
        video.addEventListener(
          'loadedmetadata',
          () => {
            video.currentTime = Math.max(0, video.duration - 0.05);
          },
          { once: true },
        );
        video.preload = 'auto';
        video.load();
        return;
      }
      introPlayed = true;
      // autoplay (not a one-off play()): Chrome pauses video-only media in a
      // hidden tab and rejects play(), but starts autoplay once it is visible.
      video.autoplay = true;
      video.load();
    });
  }, [tier, reducedMotion]);

  return (
    <div className={styles.bgVideoContainer}>
      <video
        ref={videoRef}
        className={`${styles.bgVideo} ${styles.citizenBgVideo}`}
        muted
        playsInline
        preload="none"
        poster={POSTER}
        controlsList="nodownload nofullscreen noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        onEnded={(e) => e.currentTarget.pause()} // stay on the final frame
        onContextMenu={(e) => e.preventDefault()}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className={styles.bgVideoOverlay} />
      <div className={`${styles.bgGlowOrb} ${styles.orb1}`} />
      <div className={`${styles.bgGlowOrb} ${styles.orb2}`} />
      <div className={`${styles.bgGlowOrb} ${styles.orb3}`} />
    </div>
  );
}
