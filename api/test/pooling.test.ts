import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { acceptRequest, claimSeats } from '../src/modules/pools/pools.service';
import { createDriver, createJashimOnline, requestRide, resetDb, signUpPassenger } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

// Driver HTTP endpoints arrive with the driver flow; here we call the pool service directly.
const poolOf = (vehicleId: string) =>
  prisma.pool.findFirstOrThrow({ where: { vehicleId }, orderBy: { createdAt: 'desc' } });

describe('the Banani rush-hour story', () => {
  it('pools Nusrat and Rafiq in Bullet, but not Shirin who is heading the other way', async () => {
    const jashim = await createJashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');
    const shirin = await signUpPassenger('Shirin');

    // 8:41 Nusrat books Banani → Mohakhali. No Tesla is on a trip yet, so she waits.
    const n = await requestRide(nusrat.agent, 'MOHAKHALI');
    expect(n.body.ride).toMatchObject({ status: 'REQUESTED', pool: null });

    // Jashim accepts her: Bullet's trip opens.
    await acceptRequest(jashim.id, n.body.ride.id);
    const nusratsRide = await nusrat.agent.get(`/api/rides/${n.body.ride.id}`);
    expect(nusratsRide.body.ride).toMatchObject({
      status: 'MATCHED',
      pool: { status: 'OPEN', vehicle: { name: 'Bullet' }, driver: { name: 'Jashim' }, sharedWith: 0 },
    });

    // 8:43 Rafiq books Banani → Gulshan 1: 1 km from Mohakhali, so he joins Bullet instantly.
    const r = await requestRide(rafiq.agent, 'GULSHAN_1');
    expect(r.body.ride).toMatchObject({ status: 'MATCHED', pool: { vehicle: { name: 'Bullet' }, sharedWith: 1 } });

    // Shirin wants Gulshan 2: 3 km from Nusrat's Mohakhali. Not the same way, so she waits.
    const s = await requestRide(shirin.agent, 'GULSHAN_2');
    expect(s.body.ride).toMatchObject({ status: 'REQUESTED', pool: null });

    const bullet = await poolOf(jashim.vehicle.id);
    expect(bullet.seatsTaken).toBe(2);
  });

  it('shows Rafiq how many people share his Tesla, but not who they are', async () => {
    const jashim = await createJashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');
    const n = await requestRide(nusrat.agent, 'MOHAKHALI');
    await acceptRequest(jashim.id, n.body.ride.id);

    const r = await requestRide(rafiq.agent, 'GULSHAN_1');
    const body = JSON.stringify(r.body);
    expect(r.body.ride.pool.sharedWith).toBe(1);
    expect(body).not.toContain('Nusrat');
    expect(body).not.toContain('MOHAKHALI');
  });
});

describe("Bullet's capacity", () => {
  it('can never be exceeded: a 2-seat request does not fit next to 2 taken seats', async () => {
    const jashim = await createJashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');

    const n = await requestRide(nusrat.agent, 'MOHAKHALI', 2);
    await acceptRequest(jashim.id, n.body.ride.id);

    const r = await requestRide(rafiq.agent, 'GULSHAN_1', 2);
    expect(r.body.ride.status).toBe('REQUESTED'); // not auto-matched

    await expect(acceptRequest(jashim.id, r.body.ride.id)).rejects.toMatchObject({ code: 'POOL_FULL' });
    expect((await poolOf(jashim.vehicle.id)).seatsTaken).toBe(2);
  });

  it('is enforced by the seat claim itself, even when called directly', async () => {
    const jashim = await createJashimOnline();
    const pool = await prisma.pool.create({
      data: { vehicleId: jashim.vehicle.id, pickupZone: 'BANANI', meetingSpotCode: 'BANANI_KAKOLI', capacity: 3, seatsTaken: 2 },
    });

    expect(await prisma.$transaction((tx) => claimSeats(tx, pool.id, 2))).toBe(false);
    expect(await prisma.$transaction((tx) => claimSeats(tx, pool.id, 1))).toBe(true);
    expect(await prisma.$transaction((tx) => claimSeats(tx, pool.id, 1))).toBe(false);
    expect((await prisma.pool.findUniqueOrThrow({ where: { id: pool.id } })).seatsTaken).toBe(3);
  });

  it('is also guarded by the database: a direct overbooking write is rejected', async () => {
    const jashim = await createJashimOnline();
    const pool = await prisma.pool.create({
      data: { vehicleId: jashim.vehicle.id, pickupZone: 'BANANI', meetingSpotCode: 'BANANI_KAKOLI', capacity: 3, seatsTaken: 3 },
    });
    await expect(prisma.pool.update({ where: { id: pool.id }, data: { seatsTaken: 4 } })).rejects.toThrow(
      /pools_seats_taken_check/,
    );
  });
});

describe('the last-seat race (DESIGN.md §8)', () => {
  it('gives Bullet’s last seat to exactly one of Nusrat and Shirin when they book at the same instant', async () => {
    const jashim = await createJashimOnline();
    const rafiq = await signUpPassenger('Rafiq');
    const nusrat = await signUpPassenger('Nusrat');
    const shirin = await signUpPassenger('Shirin');

    // Rafiq takes 2 of Bullet's 3 seats: 1 seat left.
    const r = await requestRide(rafiq.agent, 'GULSHAN_1', 2);
    await acceptRequest(jashim.id, r.body.ride.id);

    // Both see one free seat and press "Request" at the same time.
    const [n, s] = await Promise.all([requestRide(nusrat.agent, 'MOHAKHALI'), requestRide(shirin.agent, 'MOHAKHALI')]);

    const statuses = [n.body.ride.status, s.body.ride.status].sort();
    expect(statuses).toEqual(['MATCHED', 'REQUESTED']); // one got the seat, the other waits
    expect((await poolOf(jashim.vehicle.id)).seatsTaken).toBe(3);
  });

  it('never overbooks under heavy contention: 8 passengers race for 2 seats', async () => {
    const jashim = await createJashimOnline();
    const rafiq = await signUpPassenger('Rafiq');
    const r = await requestRide(rafiq.agent, 'GULSHAN_1');
    await acceptRequest(jashim.id, r.body.ride.id);

    const crowd = await Promise.all(Array.from({ length: 8 }, (_, i) => signUpPassenger(`Commuter${i}`)));
    const results = await Promise.all(crowd.map((p) => requestRide(p.agent, 'MOHAKHALI')));

    const matched = results.filter((res) => res.body.ride.status === 'MATCHED');
    expect(matched).toHaveLength(2);

    const pool = await poolOf(jashim.vehicle.id);
    const seatsInDb = await prisma.rideRequest.aggregate({
      where: { poolId: pool.id, status: 'MATCHED' },
      _sum: { seats: true },
    });
    expect(pool.seatsTaken).toBe(3);
    expect(seatsInDb._sum.seats).toBe(3); // the counter agrees with the actual members
  });

  it('lets only one of two drivers take the same waiting request', async () => {
    const jashim = await createJashimOnline();
    const karim = await createDriver('Karim', { name: 'Toofan', plate: 'DHAKA-TESLA-02', capacity: 3 }, { online: true });
    const nusrat = await signUpPassenger('Nusrat');
    const n = await requestRide(nusrat.agent, 'MOHAKHALI');

    const outcomes = await Promise.allSettled([acceptRequest(jashim.id, n.body.ride.id), acceptRequest(karim.id, n.body.ride.id)]);
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);

    // The loser's transaction rolled back completely: no empty pool left behind.
    const openPools = await prisma.pool.findMany({ where: { status: 'OPEN' } });
    expect(openPools).toHaveLength(1);
    expect(openPools[0]!.seatsTaken).toBe(1);
  });

  it('tells a driver with an out-of-date list that the rider is already taken', async () => {
    const jashim = await createJashimOnline();
    const karim = await createDriver('Karim', { name: 'Toofan', plate: 'DHAKA-TESLA-02', capacity: 3 }, { online: true });
    const nusrat = await signUpPassenger('Nusrat');
    const n = await requestRide(nusrat.agent, 'MOHAKHALI');

    await acceptRequest(jashim.id, n.body.ride.id); // Jashim taps first...
    // ...Karim's screen hasn't refreshed yet, so he taps too.
    await expect(acceptRequest(karim.id, n.body.ride.id)).rejects.toMatchObject({ code: 'RIDE_NOT_AVAILABLE' });

    // Nusrat is with Jashim only, and Karim was left with no trip at all.
    const ride = await prisma.rideRequest.findUniqueOrThrow({ where: { id: n.body.ride.id }, include: { pool: true } });
    expect(ride.pool?.vehicleId).toBe(jashim.vehicle.id);
    expect(await prisma.pool.count({ where: { vehicleId: karim.vehicle.id } })).toBe(0);
    expect(await prisma.rideEvent.count({ where: { rideRequestId: n.body.ride.id, type: 'RIDE_MATCHED' } })).toBe(1);
  });
});

describe('matching rules', () => {
  it('only pools passengers with the same pickup zone', async () => {
    const jashim = await createJashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');
    const n = await requestRide(nusrat.agent, 'MOHAKHALI');
    await acceptRequest(jashim.id, n.body.ride.id);

    // Rafiq from Gulshan 2 to Gulshan 1: nearby destination, but a different pickup. Jashim is
    // told Rafiq is too far from where his riders are meeting him (Kakoli, in Banani).
    const r = await requestRide(rafiq.agent, 'GULSHAN_1', 1, 'GULSHAN_2');
    expect(r.body.ride.status).toBe('REQUESTED');
    await expect(acceptRequest(jashim.id, r.body.ride.id)).rejects.toMatchObject({ code: 'PICKUP_TOO_FAR' });
  });

  it('does not auto-match into a pool whose driver has arrived (the passenger list is locked)', async () => {
    const jashim = await createJashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');
    const n = await requestRide(nusrat.agent, 'MOHAKHALI');
    await acceptRequest(jashim.id, n.body.ride.id);
    await prisma.pool.updateMany({ where: { vehicleId: jashim.vehicle.id }, data: { status: 'DRIVER_ARRIVED' } });

    const r = await requestRide(rafiq.agent, 'GULSHAN_1');
    expect(r.body.ride.status).toBe('REQUESTED');
  });

  it('refuses accepts from an offline driver', async () => {
    const jashim = await createDriver(); // offline
    const nusrat = await signUpPassenger('Nusrat');
    const n = await requestRide(nusrat.agent, 'MOHAKHALI');
    await expect(acceptRequest(jashim.id, n.body.ride.id)).rejects.toMatchObject({ code: 'DRIVER_OFFLINE' });
  });
});

describe('cancelling out of a pool', () => {
  it('gives Rafiq’s seat back so Shirin can take it', async () => {
    const jashim = await createJashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');
    const shirin = await signUpPassenger('Shirin');

    const n = await requestRide(nusrat.agent, 'MOHAKHALI', 2);
    await acceptRequest(jashim.id, n.body.ride.id);
    const r = await requestRide(rafiq.agent, 'GULSHAN_1'); // Bullet is now full
    expect(r.body.ride.status).toBe('MATCHED');

    const blocked = await requestRide(shirin.agent, 'MOHAKHALI');
    expect(blocked.body.ride.status).toBe('REQUESTED');
    await shirin.agent.post(`/api/rides/${blocked.body.ride.id}/cancel`).send({}).expect(200);

    await rafiq.agent.post(`/api/rides/${r.body.ride.id}/cancel`).send({ reason: 'Meeting moved' }).expect(200);
    expect((await poolOf(jashim.vehicle.id)).seatsTaken).toBe(2);

    const retry = await requestRide(shirin.agent, 'MOHAKHALI');
    expect(retry.body.ride.status).toBe('MATCHED');
  });

  it('cancels the pool when the last passenger leaves, freeing Bullet for a new trip', async () => {
    const jashim = await createJashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');

    const n = await requestRide(nusrat.agent, 'MOHAKHALI');
    await acceptRequest(jashim.id, n.body.ride.id);
    await nusrat.agent.post(`/api/rides/${n.body.ride.id}/cancel`).send({}).expect(200);

    const oldPool = await poolOf(jashim.vehicle.id);
    expect(oldPool).toMatchObject({ status: 'CANCELLED', seatsTaken: 0 });

    // Bullet can start a fresh trip for Rafiq, even from a different zone.
    const r = await requestRide(rafiq.agent, 'BANANI', 1, 'GULSHAN_1');
    await acceptRequest(jashim.id, r.body.ride.id);
    expect(await poolOf(jashim.vehicle.id)).toMatchObject({ status: 'OPEN', pickupZone: 'GULSHAN_1' });
  });

  it('records the whole story in the event history', async () => {
    const jashim = await createJashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const n = await requestRide(nusrat.agent, 'MOHAKHALI');
    await acceptRequest(jashim.id, n.body.ride.id);
    await nusrat.agent.post(`/api/rides/${n.body.ride.id}/cancel`).send({}).expect(200);

    const events = await prisma.rideEvent.findMany({ orderBy: { id: 'asc' } });
    expect(events.map((e) => e.type)).toEqual([
      'RIDE_REQUESTED',
      'POOL_OPENED',
      'RIDE_MATCHED',
      'RIDE_CANCELLED',
      'POOL_CANCELLED',
    ]);
  });
});
