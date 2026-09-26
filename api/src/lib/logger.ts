import pino from 'pino';
import { env } from '../config/env';

// Structured JSON logs in production (easy to search), pretty logs in development.
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash'],
  ...(env.NODE_ENV === 'development' && {
    transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
  }),
});
