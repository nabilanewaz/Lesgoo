import express from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { healthRouter } from './modules/health/health.routes';

// Builds the Express app without starting a server, so tests can call it directly.
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '10kb' }));

  app.use('/api/health', healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
