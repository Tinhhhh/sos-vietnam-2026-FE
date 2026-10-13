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

    const source = VIDEO_BY_TIER[tier];
    const lowPower = reducedMotion || isLowPowerDevice();

    const onTimeUpdate = () => {
      // Loop exclusively within the warm cupped-hands phase (1.2s - 2.75s)
      // to permanently eliminate the cold blue shockwave rings (which start at 2.85s)
      if (video.currentTime >= 2.75) {
        video.currentTime = 1.2;
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);

    const cleanupIdle = whenIdle(() => {
      loadedRef.current = true;
      video.src = source;
      if (lowPower) {
        video.addEventListener(
          'loadedmetadata',
          () => {
            video.currentTime = 2.5; // peak warm hands frame without blue rings
          },
          { once: true },
        );
        video.preload = 'auto';
        video.load();
        return;
      }
      video.autoplay = true;
      video.loop = true;
      video.load();
      video.play().catch(() => {});
    });

    return () => {
      cleanupIdle?.();
      video.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [tier, reducedMotion]);

  return (
    <div className={styles.bgVideoContainer}>
      <video
        ref={videoRef}
        id="citizenBgVideo"
        className={`${styles.bgVideo} ${styles.citizenBgVideo}`}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={POSTER}
        controlsList="nodownload nofullscreen noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
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
