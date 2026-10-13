import { api } from '@/lib/api-client';

export async function notifyCitizenSafe({ incidentId, citizenAccessToken }) {
  // Try Spring Boot contract first, fallback to node endpoint if needed
  try {
    return await api.post(
      `/api/incidents/${encodeURIComponent(incidentId)}/safe`,
      { incidentId, sender: 'citizen' },
      { headers: citizenAccessToken ? { 'X-SOS-Access-Token': citizenAccessToken } : {} },
    );
  } catch {
    return await api.post(
      '/api/sos/citizen-safe',
      { incidentId, accessToken: citizenAccessToken, sender: 'citizen' },
      { headers: citizenAccessToken ? { 'x-sos-access-token': citizenAccessToken } : {} },
    );
  }
}

export async function sendChatMessage({ incidentId, text, senderName, citizenAccessToken }) {
  try {
    return await api.post(
      `/api/incidents/${encodeURIComponent(incidentId)}/messages`,
      { incidentId, text, sender: 'citizen', senderName },
      { headers: citizenAccessToken ? { 'X-SOS-Access-Token': citizenAccessToken } : {} },
    );
  } catch {
    return await api.post(
      '/api/sos/message',
      { incidentId, text, sender: 'citizen', senderName },
      { headers: citizenAccessToken ? { 'x-sos-access-token': citizenAccessToken } : {} },
    );
  }
}
