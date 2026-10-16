import { api } from '@/lib/api-client';

/*
 * ICE servers for WebRTC: STUN (find our public address) + TURN (relay when 4G NAT blocks a
 * direct path). be-v2 creates short-lived Cloudflare TURN credentials; the Cloudflare key stays
 * on the server.
 *
 *   GET /api/v1/calls/ice-servers
 *     officer: JWT (api-client adds it) | citizen: header X-SOS-Access-Token + ?incident_id=
 *     -> data: { ice_servers: [{ urls: string | string[], username?, credential? }], ttl_seconds }
 *
 * If the endpoint fails, calls still work on STUN only (fine on wifi, may fail on some 4G).
 */
const STUN_ONLY = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];

let cache = null; // { key, servers, expiresAt }

/**
 * @param {{ incidentId?: string, citizenAccessToken?: string }} [citizen] leave empty for officers
 * @returns {Promise<RTCIceServer[]>}
 */
export async function getIceServers({ incidentId, citizenAccessToken } = {}) {
  const key = citizenAccessToken ? `citizen:${incidentId}` : 'officer';
  if (cache && cache.key === key && cache.expiresAt > Date.now()) return cache.servers;
  try {
    const body = await api.get('/api/v1/calls/ice-servers', {
      params: citizenAccessToken ? { incident_id: incidentId } : undefined,
      headers: citizenAccessToken ? { 'X-SOS-Access-Token': citizenAccessToken } : undefined,
    });
    const servers = (body?.data?.ice_servers || []).filter((s) => s?.urls);
    if (!servers.length) return STUN_ONLY;
    // Refresh a bit before the TURN password expires
    const ttl = Math.max(60, Number(body.data.ttl_seconds) || 600);
    cache = { key, servers, expiresAt: Date.now() + (ttl - 30) * 1000 };
    return servers;
  } catch {
    return STUN_ONLY;
  }
}
