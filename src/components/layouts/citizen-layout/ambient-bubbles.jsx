import { useState } from 'react';

import { isLowPowerDevice } from '@/lib/device-profile';

import styles from './ambient-bubbles.module.css';

// Port of legacy public/js/ios-bubble-ambient.js.
const BUBBLE_COLORS = [
  'radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.4) 0%, rgba(56, 189, 248, 0.12) 50%, rgba(14, 165, 233, 0.04) 80%, rgba(255, 255, 255, 0.01) 100%)',
  'radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.4) 0%, rgba(239, 68, 68, 0.12) 50%, rgba(220, 38, 38, 0.04) 80%, rgba(255, 255, 255, 0.01) 100%)',
  'radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.4) 0%, rgba(16, 185, 129, 0.12) 50%, rgba(5, 150, 105, 0.04) 80%, rgba(255, 255, 255, 0.01) 100%)',
  'radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.4) 0%, rgba(245, 158, 11, 0.12) 50%, rgba(217, 119, 6, 0.04) 80%, rgba(255, 255, 255, 0.01) 100%)',
];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min)) + min;

function createBubbles() {
  const count = window.innerWidth < 768 ? 5 : 8;
  return Array.from({ length: count }, (_, i) => {
    const size = randomInt(40, 120);
    return {
      id: i,
      style: {
        width: `${size}px`,
        height: `${size}px`,
        left: `${randomInt(0, 92)}vw`,
        top: `${randomInt(0, 92)}vh`,
        background: BUBBLE_COLORS[i % BUBBLE_COLORS.length],
        animationDuration: `${randomInt(18, 32)}s`,
        animationDelay: `${-randomInt(0, 15)}s`,
        opacity: (Math.random() * 0.14 + 0.14).toFixed(2),
      },
    };
  });
}

export function AmbientBubbles() {
  // Random layout is generated once per mount; weak devices get none.
  const [bubbles] = useState(() => (isLowPowerDevice() ? [] : createBubbles()));
  if (bubbles.length === 0) return null;

  return (
    <div className={styles.ios26AmbientBubblesBackdrop} aria-hidden="true">
      {bubbles.map((b) => (
        <div key={b.id} className={styles.ios26TranslucentBubble} style={b.style} />
      ))}
    </div>
  );
}
