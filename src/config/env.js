export const env = {
  // Empty = same origin (requests go through the Vite dev proxy to the backend).
  API_URL: import.meta.env.VITE_API_URL ?? '',
};
