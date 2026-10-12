import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
});