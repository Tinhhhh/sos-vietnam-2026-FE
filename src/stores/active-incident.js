/**
 * The citizen's current SOS. localStorage: closing the tab / browser and opening the site again goes
 * straight back to the call screen of that SOS (the tracking screen clears it once the case is closed).
 * Shared by the request form (writes it) and incident tracking (reads it).
 * Keys match legacy app.js so both apps read the same session data.
 */
const INCIDENT_KEY = 'active_sos_incident';
const tokenKey = (incidentId) => `sos_citizen_access_token_${incidentId}`;

export function saveActiveIncident(incident, citizenAccessToken) {
  try {
    localStorage.setItem(INCIDENT_KEY, JSON.stringify(incident));
    if (citizenAccessToken) localStorage.setItem(tokenKey(incident.id), citizenAccessToken);
  } catch {
    // storage blocked (private mode): tracking just won't survive a reload
  }
}

/** @returns {{ incident: object, citizenAccessToken: string } | null} */
export function loadActiveIncident() {
  try {
    const incident = JSON.parse(localStorage.getItem(INCIDENT_KEY) || 'null');
    if (!incident?.id) return null;
    return { incident, citizenAccessToken: localStorage.getItem(tokenKey(incident.id)) || '' };
  } catch {
    return null;
  }
}

export function clearActiveIncident() {
  try {
    const current = loadActiveIncident();
    if (current) localStorage.removeItem(tokenKey(current.incident.id));
    localStorage.removeItem(INCIDENT_KEY);
  } catch {
    // ignore
  }
}
