import { useEffect, useReducer, useRef } from 'react';

/**
 * <video> showing a MediaStream (React cannot set `srcObject` as an attribute, so a ref does it).
 * `muted` must be true for our own camera, otherwise we hear ourselves.
 * When the stream has no live video track, `fallback` is shown instead (audio still plays).
 * Give it a positioned className (absolute / relative): the fallback and children are laid over it.
 *
 * @param {{ stream: MediaStream | null, muted?: boolean, mirrored?: boolean, fit?: 'cover' | 'contain',
 *           volume?: number, fallback?: React.ReactNode, className?: string, style?: object,
 *           children?: React.ReactNode }} props   children: overlays drawn on top (labels...)
 */
export function VideoTile({
  stream,
  muted = false,
  mirrored = false,
  fit = 'cover',
  volume = 1,
  fallback,
  className,
  style,
  children,
}) {
  const ref = useRef(null);
  // Re-render when a track appears / is paused by the other side (track 'mute' when they turn the camera off)
  const [, refresh] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!stream) return undefined;
    const watched = new Set();
    const watch = (track) => {
      if (watched.has(track)) return;
      watched.add(track);
      ['mute', 'unmute', 'ended'].forEach((ev) => track.addEventListener(ev, refresh));
    };
    const onAdd = (e) => {
      watch(e.track);
      refresh();
    };
    stream.getTracks().forEach(watch);
    stream.addEventListener('addtrack', onAdd);
    return () => {
      stream.removeEventListener('addtrack', onAdd);
      watched.forEach((t) => ['mute', 'unmute', 'ended'].forEach((ev) => t.removeEventListener(ev, refresh)));
    };
  }, [stream]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (video.srcObject !== stream) video.srcObject = stream || null;
    if (stream) video.play().catch(() => {}); // autoplay may need a tap first; the call buttons provide it
  }, [stream]);

  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume]);

  const hasVideo = !!stream?.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled && !t.muted);

  return (
    <div className={className} style={{ overflow: 'hidden', ...style }}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        style={{
          width: '100%',
          height: '100%',
          objectFit: fit,
          transform: mirrored ? 'scaleX(-1)' : undefined,
          visibility: hasVideo ? 'visible' : 'hidden',
          background: '#000',
        }}
      />
      {!hasVideo && fallback && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          {fallback}
        </div>
      )}
      {children}
    </div>
  );
}
