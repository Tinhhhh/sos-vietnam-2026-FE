import { useEffect, useRef, useState } from 'react';

import styles from './call-split.module.css';

const STORAGE_KEY = 'callMapWidth';
const MIN_MAP = 260;
const MIN_CALL = 360;
const DEFAULT_MAP_RATIO = 0.34; // like the legacy layout: map about a third, on the right

function readWidth() {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/**
 * Map area during a video call: call pane on the left, the same map element on the right with
 * a drag handle between them (width remembered per browser). Without `callPane` the map fills
 * the area as before. The map element keeps its place in the tree (key "map"), so MapLibre is
 * not re-created when a call starts or ends; it resizes itself (ResizeObserver).
 *
 * @param {{ callPane?: React.ReactNode, mapOverlay?: React.ReactNode, children: React.ReactNode }} props
 */
export function CallSplit({ callPane, mapOverlay, children }) {
  const rootRef = useRef(null);
  const [mapWidth, setMapWidth] = useState(readWidth);
  const [dragging, setDragging] = useState(false);
  const inCall = !!callPane;

  // Default width once the container size is known
  useEffect(() => {
    if (!inCall || mapWidth != null || !rootRef.current) return;
    setMapWidth(Math.round(rootRef.current.clientWidth * DEFAULT_MAP_RATIO));
  }, [inCall, mapWidth]);

  const clamp = (w) => {
    const total = rootRef.current?.clientWidth || 0;
    return Math.round(Math.min(Math.max(w, MIN_MAP), Math.max(MIN_MAP, total - MIN_CALL)));
  };

  const startDrag = (e) => {
    e.preventDefault();
    const root = rootRef.current;
    if (!root) return;
    setDragging(true);
    const move = (ev) => {
      const right = root.getBoundingClientRect().right;
      setMapWidth(clamp(right - ev.clientX));
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setMapWidth((w) => {
        try {
          localStorage.setItem(STORAGE_KEY, String(w));
        } catch {
          // storage blocked: width only lasts this session
        }
        return w;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setMapWidth((w) => clamp((w || 0) + (e.key === 'ArrowLeft' ? 40 : -40)));
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.split} ${inCall ? styles.inCall : ''} ${dragging ? styles.dragging : ''}`}
    >
      {inCall && (
        <div key="call" className={styles.callSide}>
          {callPane}
        </div>
      )}
      {inCall && (
        <div
          key="handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Kéo để đổi độ rộng bản đồ"
          tabIndex={0}
          className={styles.handle}
          onPointerDown={startDrag}
          onKeyDown={onKey}
        />
      )}
      <div
        key="map"
        className={styles.mapSide}
        style={
          inCall && mapWidth
            ? { flex: `0 0 ${mapWidth}px`, minWidth: MIN_MAP, maxWidth: `calc(100% - ${MIN_CALL}px)` }
            : undefined
        }
      >
        {children}
        {inCall && mapOverlay}
      </div>
    </div>
  );
}
