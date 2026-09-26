import express from 'express';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';

// Builds the Express app without starting a server, so tests can call it directly.
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // The API sits behind exactly one proxy (the Next.js server), so trust its
  // X-Forwarded-For header to get the real client IP for rate limiting.
  app.set('trust proxy', 1);
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
