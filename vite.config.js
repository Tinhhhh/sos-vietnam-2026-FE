import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '');
  // Spring Boot backend (sos-vietnam-be-v2). The dev server proxies /api and /ws
  // to it, so the browser stays same-origin and no CORS setup is needed locally.
  const backendUrl = env.BACKEND_URL || 'http://localhost:8080';

  return {
    root: projectRoot,
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    css: {
      modules: {
        // `.btn-crystal-orb` in CSS -> `styles.btnCrystalOrb` in JSX
        localsConvention: 'camelCaseOnly',
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true },
        '/ws': { target: backendUrl, changeOrigin: true, ws: true },
      },
    },
  };
});
