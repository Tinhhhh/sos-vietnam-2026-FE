/**
 * OfficerLoginForm — Tactical Officer Login Portal
 * SOS Việt Nam 2026
 *
 * Background:
 *   - Live satellite video (dispatcher-bg.mp4) with tactical-earth-orbit poster fallback
 *   - 60fps Starfield Canvas Ambient with twinkling stars & drifting photons
 *   - Vietnam Dolly Zoom cinematic camera acceleration
 *   - Military scanline & vignette
 *
 * Action:
 *   - Central Holographic Security Shield with radar & ping halo
 *   - Single prominent tactical button to open the Auth Gate Modal
 *   - Auth Gate Modal with email & password authentication, validation, and staged progress
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { SESSION_ENDED_KEY } from './auth-context';
import { MemberPinStep } from './member-pin-step';
import { useAuth } from './use-auth';
import { paths } from '@/config/paths';
import s from './officer-login.module.css';

/** Solid eye for the password toggle; `crossed` = password is shown, click to hide it again. */
function EyeIcon({ crossed }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M12 5C6.5 5 2.4 9.1 1 12c1.4 2.9 5.5 7 11 7s9.6-4.1 11-7c-1.4-2.9-5.5-7-11-7zm0 11.3a4.3 4.3 0 1 1 0-8.6 4.3 4.3 0 0 1 0 8.6z"
      />
      <circle cx="12" cy="12" r="2.6" />
      <circle cx="13.1" cy="10.9" r="0.9" fill="#0b1628" />
      {crossed && (
        <>
          <line
            x1="3.5"
            y1="3.5"
            x2="20.5"
            y2="20.5"
            stroke="#0b1628"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line
            x1="3.5"
            y1="3.5"
            x2="20.5"
            y2="20.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

function readSessionEnded() {
  try {
    return sessionStorage.getItem(SESSION_ENDED_KEY);
  } catch {
    return null;
  }
}

// ── 60fps Tactical Cosmic Starfield Particle Hook ──────────────
function useCosmicStarfield(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId = null;
    let isRunning = true;
    const dpr = window.devicePixelRatio || 1;

    let width = 0;
    let height = 0;

    function resize() {
      const parent = canvas.parentElement;
      const rect = parent
        ? parent.getBoundingClientRect()
        : { width: window.innerWidth, height: window.innerHeight };
      width = Math.max(rect.width || window.innerWidth, 320);
      height = Math.max(rect.height || window.innerHeight, 480);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    resize();

    // 75 stars concentrated in the space orbit area
    const numStars = 75;
    const stars = Array.from({ length: numStars }, () => ({
      x: Math.random(),
      y: Math.random() * 0.55,
      radius: Math.random() * 1.6 + 0.4,
      baseAlpha: Math.random() * 0.5 + 0.25,
      twinkleSpeed: Math.random() * 0.04 + 0.015,
      phase: Math.random() * Math.PI * 2,
      hue: Math.random() > 0.8 ? 195 : Math.random() > 0.5 ? 210 : 0,
    }));

    // 10 drifting micro-photons
    const numPhotons = 10;
    const photons = Array.from({ length: numPhotons }, () => ({
      x: Math.random(),
      y: Math.random() * 0.48,
      vx: (Math.random() * 0.0004 + 0.0001) * (Math.random() > 0.5 ? 1 : -1),
      vy: Math.random() * 0.0003 + 0.0001,
      length: Math.random() * 25 + 10,
      alpha: Math.random() * 0.4 + 0.2,
    }));

    function loop() {
      if (!isRunning) return;

      ctx.clearRect(0, 0, width, height);
      const now = performance.now() * 0.001;

      // Draw Twinkling Stars
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const x = star.x * width;
        const y = star.y * height;
        const alpha = star.baseAlpha + Math.sin(now * star.twinkleSpeed * 10 + star.phase) * 0.35;
        const clampedAlpha = Math.max(0.1, Math.min(1, alpha));

        ctx.beginPath();
        ctx.arc(x, y, star.radius, 0, Math.PI * 2);
        if (star.hue === 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${clampedAlpha})`;
        } else {
          ctx.fillStyle = `hsla(${star.hue}, 90%, 75%, ${clampedAlpha})`;
        }
        ctx.fill();

        // Subtle glow halo for larger stars
        if (star.radius > 1.2 && clampedAlpha > 0.6) {
          ctx.beginPath();
          ctx.arc(x, y, star.radius * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${clampedAlpha * 0.18})`;
          ctx.fill();
        }
      }

      // Draw Drifting Micro-Photons
      for (let j = 0; j < photons.length; j++) {
        const p = photons[j];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        if (p.y > 0.55) p.y = 0;
        if (p.y < 0) p.y = 0.55;

        const px = p.x * width;
        const py = p.y * height;

        const grad = ctx.createLinearGradient(px - p.vx * 1000, py - p.vy * 1000, px, py);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
        grad.addColorStop(1, `rgba(186, 230, 253, ${p.alpha})`);

        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.2;
        ctx.moveTo(px - p.vx * 200, py - p.vy * 200);
        ctx.lineTo(px, py);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, py, 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 1.5})`;
        ctx.fill();
      }

      animFrameId = requestAnimationFrame(loop);
    }

    animFrameId = requestAnimationFrame(loop);

    function onResize() {
      resize();
    }

    function onVisibilityChange() {
      if (document.hidden) {
        isRunning = false;
        if (animFrameId) cancelAnimationFrame(animFrameId);
      } else {
        isRunning = true;
        animFrameId = requestAnimationFrame(loop);
      }
    }

    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isRunning = false;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [canvasRef]);
}

// ── Progress Bar UX Hook ──────────────────────────────────────
function useLoginProgress() {
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState('Đang xác thực bảo mật tài khoản...');

  function startProgress() {
    setPct(0);
    setLabel('Đang xác thực bảo mật tài khoản...');
    const steps = [
      { target: 30, label: 'Xác thực danh tính cán bộ...', delay: 300 },
      { target: 60, label: 'Kiểm tra phân quyền đơn vị...', delay: 700 },
      { target: 85, label: 'Tải thông tin địa giới hành chính...', delay: 1100 },
      { target: 100, label: 'Hoàn tất — Đang vào bàn điều phối...', delay: 1500 },
    ];
    steps.forEach(({ target, label: lbl, delay }) => {
      setTimeout(() => {
        setPct(target);
        setLabel(lbl);
      }, delay);
    });
  }

  return { pct, label, startProgress };
}

export function OfficerLoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Canvas starfield ref
  const canvasRef = useRef(null);
  useCosmicStarfield(canvasRef);

  // State: Modal visibility
  const [sessionEnded] = useState(readSessionEnded);
  const [isModalOpen, setIsModalOpen] = useState(!!sessionEnded);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(sessionEnded);
  const [showProgress, setShowProgress] = useState(false);
  // unit account logged in, waiting for step 2 (pick officer + PIN)
  const [unitToken, setUnitToken] = useState(null);

  const { pct, label, startProgress } = useLoginProgress();

  // Session ended from elsewhere (password changed, revoked): the form opens and says why, once
  useEffect(() => {
    try {
      sessionStorage.removeItem(SESSION_ENDED_KEY);
    } catch {
      // storage blocked
    }
  }, []);

  function openModal() {
    setError(null);
    setEmail('');
    setPassword('');
    setShowProgress(false);
    setSubmitting(false);
    setUnitToken(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setIsModalOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const result = await login({ email: email.trim(), password });
      if (result.unitToken) {
        setSubmitting(false);
        setPassword('');
        setUnitToken(result.unitToken);
        return;
      }
      await enterConsole();
    } catch (err) {
      setShowProgress(false);
      setSubmitting(false);
      setError(err.message || 'Tài khoản hoặc mật khẩu không chính xác!');
    }
  }

  async function enterConsole() {
    setSubmitting(true);
    setShowProgress(true);
    startProgress();
    // Wait for progress animation to complete
    await new Promise((r) => setTimeout(r, 1800));
    navigate(paths.officer.dashboard.getHref(), { replace: true });
  }

  return (
    <div className={s.page}>
      {/* ── Background: Live Satellite Video & Orbit Layer ──── */}
      <div className={s.bgContainer} aria-hidden="true">
        {/* Vietnam S-Curve Satellite Zoom Layer */}
        <div className={s.vietnamZoomLayer}>
          <img
            className={s.bgTacticalOrbit}
            src="/assets/tactical-earth-orbit.jpg"
            alt="Vietnam Satellite Orbit"
          />
        </div>

        {/* Live Moving Satellite Video */}
        <video
          className={s.bgVideo}
          autoPlay
          muted
          loop
          playsInline
          webkit-playsinline="true"
          preload="auto"
          poster="/assets/tactical-earth-orbit.jpg"
          src="/assets/videos/dispatcher-bg.mp4"
        />

        {/* 60fps Starfield Canvas Particles */}
        <canvas ref={canvasRef} className={s.starfieldCanvas} />

        {/* Tactical Dark Navy Vignette Overlay */}
        <div className={s.bgOverlay} />

        {/* Cyber Military Scanline Sweep */}
        <div className={s.bgScanline} />
      </div>

      {/* ── Top Header ───────────────────────────────────────── */}
      <header className={s.header}>
        <div className={s.headerBadge}>
          <span className={s.headerBadgeDot} />
          HỆ THỐNG TRỰC CHIẾN QUỐC GIA 2026
        </div>
        <h1 className={s.headerTitle}>CỔNG CÁN BỘ & ĐIỀU PHỐI CỨU HỘ KHẨN CẤP</h1>
        <div className={s.headerDescCard}>
          <span className={s.headerDescText}>
            Trung tâm tiếp nhận, giám sát và chỉ huy phản ứng nhanh các lực lượng cứu hộ liên ngành
          </span>
          <div className={s.emergencyTags}>
            <span className={`${s.emergencyTag} ${s.tagBlue}`}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#00ECF3',
                  boxShadow: '0 0 6px #00ECF3',
                }}
              />
              113 CÔNG AN
            </span>
            <span className={`${s.emergencyTag} ${s.tagGold}`}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#DFB077',
                  boxShadow: '0 0 6px #DFB077',
                }}
              />
              114 PCCC
            </span>
            <span className={`${s.emergencyTag} ${s.tagRed}`}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#ff4d6d',
                  boxShadow: '0 0 6px #ff4d6d',
                }}
              />
              115 CẤP CỨU
            </span>
          </div>
        </div>
      </header>

      {/* ── Center Stage: Holographic Shield & Single Action Button ── */}
      <main className={s.stage}>
        {/* Central Tactical Security Shield */}
        <div className={s.shieldContainer} aria-hidden="true">
          <div className={s.shieldRadarRing} />
          <div className={s.shieldPingRing} />
          <div className={s.shieldCore}>
            <img
              src="/assets/icons/logo-sos-emblem.png"
              alt="Khiên An Ninh Quốc Gia"
              className={s.shieldIcon}
            />
          </div>
        </div>

        {/* The Single Primary Button to open UI Login */}
        <button id="btn-open-officer-login" type="button" className={s.openPortalBtn} onClick={openModal}>
          <img src="/assets/icons/khien.png" alt="" className={s.openPortalIcon} aria-hidden="true" />
          <span>ĐĂNG NHẬP CÁN BỘ TÁC CHIẾN</span>
          <svg
            className={s.openPortalArrow}
            viewBox="0 0 24 24"
            width="18"
            height="18"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </main>

      {/* ── Auth Gate Modal ────────────────────────────────────── */}
      {isModalOpen && (
        <div
          className={s.backdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Đăng nhập cán bộ"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className={s.modal}>
            {/* Close button */}
            <button
              type="button"
              className={s.modalCloseBtn}
              onClick={closeModal}
              disabled={submitting}
              aria-label="Đóng cửa sổ đăng nhập"
            >
              ✕ Đóng
            </button>

            {/* Glowing Shield Emblem */}
            <div className={s.modalShieldWrap} aria-hidden="true">
              <img src="/assets/icons/khien.png" alt="" className={s.modalShieldImg} />
            </div>

            {/* Badge */}
            <div className={s.modalBadge}>
              <span className={s.modalBadgeDot} />
              XÁC THỰC AN NINH NỘI BỘ
            </div>

            <h2 className={s.modalTitle}>{unitToken ? 'CÁN BỘ VÀO TRỰC' : 'ĐĂNG NHẬP ĐƠN VỊ'}</h2>
            <p className={s.modalSubtitle}>
              {unitToken
                ? 'Chọn tên của bạn trong danh sách cán bộ đơn vị và nhập mã PIN cá nhân.'
                : 'Vui lòng nhập email và mật khẩu tài khoản đơn vị được cấp.'}
            </p>

            {unitToken && !showProgress && (
              <MemberPinStep
                unitToken={unitToken}
                s={s}
                onDone={enterConsole}
                onBack={() => {
                  setUnitToken(null);
                  setError(null);
                }}
              />
            )}

            {/* Form */}
            {!unitToken && (
              <form className={s.form} onSubmit={handleSubmit} noValidate>
                {/* Email */}
                <div>
                  <label className={s.fieldLabel} htmlFor="officer-email">
                    Email tài khoản đơn vị *
                  </label>
                  <div className={s.inputWrap}>
                    <input
                      id="officer-email"
                      type="email"
                      className={s.input}
                      placeholder="Nhập tài khoản..."
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={submitting}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className={s.fieldLabel} htmlFor="officer-password">
                    Mật khẩu bảo mật đơn vị *
                  </label>
                  <div className={s.inputWrap}>
                    <input
                      id="officer-password"
                      type={showPwd ? 'text' : 'password'}
                      className={s.input}
                      placeholder="Nhập mật khẩu đơn vị..."
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={submitting}
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      className={s.togglePwd}
                      onClick={() => setShowPwd((v) => !v)}
                      aria-label={showPwd ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      tabIndex={-1}
                    >
                      <EyeIcon crossed={showPwd} />
                    </button>
                  </div>
                </div>

                {/* Error Box */}
                {error && (
                  <div className={s.errorBox} role="alert">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  id="officer-login-submit"
                  type="submit"
                  className={s.submitBtn}
                  disabled={submitting || !email || !password}
                >
                  {submitting ? (
                    <>
                      <span className={s.spinner} /> Đang xác thực...
                    </>
                  ) : (
                    <>
                      <img
                        src="/assets/icons/khien.png"
                        alt=""
                        style={{ width: 18, height: 18, objectFit: 'contain' }}
                      />
                      XÁC THỰC TRUY CẬP AN NINH
                    </>
                  )}
                </button>

                {showProgress && <ProgressBox pct={pct} label={label} s={s} />}
              </form>
            )}

            {unitToken && showProgress && <ProgressBox pct={pct} label={label} s={s} />}
          </div>
        </div>
      )}

      {/* ── Bottom Bar ───────────────────────────────────────── */}
      <footer className={s.bottomBar} aria-hidden="true">
        <span className={s.bottomText}>
          HỆ THỐNG ĐIỀU PHỐI CỨU HỘ KHẨN CẤP QUỐC GIA 2026 • PHÒNG THỦ KHÔNG GIAN SỐ
        </span>
      </footer>
    </div>
  );
}

function ProgressBox({ pct, label, s }) {
  return (
    <div className={s.progressBox}>
      <div className={s.progressTop}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={s.spinner} style={{ width: 12, height: 12 }} />
          {label}
        </span>
        <span className={s.progressPercent}>{pct}%</span>
      </div>
      <div className={s.progressTrack}>
        <div className={s.progressBar} style={{ width: `${pct}%` }} />
      </div>
      <div className={s.progressDetail}>
        <span>🌐</span>
        <span>Đang tải thông tin địa giới hành chính 34 tỉnh thành & 3.321 xã/phường...</span>
      </div>
    </div>
  );
}
