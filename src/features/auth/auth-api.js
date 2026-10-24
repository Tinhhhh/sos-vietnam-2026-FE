/**
 * Auth API — gọi Spring Boot /api/v1/auth/*.
 *
 * be-v2 bọc mọi response thành { http_status, time_stamp, message, data }.
 * api-client đã trả về body, nên ở đây chỉ cần lấy `.data`.
 *
 *   POST /api/v1/auth/login          { email, password }
 *        -> ADMIN: data { access_token, refresh_token }  (thông tin tài khoản lấy qua /me)
 *        -> tài khoản đơn vị: data { unit_token }  (token tạm 5', chỉ dùng cho 3 API /auth/unit/* dưới)
 *   GET  /api/v1/auth/unit/members   header Bearer <unit_token>
 *        -> data: [{ member_id, full_name, badge_number, rank, rank_label, position, unit_role, activated, locked }]
 *   POST /api/v1/auth/unit/pin       { member_id, pin }  -> data { access_token, refresh_token } của cán bộ
 *        (sai PIN 401, khoá sau 5 lần 423)
 *   POST /api/v1/auth/unit/activate  { member_id, activation_code, pin } -> như /pin (đặt PIN lần đầu / sau khi cấp lại)
 *   POST /api/v1/auth/pin            { old_pin, new_pin } (cán bộ đang đăng nhập)
 *   GET  /api/v1/auth/me             -> data: { account_id, full_name, email, role_name, agency_type, province, ... }
 *   POST /api/v1/auth/refresh-token  header Authorization: Bearer <refresh_token> -> data: { access_token, refresh_token }
 *   POST /api/v1/auth/logout         header Authorization: Bearer <access_token>
 */
import { api } from '@/lib/api-client';

/** @returns {Promise<{ access_token: string, refresh_token: string }>} */
export async function loginApi({ email, password }) {
  const body = await api.post('/api/v1/auth/login', { email, password });
  return body.data;
}

function unitHeader(unitToken) {
  return { headers: { Authorization: `Bearer ${unitToken}` } };
}

export async function getUnitMembersApi(unitToken) {
  const body = await api.get('/api/v1/auth/unit/members', unitHeader(unitToken));
  return body.data || [];
}

/** @returns {Promise<{ access_token: string, refresh_token: string }>} */
export async function pinLoginApi(unitToken, { memberId, pin }) {
  const body = await api.post('/api/v1/auth/unit/pin', { member_id: memberId, pin }, unitHeader(unitToken));
  return body.data;
}

/** @returns {Promise<{ access_token: string, refresh_token: string }>} */
export async function activateMemberApi(unitToken, { memberId, activationCode, pin }) {
  const body = await api.post(
    '/api/v1/auth/unit/activate',
    { member_id: memberId, activation_code: activationCode, pin },
    unitHeader(unitToken),
  );
  return body.data;
}

export async function changePinApi({ oldPin, newPin }) {
  await api.post('/api/v1/auth/pin', { old_pin: oldPin, new_pin: newPin });
}

/** @returns {Promise<{ account_id: string, email: string, full_name: string, role_name: string }>} */
export async function getMeApi() {
  const body = await api.get('/api/v1/auth/me');
  return body.data;
}

/** POST /api/v1/auth/change-password { current_password, new_password } (đang đăng nhập) -> chỉ message. */
export async function changePasswordApi({ currentPassword, newPassword }) {
  await api.post('/api/v1/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export async function logoutApi() {
  await api.post('/api/v1/auth/logout');
}

/** Refresh token được gửi qua header Authorization (không phải access token). */
export async function refreshTokenApi(refreshToken) {
  const body = await api.post('/api/v1/auth/refresh-token', null, {
    headers: { Authorization: `Bearer ${refreshToken}` },
  });
  return body.data;
}
