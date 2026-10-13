import { useEffect, useRef } from 'react';

import { speakSosPrompt } from '../utils/sos-voice-prompt';
import { CrystalOrb } from './crystal-orb';
import { LegalWarningCard } from './legal-warning-card';
import styles from './sos-hero.module.css';

// Lets the shockwave play before the SOS form opens (legacy timing).
const OPEN_FORM_DELAY_MS = 320;

/**
 * Home hero: headline, crystal SOS orb and the legal warning.
 * `onTrigger` fires after the tap animation; the route decides what opens.
 */
export function SosHero({ location, onTrigger }) {
  const timerRef = useRef(null);

  useEffect(() => {
    function alignOrbWithVideoWave() {
      const video = document.getElementById('citizenBgVideo');
      const isPortrait = window.innerWidth <= window.innerHeight;
      if (!isPortrait) {
        document.documentElement.style.removeProperty('--orb-calc-margin-top');
        return;
      }
      if (!video) return;
      const vr = video.getBoundingClientRect();
      if (!vr || vr.height === 0) return;

      const waveCenterY = vr.top + vr.height * 0.4877;
      const hero = document.querySelector(`.${styles.sosHero}`);
      const sub = hero?.querySelector(`.${styles.sosHeroSub}`);
      let subOuterBottom = (hero?.getBoundingClientRect().top || 0) + 140;
      if (sub) {
        const subStyle = window.getComputedStyle(sub);
        const subMarginBottom = parseFloat(subStyle.marginBottom) || 0;
        subOuterBottom = sub.getBoundingClientRect().bottom + subMarginBottom;
      }
      const orbHeight = 210;
      const desiredMarginTop = waveCenterY - orbHeight / 2 - subOuterBottom;
      if (desiredMarginTop > 10) {
        document.documentElement.style.setProperty('--orb-calc-margin-top', `${Math.round(desiredMarginTop)}px`);
      }
    }

    alignOrbWithVideoWave();
    window.addEventListener('resize', alignOrbWithVideoWave);
    const video = document.getElementById('citizenBgVideo');
    if (video) {
      video.addEventListener('loadedmetadata', alignOrbWithVideoWave);
      video.addEventListener('play', alignOrbWithVideoWave);
    }
    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener('resize', alignOrbWithVideoWave);
      if (video) {
        video.removeEventListener('loadedmetadata', alignOrbWithVideoWave);
        video.removeEventListener('play', alignOrbWithVideoWave);
      }
    };
  }, []);

  const handleActivate = () => {
    speakSosPrompt(location);
    navigator.vibrate?.([250, 100, 250]);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onTrigger?.(), OPEN_FORM_DELAY_MS);
  };

  return (
    <section className={styles.sosHero}>
      <div className={`${styles.heroBadgePill} liquid-glass`}>
        <span className={styles.liveDot} /> HỆ THỐNG ĐIỀU PHỐI KHẨN CẤP QUỐC GIA 24/7
      </div>
      <h1 className={styles.sosHeroTitle}>Sống An Toàn, Được Bảo Vệ Từng Giây</h1>
      <p className={styles.sosHeroSub}>
        Chạm vào nút bên dưới để gửi tọa độ GPS và thông báo sự cố ngay lập tức tới lực lượng Công an, Y tế,
        Cứu hộ gần nhất.
      </p>

      <CrystalOrb onActivate={handleActivate} />
      <LegalWarningCard />
    </section>
  );
}
