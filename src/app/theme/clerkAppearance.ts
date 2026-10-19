import type { ClerkProvider } from '@clerk/react';
import type { ComponentProps } from 'react';

type Appearance = NonNullable<ComponentProps<typeof ClerkProvider>['appearance']>;

/** Makes Clerk's sign in and sign up cards follow the theme tokens. */
export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: 'var(--color-primary)',
    colorForeground: 'var(--color-ink)',
    colorBackground: 'var(--color-surface)',
    fontFamily: 'var(--font-sans)',
    borderRadius: '0.375rem',
  },
  elements: {
    cardBox: 'shadow-none border border-line rounded-lg',
    footer: 'rounded-b-lg',
  },
};
