import { execSync } from 'node:child_process';

// Runs once before all tests: creates the test database if needed and applies migrations,
// so tests always run against the real schema, constraints included.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see vitest.config.mts)');

  try {
    execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  } catch (err) {
    const output = (err as { stderr?: Buffer }).stderr?.toString() ?? '';
    throw new Error(`Could not migrate the test database. Is Postgres running (docker compose up -d db)?\n${output}`);
  }
}
