import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app';
import { initInstallPrompt } from '@/features/install-app';
import { initDeviceProfile } from '@/lib/device-profile';
import '@/styles/legacy-global.css';
import '@/styles/app.css';

initDeviceProfile();
initInstallPrompt();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
