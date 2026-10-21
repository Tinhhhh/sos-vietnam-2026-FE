import { api } from '@/lib/api-client';

/*
 * be-v2 contracts (body bọc { http_status, time_stamp, message, data }, JSON snake_case):
 *   POST /api/v1/incidents               { emergency_type, incident_tags, description, citizen_name,
 *                                          phone, address, latitude, longitude, accuracy }
 *                                        -> 201, data: { incident: {...}, citizen_access_token }
 *   POST /api/v1/incidents/{id}/media    multipart "files", header X-SOS-Access-Token
 *                                        -> data: [{ type, url, original_name, content_type, size }]
 * Lưu ý: BE từ chối field lạ (400), nên payload phải đúng tên field ở trên.
 */

export function createIncident(payload) {
  return api.post('/api/v1/incidents', payload);
}

export function uploadIncidentMedia({ incidentId, citizenAccessToken, attachments }) {
  const form = new FormData();
  attachments.forEach((a) => form.append('files', a.blob, a.name));
  return api.post(`/api/v1/incidents/${encodeURIComponent(incidentId)}/media`, form, {
    headers: { 'X-SOS-Access-Token': citizenAccessToken },
    timeout: 120000, // a 20MB video on a slow mobile network
  });
}
