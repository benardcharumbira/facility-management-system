import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Colours, pixel font sizes and pixel spacing belong in the theme module only.
const noRawStyleValues = [
  {
    selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
    message: 'No hardcoded hex colours. Read colours from the theme.',
  },
  {
    selector: 'Literal[value=/\\b\\d+(\\.\\d+)?px\\b/]',
    message: 'No hardcoded pixel values. Use theme.spacing / theme.typography.',
  },
  {
    selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b|\\b\\d+(\\.\\d+)?px\\b/]',
    message: 'No hardcoded colours or pixel values. Read them from the theme.',
  },
];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'public'] },
  { settings: { react: { version: 'detect' } } },
  js.configs.recommended,
  tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs.flat.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-syntax': ['error', ...noRawStyleValues],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@clerk/react',
              message: 'Use useCurrentUser from @/shared/auth. Only the auth layer touches Clerk.',
            },
          ],
        },
      ],
    },
  },
  {
    // The auth layer, root layout and Clerk sign-in pages are the only Clerk consumers.
    files: [
      'src/shared/auth/**',
      'src/app/routes/RootLayout.tsx',
      'src/app/routes/SignInPage.tsx',
      'src/app/routes/SignUpPage.tsx',
      'src/test/**',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Features never import from one another. Anything shared lives in shared/.
    files: ['src/features/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '**/features/*'],
              message: 'Features must not import from other features. Move it to shared/.',
            },
          ],
        },
      ],
    },
  },
  {
    // The theme module is where raw values are allowed.
    files: ['src/app/theme/**', '**/*.test.{ts,tsx}', 'src/test/**', 'src/mocks/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
