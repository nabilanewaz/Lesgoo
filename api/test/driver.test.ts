import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { createDriver, logIn, requestRide, resetDb, signUpPassenger } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function jashimOnline() {
  await createDriver();
  const jashim = await logIn('jashim@teslapool.test');
  await jashim.post('/api/driver/online').expect(200);
  return jashim;
}

// Nusrat is in Bullet, Rafiq joins: the pooled trip from the story.
async function nusratAndRafiqInBullet() {
  const jashim = await jashimOnline();
  const nusrat = await signUpPassenger('Nusrat');
  const rafiq = await signUpPassenger('Rafiq');
  const n = await requestRide(nusrat.agent, 'MOHAKHALI');
  await jashim.post(`/api/driver/requests/${n.body.ride.id}/accept`).expect(200);
  const r = await requestRide(rafiq.agent, 'GULSHAN_1');
  expect(r.body.ride.status).toBe('MATCHED');
  return { jashim, nusrat, rafiq, nusratRideId: n.body.ride.id as string, rafiqRideId: r.body.ride.id as string };
}

describe('going online and offline', () => {
  it('lets Jashim go online and see Bullet', async () => {
    const jashim = await jashimOnline();
    const me = await jashim.get('/api/driver/me').expect(200);
    expect(me.body).toMatchObject({ vehicle: { name: 'Bullet', capacity: 3, isOnline: true }, activePool: null });
  });

  it('refuses to let Jashim go offline mid-trip, then allows it once the trip is done', async () => {
    const { jashim } = await nusratAndRafiqInBullet();
    const res = await jashim.post('/api/driver/offline').expect(409);
    expect(res.body.error.code).toBe('ACTIVE_TRIP');

    await jashim.post('/api/driver/pool/arrive').expect(200);
    await jashim.post('/api/driver/pool/start').expect(200);
    await jashim.post('/api/driver/pool/complete').expect(200);
    await jashim.post('/api/driver/offline').expect(200);
  });

  it('keeps passengers out of driver endpoints', async () => {
    const nusrat = await signUpPassenger('Nusrat');
    await nusrat.agent.get('/api/driver/me').expect(403);
    await nusrat.agent.post('/api/driver/pool/start').expect(403);
  });
});

describe('the request feed', () => {
  it('shows nothing while offline', async () => {
    await createDriver();
    const jashim = await logIn('jashim@teslapool.test');
    const nusrat = await signUpPassenger('Nusrat');
    await requestRide(nusrat.agent, 'MOHAKHALI');

    const feed = await jashim.get('/api/driver/requests').expect(200);
    expect(feed.body.requests).toEqual([]);
  });

  it('narrows to compatible requests once Bullet has a trip open', async () => {
    const jashim = await jashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');
    const shirin = await signUpPassenger('Shirin');
    const n = await requestRide(nusrat.agent, 'MOHAKHALI');
    await requestRide(rafiq.agent, 'GULSHAN_1');
    await requestRide(shirin.agent, 'GULSHAN_2');

    const before = await jashim.get('/api/driver/requests').expect(200);
    expect(before.body.requests.map((r: { passengerName: string }) => r.passengerName)).toEqual(['Nusrat', 'Rafiq', 'Shirin']);

    await jashim.post(`/api/driver/requests/${n.body.ride.id}/accept`).expect(200);

    // Rafiq's Gulshan 1 is on the way; Shirin's Gulshan 2 is not.
    const after = await jashim.get('/api/driver/requests').expect(200);
    expect(after.body.requests.map((r: { passengerName: string }) => r.passengerName)).toEqual(['Rafiq']);
  });
});

describe('a full pooled trip', () => {
  it("takes Nusrat and Rafiq from Banani to drop-off, charging ৳52.50 and ৳67.50", async () => {
    const { jashim, nusrat, rafiq, nusratRideId, rafiqRideId } = await nusratAndRafiqInBullet();

    const arrived = await jashim.post('/api/driver/pool/arrive').expect(200);
    expect(arrived.body.activePool).toMatchObject({ status: 'DRIVER_ARRIVED', seatsTaken: 2, seatsLeft: 1 });
    expect((await nusrat.agent.get(`/api/rides/${nusratRideId}`)).body.ride.status).toBe('DRIVER_ARRIVED');

    const started = await jashim.post('/api/driver/pool/start').expect(200);
    expect(started.body.activePool.passengers).toEqual([
      expect.objectContaining({ name: 'Nusrat', dropoff: { code: 'MOHAKHALI', name: 'Mohakhali' }, farePaisa: 5250 }),
      expect.objectContaining({ name: 'Rafiq', dropoff: { code: 'GULSHAN_1', name: 'Gulshan 1' }, farePaisa: 6750 }),
    ]);
    expect(started.body.activePool.totalFarePaisa).toBe(12000);

    const completed = await jashim.post('/api/driver/pool/complete').expect(200);
    expect(completed.body.activePool).toBeNull();

    // Each passenger sees only their own final fare.
    const nusratsRide = (await nusrat.agent.get(`/api/rides/${nusratRideId}`)).body.ride;
    expect(nusratsRide).toMatchObject({
      status: 'COMPLETED',
      fare: { subtotalPaisa: 7000, poolDiscountPaisa: 1750, farePaisa: 5250, isFinal: true },
    });
    const rafiqsRide = (await rafiq.agent.get(`/api/rides/${rafiqRideId}`)).body.ride;
    expect(rafiqsRide.fare).toMatchObject({ poolDiscountPaisa: 2250, farePaisa: 6750 });

    const history = await jashim.get('/api/driver/pools').expect(200);
    expect(history.body.pools[0]).toMatchObject({ status: 'COMPLETED', totalFarePaisa: 12000 });
  });

  it('records the ride timeline so we can explain what happened later', async () => {
    const { jashim, nusrat, nusratRideId } = await nusratAndRafiqInBullet();
    await jashim.post('/api/driver/pool/arrive');
    await jashim.post('/api/driver/pool/start');
    await jashim.post('/api/driver/pool/complete');

    const events = await nusrat.agent.get(`/api/rides/${nusratRideId}/events`).expect(200);
    expect(events.body.events.map((e: { type: string }) => e.type)).toEqual([
      'RIDE_REQUESTED',
      'RIDE_MATCHED',
      'DRIVER_ARRIVED',
      'TRIP_STARTED',
      'TRIP_COMPLETED',
    ]);
  });

  it('charges full price when Rafiq cancels after arrival and Nusrat rides alone', async () => {
    const { jashim, nusrat, rafiq, nusratRideId, rafiqRideId } = await nusratAndRafiqInBullet();
    await jashim.post('/api/driver/pool/arrive').expect(200);
    await rafiq.agent.post(`/api/rides/${rafiqRideId}/cancel`).send({ reason: 'Boss called' }).expect(200);

    await jashim.post('/api/driver/pool/start').expect(200);
    const ride = (await nusrat.agent.get(`/api/rides/${nusratRideId}`)).body.ride;
    expect(ride.fare).toMatchObject({ poolDiscountPaisa: 0, farePaisa: 7000 });
  });

  it('keeps the passenger list locked after arrival: Shirin waits for another Tesla', async () => {
    const { jashim } = await nusratAndRafiqInBullet();
    await jashim.post('/api/driver/pool/arrive').expect(200);

    const shirin = await signUpPassenger('Shirin');
    const s = await requestRide(shirin.agent, 'MOHAKHALI');
    expect(s.body.ride.status).toBe('REQUESTED');
    await jashim.post(`/api/driver/requests/${s.body.ride.id}/accept`).expect(409);
  });
});

describe('invalid transitions are rejected', () => {
  it('refuses to start before arriving, complete before starting, or arrive twice', async () => {
    const { jashim } = await nusratAndRafiqInBullet();

    const start = await jashim.post('/api/driver/pool/start').expect(409);
    expect(start.body.error.code).toBe('INVALID_TRANSITION');
    await jashim.post('/api/driver/pool/complete').expect(409);

    await jashim.post('/api/driver/pool/arrive').expect(200);
    await jashim.post('/api/driver/pool/arrive').expect(409);
  });

  it('refuses to cancel a trip that has started', async () => {
    const { jashim } = await nusratAndRafiqInBullet();
    await jashim.post('/api/driver/pool/arrive');
    await jashim.post('/api/driver/pool/start');
    await jashim.post('/api/driver/pool/cancel').expect(409);
  });

  it('answers 404 when there is no trip to move', async () => {
    const jashim = await jashimOnline();
    await jashim.post('/api/driver/pool/arrive').expect(404);
  });

  it('lets only one of two simultaneous "Start trip" taps through', async () => {
    const { jashim } = await nusratAndRafiqInBullet();
    await jashim.post('/api/driver/pool/arrive').expect(200);

    const [a, b] = await Promise.all([jashim.post('/api/driver/pool/start'), jashim.post('/api/driver/pool/start')]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);

    const events = await prisma.rideEvent.count({ where: { type: 'TRIP_STARTED', rideRequestId: null } });
    expect(events).toBe(1);
  });
});

describe('driver cancels', () => {
  it('cancels every passenger with a reason and frees Bullet', async () => {
    const { jashim, nusrat, nusratRideId } = await nusratAndRafiqInBullet();
    await jashim.post('/api/driver/pool/cancel').expect(200);

    const ride = (await nusrat.agent.get(`/api/rides/${nusratRideId}`)).body.ride;
    expect(ride).toMatchObject({ status: 'CANCELLED', cancelReason: 'Driver cancelled the trip' });

    // Nusrat can book again, and Jashim can go offline.
    await requestRide(nusrat.agent, 'MOHAKHALI').then((r) => expect(r.status).toBe(201));
    await jashim.post('/api/driver/offline').expect(200);
  });
});

describe("the driver's auto-add switch", () => {
  it('is on by default: Rafiq joins Bullet automatically', async () => {
    const { jashim } = await nusratAndRafiqInBullet(); // asserts Rafiq was MATCHED
    const me = await jashim.get('/api/driver/me').expect(200);
    expect(me.body.vehicle.autoAccept).toBe(true);
  });

  it('when off, compatible riders wait in the feed until Jashim accepts them', async () => {
    const jashim = await jashimOnline();
    const off = await jashim.post('/api/driver/auto-accept').send({ enabled: false }).expect(200);
    expect(off.body.vehicle.autoAccept).toBe(false);

    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');
    const n = await requestRide(nusrat.agent, 'MOHAKHALI');
    await jashim.post(`/api/driver/requests/${n.body.ride.id}/accept`).expect(200);

    // Rafiq is heading the same way, but Jashim picks his own riders now.
    const r = await requestRide(rafiq.agent, 'GULSHAN_1');
    expect(r.body.ride.status).toBe('REQUESTED');
    const feed = await jashim.get('/api/driver/requests').expect(200);
    expect(feed.body.requests.map((x: { passengerName: string }) => x.passengerName)).toEqual(['Rafiq']);

    await jashim.post(`/api/driver/requests/${r.body.ride.id}/accept`).expect(200);
    const me = await jashim.get('/api/driver/me').expect(200);
    expect(me.body.activePool.passengers).toHaveLength(2);
  });

  it('can be switched back on at any time', async () => {
    const jashim = await jashimOnline();
    await jashim.post('/api/driver/auto-accept').send({ enabled: false }).expect(200);
    await jashim.post('/api/driver/auto-accept').send({ enabled: true }).expect(200);

    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');
    const n = await requestRide(nusrat.agent, 'MOHAKHALI');
    await jashim.post(`/api/driver/requests/${n.body.ride.id}/accept`).expect(200);
    const r = await requestRide(rafiq.agent, 'GULSHAN_1');
    expect(r.body.ride.status).toBe('MATCHED');
  });

  it('rejects a malformed switch value and is drivers-only', async () => {
    const jashim = await jashimOnline();
    await jashim.post('/api/driver/auto-accept').send({ enabled: 'yes' }).expect(400);
    const nusrat = await signUpPassenger('Nusrat');
    await nusrat.agent.post('/api/driver/auto-accept').send({ enabled: false }).expect(403);
  });
});
