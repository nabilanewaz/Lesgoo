// Fare model, DESIGN.md §5:
//   passengerFare = baseFare + distanceCharge - poolDiscount
// All amounts are integer paisa (৳1 = 100 paisa). No floats anywhere.

export type FareRules = {
  baseFarePaisa: number; // per seat
  perKmPaisa: number; // per seat per km
  poolDiscountPct: number; // whole percent, applied only if the trip was actually shared
};

export const FARE_RULES: FareRules = {
  baseFarePaisa: 3000, // ৳30
  perKmPaisa: 2000, // ৳20 / km
  poolDiscountPct: 25,
};

export type FareBreakdown = {
  distanceKm: number;
  seats: number;
  baseFarePaisa: number;
  distanceChargePaisa: number;
  subtotalPaisa: number;
  poolDiscountPaisa: number;
  farePaisa: number;
};

function assertWholeNumber(name: string, value: number, min: number) {
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min}, got ${value}`);
  }
}

export function poolDiscountPaisa(subtotalPaisa: number, shared: boolean, rules: FareRules = FARE_RULES): number {
  if (!shared) return 0;
  // Integer maths, rounded down: the passenger never pays a fraction of a paisa extra.
  return Math.floor((subtotalPaisa * rules.poolDiscountPct) / 100);
}

export function calculateFare(
  distanceKm: number,
  seats: number,
  shared: boolean,
  rules: FareRules = FARE_RULES,
): FareBreakdown {
  assertWholeNumber('distanceKm', distanceKm, 1);
  assertWholeNumber('seats', seats, 1);

  const baseFare = rules.baseFarePaisa * seats;
  const distanceCharge = rules.perKmPaisa * distanceKm * seats;
  const subtotal = baseFare + distanceCharge;
  const discount = poolDiscountPaisa(subtotal, shared, rules);

  return {
    distanceKm,
    seats,
    baseFarePaisa: baseFare,
    distanceChargePaisa: distanceCharge,
    subtotalPaisa: subtotal,
    poolDiscountPaisa: discount,
    farePaisa: subtotal - discount,
  };
}

// What the passenger sees before booking: the price alone, and the price if someone shares.
export function estimateFare(distanceKm: number, seats: number, rules: FareRules = FARE_RULES) {
  return {
    solo: calculateFare(distanceKm, seats, false, rules),
    pooled: calculateFare(distanceKm, seats, true, rules),
  };
}

// A passenger who gets off early pays for the part they rode (like Uber), keeping the pool
// discount they had at the start, and never more than the fare fixed when the trip started.
export function earlyDropOffFare(
  riddenKm: number,
  seats: number,
  shared: boolean,
  fareAtStartPaisa: number,
  rules: FareRules = FARE_RULES,
): FareBreakdown {
  const ridden = calculateFare(riddenKm, seats, shared, rules);
  if (ridden.farePaisa <= fareAtStartPaisa) return ridden;
  return { ...ridden, farePaisa: fareAtStartPaisa, poolDiscountPaisa: ridden.subtotalPaisa - fareAtStartPaisa };
}
