import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1000,
  },
  test: {
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
});
