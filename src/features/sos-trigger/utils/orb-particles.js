/*
 * Canvas effects of the crystal SOS orb (port of legacy initCrystalWaterSphere
 * and triggerOrbShockwave). Pure drawing helpers; the component owns the loop.
 */

export const LIQUID_SIZE = 165;
export const SPLASH_SIZE = 340;

const LIQUID_RADIUS = 76;
const FLAKE_COUNT = 52;
const FLAKE_COLORS = [
  'rgba(255, 223, 0, ', // gold
  'rgba(251, 191, 36, ', // amber
  'rgba(255, 255, 255, ', // diamond sparkle
  'rgba(255, 77, 109, ', // ruby pink
  'rgba(255, 42, 75, ', // crimson glow
];
const SPLASH_COLORS = [
  'rgba(255, 42, 75, ',
  'rgba(255, 215, 0, ',
  'rgba(255, 107, 129, ',
  'rgba(255, 255, 255, ',
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function createFlakes() {
  const c = LIQUID_SIZE / 2;
  return Array.from({ length: FLAKE_COUNT }, () => {
    const dist = Math.random() * (LIQUID_RADIUS - 12);
    const angle = Math.random() * Math.PI * 2;
    return {
      x: c + Math.cos(angle) * dist,
      y: c + Math.sin(angle) * dist,
      dist,
      angle,
      speed: (0.012 + Math.random() * 0.022) * (Math.random() > 0.3 ? 1 : -0.6),
      size: 1.0 + Math.random() * 2.6,
      alpha: 0.3 + Math.random() * 0.7,
      colorPrefix: pick(FLAKE_COLORS),
      bobFreq: 1.5 + Math.random() * 3,
      bobPhase: Math.random() * Math.PI * 2,
    };
  });
}

/**
 * Swirling golden glitter inside the orb. Mutates flakes in place.
 * `step` is the elapsed time in 60fps frames, so the swirl keeps the legacy
 * speed at a lower frame rate.
 */
export function drawLiquidFrame(ctx, flakes, time, speedMult, step = 1) {
  const w = LIQUID_SIZE;
  const c = w / 2;
  ctx.clearRect(0, 0, w, w);

  const glow = ctx.createRadialGradient(c, c + 10, 5, c, c, LIQUID_RADIUS);
  glow.addColorStop(0, 'rgba(255, 77, 109, 0.45)');
  glow.addColorStop(0.7, 'rgba(220, 38, 38, 0.15)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(c, c, LIQUID_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  for (const f of flakes) {
    f.angle += f.speed * speedMult * step;
    f.bobPhase += 0.04 * f.bobFreq * step;

    const dist = f.dist + Math.sin(f.bobPhase) * 4;
    const px = c + Math.cos(f.angle) * dist;
    const py = c + Math.sin(f.angle) * (dist * 0.88) + Math.sin(time + dist * 0.05) * 5;
    const alpha = Math.abs(Math.sin(f.bobPhase)) * f.alpha + 0.2;

    ctx.fillStyle = `${f.colorPrefix}${Math.min(1, alpha)})`;
    ctx.beginPath();
    ctx.arc(px, py, f.size, 0, Math.PI * 2);
    ctx.fill();

    if (f.size > 2.0) {
      // diamond gleam on the bigger flakes
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(px - f.size * 1.6, py);
      ctx.lineTo(px + f.size * 1.6, py);
      ctx.moveTo(px, py - f.size * 1.6);
      ctx.lineTo(px, py + f.size * 1.6);
      ctx.stroke();
    }
  }
}

/** 42 radial droplets/sparks thrown out from the orb rim on tap. */
export function spawnSplash(particles) {
  const c = SPLASH_SIZE / 2;
  for (let i = 0; i < 42; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3.5 + Math.random() * 7.5;
    particles.push({
      x: c + Math.cos(angle) * 75,
      y: c + Math.sin(angle) * 75,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0.12,
      size: 2.0 + Math.random() * 4.0,
      life: 1.0,
      decay: 0.018 + Math.random() * 0.025,
      colorPrefix: pick(SPLASH_COLORS),
      isGlow: Math.random() > 0.4,
    });
  }
}

/** Advances and draws splash particles. Mutates the array in place. */
export function drawSplashFrame(ctx, particles) {
  ctx.clearRect(0, 0, SPLASH_SIZE, SPLASH_SIZE);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.life -= p.decay;
    p.size *= 0.97;

    if (p.life <= 0 || p.size <= 0.2) {
      particles.splice(i, 1);
      continue;
    }

    ctx.fillStyle = `${p.colorPrefix}${p.life})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();

    if (p.isGlow) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff2a4b';
    }
  }
}
