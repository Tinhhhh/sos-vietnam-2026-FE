import axios from 'axios';

import { env } from '@/config/env';

/**
 * Single axios instance for the Spring Boot backend (sos-vietnam-be-v2).
 * Responses resolve to the JSON body; errors reject with an ApiError.
 * Auth headers / token refresh are added by the auth module later.
 */
export const api = axios.create({
  baseURL: env.API_URL,
  timeout: 15000,
  headers: { Accept: 'application/json' },
});

export class ApiError extends Error {
  constructor(message, { status, data } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    // be-v2 validation errors carry { data: { field: message } } and no message.
    const fieldErrors =
      data?.data && typeof data.data === 'object' ? Object.values(data.data).join('; ') : null;
    const unreachable = !error.response || status === 502 || status === 504;
    const message =
      data?.message ||
      fieldErrors ||
      (unreachable ? 'Không kết nối được máy chủ' : null) ||
      data?.error ||
      error.message;
    return Promise.reject(new ApiError(message, { status, data }));
  },
);
