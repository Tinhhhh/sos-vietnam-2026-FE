/**
 * Officer Dashboard Route — /officer/dashboard (placeholder)
 * Wrapped by ProtectedRoute in router.
 */
import { useAuth } from '@/features/auth';

const styles = {
  page: {
    minHeight: '100dvh',
    background: '#0a0f1e',
    color: '#f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', system-ui, sans-serif",
    gap: '1rem',
  },
  badge: {
    fontSize: '4rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
  },
  sub: {
    color: '#64748b',
    margin: 0,
    fontSize: '0.875rem',
  },
  logoutBtn: {
    marginTop: '1rem',
    padding: '0.625rem 1.5rem',
    borderRadius: '0.75rem',
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#fca5a5',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    fontWeight: 600,
  },
};

export function OfficerDashboardRoute() {
  const { user, logout } = useAuth();

  return (
    <div style={styles.page}>
      <span style={styles.badge}>🏛️</span>
      <h1 style={styles.title}>Chào mừng, {user?.full_name || user?.email || 'Cán bộ'}</h1>
      <p style={styles.sub}>Vai trò: {user?.role_name ?? '—'} · Dashboard đang được xây dựng</p>
      <button style={styles.logoutBtn} onClick={logout}>
        🚪 Đăng xuất
      </button>
    </div>
  );
}
