import { useEffect, useState } from 'react';

import { getIncidentHistory } from '../api/incidents';

const POLL_MS = 60_000;
const storageKey = (who) => `historySeenAt:${who}`;

function readSeen(who) {
  try {
    const v = Number(localStorage.getItem(storageKey(who)));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeSeen(who, at) {
  try {
    localStorage.setItem(storageKey(who), String(at));
  } catch {
    /* private mode: the dot just resets on reload */
  }
}

/**
 * Red dot of the "Lịch sử" rail button: closed incidents (last 24h) newer than the last time this
 * officer opened the history. First visit on a device starts from now (no dot for old cases).
 * Re-counts every minute and whenever `closedSignal` changes (a case left the live queue).
 * @param {{ who: string | null, open: boolean, closedSignal: unknown }} args
 * @returns {number} unseen count
 */
export function useHistoryUnseen({ who, open, closedSignal }) {
  // closedAt (ms) of the cases closed in the last 24h, from the last count
  const [closed, setClosed] = useState([]);
  const [seen, setSeen] = useState(() => ({ who, at: who ? readSeen(who) : null }));
  const [prevOpen, setPrevOpen] = useState(open);

  // Another officer on this device, or opening / closing the window: move the mark (derived in render)
  if (seen.who !== who) setSeen({ who, at: who ? readSeen(who) : null });
  if (prevOpen !== open) {
    setPrevOpen(open);
    setSeen({ who, at: null }); // null = "now", fixed by the effect below
  }

  // Fix "now" (first visit on this device, or the window just opened / closed) and remember it
  useEffect(() => {
    if (!who || seen.at != null) return;
    const at = Date.now();
    writeSeen(who, at);
    setSeen({ who, at }); // eslint-disable-line react-hooks/set-state-in-effect -- clock read outside render
  }, [who, seen.at]);

  useEffect(() => {
    if (!who || open) return undefined;
    let cancelled = false;
    const count = () =>
      getIncidentHistory({ days: 1, pageNo: 0, pageSize: 50 })
        .then(({ items }) => {
          if (!cancelled) setClosed(items.map((i) => i.closedAt?.getTime() || 0));
        })
        .catch(() => {});
    // the BE closes the case a moment before the queue event arrives; give it a beat
    const first = setTimeout(count, 800);
    const timer = setInterval(count, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [who, open, closedSignal]);

  if (open || seen.at == null) return 0;
  return closed.filter((t) => t > seen.at).length;
}
