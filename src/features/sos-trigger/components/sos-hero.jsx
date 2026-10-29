import { useEffect, useRef } from 'react';

import { speakSosPrompt } from '../utils/sos-voice-prompt';
import { CrystalOrb } from './crystal-orb';
import { LegalWarningCard } from './legal-warning-card';
import { SilentReportBar } from './silent-report-bar';
import desk from '@/components/layouts/citizen-layout/citizen-desktop.module.css';

import styles from './sos-hero.module.css';

// Lets the shockwave play before the SOS form opens (legacy timing).
const OPEN_FORM_DELAY_MS = 320;

/**
 * Home hero: headline, crystal SOS orb and the legal warning.
 * `onTrigger` fires after the tap animation; the route decides what opens.
 */
export function SosHero({ onTrigger }) {
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleActivate = () => {
    speakSosPrompt();
    navigator.vibrate?.([250, 100, 250]);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onTrigger?.(), OPEN_FORM_DELAY_MS);
  };

  return (
    <section className={styles.sosHero}>
      <div className={`${styles.heroBadgePill} liquid-glass`}>
        <span className={styles.liveDot} /> HỆ THỐNG ĐIỀU PHỐI KHẨN CẤP QUỐC GIA 24/7
      </div>
      <h1 className={`${styles.sosHeroTitle} ${desk.heroTitle}`}>Sống An Toàn, Được Bảo Vệ Từng Giây</h1>
      <p className={`${styles.sosHeroSub} ${desk.heroSub}`}>
        Chạm vào nút bên dưới để gửi tọa độ GPS và thông báo sự cố ngay lập tức tới lực lượng Công an, Y tế,
        Cứu hộ gần nhất.
      </p>

      <CrystalOrb onActivate={handleActivate} />
      <LegalWarningCard />
      <SilentReportBar />
    </section>
  );
}
