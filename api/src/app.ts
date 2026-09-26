import express from 'express';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';
import { ridesRouter } from './modules/rides/rides.routes';
import { zonesRouter } from './modules/zones/zones.routes';

// Builds the Express app without starting a server, so tests can call it directly.
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // The API sits behind exactly one proxy (the Next.js server), so trust its
  // X-Forwarded-For header to get the real client IP for rate limiting.
  app.set('trust proxy', 1);
  app.use(
    pinoHttp({
      logger,
      // One line per request. Full headers made the logs unreadable (and only the cookie was redacted).
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      customSuccessMessage: (req, res, ms) => `${req.method} ${req.url} ${res.statusCode} ${Math.round(ms)}ms`,
      customErrorMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    }),
  );
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/zones', zonesRouter);
  app.use('/api/rides', ridesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
