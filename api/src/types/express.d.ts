import type { SessionUser } from '../modules/auth/session';

// Lets route handlers read req.user after requireAuth has run.
declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export {};
