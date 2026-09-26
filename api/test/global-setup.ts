import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './test-env';

// Runs once before all tests: creates the test database if needed and applies migrations,
// so tests always run against the real schema, constraints included.
export default function setup() {
  try {
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'pipe',
    });
  } catch (err) {
    const output = (err as { stdout?: Buffer; stderr?: Buffer }).stderr?.toString() ?? '';
    throw new Error(`Could not migrate the test database. Is Postgres running (docker compose up -d db)?\n${output}`);
  }
}
