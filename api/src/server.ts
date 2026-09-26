import { env } from './config/env';
import { createApp } from './app';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

const server = createApp().listen(env.PORT, () => {
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
