import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env';
import { currentUser, requireAuth } from '../../middleware/auth';
import { loginSchema, signupSchema } from './auth.schemas';
import { getMe, login, signup } from './auth.service';
import { clearSessionCookie, setSessionCookie } from './session';

export const authRouter = Router();

// Per-IP limits, kept in this process's memory (resets on restart; with several API
// instances you'd move the counters to a shared store such as Redis).
const limiter = (limit: number, options: { onlyFailures?: boolean } = {}) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    // Login: only failed attempts count. Brute force = many failures; a person signing
    // in and out repeatedly should never lock themselves out.
    skipSuccessfulRequests: options.onlyFailures ?? false,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again in a few minutes' } });
    },
  });

const loginLimiter = limiter(10, { onlyFailures: true }); // 10 wrong passwords / 15 min / IP
const signupLimiter = limiter(20); // 20 new accounts / 15 min / IP

authRouter.post('/signup', signupLimiter, async (req, res) => {
  const user = await signup(signupSchema.parse(req.body));
  setSessionCookie(res, user);
  res.status(201).json({ user });
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const user = await login(loginSchema.parse(req.body));
  setSessionCookie(res, user);
  res.json({ user });
});

// JWTs are stateless: logout removes the cookie from this browser. The token itself stays
// valid until it expires (documented limitation; fix = short-lived tokens + refresh/denylist).
authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: await getMe(currentUser(req).id) });
});
