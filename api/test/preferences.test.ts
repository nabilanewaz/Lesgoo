import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { getRequestFeed } from '../src/modules/driver/driver.service';
import { acceptRequest, transitionPool } from '../src/modules/pools/pools.service';
import { createJashimOnline, resetDb, signUpPassenger } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

type Agent = Awaited<ReturnType<typeof signUpPassenger>>['agent'];
const book = (agent: Agent, dropoffZone: string, prefs: { shareRide?: boolean; sameGenderOnly?: boolean } = {}) =>
  agent.post('/api/rides').send({ pickupZone: 'BANANI', dropoffZone, seats: 1, ...prefs });

const poolOf = (vehicleId: string) =>
  prisma.pool.findFirstOrThrow({ where: { vehicleId }, orderBy: { createdAt: 'desc' }, include: { members: true } });

describe('riding alone', () => {
  it('keeps Nusrat alone in Bullet: Rafiq is neither auto-matched nor acceptable, and she pays full fare', async () => {
    const jashim = await createJashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');

    const n = await book(nusrat.agent, 'MOHAKHALI', { shareRide: false }).expect(201);
    expect(n.body.ride).toMatchObject({ shareRide: false, fare: { pooledEstimatePaisa: null } });
    await acceptRequest(jashim.id, n.body.ride.id);

    const r = await book(rafiq.agent, 'GULSHAN_1').expect(201);
    expect(r.body.ride.status).toBe('REQUESTED');
    await expect(acceptRequest(jashim.id, r.body.ride.id)).rejects.toMatchObject({ code: 'RIDING_ALONE' });
    expect((await poolOf(jashim.vehicle.id)).members).toHaveLength(1);

    await transitionPool(jashim.id, 'DRIVER_ARRIVED');
    await transitionPool(jashim.id, 'STARTED');
    const ride = await prisma.rideRequest.findUniqueOrThrow({ where: { id: n.body.ride.id } });
    expect(ride).toMatchObject({ poolDiscountPaisa: 0, farePaisa: 7000 });
  });

  it('holds under a race: two simultaneous accepts never put anyone in with a solo rider', async () => {
    const jashim = await createJashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');
    const n = await book(nusrat.agent, 'MOHAKHALI', { shareRide: false }).expect(201);
    const r = await book(rafiq.agent, 'GULSHAN_1').expect(201);

    await Promise.allSettled([acceptRequest(jashim.id, n.body.ride.id), acceptRequest(jashim.id, r.body.ride.id)]);
    expect((await poolOf(jashim.vehicle.id)).members).toHaveLength(1);
  });
});

describe('same-gender rides', () => {
  it('women-only: Shirin joins Nusrat automatically, Rafiq is kept out everywhere', async () => {
    const jashim = await createJashimOnline();
    const nusrat = await signUpPassenger('Nusrat'); // woman
    const rafiq = await signUpPassenger('Rafiq'); // man
    const shirin = await signUpPassenger('Shirin'); // woman

    const n = await book(nusrat.agent, 'MOHAKHALI', { sameGenderOnly: true }).expect(201);
    await acceptRequest(jashim.id, n.body.ride.id);

    // Rafiq: not auto-matched, not in Jashim's feed, and refused if accepted anyway.
    const r = await book(rafiq.agent, 'GULSHAN_1').expect(201);
    expect(r.body.ride.status).toBe('REQUESTED');
    expect((await getRequestFeed(jashim.id)).map((f) => f.passengerName)).not.toContain('Rafiq');
    await expect(acceptRequest(jashim.id, r.body.ride.id)).rejects.toMatchObject({ code: 'SAME_GENDER_ONLY' });

    // Shirin: the system can honour the request itself, so she joins instantly.
    const s = await book(shirin.agent, 'MOHAKHALI').expect(201);
    expect(s.body.ride.status).toBe('MATCHED');
  });

  it('if Jashim takes Rafiq first, women-only Nusrat drops out of his feed and can never be added', async () => {
    const jashim = await createJashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');
    const n = await book(nusrat.agent, 'MOHAKHALI', { sameGenderOnly: true }).expect(201);
    const r = await book(rafiq.agent, 'GULSHAN_1').expect(201);

    // No trip yet: Jashim sees both.
    expect((await getRequestFeed(jashim.id)).map((f) => f.passengerName).sort()).toEqual(['Nusrat', 'Rafiq']);

    // He picks Rafiq first. Nusrat's request can't be met in this Tesla any more...
    await acceptRequest(jashim.id, r.body.ride.id);
    expect((await getRequestFeed(jashim.id)).map((f) => f.passengerName)).toEqual([]);
    await expect(acceptRequest(jashim.id, n.body.ride.id)).rejects.toMatchObject({ code: 'SAME_GENDER_ONLY' });

    // ...so she is never put with a man. She keeps waiting for another Tesla.
    const view = await nusrat.agent.get(`/api/rides/${n.body.ride.id}`).expect(200);
    expect(view.body.ride).toMatchObject({ status: 'REQUESTED', pool: null });
  });

  it('auto-add OFF: Nusrat shares with anyone, reappears for Jashim, he picks her, she sees a man on board', async () => {
    const jashim = await createJashimOnline();
    await prisma.vehicle.update({ where: { id: jashim.vehicle.id }, data: { autoAccept: false } });
    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');
    const r = await book(rafiq.agent, 'GULSHAN_1').expect(201);
    await acceptRequest(jashim.id, r.body.ride.id);
    const n = await book(nusrat.agent, 'MOHAKHALI', { sameGenderOnly: true }).expect(201);
    expect(n.body.ride.status).toBe('REQUESTED'); // Bullet has a man on board...
    expect((await getRequestFeed(jashim.id)).map((f) => f.passengerName)).not.toContain('Nusrat'); // ...so Jashim can't see her

    // She relaxes her preference. Jashim picks his riders himself, so she waits in his feed.
    const relaxed = await nusrat.agent.post(`/api/rides/${n.body.ride.id}/share-with-anyone`).expect(200);
    expect(relaxed.body.ride).toMatchObject({ sameGenderOnly: false, status: 'REQUESTED', pool: null });

    // She now appears in Jashim's feed, and he picks her.
    const feed = await getRequestFeed(jashim.id);
    expect(feed.map((f) => f.passengerName)).toContain('Nusrat');
    await acceptRequest(jashim.id, n.body.ride.id);

    // She can see she's sharing with a man (and nothing else about him).
    const view = await nusrat.agent.get(`/api/rides/${n.body.ride.id}`).expect(200);
    expect(view.body.ride).toMatchObject({ status: 'MATCHED', pool: { coRiderGenders: ['MAN'] } });

    const events = await nusrat.agent.get(`/api/rides/${n.body.ride.id}/events`).expect(200);
    expect(events.body.events.map((e: { type: string }) => e.type)).toEqual(['RIDE_REQUESTED', 'PREFERENCE_CHANGED', 'RIDE_MATCHED']);
  });

  it('auto-add ON (default): after sharing with anyone she joins straight away, like any sharer', async () => {
    const jashim = await createJashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');
    const r = await book(rafiq.agent, 'GULSHAN_1').expect(201);
    await acceptRequest(jashim.id, r.body.ride.id);
    const n = await book(nusrat.agent, 'MOHAKHALI', { sameGenderOnly: true }).expect(201);
    expect(n.body.ride.status).toBe('REQUESTED');

    const relaxed = await nusrat.agent.post(`/api/rides/${n.body.ride.id}/share-with-anyone`).expect(200);
    expect(relaxed.body.ride).toMatchObject({ status: 'MATCHED', pool: { coRiderGenders: ['MAN'] } });
  });

  it('only relaxes her own waiting same-gender ride', async () => {
    const jashim = await createJashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const shirin = await signUpPassenger('Shirin');
    const n = await book(nusrat.agent, 'MOHAKHALI', { sameGenderOnly: true }).expect(201);

    await shirin.agent.post(`/api/rides/${n.body.ride.id}/share-with-anyone`).expect(404); // not hers

    await acceptRequest(jashim.id, n.body.ride.id); // now MATCHED
    const late = await nusrat.agent.post(`/api/rides/${n.body.ride.id}/share-with-anyone`).expect(409);
    expect(late.body.error.code).toBe('INVALID_TRANSITION');

  });

  it('refuses when there is nothing to relax', async () => {
    const shirin = await signUpPassenger('Shirin');
    const s = await book(shirin.agent, 'MOHAKHALI').expect(201); // plain sharer, no Tesla around
    expect(s.body.ride.status).toBe('REQUESTED');

    const res = await shirin.agent.post(`/api/rides/${s.body.ride.id}/share-with-anyone`).expect(409);
    expect(res.body.error.code).toBe('NOTHING_TO_CHANGE');
  });

  it('men-only works the same way for Rafiq', async () => {
    const jashim = await createJashimOnline();
    const rafiq = await signUpPassenger('Rafiq');
    const nusrat = await signUpPassenger('Nusrat');

    const r = await book(rafiq.agent, 'GULSHAN_1', { sameGenderOnly: true }).expect(201);
    await acceptRequest(jashim.id, r.body.ride.id);

    const n = await book(nusrat.agent, 'MOHAKHALI').expect(201);
    expect(n.body.ride.status).toBe('REQUESTED');
    await expect(acceptRequest(jashim.id, n.body.ride.id)).rejects.toMatchObject({ code: 'SAME_GENDER_ONLY' });
  });

  it('shows co-riders their genders only: never names or destinations', async () => {
    const jashim = await createJashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');

    const n = await book(nusrat.agent, 'MOHAKHALI').expect(201);
    await acceptRequest(jashim.id, n.body.ride.id);
    await book(rafiq.agent, 'GULSHAN_1').expect(201); // auto-matched: nobody asked for same-gender

    const view = await nusrat.agent.get(`/api/rides/${n.body.ride.id}`).expect(200);
    expect(view.body.ride.pool).toMatchObject({ sharedWith: 1, coRiderGenders: ['MAN'] });
    const body = JSON.stringify(view.body);
    expect(body).not.toContain('Rafiq');
    expect(body).not.toContain('GULSHAN_1');

    // Nusrat isn't comfortable: she can still cancel before the trip starts.
    await nusrat.agent.post(`/api/rides/${n.body.ride.id}/cancel`).send({ reason: 'Not comfortable' }).expect(200);
  });

  it('holds under a race: a women-only rider and a man accepted at once never end up together', async () => {
    const jashim = await createJashimOnline();
    const nusrat = await signUpPassenger('Nusrat');
    const rafiq = await signUpPassenger('Rafiq');
    const n = await book(nusrat.agent, 'MOHAKHALI', { sameGenderOnly: true }).expect(201);
    const r = await book(rafiq.agent, 'GULSHAN_1').expect(201);

    await Promise.allSettled([acceptRequest(jashim.id, n.body.ride.id), acceptRequest(jashim.id, r.body.ride.id)]);
    expect((await poolOf(jashim.vehicle.id)).members).toHaveLength(1);
  });

  it('is only available to riders who declared a gender, and only when sharing', async () => {
    const quiet = await signUpPassenger('Commuter1'); // prefer not to say
    const a = await book(quiet.agent, 'MOHAKHALI', { sameGenderOnly: true }).expect(400);
    expect(a.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'sameGenderOnly' })]));

    const nusrat = await signUpPassenger('Nusrat');
    await book(nusrat.agent, 'MOHAKHALI', { shareRide: false, sameGenderOnly: true }).expect(400);
  });
});
