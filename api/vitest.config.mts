import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './test/test-env';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-only-secret-not-for-production',
      COOKIE_SECURE: 'false',
    },
    // Test files share one database and truncate it between tests, so run them one at a time.
    fileParallelism: false,
    hookTimeout: 60_000,
  },
});
