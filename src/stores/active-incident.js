/**
 * The citizen's open SOS cases on this device (a phone may have up to 2 open at once, docs/spec-multi-case.md).
 * localStorage: closing the tab / browser and opening the site again goes back to the call screen; each tab shows
 * one case through its URL (/sos/{id}). The tracking screen removes a case once it is closed.
 * Shared by the request form / "Tra cứu" (write) and the home route (read).
 * The token key matches legacy app.js; the old single-case key is migrated on first read.
 */
const LIST_KEY = 'sos_open_incidents';
const LEGACY_KEY = 'active_sos_incident';
const tokenKey = (incidentId) => `sos_citizen_access_token_${incidentId}`;
const MAX_KEPT = 5; // the BE allows 2 open per phone; a few more covers several phones on one device

function readList() {
  try {
    const list = JSON.parse(localStorage.getItem(LIST_KEY) || '[]');
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    if (legacy?.id) {
      localStorage.removeItem(LEGACY_KEY);
      if (!list.some((e) => e.incident?.id === legacy.id))
        list.unshift({ incident: legacy, savedAt: Date.now() });
      writeList(list);
    }
    return Array.isArray(list) ? list.filter((e) => e?.incident?.id) : [];
  } catch {
    return [];
  }
}

function writeList(list) {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0, MAX_KEPT)));
  } catch {
    // storage blocked (private mode): tracking just won't survive a reload
  }
}

/** Adds / refreshes a case (newest first) and its citizen access token. */
export function saveActiveIncident(incident, citizenAccessToken) {
  const list = readList().filter((e) => e.incident.id !== incident.id);
  writeList([{ incident, savedAt: Date.now() }, ...list]);
  try {
    if (citizenAccessToken) localStorage.setItem(tokenKey(incident.id), citizenAccessToken);
  } catch {
    // ignore
  }
}

/** @returns {Array<{ incident: object, citizenAccessToken: string }>} newest first, only cases with a token */
export function loadOpenIncidents() {
  return readList()
    .map((e) => {
      let citizenAccessToken = '';
      try {
        citizenAccessToken = localStorage.getItem(tokenKey(e.incident.id)) || '';
      } catch {
        // ignore
      }
      return { incident: e.incident, citizenAccessToken };
    })
    .filter((e) => e.citizenAccessToken);
}

/** @returns {{ incident: object, citizenAccessToken: string } | null} */
export function loadIncidentById(incidentId) {
  return loadOpenIncidents().find((e) => e.incident.id === incidentId) || null;
}

/** Most recent open case (kept for callers that only need one). */
export function loadActiveIncident() {
  return loadOpenIncidents()[0] || null;
}

/** The case is closed / cancelled: forget it and its token on this device. */
export function clearActiveIncident(incidentId) {
  const id = incidentId ?? readList()[0]?.incident.id;
  if (!id) return;
  writeList(readList().filter((e) => e.incident.id !== id));
  try {
    localStorage.removeItem(tokenKey(id));
  } catch {
    // ignore
  }
}
