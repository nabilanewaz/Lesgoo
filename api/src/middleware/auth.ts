import type { Request, RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { forbidden, unauthorized } from '../lib/errors';
import { SESSION_COOKIE, verifySession, type SessionUser } from '../modules/auth/session';

// Reads the session from the httpOnly cookie (browser) or an Authorization: Bearer header
// (curl / API clients). Only the signed token is trusted, never user ids sent in the body.
export const requireAuth: RequestHandler = (req, _res, next) => {
  const cookieToken: string | undefined = req.cookies?.[SESSION_COOKIE];
  const header = req.headers.authorization;
  const bearerToken = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  const token = cookieToken ?? bearerToken;
  const user = token ? verifySession(token) : null;
  if (!user) throw unauthorized();

  req.user = user;
  next();
};

// Use after requireAuth. Passengers can't hit driver endpoints and vice versa.
export const requireRole =
  (role: UserRole): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (req.user.role !== role) throw forbidden(`Only ${role.toLowerCase()}s can do that`);
    next();
  };

// For handlers behind requireAuth: returns the user without a null check at every call site.
export function currentUser(req: Request): SessionUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
