import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    // Tests that import the whole card took over 5-10 s when the host was loaded
    // (load 56 on 24 cores), failing the lander's pre-merge check (#1537).
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
