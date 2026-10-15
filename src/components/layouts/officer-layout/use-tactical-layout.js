import { useEffect, useState } from 'react';

/**
 * Port of legacy js/tactical-layout.js. Picks the console layout from the viewport
 * width and mirrors it on <body> (legacy CSS keys off these classes):
 *   >= 1280px : 'three'  [Sự cố] | [Bản đồ] | [Chi tiết]   body.tac-three-zone
 *   993–1279  : 'two'    [Bản đồ] | [Sidebar]              body.tac-two-col
 *   <= 992px  : 'mobile' one zone + bottom tab bar          body.tac-mobile-console
 * On mobile body[data-tac-view] says which zone is shown (map | queue | detail).
 */
const BP_THREE = 1280;
const BP_MOBILE = 992;

function modeFor(width) {
  if (width <= BP_MOBILE) return 'mobile';
  if (width >= BP_THREE) return 'three';
  return 'two';
}

export function useTacticalLayout({ incidentSelected = false } = {}) {
  const [mode, setMode] = useState(() => modeFor(window.innerWidth));
  const [mobileView, setMobileView] = useState('map');

  useEffect(() => {
    const onResize = () => setMode(modeFor(window.innerWidth));
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  useEffect(() => {
    const body = document.body;
    body.classList.toggle('tac-three-zone', mode === 'three');
    body.classList.toggle('tac-two-col', mode === 'two');
    body.classList.toggle('tac-mobile-console', mode === 'mobile');
    body.classList.toggle('tac-incident-selected', incidentSelected);
    body.setAttribute('data-tac-mode', mode);
    if (mode === 'mobile') body.setAttribute('data-tac-view', mobileView);
    else body.removeAttribute('data-tac-view');
  }, [mode, mobileView, incidentSelected]);

  useEffect(
    () => () => {
      const body = document.body;
      body.classList.remove('tac-three-zone', 'tac-two-col', 'tac-mobile-console', 'tac-incident-selected');
      body.removeAttribute('data-tac-mode');
      body.removeAttribute('data-tac-view');
    },
    [],
  );

  return { mode, mobileView, setMobileView };
}
