import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

/** Proxy hook: remove the Origin header from proxied HTTP requests and WebSocket upgrades. */
const dropOrigin = (proxy) => {
  proxy.on('proxyReq', (req) => req.removeHeader('origin'));
  proxy.on('proxyReqWs', (req) => req.removeHeader('origin'));
};

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
      // Phone testing over HTTPS (camera / GPS need it): `cloudflared tunnel --url http://localhost:5173`
      allowedHosts: ['.trycloudflare.com'],
      proxy: {
        // Drop Origin like the prod nginx does: the browser only talks to this origin, and a tunnel
        // host is not in the BE CORS list (REST and the WebSocket handshake would get 403).
        '/api': { target: backendUrl, changeOrigin: true, configure: dropOrigin },
        '/ws': { target: backendUrl, changeOrigin: true, ws: true, configure: dropOrigin },
      },
    },
  };
});
