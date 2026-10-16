/**
 * ProtectedRoute — chưa đăng nhập thì về trang login; sai quyền thì báo không có quyền.
 */
import { Navigate } from 'react-router';
import { useAuth } from '@/features/auth';
import { paths } from '@/config/paths';

import styles from '../status-screen.module.css';

/**
 * @param {{ children: React.ReactNode, allowedRoles?: string[] }} props
 */
export function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, user, logout } = useAuth();

  if (loading) {
    // Waiting for token hydration — show nothing (or a spinner)
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#0a0f1e' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.15)',
            borderTopColor: '#3b82f6',
            animation: 'spin 0.7s linear infinite',
          }}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={paths.officer.login.getHref()} replace />;
  }

  // Optional role check (role_name từ GET /api/v1/auth/me, vd: ADMIN, OFFICER, CITIZEN).
  // Không redirect về /officer/login: trang login thấy đã đăng nhập sẽ đẩy lại dashboard -> lặp vô hạn.
  if (allowedRoles && !allowedRoles.includes(user?.role_name)) {
    return <ForbiddenScreen roleName={user?.role_name} onLogout={logout} />;
  }

  return children;
}

/** Đã đăng nhập nhưng tài khoản không thuộc nhóm được phép (vd: CITIZEN vào cổng cán bộ). */
function ForbiddenScreen({ roleName, onLogout }) {
  return (
    <div className={styles.screen}>
      <div className={`${styles.card} liquid-glass`}>
        <div className={styles.eyebrow}>403</div>
        <h1 className={styles.title}>Tài khoản không có quyền vào cổng cán bộ</h1>
        <p>Vai trò hiện tại: {roleName || 'không xác định'}</p>
        <button type="button" className="btn-refresh-loc" onClick={onLogout}>
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
