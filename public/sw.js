// Minimal service worker: only makes the site installable ("Cài lối tắt").
// No caching: page loads go straight to the network (an emergency app must never show stale data);
// offline, the user gets a short message with the 113 / 114 / 115 hotlines instead of the browser error.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const OFFLINE_HTML = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Mất kết nối</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#030712;color:#e5e7eb;
font-family:system-ui,sans-serif;text-align:center;padding:24px}a{display:block;margin:10px auto;max-width:260px;
padding:14px;border-radius:12px;background:#dc2626;color:#fff;font-weight:800;text-decoration:none}</style></head>
<body><div><h2>Không có kết nối mạng</h2><p>Gọi trực tiếp tổng đài khẩn cấp:</p>
<a href="tel:113">113 · Công an</a><a href="tel:114">114 · Cứu hoả, cứu nạn</a><a href="tel:115">115 · Cấp cứu</a>
</div></body></html>`;

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
    ),
  );
});
