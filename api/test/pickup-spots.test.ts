import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, createDriver, logIn, resetDb, signUpPassenger } from './helpers';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

// Pickup and drop-off spots (DESIGN.md §3): landmarks inside each area. Grid positions used below
// (metres, Kakoli = 0,0): Gulshan 2 Circle (1000, 0), Pink City (1110, -270), Chairman Bari
// (-50, -680), Amtoli (0, -2000).

async function jashimOnline() {
  await createDriver();
  const jashim = await logIn('jashim@teslapool.test');
  await jashim.post('/api/driver/online').expect(200);
  return jashim;
}

type Agent = Awaited<ReturnType<typeof signUpPassenger>>['agent'];
const book = (agent: Agent, pickupSpot: string, dropoffSpot: string) =>
  agent.post('/api/rides').send({ pickupSpot, dropoffSpot, seats: 1 });

describe('the list of spots', () => {
  it('gives every area its landmarks, main spot first, in Bangla and English with map coordinates', async () => {
    const res = await request(app).get('/api/zones').expect(200);
    const zones = res.body.zones as { code: string; spots: { code: string; isMain: boolean }[] }[];

    expect(zones.flatMap((z) => z.spots)).toHaveLength(30);
    for (const zone of zones) {
      expect(zone.spots.filter((s) => s.isMain)).toHaveLength(1);
      expect(zone.spots[0]!.isMain).toBe(true);
    }
    const banani = zones.find((z) => z.code === 'BANANI')!;
    expect(banani.spots[0]).toEqual({
      code: 'BANANI_KAKOLI',
      name: 'Kakoli bus stop',
      nameBn: 'কাকলী',
      lat: 23.79432,
      lon: 90.40145,
      isMain: true,
    });
  });
});

describe('fares from exact spots', () => {
  it('prices Chairman Bari → Amtoli by its real distance: 1.37 km, ৳58 alone, ৳43.50 shared', async () => {
    const res = await request(app)
      .get('/api/rides/estimate')
      .query({ pickupSpot: 'BANANI_CHAIRMAN_BARI', dropoffSpot: 'MOHAKHALI_AMTOLI' })
      .expect(200);
    expect(res.body.estimate).toMatchObject({
      pickup: { code: 'BANANI', spot: { code: 'BANANI_CHAIRMAN_BARI', nameBn: 'চেয়ারম্যান বাড়ি' } },
      dropoff: { code: 'MOHAKHALI', spot: { code: 'MOHAKHALI_AMTOLI' } },
      solo: { distanceM: 1370, farePaisa: 5800 },
      pooled: { farePaisa: 4350 },
    });
  });

  it('keeps the story fare when only areas are given: they mean the main spots', async () => {
    const res = await request(app).get('/api/rides/estimate').query({ pickupZone: 'BANANI', dropoffZone: 'MOHAKHALI' });
    expect(res.body.estimate).toMatchObject({
      pickup: { spot: { code: 'BANANI_KAKOLI' } },
      solo: { distanceM: 2000, farePaisa: 7000 },
      pooled: { farePaisa: 5250 },
    });
  });

  it('books from a spot and shows it on the ride', async () => {
    const { agent } = await signUpPassenger('Nusrat');
    const res = await book(agent, 'BANANI_CHAIRMAN_BARI', 'MOHAKHALI_AMTOLI').expect(201);
    expect(res.body.ride).toMatchObject({
      pickup: { code: 'BANANI', name: 'Banani', spot: { code: 'BANANI_CHAIRMAN_BARI', name: 'Chairman Bari' } },
      dropoff: { code: 'MOHAKHALI', spot: { code: 'MOHAKHALI_AMTOLI', nameBn: 'আমতলী' } },
      distanceM: 1370,
      fare: { subtotalPaisa: 5800 },
    });
  });

  it('rejects an unknown spot, a spot outside the area given, and a trip inside one area', async () => {
    const { agent } = await signUpPassenger('Rafiq');
    await book(agent, 'BANANI_NOWHERE', 'MOHAKHALI_AMTOLI').expect(400);
    await agent.post('/api/rides').send({ pickupZone: 'GULSHAN_2', pickupSpot: 'BANANI_KAKOLI', dropoffZone: 'MOHAKHALI' }).expect(400);
    const same = await book(agent, 'BANANI_KAKOLI', 'BANANI_CHAIRMAN_BARI').expect(400);
    expect(same.body.error.message).toBe('Pickup and destination must be in different areas');
    await agent.post('/api/rides').send({ dropoffZone: 'MOHAKHALI' }).expect(400); // no pickup at all
  });
});

describe('meeting the Tesla', () => {
  it("makes the first rider's spot the trip's meeting spot, with directions for the driver", async () => {
    const jashim = await jashimOnline();
    const { agent: shirin } = await signUpPassenger('Shirin');
    const s = await book(shirin, 'GULSHAN_2_CIRCLE', 'MOHAKHALI_AMTOLI');
    await jashim.post(`/api/driver/requests/${s.body.ride.id}/accept`).expect(200);

    const me = (await jashim.get('/api/driver/me')).body;
    expect(me.activePool.meetingSpot).toEqual({
      code: 'GULSHAN_2_CIRCLE',
      name: 'Gulshan 2 Circle',
      nameBn: 'গুলশান ২ গোলচত্বর',
      lat: 23.79475,
      lon: 90.41462,
    });
    const ride = (await shirin.get(`/api/rides/${s.body.ride.id}`)).body.ride;
    expect(ride.pool.meetingSpot).toMatchObject({ code: 'GULSHAN_2_CIRCLE' });
  });

  it('adds Nusrat from Pink City (380 m away) and never charges more than she was quoted', async () => {
    const jashim = await jashimOnline();
    const { agent: shirin } = await signUpPassenger('Shirin');
    const { agent: nusrat } = await signUpPassenger('Nusrat');
    const s = await book(shirin, 'GULSHAN_2_CIRCLE', 'MOHAKHALI_AMTOLI');
    await jashim.post(`/api/driver/requests/${s.body.ride.id}/accept`).expect(200);

    // Pink City → Amtoli is 2.84 km (৳88). From the circle it would be 3 km (৳90): she keeps ৳88.
    const n = await book(nusrat, 'GULSHAN_2_PINK_CITY', 'MOHAKHALI_AMTOLI').expect(201);
    expect(n.body.ride).toMatchObject({
      status: 'MATCHED',
      pool: { meetingSpot: { code: 'GULSHAN_2_CIRCLE', name: 'Gulshan 2 Circle' } },
      fare: { subtotalPaisa: 8800 },
    });
    const matched = await prisma.rideEvent.findFirstOrThrow({ where: { rideRequestId: n.body.ride.id, type: 'RIDE_MATCHED' } });
    expect(matched.data).toMatchObject({ meetingSpot: 'GULSHAN_2_CIRCLE', walkM: 380, quotedSubtotalPaisa: 8800, subtotalPaisa: 8800 });
  });

  it('passes the saving on when the meeting spot is nearer to her destination', async () => {
    const jashim = await jashimOnline();
    const { agent: nusrat } = await signUpPassenger('Nusrat');
    const { agent: shirin } = await signUpPassenger('Shirin');
    const n = await book(nusrat, 'GULSHAN_2_PINK_CITY', 'MOHAKHALI_AMTOLI');
    await jashim.post(`/api/driver/requests/${n.body.ride.id}/accept`).expect(200);

    // Shirin was quoted ৳90 from the circle; she's picked up at Pink City, 2.84 km out: ৳88.
    const s = await book(shirin, 'GULSHAN_2_CIRCLE', 'MOHAKHALI_AMTOLI').expect(201);
    expect(s.body.ride).toMatchObject({ status: 'MATCHED', distanceM: 2840, fare: { subtotalPaisa: 8800 } });
  });

  it('keeps a rider more than a short walk away out of the trip: Chairman Bari is 730 m from Kakoli', async () => {
    const jashim = await jashimOnline();
    const { agent: nusrat } = await signUpPassenger('Nusrat');
    const { agent: rafiq } = await signUpPassenger('Rafiq');
    const n = await book(nusrat, 'BANANI_KAKOLI', 'MOHAKHALI_AMTOLI');
    await jashim.post(`/api/driver/requests/${n.body.ride.id}/accept`).expect(200);

    const r = await book(rafiq, 'BANANI_CHAIRMAN_BARI', 'GULSHAN_1_CIRCLE').expect(201);
    expect(r.body.ride.status).toBe('REQUESTED'); // not auto-added

    const feed = (await jashim.get('/api/driver/requests')).body.requests as { rideId: string }[];
    expect(feed.map((x) => x.rideId)).not.toContain(r.body.ride.id);
    const accept = await jashim.post(`/api/driver/requests/${r.body.ride.id}/accept`).expect(409);
    expect(accept.body.error.code).toBe('PICKUP_TOO_FAR');
  });

  it('shows the driver each waiting rider’s exact pickup and destination spots', async () => {
    const jashim = await jashimOnline();
    const { agent: rafiq } = await signUpPassenger('Rafiq');
    await book(rafiq, 'BANANI_CHAIRMAN_BARI', 'GULSHAN_1_CIRCLE');
    const feed = (await jashim.get('/api/driver/requests')).body.requests;
    expect(feed[0]).toMatchObject({
      pickup: { code: 'BANANI', spot: { nameBn: 'চেয়ারম্যান বাড়ি' } },
      dropoff: { code: 'GULSHAN_1', spot: { name: 'Gulshan 1 Circle' } },
      distanceM: 2370,
    });
  });
});
