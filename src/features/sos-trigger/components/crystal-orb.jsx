import { useEffect, useRef } from 'react';

import {
  createFlakes,
  drawLiquidFrame,
  drawSplashFrame,
  LIQUID_SIZE,
  spawnSplash,
  SPLASH_SIZE,
} from '../utils/orb-particles';
import styles from './crystal-orb.module.css';

const HIGHLIGHT_REST = 'rotate(-22deg)';

/** Restarts a CSS animation by removing the class, forcing reflow, re-adding it. */
function replayClass(el, className) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

/** 3D crystal water sphere SOS button with liquid glitter + splash canvases. */
export function CrystalOrb({ onActivate }) {
  const buttonRef = useRef(null);
  const liquidRef = useRef(null);
  const splashRef = useRef(null);
  const highlightRef = useRef(null);
  const blastRef = useRef(null);
  const rippleRef = useRef(null);
  const hoveredRef = useRef(false);
  const particlesRef = useRef([]);
  const clickTimerRef = useRef(null);

  useEffect(() => {
    const liquidCtx = liquidRef.current.getContext('2d');
    const splashCtx = splashRef.current.getContext('2d');
    const flakes = createFlakes();
    let time = 0;
    let speedMult = 1;
    let frame;

    const loop = () => {
      // ease into 2.8x swirl speed while hovered
      speedMult += ((hoveredRef.current ? 2.8 : 1.0) - speedMult) * 0.08;
      time += 0.03 * speedMult;
      drawLiquidFrame(liquidCtx, flakes, time, speedMult);
      drawSplashFrame(splashCtx, particlesRef.current);
      frame = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(clickTimerRef.current);
    };
  }, []);

  const handleMouseMove = (e) => {
    const rect = buttonRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    highlightRef.current.style.transform = `translate(${nx * 14}px, ${ny * 10}px) ${HIGHLIGHT_REST}`;
  };

  const handleMouseLeave = () => {
    hoveredRef.current = false;
    highlightRef.current.style.transform = HIGHLIGHT_REST;
  };

  const handleClick = (e) => {
    const button = buttonRef.current;
    button.classList.add(styles.isClicking);
    clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => button.classList.remove(styles.isClicking), 450);

    replayClass(blastRef.current, styles.active);
    replayClass(rippleRef.current, styles.active);
    spawnSplash(particlesRef.current);

    onActivate?.(e);
  };

  return (
    <div className={styles.crystalOrbWrapper}>
      <div className={`${styles.radarRing} ${styles.ring1}`} />
      <div className={`${styles.radarRing} ${styles.ring2}`} />
      <div className={`${styles.radarRing} ${styles.ring3}`} />
      <div ref={blastRef} className={styles.shockwaveBlastRing} />

      <canvas
        ref={splashRef}
        className={styles.orbParticlesCanvas}
        width={SPLASH_SIZE}
        height={SPLASH_SIZE}
        aria-hidden="true"
      />

      <button
        ref={buttonRef}
        type="button"
        className={styles.btnCrystalOrb}
        aria-label="Bấm phát tín hiệu SOS"
        onClick={handleClick}
        onMouseEnter={() => {
          hoveredRef.current = true;
        }}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        <div className={styles.orbGlassBase} />

        <div className={styles.orbLiquidChamber}>
          <div className={styles.orbFluidDeep} />
          <canvas
            ref={liquidRef}
            className={styles.orbLiquidCanvas}
            width={LIQUID_SIZE}
            height={LIQUID_SIZE}
            aria-hidden="true"
          />
          <div className={`${styles.liquidWaveLayer} ${styles.waveBack}`} />
          <div className={`${styles.liquidWaveLayer} ${styles.waveMid}`} />
          <div className={`${styles.liquidWaveLayer} ${styles.waveFront}`} />
          <div className={styles.orbVortexSwirl} />
        </div>

        <div ref={highlightRef} className={styles.orbGlassHighlightTop} />
        <div className={styles.orbGlassRimSheen} />
        <div className={styles.orbGlassCausticBottom} />

        <div className={styles.orbContent}>
          <span className={styles.orbSosText}>SOS</span>
          <span className={styles.orbSosSub}>BÁO CỨU HỘ</span>
        </div>

        <div ref={rippleRef} className={styles.orbClickRipple} />
      </button>
    </div>
  );
}
