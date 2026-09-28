import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/create-app';
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
  { online = false } = {},
) {
  const driver = await prisma.user.create({
    data: {
      name,
      email: `${name.toLowerCase()}@teslapool.test`,
      passwordHash: await bcrypt.hash(PASSWORD, 4), // low cost rounds: fast tests
      role: 'DRIVER',
      vehicle: { create: { ...vehicle, isOnline: online } },
    },
    include: { vehicle: true },
  });
  return { ...driver, vehicle: driver.vehicle! };
}

// Jashim and Bullet, online and ready at Banani Road 11.
export const createJashimOnline = () => createDriver('Jashim', undefined, { online: true });

export async function requestRide(
  agent: Awaited<ReturnType<typeof signUpPassenger>>['agent'],
  dropoffZone: string,
  seats = 1,
  pickupZone = 'BANANI',
) {
  const res = await agent.post('/api/rides').send({ pickupZone, dropoffZone, seats });
  return res;
}

// The story cast's self-declared genders; anyone else (e.g. the "Commuter" crowd) didn't say.
export const CAST_GENDER: Record<string, 'WOMAN' | 'MAN' | 'UNDISCLOSED'> = {
  Nusrat: 'WOMAN',
  Shirin: 'WOMAN',
  Moushumi: 'WOMAN',
  Rafiq: 'MAN',
};

// Returns a supertest agent that keeps the session cookie, like a browser would.
export async function signUpPassenger(name: string, gender = CAST_GENDER[name] ?? 'UNDISCLOSED') {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/signup')
    .send({ name, email: `${name.toLowerCase()}@teslapool.test`, password: PASSWORD, gender })
    .expect(201);
  return { agent, user: res.body.user as { id: string; name: string; email: string; role: string } };
}

export async function logIn(email: string, password = PASSWORD) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password }).expect(200);
  return agent;
}
