/**
 * /officer/statistics — full-screen statistics dashboard, opened from the "Thống kê"
 * shortcut on the command map. Scope (ward / province / national) comes from the account.
 */
import '@/styles/officer-theme.css';

import { useMemo } from 'react';

import { paths } from '@/config/paths';
import { buildOfficerProfile, useAuth } from '@/features/auth';
import { StatisticsPage } from '@/features/statistics';

export function OfficerStatisticsRoute() {
  const { user } = useAuth();
  const officer = useMemo(() => buildOfficerProfile(user), [user]);
  return <StatisticsPage officer={officer} backHref={paths.officer.dashboard.getHref()} />;
}
