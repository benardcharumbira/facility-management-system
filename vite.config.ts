import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // Routes are lazy loaded; vendor code is split so the entry chunk stays small and cacheable.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-clerk', test: /node_modules[\\/]@clerk/ },
            { name: 'vendor-radix', test: /node_modules[\\/](@radix-ui|radix-ui)/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    // Same origin as the mocked API, so jsdom's XMLHttpRequest (used for uploads, which need
    // progress events) does not trigger CORS preflights that no handler answers.
    environmentOptions: { jsdom: { url: 'http://localhost:5000/' } },
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    env: {
      VITE_API_BASE_URL: 'http://localhost:5000/api',
      VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_vitest',
      VITE_ENABLE_API_MOCKING: 'false',
    },
  },
});
