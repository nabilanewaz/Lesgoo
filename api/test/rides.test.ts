import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, createDriver, logIn, resetDb, signUpPassenger } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const nusratsTrip = { pickupZone: 'BANANI', dropoffZone: 'MOHAKHALI', seats: 1 };

describe('fare estimate', () => {
  it('quotes Nusrat solo and pooled prices without signing in', async () => {
    const res = await request(app)
      .get('/api/rides/estimate')
      .query({ pickupZone: 'BANANI', dropoffZone: 'MOHAKHALI' })
      .expect(200);

    expect(res.body.estimate.solo).toMatchObject({ distanceKm: 2, farePaisa: 7000 });
    expect(res.body.estimate.pooled).toMatchObject({ poolDiscountPaisa: 1750, farePaisa: 5250 });
  });
});

describe('requesting a ride', () => {
  it('creates Nusrat’s Banani → Mohakhali request with its fare estimate and a history entry', async () => {
    const { agent } = await signUpPassenger('Nusrat');

    const res = await agent.post('/api/rides').send(nusratsTrip).expect(201);
    expect(res.body.ride).toMatchObject({
      status: 'REQUESTED',
      pickup: { code: 'BANANI', name: 'Banani' },
      dropoff: { code: 'MOHAKHALI', name: 'Mohakhali' },
      distanceKm: 2,
      paymentMethod: 'CASH',
      fare: { subtotalPaisa: 7000, pooledEstimatePaisa: 5250, farePaisa: null, isFinal: false },
    });

    const events = await agent.get(`/api/rides/${res.body.ride.id}/events`).expect(200);
    expect(events.body.events).toEqual([expect.objectContaining({ type: 'RIDE_REQUESTED', toStatus: 'REQUESTED' })]);
  });

  it('allows only one active ride per passenger', async () => {
    const { agent } = await signUpPassenger('Nusrat');
    await agent.post('/api/rides').send(nusratsTrip).expect(201);

    const res = await agent.post('/api/rides').send({ ...nusratsTrip, dropoffZone: 'GULSHAN_1' }).expect(409);
    expect(res.body.error.code).toBe('ACTIVE_RIDE_EXISTS');
  });

  it('rejects a trip that goes nowhere, an unknown zone, and too many seats', async () => {
    const { agent } = await signUpPassenger('Rafiq');
    await agent.post('/api/rides').send({ pickupZone: 'BANANI', dropoffZone: 'BANANI' }).expect(400);
    await agent.post('/api/rides').send({ pickupZone: 'BANANI', dropoffZone: 'NARNIA' }).expect(400);
    await agent.post('/api/rides').send({ ...nusratsTrip, seats: 4 }).expect(400);
  });

  it('requires a signed-in passenger: guests get 401, Jashim (a driver) gets 403', async () => {
    await request(app).post('/api/rides').send(nusratsTrip).expect(401);

    await createDriver();
    const jashim = await logIn('jashim@teslapool.test');
    await jashim.post('/api/rides').send(nusratsTrip).expect(403);
  });
});

describe('privacy and ownership', () => {
  it('stops Rafiq from reading, cancelling or viewing the history of Nusrat’s ride', async () => {
    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');
    const { body } = await nusrat.agent.post('/api/rides').send(nusratsTrip).expect(201);
    const nusratsRideId = body.ride.id;

    await rafiq.agent.get(`/api/rides/${nusratsRideId}`).expect(404);
    await rafiq.agent.get(`/api/rides/${nusratsRideId}/events`).expect(404);
    await rafiq.agent.post(`/api/rides/${nusratsRideId}/cancel`).send({}).expect(404);

    const stillThere = await nusrat.agent.get(`/api/rides/${nusratsRideId}`).expect(200);
    expect(stillThere.body.ride.status).toBe('REQUESTED');

    const rafiqsHistory = await rafiq.agent.get('/api/rides').expect(200);
    expect(rafiqsHistory.body.rides).toEqual([]);
  });

  it('answers 404 for a malformed ride id instead of crashing', async () => {
    const { agent } = await signUpPassenger('Nusrat');
    await agent.get('/api/rides/not-a-uuid').expect(404);
  });
});

describe('cancellation', () => {
  it('lets Nusrat cancel a waiting request, then book again', async () => {
    const { agent } = await signUpPassenger('Nusrat');
    const { body } = await agent.post('/api/rides').send(nusratsTrip).expect(201);

    const cancelled = await agent
      .post(`/api/rides/${body.ride.id}/cancel`)
      .send({ reason: 'Found a CNG' })
      .expect(200);
    expect(cancelled.body.ride).toMatchObject({ status: 'CANCELLED', cancelReason: 'Found a CNG' });

    const current = await agent.get('/api/rides/current').expect(200);
    expect(current.body.ride).toBeNull();

    await agent.post('/api/rides').send(nusratsTrip).expect(201);

    const history = await agent.get('/api/rides').expect(200);
    expect(history.body.rides.map((r: { status: string }) => r.status)).toEqual(['REQUESTED', 'CANCELLED']);
  });

  it('refuses to cancel twice', async () => {
    const { agent } = await signUpPassenger('Shirin');
    const { body } = await agent.post('/api/rides').send(nusratsTrip).expect(201);
    await agent.post(`/api/rides/${body.ride.id}/cancel`).send({}).expect(200);

    const again = await agent.post(`/api/rides/${body.ride.id}/cancel`).send({}).expect(409);
    expect(again.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('refuses to cancel once the trip has started', async () => {
    const { agent } = await signUpPassenger('Rafiq');
    const { body } = await agent.post('/api/rides').send(nusratsTrip).expect(201);

    // Pools and the driver flow arrive in later steps; put the ride mid-trip directly.
    const jashim = await createDriver();
    const pool = await prisma.pool.create({
      data: { vehicleId: jashim.vehicle!.id, pickupZone: 'BANANI', capacity: 3, seatsTaken: 1, status: 'STARTED' },
    });
    await prisma.rideRequest.update({ where: { id: body.ride.id }, data: { status: 'STARTED', poolId: pool.id } });

    const res = await agent.post(`/api/rides/${body.ride.id}/cancel`).send({}).expect(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });
});
