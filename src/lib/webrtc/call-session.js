/*
 * One WebRTC video call between the citizen and the officer holding the incident.
 * The class does not know about STOMP: it calls `send(signal)` and the owner feeds incoming
 * signals to `handleSignal(signal)`. be-v2 only relays them (it never stores SDP / ICE).
 *
 * Signals (always with call_id):
 *   ring     caller -> callee   "phone is ringing"
 *   accept   callee -> caller   callee has camera/mic ready; caller now sends the offer
 *   reject   either way         declined / busy
 *   offer    caller -> callee   SDP describing the caller's media (also used for ICE restart)
 *   answer   callee -> caller   SDP answer
 *   ice      either way         one network candidate (address the peer may reach us on)
 *   quality  officer -> citizen { quality: 'detail' | 'smooth' } favour sharpness or smoothness
 *   end      either way         hang up
 *
 * States: ringing (caller waits) | incoming (callee rings) | connecting | live | reconnecting | ended
 */

/** Video limits. The browser lowers them by itself when the network is weak (keeps audio first). */
export const VIDEO_PROFILES = {
  // Citizen filming the scene: up to 720p30 when the network allows
  scene: { width: 1280, height: 720, frameRate: 30, maxBitrate: 1_500_000 },
  // Officer webcam: small picture-in-picture, keep it cheap for the citizen's 4G download
  officer: { width: 426, height: 240, frameRate: 15, maxBitrate: 150_000 },
};

const RING_TIMEOUT_MS = 45_000;
const RECONNECT_GRACE_MS = 4_000; // 'disconnected' often heals by itself (4G cell handover)
const MAX_ICE_RESTARTS = 3;

export class CallSession {
  /**
   * @param {{
   *   callId: string, role: 'caller' | 'callee',
   *   send: (signal: object) => void,
   *   getIceServers: () => Promise<RTCIceServer[]>,
   *   videoProfile: { width, height, frameRate, maxBitrate },
   *   facingMode?: 'user' | 'environment',
   *   onChange: (session: CallSession) => void,  // any state / stream / flag change
   * }} options
   */
  constructor({ callId, role, send, getIceServers, videoProfile, facingMode = 'user', onChange }) {
    this.callId = callId;
    this.role = role;
    this.state = role === 'caller' ? 'ringing' : 'incoming';
    this.endedReason = null; // 'hangup' | 'remote-hangup' | 'rejected' | 'no-answer' | 'network' | 'media'
    this.localStream = null;
    this.remoteStream = null;
    this.micOn = true;
    this.cameraOn = true;
    this.hasCamera = false;
    this.facingMode = facingMode;
    this.quality = 'smooth';
    this.connectedAt = null;

    this._send = send;
    this._getIceServers = getIceServers;
    this._profile = videoProfile;
    this._onChange = onChange;
    this._pc = null;
    this._pendingIce = [];
    this._ringTimer = null;
    this._graceTimer = null;
    this._iceRestarts = 0;
  }

  // ---------------------------------------------------------------- public actions

  /** Caller: open camera/mic (preview while ringing) and ring the other side. */
  async startOutgoing() {
    await this._openMedia();
    if (this.state === 'ended') return;
    this._signal('ring');
    this._ringTimer = setTimeout(() => {
      if (this.state === 'ringing') this._finish('no-answer', 'end');
    }, RING_TIMEOUT_MS);
    this._emit();
  }

  /** Callee: must run from a click (mobile browsers only allow camera + sound after a tap). */
  async accept() {
    if (this.state !== 'incoming') return;
    this._setState('connecting');
    await this._openMedia();
    if (this.state === 'ended') return;
    await this._createPeer();
    this._signal('accept');
  }

  reject() {
    if (this.state === 'incoming') this._finish('rejected', 'reject');
  }

  hangUp() {
    if (this.state !== 'ended') this._finish('hangup', 'end');
  }

  setMic(on) {
    this.micOn = on;
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = on));
    this._emit();
  }

  setCamera(on) {
    this.cameraOn = on;
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = on));
    this._emit();
  }

  /** Front <-> back camera without renegotiating (replaceTrack keeps the same connection). */
  async switchCamera() {
    if (!this.hasCamera) return;
    const facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    let track;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: this._videoConstraints(facingMode) });
      [track] = stream.getVideoTracks();
    } catch {
      return; // only one camera
    }
    const old = this.localStream.getVideoTracks()[0];
    track.enabled = this.cameraOn;
    await this._videoSender()?.replaceTrack(track);
    if (old) {
      this.localStream.removeTrack(old);
      old.stop();
    }
    this.localStream.addTrack(track);
    this.facingMode = facingMode;
    this._emit();
  }

  /** Officer asks the citizen's phone to keep resolution (read a plate) instead of frame rate. */
  requestQuality(quality) {
    this.quality = quality;
    this._signal('quality', { quality });
    this._emit();
  }

  /**
   * Feed a signal received from be-v2 (already filtered to this call_id by the owner).
   * Signals are applied one at a time: an ICE candidate must not overtake the offer it belongs to.
   */
  handleSignal(signal) {
    this._queue = (this._queue || Promise.resolve()).then(() => this._handle(signal)).catch(() => {});
    return this._queue;
  }

  async _handle(signal) {
    if (this.state === 'ended') return;
    switch (signal.action) {
      case 'accept':
        if (this.role !== 'caller' || this.state !== 'ringing') return;
        clearTimeout(this._ringTimer);
        this._setState('connecting');
        await this._createPeer();
        await this._sendOffer();
        break;
      case 'offer':
        if (!this._pc) await this._createPeer();
        await this._pc.setRemoteDescription(signal.sdp);
        await this._flushIce();
        await this._pc.setLocalDescription(await this._pc.createAnswer());
        this._signal('answer', { sdp: this._pc.localDescription.toJSON() });
        break;
      case 'answer':
        if (!this._pc || this._pc.signalingState !== 'have-local-offer') return;
        await this._pc.setRemoteDescription(signal.sdp);
        await this._flushIce();
        break;
      case 'ice':
        if (!signal.candidate) return;
        if (this._pc?.remoteDescription) await this._pc.addIceCandidate(signal.candidate).catch(() => {});
        else this._pendingIce.push(signal.candidate);
        break;
      case 'quality':
        this.quality = signal.quality === 'detail' ? 'detail' : 'smooth';
        await this._applySenderLimits();
        this._emit();
        break;
      case 'reject':
        // the server refuses at once when the other side is not connected (offline) / not part of the case
        this._finish(REFUSAL_REASONS.includes(signal.reason) ? signal.reason : 'rejected');
        break;
      case 'end':
        this._finish(signal.reason === 'network' ? 'network' : 'remote-hangup');
        break;
      default:
    }
  }

  // ---------------------------------------------------------------- internals

  _videoConstraints(facingMode) {
    const p = this._profile;
    return {
      facingMode: { ideal: facingMode },
      width: { ideal: p.width },
      height: { ideal: p.height },
      frameRate: { ideal: p.frameRate, max: p.frameRate },
    };
  }

  /** Camera + mic; falls back to mic only, then to receive-only (still hears / sees the peer). */
  async _openMedia() {
    if (this.localStream) return;
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    const attempts = [{ audio, video: this._videoConstraints(this.facingMode) }, { audio }];
    for (const constraints of attempts) {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch {
        // permission denied / no device: try the next, smaller request
      }
    }
    if (this.state === 'ended') {
      this._stopMedia(); // hung up while the permission prompt was open
      return;
    }
    this.hasCamera = !!this.localStream?.getVideoTracks().length;
    if (!this.localStream) this.micOn = false;
    this._emit();
  }

  async _createPeer() {
    if (this._pc) return;
    const pc = new RTCPeerConnection({ iceServers: await this._getIceServers() });
    this._pc = pc;
    this.remoteStream = new MediaStream();

    const tracks = this.localStream?.getTracks() || [];
    tracks.forEach((t) => pc.addTrack(t, this.localStream));
    // Always ask to receive both kinds, even when we have nothing to send
    if (!tracks.some((t) => t.kind === 'audio')) pc.addTransceiver('audio', { direction: 'recvonly' });
    if (!tracks.some((t) => t.kind === 'video')) pc.addTransceiver('video', { direction: 'recvonly' });

    pc.ontrack = (e) => {
      if (!this.remoteStream.getTracks().includes(e.track)) this.remoteStream.addTrack(e.track);
      this._emit();
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) this._signal('ice', { candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => this._onConnectionState(pc.connectionState);
    await this._applySenderLimits();
  }

  async _sendOffer(iceRestart = false) {
    const offer = await this._pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
    await this._pc.setLocalDescription(offer);
    this._signal('offer', { sdp: this._pc.localDescription.toJSON() });
  }

  async _flushIce() {
    const pending = this._pendingIce;
    this._pendingIce = [];
    for (const c of pending) await this._pc.addIceCandidate(c).catch(() => {});
  }

  _onConnectionState(state) {
    if (this.state === 'ended') return;
    clearTimeout(this._graceTimer);
    if (state === 'connected') {
      this._iceRestarts = 0;
      if (!this.connectedAt) this.connectedAt = Date.now();
      this._setState('live');
      this._applySenderLimits();
    } else if (state === 'disconnected') {
      this._setState('reconnecting');
      this._graceTimer = setTimeout(() => this._restartIce(), RECONNECT_GRACE_MS);
    } else if (state === 'failed') {
      this._setState('reconnecting');
      this._restartIce();
    }
  }

  /** New network path (4G -> wifi, cell change). Only the caller re-offers, so both sides never collide. */
  async _restartIce() {
    if (this.state === 'ended' || this._pc?.connectionState === 'connected') return;
    if (this._iceRestarts >= MAX_ICE_RESTARTS) {
      this._finish('network', 'end');
      return;
    }
    this._iceRestarts += 1;
    if (this.role === 'caller') {
      try {
        await this._sendOffer(true);
      } catch {
        this._finish('network', 'end');
      }
    }
    // Callee: give the caller's restart time, then count another attempt
    this._graceTimer = setTimeout(() => this._restartIce(), 10_000);
  }

  _videoSender() {
    return this._pc?.getSenders().find((s) => s.track?.kind === 'video') || null;
  }

  /**
   * Bitrate / frame-rate caps on what we send. 'smooth' lets the browser drop resolution first
   * (fluid motion), 'detail' keeps resolution and drops frames (read a plate, a wound).
   */
  async _applySenderLimits() {
    if (!this._pc) return;
    for (const sender of this._pc.getSenders()) {
      if (!sender.track) continue;
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      if (sender.track.kind === 'audio') {
        params.encodings[0].priority = 'high';
        params.encodings[0].networkPriority = 'high';
      } else {
        params.encodings[0].maxBitrate = this._profile.maxBitrate;
        params.encodings[0].maxFramerate = this._profile.frameRate;
        params.degradationPreference = this.quality === 'detail' ? 'maintain-resolution' : 'balanced';
      }
      try {
        await sender.setParameters(params);
      } catch {
        // some browsers reject a field (e.g. degradationPreference): keep their defaults
      }
    }
  }

  _signal(action, extra = {}) {
    this._send({ call_id: this.callId, action, ...extra });
  }

  /** @param {string} reason @param {'end' | 'reject'} [notify] tell the peer as well */
  _finish(reason, notify) {
    if (this.state === 'ended') return;
    if (notify) this._signal(notify, notify === 'end' ? { reason } : {});
    clearTimeout(this._ringTimer);
    clearTimeout(this._graceTimer);
    this._pc?.close();
    this._pc = null;
    this._stopMedia();
    this.endedReason = reason;
    this._setState('ended');
  }

  _stopMedia() {
    this.localStream?.getTracks().forEach((t) => t.stop());
  }

  _setState(state) {
    this.state = state;
    this._emit();
  }

  _emit() {
    this._onChange?.(this);
  }
}

export const END_REASON_TEXT = {
  hangup: 'Bạn đã kết thúc cuộc gọi',
  'remote-hangup': 'Bên kia đã kết thúc cuộc gọi',
  rejected: 'Cuộc gọi bị từ chối',
  busy: 'Máy bận (đang trong cuộc gọi khác)',
  offline: 'Người nhận đang không trực tuyến (chưa mở trang / link)',
  not_handler: 'Bạn không còn là một bên của ca này',
  no_handler: 'Ca chưa có cán bộ nhận',
  no_field: 'Chưa có người phụ trách hiện trường',
  no_delegate: 'Ca không còn cán bộ được uỷ quyền',
  closed: 'Ca đã kết thúc',
  'no-answer': 'Không có người nghe máy',
  network: 'Mất kết nối mạng',
  media: 'Không mở được camera / micro',
};

const REFUSAL_REASONS = ['busy', 'offline', 'not_handler', 'no_handler', 'no_field', 'no_delegate', 'closed'];

export function newCallId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
