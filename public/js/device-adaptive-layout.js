/**
 * 📱 Smart Device-Adaptive Layout Engine for SOS Emergency Vietnam
 * Auto-detects device type (Apple Watch, iPhone, Android, iPad/Tablet, Laptop, PC)
 * and dynamically applies optimal layout classes, touch ergonomics, and viewport optimizations.
 */

(function() {
  'use strict';

  function detectDeviceProfile() {
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    const height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const pixelRatio = window.devicePixelRatio || 1;

    let deviceType = 'desktop';
    let osType = 'other';

    // 1. Check OS
    if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      osType = 'ios';
    } else if (/Android/i.test(ua)) {
      osType = 'android';
    } else if (/Windows/i.test(ua)) {
      osType = 'windows';
    } else if (/Macintosh|Mac OS/i.test(ua)) {
      osType = 'mac';
    }

    // 2. Check Device Category
    if (width <= 320 || /Watch|AppleWatch/i.test(ua)) {
      deviceType = 'watch'; // Apple Watch / Smartwatch / Ultra-compact
    } else if (width <= 480 || (/Mobile|iPhone|Android/i.test(ua) && width < 768)) {
      deviceType = 'mobile'; // iPhone / Android Phone
    } else if (width <= 1024 || /iPad|Tablet/i.test(ua)) {
      deviceType = 'tablet'; // iPad / Android Tablet
    } else if (width <= 1440) {
      deviceType = 'laptop'; // Laptop
    } else {
      deviceType = 'pc'; // Desktop / Widescreen PC
    }

    return {
      deviceType,
      osType,
      width,
      height,
      isTouch,
      pixelRatio
    };
  }

  function applyDeviceAdaptiveClasses() {
    const profile = detectDeviceProfile();
    const html = document.documentElement;
    const body = document.body;

    // Clear previous device classes
    const classesToRemove = [
      'device-watch', 'device-mobile', 'device-tablet', 'device-laptop', 'device-pc',
      'os-ios', 'os-android', 'os-windows', 'os-mac',
      'touch-device', 'no-touch'
    ];
    classesToRemove.forEach(cls => {
      html.classList.remove(cls);
      if (body) body.classList.remove(cls);
    });

    // Add updated profile classes
    const classesToAdd = [
      `device-${profile.deviceType}`,
      `os-${profile.osType}`,
      profile.isTouch ? 'touch-device' : 'no-touch'
    ];

    classesToAdd.forEach(cls => {
      html.classList.add(cls);
      if (body) body.classList.add(cls);
    });

    // Set CSS Variables for adaptive UI scaling
    html.style.setProperty('--viewport-vw', `${profile.width}px`);
    html.style.setProperty('--viewport-vh', `${profile.height}px`);

    // Dispatch event for other components (Map, Stepper, Charts) to re-layout
    window.dispatchEvent(new CustomEvent('sos:device-change', { detail: profile }));

    // Calibrate SOS Crystal Orb with Background Video Wave Center
    alignOrbWithVideoWave();
  }

  function alignOrbWithVideoWave() {
    const video = document.getElementById('citizenBgVideo');
    const orb = document.getElementById('crystalOrbWrapper');
    const hero = document.querySelector('.sos-hero');
    if (!video || !orb || !hero) return;

    const isPortrait = window.innerWidth <= window.innerHeight;
    if (!isPortrait) {
      document.documentElement.style.removeProperty('--orb-calc-margin-top');
      return;
    }

    const vr = video.getBoundingClientRect();
    if (!vr || vr.height === 0) return;

    // Exact wave epicenter in 16:9 video is at 48.77% of video rendered height
    const waveCenterY = vr.top + vr.height * 0.4877;
    const sub = hero.querySelector('.sos-hero-sub');
    let subOuterBottom = hero.getBoundingClientRect().top + 140;
    if (sub) {
      const subStyle = window.getComputedStyle(sub);
      const subMarginBottom = parseFloat(subStyle.marginBottom) || 0;
      subOuterBottom = sub.getBoundingClientRect().bottom + subMarginBottom;
    }
    const orbHeight = orb.offsetHeight || 204;

    const desiredMarginTop = (waveCenterY - orbHeight / 2) - subOuterBottom;
    if (desiredMarginTop > 10) {
      document.documentElement.style.setProperty('--orb-calc-margin-top', `${Math.round(desiredMarginTop)}px`);
    }
  }

  // Run on load and on resize/orientation change
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDeviceAdaptiveClasses);
  } else {
    applyDeviceAdaptiveClasses();
  }

  // Attach video metadata listener to realign when video renders
  window.addEventListener('DOMContentLoaded', function() {
    const bgVid = document.getElementById('citizenBgVideo');
    if (bgVid) {
      bgVid.addEventListener('loadedmetadata', alignOrbWithVideoWave);
      bgVid.addEventListener('play', alignOrbWithVideoWave);
    }
  });

  let resizeTimer = null;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyDeviceAdaptiveClasses, 150);
  });

  window.addEventListener('orientationchange', function() {
    setTimeout(applyDeviceAdaptiveClasses, 200);
  });

  window.getSOSDeviceProfile = detectDeviceProfile;
  window.alignSOSOrbWithVideoWave = alignOrbWithVideoWave;
})();
