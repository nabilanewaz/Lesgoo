import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { env } from '../../config/env';

// Who is making the request. This is all the token carries: never names, emails or passwords.
export type SessionUser = { id: string; role: UserRole };

export const SESSION_COOKIE = 'tp_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

const cookieOptions: CookieOptions = {
  httpOnly: true, // page JavaScript can't read it, so an XSS bug can't steal the session
  sameSite: 'lax', // not sent on cross-site POSTs, which blocks basic CSRF
  secure: env.COOKIE_SECURE,
  path: '/',
};

export function signSession(user: SessionUser): string {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: SESSION_TTL_SECONDS,
    algorithm: 'HS256',
  });
}

// Returns null for anything invalid: bad signature, expired, or unexpected shape.
export function verifySession(token: string): SessionUser | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub) return null;
    if (payload.role !== 'PASSENGER' && payload.role !== 'DRIVER') return null;
    return { id: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, user: SessionUser) {
  res.cookie(SESSION_COOKIE, signSession(user), { ...cookieOptions, maxAge: SESSION_TTL_SECONDS * 1000 });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}
