import type { Express } from 'express';
import { env } from './config/env';
import { createApp } from './create-app';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

// The one entry point: Docker, `npm run dev` and Vercel all start the API here (Vercel's Express
// support runs this file and takes over the port). src/create-app.ts only builds the app.
// Vercel only accepts an entry file that imports express itself, hence the typed `app` below.
const app: Express = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Tesla Pool API listening on port ${env.PORT}`);
});

// On `docker compose down` the container gets SIGTERM: stop accepting requests,
// let in-flight ones finish, then close DB connections.
function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
