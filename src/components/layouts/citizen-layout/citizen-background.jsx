import { useEffect, useRef } from 'react';

import { useNetworkStatus } from '@/hooks/use-network-status';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

import styles from './citizen-background.module.css';

const POSTER = '/assets/videos/sos-citizen-bg-poster.jpg';
const VIDEO_BY_TIER = {
  full: '/assets/videos/sos-citizen-bg-hq.mp4',
  '4g': '/assets/videos/sos-citizen-bg-hq.mp4',
  lite: '/assets/videos/sos-citizen-bg-lite.mp4',
  none: '',
};

/** Looping background video picked by connection quality, plus glow orbs. */
export function CitizenBackground() {
  const videoRef = useRef(null);
  const { tier } = useNetworkStatus();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const video = videoRef.current;
    const source = VIDEO_BY_TIER[tier];
    if (!video || reducedMotion || !source || video.getAttribute('src') === source) return undefined;

    // Load the video only when the browser is idle so it never delays the SOS button.
    const load = () => {
      video.src = source;
      video.load();
      video.play().catch(() => {});
    };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(load, { timeout: 1200 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(load, 500);
    return () => window.clearTimeout(id);
  }, [tier, reducedMotion]);

  return (
    <div className={styles.bgVideoContainer}>
      <video
        ref={videoRef}
        className={`${styles.bgVideo} ${styles.citizenBgVideo}`}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
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
