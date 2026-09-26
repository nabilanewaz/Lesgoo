import { Router } from 'express';
import { prisma } from '../../lib/prisma';

export const healthRouter = Router();

// Used by Docker health checks and the hosting platform.
// Reports 503 when the database is unreachable, so the container is marked unhealthy.
healthRouter.get('/', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'ok' });
  } catch (err) {
    req.log.warn({ err }, 'health check: database unreachable');
    res.status(503).json({ status: 'degraded', db: 'unreachable' });
  }
});
