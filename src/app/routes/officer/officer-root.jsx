/**
 * OfficerRoot — layout wrapper cho toàn bộ officer portal.
 * Bao gồm ProtectedRoute guard và AuthProvider đã có sẵn từ provider.
 */
import { Outlet } from 'react-router';
import { ProtectedRoute } from './protected-route';

export function OfficerRoot() {
  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'OFFICER']}>
      <Outlet />
    </ProtectedRoute>
  );
}
