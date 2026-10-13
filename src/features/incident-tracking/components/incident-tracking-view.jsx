import { useEffect, useRef, useState } from 'react';

import { notifyCitizenSafe, sendChatMessage } from '../api/tracking';
import styles from './incident-tracking-view.module.css';

const DEFAULT_COORDS = { lat: 21.0285, lng: 105.8542 };

export function IncidentTrackingView({
  incident,
  citizenAccessToken,
  onEndIncident,
  onOpenVideoCall,
  onOpenVoiceCall,
  onViewReport,
}) {
  const [currentIncident, setCurrentIncident] = useState(incident || {});
  const [messages, setMessages] = useState([
    {
      id: 'sys-welcome',
      sender: 'system',
      text: 'Hệ thống đã tự động kích hoạt đường truyền kết nối ưu tiên đến Trung tâm Chỉ huy. Cán bộ trực ban sẽ trao đổi với bạn tại đây.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [submittingSafe, setSubmittingSafe] = useState(false);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Sync prop changes
  useEffect(() => {
    if (incident) setCurrentIncident(incident);
  }, [incident]);

  // Connect SSE for Realtime Updates
  useEffect(() => {
    if (!currentIncident?.id) return undefined;
    const tokenQuery = citizenAccessToken ? `?access_token=${encodeURIComponent(citizenAccessToken)}` : '';
    let eventSource;
    try {
      eventSource = new EventSource(`/api/sos/stream/${encodeURIComponent(currentIncident.id)}${tokenQuery}`);
      eventSource.addEventListener('sos_update', (e) => {
        try {
          const updated = JSON.parse(e.data);
          setCurrentIncident((prev) => ({ ...prev, ...updated }));
        } catch {}
      });
      eventSource.addEventListener('new_message', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data?.message) {
            setMessages((prev) => [...prev, data.message]);
          }
        } catch {}
      });
    } catch {}

    return () => {
      eventSource?.close();
    };
  }, [currentIncident?.id, citizenAccessToken]);

  // MapLibre Interactive Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const maplibregl = window.maplibregl;
    if (!maplibregl) return;

    const lat = Number(currentIncident.lat || currentIncident.latitude || DEFAULT_COORDS.lat);
    const lng = Number(currentIncident.lng || currentIncident.longitude || DEFAULT_COORDS.lng);

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
          sources: {
            'google-tiles': {
              type: 'raster',
              tiles: [
                'https://mt0.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
                'https://mt1.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
                'https://mt2.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
                'https://mt3.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
              ],
              tileSize: 256,
              attribution: 'Bản Đồ Nền Quốc Gia 2026',
            },
          },
          layers: [
            {
              id: 'google-tiles-layer',
              type: 'raster',
              source: 'google-tiles',
              minzoom: 0,
              maxzoom: 20,
            },
          ],
        },
        center: [lng, lat],
        zoom: 14,
      });

      mapInstanceRef.current = map;

      // Add citizen marker
      const elCitizen = document.createElement('div');
      elCitizen.style.width = '24px';
      elCitizen.style.height = '24px';
      elCitizen.style.borderRadius = '50%';
      elCitizen.style.backgroundColor = '#ef4444';
      elCitizen.style.border = '3px solid #ffffff';
      elCitizen.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.9)';
      new maplibregl.Marker({ element: elCitizen }).setLngLat([lng, lat]).addTo(map);

      // Add unit marker if assigned
      const assigned = currentIncident.dispatchUnit || currentIncident.assignedUnit;
      if (assigned?.lat && assigned?.lng) {
        const elStation = document.createElement('div');
        elStation.style.width = '24px';
        elStation.style.height = '24px';
        elStation.style.borderRadius = '50%';
        elStation.style.backgroundColor = '#0088ff';
        elStation.style.border = '3px solid #ffffff';
        elStation.style.boxShadow = '0 0 15px rgba(0, 136, 255, 0.9)';
        new maplibregl.Marker({ element: elStation }).setLngLat([assigned.lng, assigned.lat]).addTo(map);

        // Fetch OSRM route line
        fetch(`https://router.project-osrm.org/route/v1/driving/${assigned.lng},${assigned.lat};${lng},${lat}?overview=full&geometries=geojson`)
          .then((res) => res.json())
          .then((routeData) => {
            if (routeData?.routes?.[0]?.geometry && map.getSource) {
              map.on('load', () => {
                if (map.getSource('rescue-route')) return;
                map.addSource('rescue-route', {
                  type: 'geojson',
                  data: {
                    type: 'Feature',
                    geometry: routeData.routes[0].geometry,
                  },
                });
                map.addLayer({
                  id: 'rescue-route-line',
                  type: 'line',
                  source: 'rescue-route',
                  layout: { 'line-join': 'round', 'line-cap': 'round' },
                  paint: {
                    'line-color': '#0ea5e9',
                    'line-width': 5,
                    'line-opacity': 0.85,
                  },
                });
              });
            }
          })
          .catch(() => {});
      }
    } catch {}

    return () => {
      mapInstanceRef.current?.remove();
    };
  }, [currentIncident]);

  // Stepper calculations
  const stepIndex = currentIncident.stepIndex || (currentIncident.status === 'resolved' ? 5 : 2);
  const isResolved = currentIncident.status === 'resolved';
  const progressPercent = isResolved ? 100 : stepIndex === 4 ? 80 : stepIndex === 3 ? 55 : 25;

  const assignedUnit = currentIncident.dispatchUnit || currentIncident.assignedUnit || {};
  const unitPhone = assignedUnit.phone || '113';
  const unitAddress = assignedUnit.address || currentIncident.address || 'Đang cập nhật...';
  const officerName = currentIncident.officerName || assignedUnit.officerName || 'Đang kết nối...';
  const unitName = assignedUnit.unitName || assignedUnit.name || 'Công an Phường / Xã tiếp nhận';

  const handleSendChat = async (e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || isResolved) return;
    setChatInput('');
    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: 'citizen',
      senderName: currentIncident.reporterName || 'Tôi',
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
    try {
      await sendChatMessage({
        incidentId: currentIncident.id,
        text,
        senderName: currentIncident.reporterName || 'Người dân',
        citizenAccessToken,
      });
    } catch {}
  };

  const handleConfirmSafe = async () => {
    if (!window.confirm('Bạn xác nhận đã AN TOÀN và muốn kết thúc ca cứu hộ này?\n\nTrực ban sẽ nhận được thông báo ngay lập tức.')) {
      return;
    }
    setSubmittingSafe(true);
    try {
      await notifyCitizenSafe({ incidentId: currentIncident.id, citizenAccessToken });
      alert('✅ Đã ghi nhận bạn an toàn. Ca cứu hộ đã kết thúc.');
      onEndIncident?.();
    } catch (err) {
      alert(`Lỗi: ${err.message || 'Không thể gửi xác nhận'}`);
    } finally {
      setSubmittingSafe(false);
    }
  };

  const lat = currentIncident.lat || currentIncident.latitude || DEFAULT_COORDS.lat;
  const lng = currentIncident.lng || currentIncident.longitude || DEFAULT_COORDS.lng;
  const originParam = assignedUnit?.lat && assignedUnit?.lng ? `&origin=${assignedUnit.lat},${assignedUnit.lng}` : '';
  const gmapsCarUrl = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${lat},${lng}&travelmode=driving`;
  const gmapsMotoUrl = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${lat},${lng}&travelmode=two-wheeler`;

  return (
    <div className={styles.trackingWrapper}>
      <div className={styles.trackingCard}>
        {/* Header with ID and Status */}
        <div className={styles.trackingHeader}>
          <div>
            <div className={styles.trackingIdLabel}>MÃ SỐ TIẾP NHẬN</div>
            <div className={styles.trackingIdValue}>#{currentIncident.id || 'SOS-XXXX'}</div>
          </div>
          <div
            className={`${styles.trackingBadgeStatus} ${
              isResolved ? styles.resolved : stepIndex >= 3 ? styles.enRoute : styles.dispatching
            }`}
          >
            {isResolved
              ? '✅ Ca cứu hộ đã hoàn tất'
              : stepIndex >= 3
                ? '🚒 Đang điều động xe tiếp cận'
                : '⏳ Đang kết nối Trực ban Xã/Phường'}
          </div>
        </div>

        {/* 5-Step Visual Stepper */}
        <div className={styles.stepperTimeline}>
          <div className={styles.stepperProgressFill} style={{ width: `${progressPercent}%` }} />
          <div className={`${styles.stepNode} ${styles.completed}`}>
            <div className={styles.stepCircle}>1</div>
            <div className={styles.stepText}>Đã phát SOS</div>
          </div>
          <div className={`${styles.stepNode} ${stepIndex >= 2 ? styles.completed : styles.active}`}>
            <div className={styles.stepCircle}>2</div>
            <div className={styles.stepText}>Đã tiếp nhận</div>
          </div>
          <div
            className={`${styles.stepNode} ${
              stepIndex > 3 ? styles.completed : stepIndex === 3 ? styles.active : ''
            }`}
          >
            <div className={styles.stepCircle}>3</div>
            <div className={styles.stepText}>Điều động xe</div>
          </div>
          <div
            className={`${styles.stepNode} ${
              stepIndex > 4 ? styles.completed : stepIndex === 4 ? styles.active : ''
            }`}
          >
            <div className={styles.stepCircle}>4</div>
            <div className={styles.stepText}>Đến hiện trường</div>
          </div>
          <div className={`${styles.stepNode} ${isResolved ? styles.completed : ''}`}>
            <div className={styles.stepCircle}>5</div>
            <div className={styles.stepText}>Hoàn tất</div>
          </div>
        </div>

        {/* Assigned Unit Card */}
        <div className={styles.unitCard}>
          <div className={styles.unitTopRow}>
            <div className={styles.unitInfo}>
              <div className={styles.unitAvatar}>🛡️</div>
              <div>
                <span className={styles.unitLevelBadge}>ĐƠN VỊ ĐỊA BÀN GẦN NHẤT</span>
                <div className={styles.unitName}>{unitName}</div>
                <div className={styles.unitSub}>Cán bộ tiếp nhận: {officerName}</div>
              </div>
            </div>
            <div className={styles.unitActionsRow}>
              <a href={`tel:${unitPhone}`} className={styles.btnCallUnit}>
                📞 Gọi Trực Ban
              </a>
              <button
                type="button"
                className={`${styles.btnCallUnit} ${styles.btnVideoUnit}`}
                onClick={onOpenVideoCall}
              >
                📹 Gọi Video Hiện Trường
              </button>
            </div>
          </div>

          <div className={styles.unitStationDetailsBox}>
            <div>
              📍 <b>Trụ sở cơ sở:</b> <span style={{ color: '#60a5fa' }}>{unitAddress}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '4px' }}>
              <div>
                📞 <b>SĐT:</b> <span style={{ color: '#34d399' }}>{unitPhone}</span>
              </div>
              <div>
                ✉️ <b>Email:</b> <span>{assignedUnit.email || 'trucban.sos@vn.gov'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Multi-Channel Notification Badges Bar */}
        <div className={styles.multiChannelGrid}>
          <div className={styles.multiChannelCard}>
            <div style={{ fontSize: '18px', marginBottom: '2px' }}>📱</div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#60a5fa' }}>SMS Khẩn Cấp</div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Đã gửi trực ban</div>
          </div>

          <button type="button" className={styles.multiChannelBtnCall} onClick={onOpenVoiceCall}>
            <div style={{ fontSize: '18px', marginBottom: '2px' }}>📞</div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#34d399' }}>Gọi Trực Ban Khẩn</div>
            <div style={{ fontSize: '10px', color: '#a7f3d0' }}>Video / Thoại 2 Chiều</div>
          </button>

          <div className={styles.multiChannelCard}>
            <div style={{ fontSize: '18px', marginBottom: '2px' }}>📨</div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#fbbf24' }}>Email Báo Cáo</div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Đã chuyển giao</div>
          </div>
        </div>

        {/* Map Header and Canvas Container */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>
            🗺️ Bản đồ Vị trí & Lộ trình Di chuyển
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <a
              href={gmapsCarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-refresh-loc"
              style={{ fontSize: '10.5px', padding: '4px 8px', color: '#60a5fa' }}
            >
              🚗 Ô tô ↗
            </a>
            <a
              href={gmapsMotoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-refresh-loc"
              style={{ fontSize: '10.5px', padding: '4px 8px', color: '#34d399' }}
            >
              🏍️ Xe máy ↗
            </a>
          </div>
        </div>

        <div className={styles.trackingMapContainer}>
          <div ref={mapContainerRef} className={styles.mapViewport} />
        </div>

        {/* Export Official Document Button */}
        {onViewReport && (
          <div style={{ marginBottom: '12px' }}>
            <button
              type="button"
              className="btn-refresh-loc"
              style={{
                width: '100%',
                justifyContent: 'center',
                background: 'rgba(56, 189, 248, 0.15)',
                borderColor: '#38bdf8',
                color: '#38bdf8',
                fontWeight: 700,
                fontSize: '12px',
                padding: '9px',
              }}
              onClick={onViewReport}
            >
              📄 XEM & TẢI PHIẾU TIẾP NHẬN SỰ CỐ (FILE WORD / PDF)
            </button>
          </div>
        )}

        {/* 2-Way Live Chat with Dispatcher */}
        <div className={styles.chatWrapper}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', marginBottom: '8px' }}>
            💬 Trao đổi trực tiếp với Trực ban điều phối
          </div>
          <div className={styles.chatMessagesBox}>
            {messages.map((m) => (
              <div key={m.id} className={`${styles.chatBubble} ${styles[m.sender] || styles.system}`}>
                {m.text}
              </div>
            ))}
          </div>
          <form className={styles.chatInputBar} onSubmit={handleSendChat}>
            <input
              type="text"
              className={styles.chatInput}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={isResolved ? 'Ca cứu hộ đã hoàn tất' : 'Nhắn tin cho trực ban...'}
              disabled={isResolved}
            />
            <button type="submit" className={styles.btnSendChat} disabled={isResolved || !chatInput.trim()}>
              Gửi
            </button>
          </form>

          {/* Safe confirmation button */}
          <button
            type="button"
            className={styles.btnCitizenSafe}
            onClick={handleConfirmSafe}
            disabled={submittingSafe}
          >
            🛡️ {submittingSafe ? 'Đang gửi xác nhận an toàn...' : 'TÔI ĐÃ AN TOÀN — KẾT THÚC CA CỨU HỘ'}
          </button>
        </div>
      </div>
    </div>
  );
}
