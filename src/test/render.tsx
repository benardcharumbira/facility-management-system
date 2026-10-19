import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/AppProviders';
import { routes } from '@/app/router';
import { server, TEST_API_BASE_URL } from '@/mocks/server';
import type { Role } from '@/shared/auth';

/** Make the mocked GET /me resolve to the given role for the current test. */
export function mockMeRole(role: Role) {
  server.use(
    http.get(`${TEST_API_BASE_URL}/me`, () =>
      HttpResponse.json({
        id: 'u1',
        email: 'test.user@example.org',
        displayName: 'Test User',
        role,
      }),
    ),
  );
}

export function renderApp(initialPath: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const view = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, ...view };
}
