import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { paths } from '@/config/paths';

import { RouteErrorBoundary } from './routes/route-error-boundary';
import { RouteLoading } from './routes/route-loading';

// Each route is lazy-loaded so the citizen bundle never ships dispatcher code.
const router = createBrowserRouter([
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
  {
    path: paths.dispatcher.root.path,
    lazy: async () => ({
      Component: (await import('./routes/dispatcher/dispatcher-placeholder')).DispatcherPlaceholderRoute,
    }),
    ErrorBoundary: RouteErrorBoundary,
    HydrateFallback: RouteLoading,
  },
  {
    path: '*',
    HydrateFallback: RouteLoading,
    lazy: async () => ({ Component: (await import('./routes/not-found')).NotFoundRoute }),
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
