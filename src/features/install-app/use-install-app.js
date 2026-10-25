import { useCallback, useState } from 'react';

import { canPromptInstall, detectPlatform, isStandalone, promptInstall } from './install-prompt';

/**
 * Button handler for "Cài Lối Tắt": native install dialog when the browser offers one
 * (Android / desktop Chromium), otherwise the manual steps (iOS Share menu, other browsers).
 * @param {(msg: string, opts?: object) => void} notify toast
 * @returns {{ install: () => void, guide: null | 'ios' | 'android' | 'desktop', closeGuide: () => void }}
 */
export function useInstallApp(notify) {
  const [guide, setGuide] = useState(null);

  const install = useCallback(async () => {
    if (isStandalone()) {
      notify('Bạn đang mở SOS Việt Nam từ lối tắt trên màn hình chính.', { tone: 'success' });
      return;
    }
    if (canPromptInstall()) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') notify('Đã thêm SOS Việt Nam ra màn hình chính.', { tone: 'success' });
      return;
    }
    setGuide(detectPlatform());
  }, [notify]);

  const closeGuide = useCallback(() => setGuide(null), []);
  return { install, guide, closeGuide };
}
