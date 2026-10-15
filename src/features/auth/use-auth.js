/**
 * useAuth — React hook for auth state.
 * Must be used inside <AuthProvider>.
 */
import { useContext } from 'react';
import { AuthContext } from './auth-context';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
