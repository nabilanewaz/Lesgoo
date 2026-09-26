import { defineConfig } from 'vitest/config';

// Tests use their own database so they never touch development data.
// Set here (the main vitest process) so test/global-setup.ts can read it too.
process.env.TEST_DATABASE_URL ??= 'postgresql://tesla:tesla@localhost:5432/tesla_pool_test?schema=public';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      JWT_SECRET: 'test-only-secret-not-for-production',
      COOKIE_SECURE: 'false',
    },
    // Test files share one database and truncate it between tests, so run them one at a time.
    fileParallelism: false,
    hookTimeout: 60_000,
  },
});
