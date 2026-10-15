/**
 * Officer Login Route — /officer/login
 * Redirects to dashboard if already authenticated.
 */
import { Navigate } from 'react-router';
import { useAuth, OfficerLoginForm } from '@/features/auth';
import { paths } from '@/config/paths';

export function OfficerLoginRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null;

  // Already logged in → go to dashboard
  if (isAuthenticated) {
    return <Navigate to={paths.officer.dashboard.getHref()} replace />;
  }

  return <OfficerLoginForm />;
}
