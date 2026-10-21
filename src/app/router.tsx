import { lazy } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { ProtectedRoute, RequireRole } from '@/shared/auth';
import { ACCESS } from './access';
import { PublicLayout } from './routes/PublicLayout';
import { RoleRedirect } from './routes/RoleRedirect';
import { RootLayout } from './routes/RootLayout';
import { AppShell } from './shell/AppShell';

// Route components are lazy loaded, so they are default exports.
const SignInPage = lazy(() => import('./routes/SignInPage'));
const SignUpPage = lazy(() => import('./routes/SignUpPage'));
const NotFoundPage = lazy(() => import('./routes/NotFoundPage'));
const FacilitiesPage = lazy(() => import('@/features/facilities/pages/FacilitiesPage'));
const FacilityDetailPage = lazy(() => import('@/features/facilities/pages/FacilityDetailPage'));
const BookingsPage = lazy(() => import('@/features/bookings/pages/BookingsPage'));
const NewBookingPage = lazy(() => import('@/features/bookings/pages/NewBookingPage'));
const BookingConfirmationPage = lazy(
  () => import('@/features/bookings/pages/BookingConfirmationPage'),
);
const BookingDetailPage = lazy(() => import('@/features/bookings/pages/BookingDetailPage'));
const ApprovalsPage = lazy(() => import('@/features/approvals/pages/ApprovalsPage'));
const AdminFacilitiesPage = lazy(() => import('@/features/admin/pages/AdminFacilitiesPage'));
const AdminFacilityNewPage = lazy(() => import('@/features/admin/pages/AdminFacilityNewPage'));
const AdminFacilityEditPage = lazy(() => import('@/features/admin/pages/AdminFacilityEditPage'));
const AdminResourcesPage = lazy(() => import('@/features/admin/pages/AdminResourcesPage'));
const AdminResourceNewPage = lazy(() => import('@/features/admin/pages/AdminResourceNewPage'));
const AdminResourceEditPage = lazy(() => import('@/features/admin/pages/AdminResourceEditPage'));
const AdminAllocationPage = lazy(() => import('@/features/admin/pages/AdminAllocationPage'));
const AdminFacilityResourcesPage = lazy(
  () => import('@/features/admin/pages/AdminFacilityResourcesPage'),
);
const AdminUsersPage = lazy(() => import('@/features/admin/pages/AdminUsersPage'));

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: 'sign-in/*', element: <SignInPage /> },
          { path: 'sign-up/*', element: <SignUpPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <RoleRedirect /> },
              { path: 'facilities', element: <FacilitiesPage /> },
              { path: 'facilities/:id', element: <FacilityDetailPage /> },
              { path: 'bookings/:id', element: <BookingDetailPage /> },
              {
                element: <RequireRole roles={ACCESS.bookers} />,
                children: [
                  { path: 'bookings', element: <BookingsPage /> },
                  { path: 'bookings/new', element: <NewBookingPage /> },
                  { path: 'bookings/:id/confirmation', element: <BookingConfirmationPage /> },
                ],
              },
              {
                element: <RequireRole roles={ACCESS.approvers} />,
                children: [{ path: 'approvals/:itemId?', element: <ApprovalsPage /> }],
              },
              {
                element: <RequireRole roles={ACCESS.estateAdmins} />,
                children: [
                  { path: 'admin/facilities', element: <AdminFacilitiesPage /> },
                  { path: 'admin/facilities/new', element: <AdminFacilityNewPage /> },
                  { path: 'admin/facilities/:id', element: <AdminFacilityEditPage /> },
                  {
                    path: 'admin/facilities/:id/resources',
                    element: <AdminFacilityResourcesPage />,
                  },
                  { path: 'admin/resources', element: <AdminResourcesPage /> },
                  { path: 'admin/resources/new', element: <AdminResourceNewPage /> },
                  { path: 'admin/resources/allocation', element: <AdminAllocationPage /> },
                  { path: 'admin/resources/:id', element: <AdminResourceEditPage /> },
                ],
              },
              {
                element: <RequireRole roles={ACCESS.systemAdmins} />,
                children: [{ path: 'admin/users', element: <AdminUsersPage /> }],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
