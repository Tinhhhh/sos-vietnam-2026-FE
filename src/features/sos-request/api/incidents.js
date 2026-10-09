import { api } from '@/lib/api-client';

/*
 * be-v2 contracts:
 *   POST /api/incidents                  -> { ok, message, incident, citizenAccessToken }
 *   POST /api/incidents/{id}/media       multipart "files", header X-SOS-Access-Token
 *                                        -> { ok, message, media: [{ type, url, ... }] }
 */

export function createIncident(payload) {
  return api.post('/api/incidents', payload);
}

export function uploadIncidentMedia({ incidentId, citizenAccessToken, attachments }) {
  const form = new FormData();
  attachments.forEach((a) => form.append('files', a.blob, a.name));
  return api.post(`/api/incidents/${encodeURIComponent(incidentId)}/media`, form, {
    headers: { 'X-SOS-Access-Token': citizenAccessToken },
    timeout: 120000, // a 15MB video on a slow mobile network
  });
}
