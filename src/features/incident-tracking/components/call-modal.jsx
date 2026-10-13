import { useEffect, useRef, useState } from 'react';
import styles from './call-modal.module.css';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

function createSyntheticStream({ video = true, audio = true } = {}) {
  const tracks = [];
  if (audio) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.001;
        osc.connect(gain);
        const dest = ctx.createMediaStreamDestination();
        gain.connect(dest);
        osc.start();
        const audioTrack = dest.stream.getAudioTracks()[0];
        if (audioTrack) tracks.push(audioTrack);
      }
    } catch {}
  }

  if (video) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx2d = canvas.getContext('2d');
      const draw = () => {
        if (!ctx2d) return;
        ctx2d.fillStyle = '#0f172a';
        ctx2d.fillRect(0, 0, canvas.width, canvas.height);
        ctx2d.fillStyle = '#ef4444';
        ctx2d.font = 'bold 22px sans-serif';
        ctx2d.fillText('CAMERA HIỆN TRƯỜNG SOS VIỆT NAM', 90, 160);
        ctx2d.fillStyle = '#38bdf8';
        ctx2d.font = '16px monospace';
        ctx2d.fillText(new Date().toLocaleTimeString('vi-VN'), 260, 205);
      };
      draw();
      const interval = setInterval(draw, 500);
      if (typeof canvas.captureStream === 'function') {
        const stream = canvas.captureStream(15);
        const vTrack = stream.getVideoTracks()[0];
        if (vTrack) {
          const origStop = vTrack.stop.bind(vTrack);
          vTrack.stop = () => {
            clearInterval(interval);
            origStop();
          };
          tracks.push(vTrack);
        }
      }
    } catch {}
  }

  return new MediaStream(tracks);
}

export function CallModal({
  incident,
  citizenAccessToken,
  callType, // 'video' | 'voice'
  incomingSignal,
  onClose,
}) {
  const [activeCallType, setActiveCallType] = useState(callType || incomingSignal?.callType || 'video');
  const [isIncoming, setIsIncoming] = useState(Boolean(incomingSignal && incomingSignal.action === 'request'));
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [duration, setDuration] = useState(0);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingIceRef = useRef([]);
  const ringtoneCtxRef = useRef(null);

  const incidentId = incident?.id || incomingSignal?.incidentId || 'SOS-01';

  // Ringtone handling
  const playRingtone = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      ringtoneCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
    } catch {}
  };

  const stopRingtone = () => {
    try {
      ringtoneCtxRef.current?.close();
      ringtoneCtxRef.current = null;
    } catch {}
  };

  // Signal sender helper
  const sendSignal = async (payload) => {
    try {
      await fetch('/api/sos/videocall/signal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(citizenAccessToken ? { 'X-SOS-Access-Token': citizenAccessToken } : {}),
        },
        body: JSON.stringify({
          id: incidentId,
          incidentId,
          sender: 'citizen',
          callType: activeCallType,
          accessToken: citizenAccessToken || '',
          ...payload,
        }),
      });
    } catch (e) {
      console.warn('Call signaling error:', e);
    }
  };

  // Start outgoing call or connect call
  const startCall = async (callT = activeCallType) => {
    setIsIncoming(false);
    stopRingtone();

    // 1. Get User Media
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: callT === 'video' ? { facingMode } : false,
        audio: true,
      });
    } catch {
      stream = createSyntheticStream({ video: callT === 'video', audio: true });
    }
    localStreamRef.current = stream;

    if (localVideoRef.current && callT === 'video') {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }

    // 2. Setup WebRTC PeerConnection
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) return;
      if (remoteVideoRef.current && callT === 'video') {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => {});
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(() => {});
      }
      setIsConnected(true);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ action: 'webrtc-ice', candidate: event.candidate.toJSON() });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setIsConnected(true);
      }
    };

    // If answering an incoming call that had buffered SDP offer
    if (incomingSignal?.sdp) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal({ action: 'webrtc-answer', sdp: answer });
        setIsConnected(true);
      } catch (err) {
        console.warn('Error answering offer:', err);
      }
    } else {
      // Outgoing call: request signal + create offer
      await sendSignal({ action: 'request', callType: callT });
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal({ action: 'webrtc-offer', sdp: offer });
      } catch (err) {
        console.warn('Error creating offer:', err);
      }
    }
  };

  // Handle incoming signals from SSE
  useEffect(() => {
    if (!incidentId) return undefined;

    const tokenQuery = citizenAccessToken ? `?access_token=${encodeURIComponent(citizenAccessToken)}` : '';
    const es = new EventSource(`/api/sos/stream/${encodeURIComponent(incidentId)}${tokenQuery}`);

    const onCallSignal = async (e) => {
      try {
        const signal = JSON.parse(e.data);
        if (!signal || signal.sender === 'citizen') return;

        const pc = pcRef.current;

        if (signal.action === 'accept') {
          setIsConnected(true);
          // If we had an offer created, ensure remote answer handling
          if (pc && pc.localDescription && !pc.remoteDescription) {
            // Re-send offer to ensure connection
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await sendSignal({ action: 'webrtc-offer', sdp: offer });
          }
        } else if (signal.action === 'reject') {
          alert('Cán bộ trực ban đang bận hoặc đã từ chối cuộc gọi.');
          handleEnd();
        } else if (signal.action === 'end') {
          handleEnd();
        } else if (signal.action === 'webrtc-offer' && pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            // Apply buffered candidates
            for (const cand of pendingIceRef.current) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            pendingIceRef.current = [];
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal({ action: 'webrtc-answer', sdp: answer });
            setIsConnected(true);
          } catch (err) {
            console.warn('Failed to answer incoming offer:', err);
          }
        } else if (signal.action === 'webrtc-answer' && pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            for (const cand of pendingIceRef.current) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            pendingIceRef.current = [];
            setIsConnected(true);
          } catch (err) {
            console.warn('Failed to set remote answer:', err);
          }
        } else if (signal.action === 'webrtc-ice' && signal.candidate) {
          if (pc && pc.remoteDescription) {
            pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
          } else {
            pendingIceRef.current.push(signal.candidate);
          }
        }
      } catch (err) {
        console.warn('SSE signal parse error:', err);
      }
    };

    es.addEventListener('videocall_signal', onCallSignal);
    es.addEventListener('voicecall_signal', onCallSignal);

    return () => {
      es.close();
    };
  }, [incidentId, citizenAccessToken]);

  // Initial call startup
  useEffect(() => {
    if (isIncoming) {
      playRingtone();
    } else {
      startCall(activeCallType);
    }

    return () => {
      stopRingtone();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
    };
  }, []);

  // Duration Timer
  useEffect(() => {
    if (!isConnected) return undefined;
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const handleEnd = () => {
    stopRingtone();
    sendSignal({ action: 'end' });
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    onClose?.();
  };

  const handleAcceptIncoming = () => {
    setIsIncoming(false);
    stopRingtone();
    sendSignal({ action: 'accept' });
    startCall(incomingSignal?.callType || activeCallType);
  };

  const handleRejectIncoming = () => {
    stopRingtone();
    sendSignal({ action: 'reject' });
    onClose?.();
  };

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const flipCamera = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextMode },
        audio: true,
      });
      const oldVTrack = localStreamRef.current?.getVideoTracks()[0];
      const newVTrack = nextStream.getVideoTracks()[0];
      if (oldVTrack && newVTrack) {
        oldVTrack.stop();
        localStreamRef.current.removeTrack(oldVTrack);
        localStreamRef.current.addTrack(newVTrack);
        const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
        sender?.replaceTrack(newVTrack);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    } catch {}
  };

  const formatTimer = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // Render Incoming Ringing Dialog
  if (isIncoming) {
    const isVid = (incomingSignal?.callType || activeCallType) === 'video';
    return (
      <div className={styles.callOverlay}>
        <div className={styles.incomingCard}>
          <div className={styles.incomingIcon}>{isVid ? '📹' : '📞'}</div>
          <div className={styles.incomingHeading}>
            {isVid ? 'Yêu cầu mở Camera Hiện Trường' : 'Cuộc gọi thoại khẩn cấp'}
          </div>
          <div className={styles.incomingCaller}>
            {incomingSignal?.officerName || 'Cán bộ trực ban tác chiến'}
          </div>
          <div className={styles.incomingUnit}>
            {incomingSignal?.unitName || 'Trung tâm chỉ huy điều phối cứu hộ'}
          </div>
          <div className={styles.incomingButtons}>
            <button type="button" className={styles.btnReject} onClick={handleRejectIncoming}>
              ✕ Từ chối
            </button>
            <button type="button" className={styles.btnAccept} onClick={handleAcceptIncoming}>
              ✓ {isVid ? 'Bật Camera & Kết Nối' : 'Nhận Cuộc Gọi'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Floating Voice Call HUD
  if (activeCallType === 'voice') {
    return (
      <>
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
        <div className={styles.voiceFloatingBar}>
          <div className={styles.voiceInfo}>
            <div className={styles.voiceAvatar}>🛡️</div>
            <div>
              <div className={styles.voiceTitle}>
                {incident?.assignedUnit?.officerName || 'Cán bộ trực ban tác chiến'}
              </div>
              <div className={styles.voiceSubtitle}>
                {isConnected ? (
                  <>
                    <span className={styles.voiceWaves}>
                      <span className={styles.voiceWaveBar} />
                      <span className={styles.voiceWaveBar} />
                      <span className={styles.voiceWaveBar} />
                      <span className={styles.voiceWaveBar} />
                    </span>
                    <span>Đang đàm thoại ({formatTimer(duration)})</span>
                  </>
                ) : (
                  <span>⏳ Đang kết nối trực ban...</span>
                )}
              </div>
            </div>
          </div>

          <div className={styles.voiceActions}>
            <button
              type="button"
              className={`${styles.btnControl} ${isMuted ? styles.activeMuted : ''}`}
              style={{ width: '42px', height: '42px', fontSize: '16px' }}
              onClick={toggleMute}
              title={isMuted ? 'Bật micro' : 'Tắt micro'}
            >
              {isMuted ? '🔇' : '🎙️'}
            </button>
            <button
              type="button"
              className={styles.btnEndCall}
              style={{ width: '42px', height: '42px', fontSize: '18px' }}
              onClick={handleEnd}
              title="Kết thúc đàm thoại"
            >
              📞
            </button>
          </div>
        </div>
      </>
    );
  }

  // Render Fullscreen Video Call Overlay
  return (
    <div className={styles.callOverlay}>
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
      <div className={styles.videoContainer}>
        {/* Remote Video Stream Viewport */}
        <video ref={remoteVideoRef} className={styles.remoteVideo} autoPlay playsInline />

        {/* Local Camera Pip */}
        <video ref={localVideoRef} className={styles.localPip} autoPlay playsInline muted />

        {/* HUD Top Bar */}
        <div className={styles.hudTop}>
          <div className={styles.badgeSosId}>
            <span>🛡️</span>
            <span>#{incidentId}</span>
          </div>
          <div className={styles.callTimer}>{formatTimer(duration)}</div>
        </div>

        {/* Status Pill */}
        <div className={styles.statusPill}>
          {isConnected ? (
            <>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }} />
              <span>LIVE HD — Đang truyền hình 2 chiều</span>
            </>
          ) : (
            <>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }} />
              <span>Đang kết nối camera tới Cán bộ trực ban...</span>
            </>
          )}
        </div>

        {/* Controls Bar */}
        <div className={styles.controlsBar}>
          <button
            type="button"
            className={`${styles.btnControl} ${isMuted ? styles.activeMuted : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Bật micro' : 'Tắt micro'}
          >
            {isMuted ? '🔇' : '🎙️'}
          </button>

          <button type="button" className={styles.btnEndCall} onClick={handleEnd} title="Kết thúc cuộc gọi">
            ✕
          </button>

          <button type="button" className={styles.btnControl} onClick={flipCamera} title="Đổi camera trước/sau">
            🔄
          </button>
        </div>
      </div>
    </div>
  );
}
