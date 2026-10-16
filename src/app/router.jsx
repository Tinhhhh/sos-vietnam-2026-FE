import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { paths } from '@/config/paths';

import { RouteErrorBoundary } from './routes/route-error-boundary';
import { RouteLoading } from './routes/route-loading';

// Each route is lazy-loaded so the citizen bundle never ships officer/dispatcher code.
const router = createBrowserRouter([
  // ── Citizen portal ───────────────────────────────────────────────
  {
    path: paths.citizen.home.path,
    lazy: async () => ({ Component: (await import('./routes/citizen/citizen-root')).CitizenRoot }),
    ErrorBoundary: RouteErrorBoundary,
    HydrateFallback: RouteLoading,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('./routes/citizen/home')).CitizenHomeRoute }),
      },
    ],
  },

  // ── Officer portal ───────────────────────────────────────────────
  {
    // Public: login page (no auth required)
    path: paths.officer.login.path,
    lazy: async () => ({
      Component: (await import('./routes/officer/officer-login')).OfficerLoginRoute,
    }),
    ErrorBoundary: RouteErrorBoundary,
    HydrateFallback: RouteLoading,
  },
  {
    // Protected: OfficerRoot guards via ProtectedRoute + Outlet
    path: '/officer',
    lazy: async () => ({ Component: (await import('./routes/officer/officer-root')).OfficerRoot }),
    ErrorBoundary: RouteErrorBoundary,
    HydrateFallback: RouteLoading,
    children: [
      {
        path: 'dashboard',
        lazy: async () => ({
          Component: (await import('./routes/officer/officer-dashboard')).OfficerDashboardRoute,
        }),
      },
      {
        path: 'statistics',
        lazy: async () => ({
          Component: (await import('./routes/officer/officer-statistics')).OfficerStatisticsRoute,
        }),
      },
    ],
  },

  // ── Legacy dispatcher placeholder ────────────────────────────────
  {
    path: paths.dispatcher.root.path,
    lazy: async () => ({
      Component: (await import('./routes/dispatcher/dispatcher-placeholder')).DispatcherPlaceholderRoute,
    }),
    ErrorBoundary: RouteErrorBoundary,
    HydrateFallback: RouteLoading,
  },

  // ── 404 ──────────────────────────────────────────────────────────
  {
    path: '*',
    HydrateFallback: RouteLoading,
    lazy: async () => ({ Component: (await import('./routes/not-found')).NotFoundRoute }),
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
