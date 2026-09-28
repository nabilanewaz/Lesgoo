// Fare model, DESIGN.md §5:
//   passengerFare = baseFare + distanceCharge - poolDiscount
// All amounts are integer paisa (৳1 = 100 paisa). No floats anywhere.
// Distance is charged per started 100 m, like a taxi meter: ৳20/km = ৳2 per 100 m.

export type FareRules = {
  baseFarePaisa: number; // per seat
  perKmPaisa: number; // per seat per km; a multiple of 10 so every 100 m is whole paisa
  poolDiscountPct: number; // whole percent, applied only if the trip was actually shared
};

export const FARE_RULES: FareRules = {
  baseFarePaisa: 3000, // ৳30
  perKmPaisa: 2000, // ৳20 / km
  poolDiscountPct: 25,
};

export const METRES_PER_STEP = 100;

export type FareBreakdown = {
  distanceM: number;
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
  distanceM: number,
  seats: number,
  shared: boolean,
  rules: FareRules = FARE_RULES,
): FareBreakdown {
  assertWholeNumber('distanceM', distanceM, 1);
  assertWholeNumber('seats', seats, 1);

  const steps = Math.ceil(distanceM / METRES_PER_STEP); // a started 100 m counts in full
  const baseFare = rules.baseFarePaisa * seats;
  const distanceCharge = ((rules.perKmPaisa * steps) / (1000 / METRES_PER_STEP)) * seats;
  const subtotal = baseFare + distanceCharge;
  const discount = poolDiscountPaisa(subtotal, shared, rules);

  return {
    distanceM,
    seats,
    baseFarePaisa: baseFare,
    distanceChargePaisa: distanceCharge,
    subtotalPaisa: subtotal,
    poolDiscountPaisa: discount,
    farePaisa: subtotal - discount,
  };
}

// What the passenger sees before booking: the price alone, and the price if someone shares.
export function estimateFare(distanceM: number, seats: number, rules: FareRules = FARE_RULES) {
  return {
    solo: calculateFare(distanceM, seats, false, rules),
    pooled: calculateFare(distanceM, seats, true, rules),
  };
}

// A passenger who gets off early pays for the part they rode (like Uber), keeping the pool
// discount they had at the start, and never more than the fare fixed when the trip started.
export function earlyDropOffFare(
  riddenM: number,
  seats: number,
  shared: boolean,
  fareAtStartPaisa: number,
  rules: FareRules = FARE_RULES,
): FareBreakdown {
  const ridden = calculateFare(riddenM, seats, shared, rules);
  if (ridden.farePaisa <= fareAtStartPaisa) return ridden;
  return { ...ridden, farePaisa: fareAtStartPaisa, poolDiscountPaisa: ridden.subtotalPaisa - fareAtStartPaisa };
}
