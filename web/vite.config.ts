import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the site works under any GitHub Pages sub-path or domain.
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
