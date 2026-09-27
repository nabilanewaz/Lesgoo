import { describe, expect, it } from 'vitest';
import { calculateFare, earlyDropOffFare, estimateFare, poolDiscountPaisa } from '../src/domain/fare';
import { manhattanKm, zonesOnTheWay } from '../src/domain/geo';
import { isCompatible, rankPools } from '../src/domain/matching';
import { canRideTransition, passengerCanCancel } from '../src/domain/ride-status';

const BANANI = { xKm: 0, yKm: 0 };
const MOHAKHALI = { xKm: 0, yKm: -2 };
const GULSHAN_1 = { xKm: 1, yKm: -2 };

describe('distance', () => {
  it('measures the story trips in whole km', () => {
    expect(manhattanKm(BANANI, MOHAKHALI)).toBe(2); // Nusrat
    expect(manhattanKm(BANANI, GULSHAN_1)).toBe(3); // Rafiq
    expect(manhattanKm(MOHAKHALI, GULSHAN_1)).toBe(1); // their destinations: close enough to pool
  });
});

describe('fare (DESIGN.md §5 worked example)', () => {
  it("prices Nusrat's pooled Banani → Mohakhali trip at ৳52.50", () => {
    expect(calculateFare(2, 1, true)).toEqual({
      distanceKm: 2,
      seats: 1,
      baseFarePaisa: 3000,
      distanceChargePaisa: 4000,
      subtotalPaisa: 7000,
      poolDiscountPaisa: 1750,
      farePaisa: 5250,
    });
  });

  it("prices Rafiq's pooled Banani → Gulshan 1 trip at ৳67.50", () => {
    expect(calculateFare(3, 1, true)).toMatchObject({ subtotalPaisa: 9000, poolDiscountPaisa: 2250, farePaisa: 6750 });
  });

  it('charges the full price when nobody shared the Tesla', () => {
    expect(calculateFare(2, 1, false)).toMatchObject({ poolDiscountPaisa: 0, farePaisa: 7000 });
    expect(calculateFare(3, 1, false).farePaisa).toBe(9000);
  });

  it('charges per seat', () => {
    expect(calculateFare(2, 2, false)).toMatchObject({ baseFarePaisa: 6000, distanceChargePaisa: 8000, farePaisa: 14000 });
  });

  it('shows both solo and pooled estimates before booking', () => {
    const estimate = estimateFare(2, 1);
    expect(estimate.solo.farePaisa).toBe(7000);
    expect(estimate.pooled.farePaisa).toBe(5250);
  });

  it('rounds the discount down to whole paisa', () => {
    // 25% of 7003 = 1750.75 → 1750 discount, so the passenger pays 5253 (never a fractional paisa)
    expect(poolDiscountPaisa(7003, true)).toBe(1750);
  });

  it('refuses non-integer inputs instead of producing float money', () => {
    expect(() => calculateFare(2.5, 1, true)).toThrow();
    expect(() => calculateFare(2, 0, true)).toThrow();
  });
});

describe('matching rule (DESIGN.md §4)', () => {
  const GULSHAN_2 = { xKm: 1, yKm: 0 };
  const plain = { shareRide: true, sameGenderOnly: false, gender: 'UNDISCLOSED' as const };
  const sharer = (dropoff: { xKm: number; yKm: number }, pickupZone = 'BANANI') => ({ pickupZone, dropoff, ...plain });
  const member = (dropoff: { xKm: number; yKm: number }) => ({ dropoff, ...plain });
  const poolWithNusrat = { pickupZone: 'BANANI', members: [member(MOHAKHALI)] };

  it('pools Rafiq with Nusrat: same pickup, destinations 1 km apart', () => {
    expect(isCompatible(sharer(GULSHAN_1), poolWithNusrat)).toBe(true);
  });

  it('does not pool Shirin to Gulshan 2: 3 km from Mohakhali', () => {
    expect(isCompatible(sharer(GULSHAN_2), poolWithNusrat)).toBe(false);
  });

  it('does not pool different pickup zones, however close the destinations', () => {
    expect(isCompatible(sharer(MOHAKHALI, 'GULSHAN_2'), poolWithNusrat)).toBe(false);
  });

  it('requires closeness to EVERY member, not just one', () => {
    // Gulshan 2 is 2 km from Gulshan 1 but 3 km from Mohakhali
    const pool = { pickupZone: 'BANANI', members: [member(MOHAKHALI), member(GULSHAN_1)] };
    expect(isCompatible(sharer(GULSHAN_2), pool)).toBe(false);
  });

  it('fills the fullest Tesla first, then the oldest', () => {
    const older = { id: 'older', seatsTaken: 1, createdAt: new Date('2026-09-27T08:40:00') };
    const fuller = { id: 'fuller', seatsTaken: 2, createdAt: new Date('2026-09-27T08:42:00') };
    const newer = { id: 'newer', seatsTaken: 1, createdAt: new Date('2026-09-27T08:43:00') };
    expect(rankPools([newer, older, fuller]).map((p) => p.id)).toEqual(['fuller', 'older', 'newer']);
  });
});

describe('sharing preferences', () => {
  type G = 'WOMAN' | 'MAN' | 'UNDISCLOSED';
  const rider = (gender: G, extra: { shareRide?: boolean; sameGenderOnly?: boolean } = {}) => ({
    pickupZone: 'BANANI',
    dropoff: GULSHAN_1,
    gender,
    shareRide: extra.shareRide ?? true,
    sameGenderOnly: extra.sameGenderOnly ?? false,
  });
  const pool = (...members: ReturnType<typeof rider>[]) => ({
    pickupZone: 'BANANI',
    members: members.map((m) => ({ gender: m.gender, shareRide: m.shareRide, sameGenderOnly: m.sameGenderOnly, dropoff: MOHAKHALI })),
  });
  const womenOnly = rider('WOMAN', { sameGenderOnly: true });
  const menOnly = rider('MAN', { sameGenderOnly: true });

  it('lets a "ride alone" passenger open an empty Tesla but never join an occupied one', () => {
    expect(isCompatible(rider('WOMAN', { shareRide: false }), pool())).toBe(true);
    expect(isCompatible(rider('WOMAN', { shareRide: false }), pool(rider('MAN')))).toBe(false);
  });

  it('never adds anyone to a Tesla with a "ride alone" passenger', () => {
    expect(isCompatible(rider('MAN'), pool(rider('WOMAN', { shareRide: false })))).toBe(false);
  });

  it('women-only: only women join her, and she only joins women', () => {
    expect(isCompatible(rider('WOMAN'), pool(womenOnly))).toBe(true); // Shirin joins Nusrat
    expect(isCompatible(rider('MAN'), pool(womenOnly))).toBe(false); // Rafiq can't
    expect(isCompatible(womenOnly, pool(rider('MAN')))).toBe(false); // she won't join a man
    expect(isCompatible(womenOnly, pool(rider('WOMAN')))).toBe(true);
  });

  it('men-only works the same way, so conservative men have the same choice', () => {
    expect(isCompatible(rider('MAN'), pool(menOnly))).toBe(true);
    expect(isCompatible(rider('WOMAN'), pool(menOnly))).toBe(false);
    expect(isCompatible(menOnly, pool(rider('WOMAN')))).toBe(false);
  });

  it('an undisclosed gender never satisfies a same-gender request', () => {
    expect(isCompatible(rider('UNDISCLOSED'), pool(womenOnly))).toBe(false);
    expect(isCompatible(womenOnly, pool(rider('UNDISCLOSED')))).toBe(false);
  });

  it('leaves ordinary sharers unaffected, whatever their gender', () => {
    expect(isCompatible(rider('MAN'), pool(rider('WOMAN')))).toBe(true);
    expect(isCompatible(rider('UNDISCLOSED'), pool(rider('MAN')))).toBe(true);
  });
});

describe('ride state machine', () => {
  it('allows the happy path and cancellation before the trip starts', () => {
    expect(canRideTransition('REQUESTED', 'MATCHED')).toBe(true);
    expect(canRideTransition('MATCHED', 'DRIVER_ARRIVED')).toBe(true);
    expect(canRideTransition('DRIVER_ARRIVED', 'STARTED')).toBe(true);
    expect(canRideTransition('STARTED', 'COMPLETED')).toBe(true);
    expect(canRideTransition('DRIVER_ARRIVED', 'CANCELLED')).toBe(true);
  });

  it('lets a started ride be cancelled only by a breakdown, never by the passenger', () => {
    expect(canRideTransition('STARTED', 'CANCELLED')).toBe(true);
    expect(passengerCanCancel('STARTED')).toBe(false);
    expect(passengerCanCancel('DRIVER_ARRIVED')).toBe(true);
    expect(passengerCanCancel('COMPLETED')).toBe(false);
  });

  it('rejects skipping steps and reviving finished rides', () => {
    expect(canRideTransition('REQUESTED', 'STARTED')).toBe(false);
    expect(canRideTransition('MATCHED', 'COMPLETED')).toBe(false);
    expect(canRideTransition('COMPLETED', 'REQUESTED')).toBe(false);
    expect(canRideTransition('CANCELLED', 'MATCHED')).toBe(false);
  });
});

describe('getting off early (DESIGN.md §5)', () => {
  const zone = (code: string, xKm: number, yKm: number) => ({ code, xKm, yKm });
  const ZONES = [
    zone('BANANI', 0, 0),
    zone('GULSHAN_2', 1, 0),
    zone('GULSHAN_1', 1, -2),
    zone('MOHAKHALI', 0, -2),
    zone('BASHUNDHARA', 2, 2),
    zone('UTTARA', -1, 9),
  ] as const;
  const [banani, gulshan2, gulshan1, mohakhali, , uttara] = ZONES;

  it("lists the areas on Rafiq's way to Gulshan 1, nearest first, without either end", () => {
    expect(zonesOnTheWay(banani, gulshan1, ZONES).map((z) => z.code)).toEqual(['GULSHAN_2', 'MOHAKHALI']);
  });

  it('lists nothing when there is no area in between', () => {
    expect(zonesOnTheWay(banani, mohakhali, ZONES)).toEqual([]);
    expect(zonesOnTheWay(banani, gulshan2, ZONES)).toEqual([]);
  });

  it('never offers a detour', () => {
    expect(zonesOnTheWay(uttara, gulshan2, ZONES).map((z) => z.code)).toEqual(['BANANI']);
  });

  it('charges a solo rider for the km ridden: Gulshan 2 after 1 km is ৳50', () => {
    expect(earlyDropOffFare(1, 1, false, 9000)).toMatchObject({ subtotalPaisa: 5000, poolDiscountPaisa: 0, farePaisa: 5000 });
  });

  it('keeps the pool discount for a shared rider: Mohakhali after 2 km is ৳52.50', () => {
    expect(earlyDropOffFare(2, 1, true, 6750)).toMatchObject({ subtotalPaisa: 7000, poolDiscountPaisa: 1750, farePaisa: 5250 });
  });

  it('never charges more than the fare fixed at the start', () => {
    expect(earlyDropOffFare(3, 1, false, 6750)).toMatchObject({ subtotalPaisa: 9000, poolDiscountPaisa: 2250, farePaisa: 6750 });
  });
});
