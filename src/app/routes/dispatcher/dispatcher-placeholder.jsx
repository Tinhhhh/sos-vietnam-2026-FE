import { useEffect } from 'react';

/** Full-featured 5-force tactical Dispatcher Command Center (Nghị định 30, GIS Radar, WebRTC). */
export function DispatcherPlaceholderRoute() {
  useEffect(() => {
    document.title = 'Cổng Trực Ban Tác Chiến SOS Việt Nam — Trung Tâm Điều Hành 24/7';
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', background: '#030712' }}>
      <iframe
        src="/dispatcher.html"
        title="Trung Tâm Điều Hành Trực Ban SOS Việt Nam"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  );
}
