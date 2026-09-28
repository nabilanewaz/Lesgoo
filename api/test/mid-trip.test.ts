import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { createDriver, logIn, requestRide, resetDb, signUpPassenger } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

// Things that happen once Bullet is on the road (DESIGN.md §6): passengers are dropped off one
// by one, someone gets off early, or Bullet breaks down.

async function jashimOnline() {
  await createDriver();
  const jashim = await logIn('jashim@teslapool.test');
  await jashim.post('/api/driver/online').expect(200);
  return jashim;
}

// Nusrat (Banani → Mohakhali, 2 km) and Rafiq (Banani → Gulshan 1, 3 km) share Bullet, and the
// trip has started: fares are fixed at ৳52.50 and ৳67.50.
async function pooledTripUnderway() {
  const jashim = await jashimOnline();
  const nusrat = await signUpPassenger('Nusrat');
  const rafiq = await signUpPassenger('Rafiq');
  const n = await requestRide(nusrat.agent, 'MOHAKHALI');
  await jashim.post(`/api/driver/requests/${n.body.ride.id}/accept`).expect(200);
  const r = await requestRide(rafiq.agent, 'GULSHAN_1');
  expect(r.body.ride.status).toBe('MATCHED');
  await jashim.post('/api/driver/pool/arrive').expect(200);
  await jashim.post('/api/driver/pool/start').expect(200);
  return { jashim, nusrat, rafiq, nusratRideId: n.body.ride.id as string, rafiqRideId: r.body.ride.id as string };
}

// Rafiq alone in Bullet (Banani → Gulshan 1, ৳90), trip started.
async function soloTripUnderway() {
  const jashim = await jashimOnline();
  const rafiq = await signUpPassenger('Rafiq');
  const r = await requestRide(rafiq.agent, 'GULSHAN_1');
  await jashim.post(`/api/driver/requests/${r.body.ride.id}/accept`).expect(200);
  await jashim.post('/api/driver/pool/arrive').expect(200);
  await jashim.post('/api/driver/pool/start').expect(200);
  return { jashim, rafiq, rafiqRideId: r.body.ride.id as string };
}

const lastEvent = (rideRequestId: string) =>
  prisma.rideEvent.findFirstOrThrow({ where: { rideRequestId }, orderBy: { id: 'desc' } });

// Holds the trip's row lock while `start` fires its requests, waits until `waiters` of them are
// blocked on that lock, then lets them all go at once. Turns "two taps at the same moment" from
// a lucky timing into a certainty.
async function queuedBehindPoolLock<T>(poolId: string, waiters: number, start: () => PromiseLike<T>[]) {
  let pending: Promise<T>[] = [];
  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM pools WHERE id = ${poolId}::uuid FOR UPDATE`;
      pending = start().map((p) => Promise.resolve(p));
      for (let i = 0; i < 250; i++) {
        const [row] = await prisma.$queryRaw<{ n: number }[]>`
          SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'`;
        if ((row?.n ?? 0) >= waiters) return;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw new Error(`only some requests reached the lock`);
    },
    { timeout: 10_000 },
  );
  return Promise.all(pending);
}

const passenger = (body: { activePool: { passengers: { name: string }[] } }, name: string) =>
  body.activePool.passengers.find((p) => p.name === name);

describe('dropping passengers off one by one', () => {
  it('lets Nusrat off at Mohakhali while Rafiq rides on, then ends the trip when Rafiq is off', async () => {
    const { jashim, nusrat, rafiq, nusratRideId, rafiqRideId } = await pooledTripUnderway();

    const afterNusrat = await jashim.post(`/api/driver/rides/${nusratRideId}/drop-off`).expect(200);
    expect(afterNusrat.body.activePool.status).toBe('STARTED');
    expect(passenger(afterNusrat.body, 'Nusrat')).toMatchObject({
      status: 'COMPLETED',
      droppedOff: { code: 'MOHAKHALI', name: 'Mohakhali' },
      farePaisa: 5250,
    });
    expect(passenger(afterNusrat.body, 'Rafiq')).toMatchObject({ status: 'STARTED' });

    // Nusrat sees her ride finished at the fare fixed at the start.
    const nusratsRide = (await nusrat.agent.get(`/api/rides/${nusratRideId}`)).body.ride;
    expect(nusratsRide).toMatchObject({ status: 'COMPLETED', droppedOff: { code: 'MOHAKHALI' }, fare: { farePaisa: 5250 } });
    expect(nusratsRide.completedAt).toBeTruthy();

    // Last passenger off: the trip completes by itself and Bullet is free.
    const afterRafiq = await jashim.post(`/api/driver/rides/${rafiqRideId}/drop-off`).expect(200);
    expect(afterRafiq.body.activePool).toBeNull();
    expect((await rafiq.agent.get(`/api/rides/${rafiqRideId}`)).body.ride.status).toBe('COMPLETED');

    const history = await jashim.get('/api/driver/pools').expect(200);
    expect(history.body.pools[0]).toMatchObject({ status: 'COMPLETED', totalFarePaisa: 12000 });
    await jashim.post('/api/driver/offline').expect(200);
  });

  it("offers the areas on each passenger's way as early stops, nearest first", async () => {
    const { jashim } = await pooledTripUnderway();
    const me = (await jashim.get('/api/driver/me')).body;

    // Banani → Gulshan 1 passes Gulshan 2 (1 km) and Mohakhali (2 km).
    expect(passenger(me, 'Rafiq')).toMatchObject({
      stopsOnTheWay: [
        { code: 'GULSHAN_2', name: 'Gulshan 2' },
        { code: 'MOHAKHALI', name: 'Mohakhali' },
      ],
    });
    // Banani → Mohakhali has nothing in between: only "Reached".
    expect(passenger(me, 'Nusrat')).toMatchObject({ stopsOnTheWay: [] });
  });

  it('still lets Jashim end the trip in one go, dropping everyone at their destination', async () => {
    const { jashim, nusrat, nusratRideId } = await pooledTripUnderway();
    await jashim.post('/api/driver/pool/complete').expect(200);
    const ride = (await nusrat.agent.get(`/api/rides/${nusratRideId}`)).body.ride;
    expect(ride).toMatchObject({ status: 'COMPLETED', droppedOff: { code: 'MOHAKHALI' } });
  });
});

describe('getting off early', () => {
  it('charges Rafiq only for the part he rode, keeping his pool discount', async () => {
    const { jashim, rafiq, rafiqRideId } = await pooledTripUnderway();

    // Booked to Gulshan 1 (3 km, ৳67.50 shared). He gets off at Mohakhali: 2 km, shared = ৳52.50.
    await jashim.post(`/api/driver/rides/${rafiqRideId}/drop-off`).send({ zone: 'MOHAKHALI' }).expect(200);

    const ride = (await rafiq.agent.get(`/api/rides/${rafiqRideId}`)).body.ride;
    expect(ride).toMatchObject({
      status: 'COMPLETED',
      dropoff: { code: 'GULSHAN_1' }, // what he booked
      droppedOff: { code: 'MOHAKHALI', name: 'Mohakhali' }, // where he actually got off
      distanceM: 2000,
      fare: { subtotalPaisa: 7000, poolDiscountPaisa: 1750, farePaisa: 5250 },
    });

    // The audit trail keeps what he had booked, in case he disputes it. (Passengers see the
    // timeline without event data; support reads it here.)
    const events = (await rafiq.agent.get(`/api/rides/${rafiqRideId}/events`)).body.events;
    expect(events.at(-1).type).toBe('PASSENGER_DROPPED_OFF');
    expect(await lastEvent(rafiqRideId)).toMatchObject({
      type: 'PASSENGER_DROPPED_OFF',
      data: { at: 'MOHAKHALI', early: true, bookedTo: 'GULSHAN_1', bookedFarePaisa: 6750, farePaisa: 5250 },
    });
  });

  it('works for a solo rider too, and the trip ends with him', async () => {
    const { jashim, rafiq, rafiqRideId } = await soloTripUnderway();

    // Alone to Gulshan 1 would be ৳90; off at Gulshan 2 after 1 km: ৳30 + ৳20 = ৳50.
    const res = await jashim.post(`/api/driver/rides/${rafiqRideId}/drop-off`).send({ zone: 'GULSHAN_2' }).expect(200);
    expect(res.body.activePool).toBeNull();

    const ride = (await rafiq.agent.get(`/api/rides/${rafiqRideId}`)).body.ride;
    expect(ride.fare).toMatchObject({ subtotalPaisa: 5000, poolDiscountPaisa: 0, farePaisa: 5000 });

    // Both of them are free to go again.
    await requestRide(rafiq.agent, 'MOHAKHALI').then((r) => expect(r.status).toBe(201));
  });

  it('only accepts an area on the way, never one off the route or his own starting point', async () => {
    const { jashim, rafiqRideId } = await pooledTripUnderway();
    for (const zone of ['UTTARA', 'BANANI', 'NOWHERE']) {
      const res = await jashim.post(`/api/driver/rides/${rafiqRideId}/drop-off`).send({ zone }).expect(400);
      expect(res.body.error.code).toBe('NOT_ON_THE_WAY');
    }
    expect((await prisma.rideRequest.findUniqueOrThrow({ where: { id: rafiqRideId } })).status).toBe('STARTED');
  });
});

describe('drop-off rules and races', () => {
  it('refuses to drop off anyone before the trip has started', async () => {
    const jashim = await jashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const n = await requestRide(nusrat.agent, 'MOHAKHALI');
    await jashim.post(`/api/driver/requests/${n.body.ride.id}/accept`).expect(200);

    const res = await jashim.post(`/api/driver/rides/${n.body.ride.id}/drop-off`).expect(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it("won't let a driver drop off a passenger from someone else's trip", async () => {
    const { rafiqRideId } = await pooledTripUnderway();
    await createDriver('Karim', { name: 'Toofan', plate: 'DHAKA-TESLA-02', capacity: 3 }, { online: true });
    const shirin = await signUpPassenger('Shirin');
    const karim = await logIn('karim@teslapool.test');
    const s = await requestRide(shirin.agent, 'MIRPUR');
    await karim.post(`/api/driver/requests/${s.body.ride.id}/accept`).expect(200);
    await karim.post('/api/driver/pool/arrive').expect(200);
    await karim.post('/api/driver/pool/start').expect(200);

    await karim.post(`/api/driver/rides/${rafiqRideId}/drop-off`).expect(404);
    expect((await prisma.rideRequest.findUniqueOrThrow({ where: { id: rafiqRideId } })).status).toBe('STARTED');
  });

  it('drops a passenger off exactly once when the button is tapped twice', async () => {
    const { jashim, nusratRideId } = await pooledTripUnderway();
    const pool = await prisma.pool.findFirstOrThrow();
    // Worst case, made certain: both taps have already checked "is Nusrat riding?" (yes) and are
    // queued on the trip lock before either one drops her off.
    const [a, b] = await queuedBehindPoolLock(pool.id, 2, () => [
      jashim.post(`/api/driver/rides/${nusratRideId}/drop-off`),
      jashim.post(`/api/driver/rides/${nusratRideId}/drop-off`),
    ]);
    expect([a!.status, b!.status].sort()).toEqual([200, 409]);
    expect(await prisma.rideEvent.count({ where: { type: 'PASSENGER_DROPPED_OFF', rideRequestId: nusratRideId } })).toBe(1);
  });

  it('completes the trip exactly once when the last two passengers are dropped at the same moment', async () => {
    const { jashim, nusratRideId, rafiqRideId } = await pooledTripUnderway();
    const results = await Promise.all([
      jashim.post(`/api/driver/rides/${nusratRideId}/drop-off`),
      jashim.post(`/api/driver/rides/${rafiqRideId}/drop-off`),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await prisma.pool.findFirstOrThrow()).toMatchObject({ status: 'COMPLETED' });
    expect(await prisma.rideEvent.count({ where: { type: 'TRIP_COMPLETED', rideRequestId: null } })).toBe(1);
  });
});

describe('Bullet breaks down', () => {
  it('mid-trip: Rafiq, still on board, pays nothing; Nusrat, already dropped, keeps her fare', async () => {
    const { jashim, nusrat, rafiq, nusratRideId, rafiqRideId } = await pooledTripUnderway();
    await jashim.post(`/api/driver/rides/${nusratRideId}/drop-off`).expect(200);

    const res = await jashim.post('/api/driver/pool/breakdown').send({ reason: 'FLAT_TYRE' }).expect(200);
    expect(res.body.activePool).toBeNull();
    // Bullet is taken off the road, so nobody else is sent to it.
    expect(res.body.vehicle.isOnline).toBe(false);

    const rafiqsRide = (await rafiq.agent.get(`/api/rides/${rafiqRideId}`)).body.ride;
    expect(rafiqsRide).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'The Tesla broke down (flat tyre)',
      fare: { farePaisa: 0 },
    });
    const nusratsRide = (await nusrat.agent.get(`/api/rides/${nusratRideId}`)).body.ride;
    expect(nusratsRide).toMatchObject({ status: 'COMPLETED', fare: { farePaisa: 5250 } });

    const history = (await jashim.get('/api/driver/pools')).body.pools[0];
    expect(history).toMatchObject({ status: 'CANCELLED', totalFarePaisa: 5250 });

    // Rafiq can book another Tesla straight away, from wherever he is now.
    await requestRide(rafiq.agent, 'GULSHAN_1', 1, 'MOHAKHALI').then((r) => expect(r.status).toBe(201));
    // And Jashim goes online again once the tyre is fixed.
    await jashim.post('/api/driver/online').expect(200);
  });

  it('before pick-up: waiting passengers are released and can book again, Bullet goes offline', async () => {
    const jashim = await jashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const n = await requestRide(nusrat.agent, 'MOHAKHALI');
    await jashim.post(`/api/driver/requests/${n.body.ride.id}/accept`).expect(200);

    const res = await jashim.post('/api/driver/pool/breakdown').send({ reason: 'BATTERY' }).expect(200);
    expect(res.body.vehicle.isOnline).toBe(false);

    const ride = (await nusrat.agent.get(`/api/rides/${n.body.ride.id}`)).body.ride;
    // Never charged: the fare was never fixed.
    expect(ride).toMatchObject({ status: 'CANCELLED', cancelReason: 'The Tesla broke down (battery)', fare: { farePaisa: null } });
    await requestRide(nusrat.agent, 'MOHAKHALI').then((r) => expect(r.status).toBe(201));
  });

  it('is recorded in the ride timeline with the reason', async () => {
    const { jashim, rafiq, rafiqRideId } = await soloTripUnderway();
    await jashim.post('/api/driver/pool/breakdown').send({ reason: 'OTHER' }).expect(200);

    const events = (await rafiq.agent.get(`/api/rides/${rafiqRideId}/events`)).body.events;
    expect(events.at(-1).type).toBe('TESLA_BROKE_DOWN');
    expect(await lastEvent(rafiqRideId)).toMatchObject({
      type: 'TESLA_BROKE_DOWN',
      fromStatus: 'STARTED',
      toStatus: 'CANCELLED',
      data: { reason: 'OTHER', waivedFarePaisa: 9000 },
    });
  });

  it('never charges and waives the same passenger when a drop-off and a breakdown land together', async () => {
    const { jashim, rafiqRideId } = await pooledTripUnderway();
    const [drop] = await Promise.all([
      jashim.post(`/api/driver/rides/${rafiqRideId}/drop-off`),
      jashim.post('/api/driver/pool/breakdown').send({ reason: 'FLAT_TYRE' }),
    ]);

    const rafiqsRide = await prisma.rideRequest.findUniqueOrThrow({ where: { id: rafiqRideId } });
    if (drop.status === 200) {
      // The drop-off got in first: Rafiq paid his fare, the breakdown released only Nusrat.
      expect(rafiqsRide).toMatchObject({ status: 'COMPLETED', farePaisa: 6750 });
    } else {
      expect([404, 409]).toContain(drop.status);
      expect(rafiqsRide).toMatchObject({ status: 'CANCELLED', farePaisa: 0 });
    }
    expect(await prisma.pool.findFirstOrThrow()).toMatchObject({ status: 'CANCELLED' });
    expect(await prisma.rideEvent.count({ where: { rideRequestId: rafiqRideId, toStatus: { in: ['COMPLETED', 'CANCELLED'] } } })).toBe(1);
  });

  it('is reported exactly once when Jashim taps it twice', async () => {
    const { jashim } = await soloTripUnderway();
    const pool = await prisma.pool.findFirstOrThrow();
    const [a, b] = await queuedBehindPoolLock(pool.id, 2, () => [
      jashim.post('/api/driver/pool/breakdown').send({ reason: 'FLAT_TYRE' }),
      jashim.post('/api/driver/pool/breakdown').send({ reason: 'FLAT_TYRE' }),
    ]);
    expect([a!.status, b!.status].sort()).toEqual([200, 409]);
    expect(await prisma.rideEvent.count({ where: { type: 'TESLA_BROKE_DOWN', rideRequestId: null } })).toBe(1);
  });

  it('needs a reason from the list and an active trip', async () => {
    const { jashim } = await soloTripUnderway();
    await jashim.post('/api/driver/pool/breakdown').send({ reason: 'BORED' }).expect(400);
    await jashim.post('/api/driver/pool/breakdown').send({ reason: 'BATTERY' }).expect(200);
    await jashim.post('/api/driver/pool/breakdown').send({ reason: 'BATTERY' }).expect(404);
  });

  it('is the only way to stop a started trip early: a plain cancel is still refused', async () => {
    const { jashim } = await soloTripUnderway();
    const res = await jashim.post('/api/driver/pool/cancel').expect(409);
    expect(res.body.error.message).toMatch(/report a breakdown/);
  });
});
