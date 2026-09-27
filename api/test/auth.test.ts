import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { PASSWORD, app, createDriver, logIn, resetDb, signUpPassenger } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('passenger sign-up', () => {
  it('creates Nusrat as a passenger and signs her in with an httpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Nusrat', email: 'Nusrat@TeslaPool.test', password: PASSWORD, gender: 'WOMAN' })
      .expect(201);

    expect(res.body.user).toMatchObject({ name: 'Nusrat', email: 'nusrat@teslapool.test', role: 'PASSENGER', gender: 'WOMAN' });
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/^tp_session=/);
    expect(cookie).toMatch(/HttpOnly/i);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'nusrat@teslapool.test' } });
    expect(stored.passwordHash).not.toBe(PASSWORD);
  });

  it('ignores a role in the body: Rafiq cannot sign himself up as a driver', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Rafiq', email: 'rafiq@teslapool.test', password: PASSWORD, gender: 'MAN', role: 'DRIVER' })
      .expect(201);

    expect(res.body.user.role).toBe('PASSENGER');
  });

  it('rejects a second account with the same email, whatever the casing', async () => {
    await signUpPassenger('Shirin');
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Shirin Again', email: 'SHIRIN@teslapool.test', password: PASSWORD, gender: 'WOMAN' })
      .expect(409);

    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('explains which fields are invalid', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'N', email: 'not-an-email', password: 'short', gender: 'ALIEN' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password', 'gender']));
  });
});

describe('declared gender', () => {
  it('allows "prefer not to say"', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Shirin', email: 'shirin@teslapool.test', password: PASSWORD, gender: 'UNDISCLOSED' })
      .expect(201);
    expect(res.body.user.gender).toBe('UNDISCLOSED');
  });

  it('requires an explicit choice', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Shirin', email: 'shirin@teslapool.test', password: PASSWORD })
      .expect(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain('gender');
  });
});

describe('login', () => {
  it('lets Jashim log in and shows Bullet on /me', async () => {
    await createDriver();
    const agent = await logIn('jashim@teslapool.test');

    const res = await agent.get('/api/auth/me').expect(200);
    expect(res.body.user).toMatchObject({ name: 'Jashim', role: 'DRIVER' });
    expect(res.body.user.vehicle).toMatchObject({ name: 'Bullet', capacity: 3, isOnline: false });
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    await signUpPassenger('Nusrat');

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nusrat@teslapool.test', password: 'not-her-password' })
      .expect(401);
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@teslapool.test', password: PASSWORD, gender: 'WOMAN' })
      .expect(401);

    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('sessions', () => {
  it('rejects /me without a session', async () => {
    await request(app).get('/api/auth/me').expect(401);
  });

  it('rejects a forged token', async () => {
    const { agent } = await signUpPassenger('Nusrat');
    const res = await agent.get('/api/auth/me').expect(200);
    expect(res.body.user.name).toBe('Nusrat');

    await request(app).get('/api/auth/me').set('Cookie', 'tp_session=eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.').expect(401);
  });

  it('accepts a Bearer token for API clients', async () => {
    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Rafiq', email: 'rafiq@teslapool.test', password: PASSWORD, gender: 'MAN' });
    const token = /tp_session=([^;]+)/.exec(signup.headers['set-cookie']?.[0] ?? '')?.[1];

    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('signs out on logout', async () => {
    const { agent } = await signUpPassenger('Shirin');
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });
});
