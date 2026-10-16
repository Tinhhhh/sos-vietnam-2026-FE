import { Client } from '@stomp/stompjs';

import { env } from '@/config/env';

/*
 * STOMP over a plain WebSocket to be-v2 (endpoint /ws-raw; dev: Vite proxies /ws*,
 * prod: nginx proxies /ws*). STOMP adds "destinations" on top of WebSocket:
 * the client SUBSCRIBEs to a destination and the server pushes MESSAGE frames to it.
 *
 * The JWT goes in the CONNECT frame (browsers cannot set headers on the WebSocket
 * handshake). stompjs reconnects by itself; beforeConnect re-reads the token so a
 * refreshed token is used on reconnect.
 */
const RECONNECT_DELAY_MS = 5000;

function socketUrl() {
  // VITE_API_URL may point at another host in some builds; default is same origin.
  const base = env.API_URL ? new URL(env.API_URL, window.location.href) : window.location;
  const protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${base.host}/ws-raw`;
}

/**
 * @param {{
 *   getToken?: () => string | null,        // officer: JWT sent as "Authorization: Bearer ..."
 *   getHeaders?: () => Record<string, string>, // citizen: X-SOS-Access-Token + X-SOS-Incident-Id

 *   onConnect: (client: Client) => void,
 *   onStatusChange?: (status: 'connecting' | 'live' | 'reconnecting') => void,
 * }} options
 * @returns {Client} call .deactivate() to close
 */
export function connectStomp({ getToken, getHeaders, onConnect, onStatusChange }) {
  const client = new Client({
    brokerURL: socketUrl(),
    reconnectDelay: RECONNECT_DELAY_MS,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    beforeConnect: (c) => {
      if (getHeaders) {
        c.connectHeaders = getHeaders() || {};
        return;
      }
      const token = getToken?.();
      c.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    },
    onConnect: () => {
      onStatusChange?.('live');
      onConnect(client);
    },
    onWebSocketClose: () => onStatusChange?.('reconnecting'),
    onStompError: () => onStatusChange?.('reconnecting'),
  });
  onStatusChange?.('connecting');
  client.activate();
  return client;
}
