import { useEffect, useState } from 'react';

/**
 * Port of legacy public/js/connection-aware-background.js.
 * `tier` picks the background video quality:
 *   full -> HQ video, 4g -> HQ video, lite -> lite video, none -> poster only.
 */
function readNetwork() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  if (!navigator.onLine) return { label: 'Không có kết nối', tier: 'none' };
  // Browsers that hide the radio type keep the full experience instead of
  // being wrongly downgraded.
  if (!connection) return { label: 'Đang nhận diện', tier: 'full' };

  const type = connection.type || '';
  const effectiveType = connection.effectiveType || '';
  const downlink = Number(connection.downlink || 0);
  const rtt = Number(connection.rtt || 0);
  const isCellular = type === 'cellular';
  // No real 5G label exists in the Network Information API; this threshold is
  // deliberately conservative so normal 4G stays on the 720p asset.
  const isLikely5G = isCellular && effectiveType === '4g' && downlink >= 20 && rtt > 0 && rtt <= 60;

  if (connection.saveData) return { label: 'Tiết kiệm dữ liệu', tier: 'none' };
  if (type === 'wifi') return { label: 'Wi‑Fi', tier: 'full' };
  if (isLikely5G) return { label: 'Di động rất nhanh (ước lượng 5G)', tier: 'full' };
  if (isCellular && effectiveType === '4g') return { label: '4G', tier: '4g' };
  if (isCellular && effectiveType === '3g') return { label: '3G', tier: 'lite' };
  if (isCellular && (effectiveType === '2g' || effectiveType === 'slow-2g')) {
    return { label: `Mạng yếu (${effectiveType.toUpperCase()})`, tier: 'none' };
  }
  if (isCellular) return { label: 'Mạng di động', tier: 'lite' };
  if (type === 'ethernet') return { label: 'Ethernet', tier: 'full' };
  return { label: 'Đang nhận diện', tier: 'full' };
}

export function useNetworkStatus() {
  const [network, setNetwork] = useState(readNetwork);

  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const update = () => setNetwork(readNetwork());

    connection?.addEventListener?.('change', update);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      connection?.removeEventListener?.('change', update);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return network;
}
