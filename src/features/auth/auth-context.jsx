/**
 * AuthContext + AuthProvider
 *
 * Provides: { user, accessToken, loading, login, logout }
 * user = data của GET /api/v1/auth/me (snake_case: full_name, role_name, agency_type, ...).
 * Persists tokens to localStorage (ACCESS_KEY / REFRESH_KEY).
 * Injects Authorization header into all axios requests via api-client interceptor.
 * A 401 on a signed-in request (token revoked: password changed on another device, logged out...) tries
 * one refresh; if that fails too the session is cleared and the login page says why (SESSION_ENDED_KEY).
 */
import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api-client';
import { loginApi, logoutApi, getMeApi, refreshTokenApi } from './auth-api';

const ACCESS_KEY = 'sos_access_v2';
const REFRESH_KEY = 'sos_refresh_v2';
/** sessionStorage: message the login page shows once after the session was ended from elsewhere */
export const SESSION_ENDED_KEY = 'sos_session_ended';
const SESSION_ENDED_MSG =
  'Phiên đăng nhập đã kết thúc (đổi mật khẩu hoặc đăng xuất ở nơi khác). Vui lòng đăng nhập lại.';
const AUTH_PATHS = ['/api/v1/auth/login', '/api/v1/auth/refresh-token', '/api/v1/auth/logout'];

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(ACCESS_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem(ACCESS_KEY)); // hydrating
  const interceptorRef = useRef(null);
  const refreshingRef = useRef(null); // one refresh at a time; parallel 401s wait for it

  // --- Axios request interceptor: attach JWT ---
  useEffect(() => {
    // Remove previous interceptor before attaching new one
    if (interceptorRef.current !== null) {
      api.interceptors.request.eject(interceptorRef.current);
    }
    interceptorRef.current = api.interceptors.request.use((config) => {
      const token = localStorage.getItem(ACCESS_KEY);
      // Không ghi đè header đã set sẵn: refreshTokenApi tự gửi refresh token qua Authorization.
      // (Nếu ghi đè bằng access token thì BE trả 401 "not a refresh token" và user bị đá ra.)
      if (token && !config.headers?.Authorization) {
        config.headers = config.headers ?? {};
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    });
    return () => {
      if (interceptorRef.current !== null) {
        api.interceptors.request.eject(interceptorRef.current);
      }
    };
  }, []); // only once; localStorage is read dynamically per-request

  // --- Axios response interceptor: 401 -> refresh once and retry, else end the session ---
  useEffect(() => {
    const id = api.interceptors.response.use(undefined, async (err) => {
      const config = err?.config;
      const signedIn = !!localStorage.getItem(ACCESS_KEY);
      const isAuthCall = AUTH_PATHS.some((p) => config?.url?.includes(p));
      if (err?.status !== 401 || !config || !signedIn || isAuthCall || config._retried) throw err;
      const rt = localStorage.getItem(REFRESH_KEY);
      try {
        if (!rt) throw err;
        refreshingRef.current ??= refreshTokenApi(rt).finally(() => {
          refreshingRef.current = null;
        });
        const tokens = await refreshingRef.current;
        saveTokens(tokens.access_token, tokens.refresh_token ?? rt);
      } catch {
        try {
          sessionStorage.setItem(SESSION_ENDED_KEY, SESSION_ENDED_MSG);
        } catch {
          // storage blocked: the login page just won't say why
        }
        clearSession();
        throw err;
      }
      config._retried = true;
      config.headers = { ...config.headers, Authorization: `Bearer ${localStorage.getItem(ACCESS_KEY)}` };
      return api(config);
    });
    return () => api.interceptors.response.eject(id);
  }, []);

  // --- Hydrate user on first mount if token exists ---
  useEffect(() => {
    // loading đã khởi tạo = có token hay không, nên không cần set lại ở đây
    if (!localStorage.getItem(ACCESS_KEY)) return;
    getMeApi()
      .then(setUser)
      .catch(async () => {
        // Access token expired — try refresh
        const rt = localStorage.getItem(REFRESH_KEY);
        if (!rt) {
          clearSession();
          return;
        }
        try {
          const tokens = await refreshTokenApi(rt);
          saveTokens(tokens.access_token, tokens.refresh_token ?? rt);
          const me = await getMeApi();
          setUser(me);
        } catch {
          clearSession();
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function saveTokens(access, refresh) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    setAccessToken(access);
  }

  function clearSession() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setAccessToken(null);
    setUser(null);
  }

  const login = useCallback(async ({ email, password }) => {
    const tokens = await loginApi({ email, password });
    saveTokens(tokens.access_token, tokens.refresh_token);
    const me = await getMeApi();
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      /* ignore network errors */
    }
    clearSession();
  }, []);

  const value = {
    user,
    accessToken,
    loading,
    isAuthenticated: !!accessToken && !!user,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
