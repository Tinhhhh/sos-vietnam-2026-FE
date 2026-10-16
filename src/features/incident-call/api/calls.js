/*
 * Video call signaling for officers, over the same be-v2 STOMP endpoint as the queue (/ws-raw, JWT
 * in CONNECT). be-v2 only relays between the citizen of the incident and the officer holding it.
 *
 *   SEND      /app/calls          { incident_id, call_id, action, sdp?, candidate?, quality?, reason? }
 *   SUBSCRIBE /user/queue/calls   same signal + { from: 'citizen' | 'officer', peer_name, unit_name }
 *
 * Actions and their order: see src/lib/webrtc/call-session.js.
 * Rejected by be-v2 (error frame / dropped): officer not holding the incident, incident closed.
 */
export const CALLS_DESTINATION = '/user/queue/calls';
export const CALL_SEND_DESTINATION = '/app/calls';
