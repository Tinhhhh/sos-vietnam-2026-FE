/**
 * /officer/accounts/new — ADMIN creates officer / admin accounts (opened from the gear menu).
 */
import '@/styles/officer-theme.css';

import { paths } from '@/config/paths';
import { CreateAccountPage } from '@/features/account-admin';

import { ProtectedRoute } from './protected-route';

export function OfficerAccountsNewRoute() {
  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <CreateAccountPage backHref={paths.officer.dashboard.getHref()} />
    </ProtectedRoute>
  );
}
