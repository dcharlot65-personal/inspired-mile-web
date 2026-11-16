import { defineConfig } from 'vitest/config';

// Unit tests for pure game logic. Browser tests live in tests/ and run under Playwright.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
