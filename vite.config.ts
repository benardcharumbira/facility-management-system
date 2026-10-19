import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
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
            { name: 'vendor-mui', test: /node_modules[\\/](@mui|@emotion)/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    env: {
      VITE_API_BASE_URL: 'http://localhost:5000/api',
      VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_vitest',
      VITE_ENABLE_API_MOCKING: 'false',
    },
  },
});
