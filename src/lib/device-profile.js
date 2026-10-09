/**
 * Port of legacy public/js/device-adaptive-layout.js.
 * Legacy CSS still targets these classes on <html>/<body>
 * (device-mobile, os-ios, touch-device, ...), so they are applied once at
 * startup and kept in sync on resize/orientation change.
 */

const PROFILE_CLASSES = [
  'device-watch',
  'device-mobile',
  'device-tablet',
  'device-laptop',
  'device-pc',
  'os-ios',
  'os-android',
  'os-windows',
  'os-mac',
  'touch-device',
  'no-touch',
  'low-power',
];

export function detectDeviceProfile() {
  const ua = navigator.userAgent || '';
  const width = window.innerWidth || document.documentElement.clientWidth;
  const height = window.innerHeight || document.documentElement.clientHeight;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  let osType = 'other';
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    osType = 'ios';
  } else if (/Android/i.test(ua)) {
    osType = 'android';
  } else if (/Windows/i.test(ua)) {
    osType = 'windows';
  } else if (/Macintosh|Mac OS/i.test(ua)) {
    osType = 'mac';
  }

  let deviceType;
  if (width <= 320 || /Watch|AppleWatch/i.test(ua)) {
    deviceType = 'watch';
  } else if (width <= 480 || (/Mobile|iPhone|Android/i.test(ua) && width < 768)) {
    deviceType = 'mobile';
  } else if (width <= 1024 || /iPad|Tablet/i.test(ua)) {
    deviceType = 'tablet';
  } else if (width <= 1440) {
    deviceType = 'laptop';
  } else {
    deviceType = 'pc';
  }

  return { deviceType, osType, width, height, isTouch, pixelRatio: window.devicePixelRatio || 1 };
}

/**
 * Weak hardware or data-saver: ambient effects (background video, bubbles,
 * drifting glows) are dropped so the SOS button stays responsive.
 */
export function isLowPowerDevice() {
  const memory = navigator.deviceMemory; // GB, Chromium only
  const cores = navigator.hardwareConcurrency;
  const saveData = navigator.connection?.saveData;
  return Boolean(saveData || (memory && memory < 4) || (cores && cores < 4));
}

function applyDeviceProfile() {
  const profile = detectDeviceProfile();
  const nextClasses = [
    `device-${profile.deviceType}`,
    `os-${profile.osType}`,
    profile.isTouch ? 'touch-device' : 'no-touch',
  ];
  if (isLowPowerDevice()) nextClasses.push('low-power');

  for (const el of [document.documentElement, document.body]) {
    el.classList.remove(...PROFILE_CLASSES);
    el.classList.add(...nextClasses);
  }

  document.documentElement.style.setProperty('--viewport-vw', `${profile.width}px`);
  document.documentElement.style.setProperty('--viewport-vh', `${profile.height}px`);
}

/** Applies the classes now and on every resize. Returns a cleanup function. */
export function initDeviceProfile() {
  applyDeviceProfile();

  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyDeviceProfile, 150);
  };
  const onOrientation = () => setTimeout(applyDeviceProfile, 200);

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onOrientation);

  return () => {
    clearTimeout(resizeTimer);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onOrientation);
  };
}
