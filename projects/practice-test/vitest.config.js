import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'app',
  test: {
    environment: 'jsdom',
    include: ['../tests/unit/**/*.test.js'],
    globals: false,
  },
});
