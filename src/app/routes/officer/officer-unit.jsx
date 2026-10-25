/**
 * /officer/unit — Settings → "Cán bộ & trực ban" of a unit account (officer list, duty officer).
 */
import '@/styles/officer-theme.css';

import { paths } from '@/config/paths';
import { useAuth } from '@/features/auth';
import { UnitSettingsPage } from '@/features/unit-settings';

import { ProtectedRoute } from './protected-route';

export function OfficerUnitRoute() {
  const { user } = useAuth();
  return (
    <ProtectedRoute allowedRoles={['OFFICER']}>
      <UnitSettingsPage backHref={paths.officer.dashboard.getHref()} me={user} />
    </ProtectedRoute>
  );
}
