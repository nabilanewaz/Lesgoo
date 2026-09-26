import { describe, expect, it } from 'vitest';
import { calculateFare, estimateFare, poolDiscountPaisa } from '../src/domain/fare';
import { manhattanKm } from '../src/domain/geo';
import { canRideTransition } from '../src/domain/ride-status';

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

describe('ride state machine', () => {
  it('allows the happy path and cancellation before the trip starts', () => {
    expect(canRideTransition('REQUESTED', 'MATCHED')).toBe(true);
    expect(canRideTransition('MATCHED', 'DRIVER_ARRIVED')).toBe(true);
    expect(canRideTransition('DRIVER_ARRIVED', 'STARTED')).toBe(true);
    expect(canRideTransition('STARTED', 'COMPLETED')).toBe(true);
    expect(canRideTransition('DRIVER_ARRIVED', 'CANCELLED')).toBe(true);
  });

  it('rejects skipping steps, cancelling mid-trip and reviving finished rides', () => {
    expect(canRideTransition('REQUESTED', 'STARTED')).toBe(false);
    expect(canRideTransition('MATCHED', 'COMPLETED')).toBe(false);
    expect(canRideTransition('STARTED', 'CANCELLED')).toBe(false);
    expect(canRideTransition('COMPLETED', 'REQUESTED')).toBe(false);
    expect(canRideTransition('CANCELLED', 'MATCHED')).toBe(false);
  });
});
