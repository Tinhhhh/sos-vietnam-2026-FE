/**
 * The citizen's current SOS (survives reloads within the tab, like legacy).
 * Shared by the request form (writes it) and incident tracking (reads it).
 * Keys match legacy app.js so both apps read the same session data.
 */
const INCIDENT_KEY = 'active_sos_incident';
const tokenKey = (incidentId) => `sos_citizen_access_token_${incidentId}`;

export function saveActiveIncident(incident, citizenAccessToken) {
  try {
    sessionStorage.setItem(INCIDENT_KEY, JSON.stringify(incident));
    if (citizenAccessToken) sessionStorage.setItem(tokenKey(incident.id), citizenAccessToken);
  } catch {
    // storage blocked (private mode): tracking just won't survive a reload
  }
}

/** @returns {{ incident: object, citizenAccessToken: string } | null} */
export function loadActiveIncident() {
  try {
    const incident = JSON.parse(sessionStorage.getItem(INCIDENT_KEY) || 'null');
    if (!incident?.id) return null;
    return { incident, citizenAccessToken: sessionStorage.getItem(tokenKey(incident.id)) || '' };
  } catch {
    return null;
  }
}

export function clearActiveIncident() {
  try {
    const current = loadActiveIncident();
    if (current) sessionStorage.removeItem(tokenKey(current.incident.id));
    sessionStorage.removeItem(INCIDENT_KEY);
  } catch {
    // ignore
  }
}
