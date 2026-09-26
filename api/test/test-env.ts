// Tests use their own database so they never touch development data.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://tesla:tesla@localhost:5432/tesla_pool_test?schema=public';
