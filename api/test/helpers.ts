import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

export const app = createApp();

export const PASSWORD = 'bullet-rides-3';

// Empties every table except zones (reference data from the migration).
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE ride_events, ride_requests, pools, vehicles, users RESTART IDENTITY CASCADE',
  );
}

// Drivers can't sign up through the API, so tests create them directly, like the seed does.
export async function createDriver(
  name = 'Jashim',
  vehicle = { name: 'Bullet', plate: 'DHAKA-TESLA-01', capacity: 3 },
) {
  return prisma.user.create({
    data: {
      name,
      email: `${name.toLowerCase()}@teslapool.test`,
      passwordHash: await bcrypt.hash(PASSWORD, 4), // low cost rounds: fast tests
      role: 'DRIVER',
      vehicle: { create: vehicle },
    },
    include: { vehicle: true },
  });
}

// Returns a supertest agent that keeps the session cookie, like a browser would.
export async function signUpPassenger(name: string) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/signup')
    .send({ name, email: `${name.toLowerCase()}@teslapool.test`, password: PASSWORD })
    .expect(201);
  return { agent, user: res.body.user as { id: string; name: string; email: string; role: string } };
}

export async function logIn(email: string, password = PASSWORD) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password }).expect(200);
  return agent;
}
