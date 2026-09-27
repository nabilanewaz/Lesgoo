import { Prisma, type Pool, type RideRequest } from '@prisma/client';
import { poolDiscountPaisa } from '../../domain/fare';
import {
  genderPreferencesMet,
  isCompatible,
  rankPools,
  sharingAllowed,
  type MatchCandidate,
  type PoolForMatching,
} from '../../domain/matching';
import { ACTIVE_POOL_STATUSES, canPoolTransition } from '../../domain/pool-status';
import { ACTIVE_RIDE_STATUSES, canRideTransition } from '../../domain/ride-status';
import { AppError, conflict, forbidden, notFound } from '../../lib/errors';
import { recordEvent, type RideEventType } from '../../lib/events';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';

// ---------------------------------------------------------------------------------------------
// The pool engine. Every way into a pool (auto-match, driver accept) goes through joinPool(),
// so capacity and compatibility are enforced in exactly one place. See DESIGN.md §4 and §8.
//
// Lock order is always: vehicle row, then pool row, then ride rows. Taking locks in the same
// order everywhere means two transactions can't each hold one lock and wait for the other (deadlock).
// ---------------------------------------------------------------------------------------------

type Tx = Prisma.TransactionClient;
type JoinResult = 'JOINED' | 'POOL_CLOSED' | 'DRIVER_PICKS' | 'RIDING_ALONE' | 'SAME_GENDER_ONLY' | 'INCOMPATIBLE' | 'FULL';

const activeMembers = { status: { in: [...ACTIVE_RIDE_STATUSES] } } satisfies Prisma.RideRequestWhereInput;

// Blocks until no other transaction holds this pool, then returns whether it is still OPEN.
// While we hold the lock, nobody else can add or remove members, so the compatibility check
// below reads a membership list that can't change under us.
async function lockOpenPool(tx: Tx, poolId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM pools WHERE id = ${poolId}::uuid AND status = 'OPEN' FOR UPDATE`;
  return rows.length === 1;
}

// THE seat claim (DESIGN.md §8). One statement that checks and increments together, so two
// requests can never both take the last seat. Returns false when the seats don't fit.
// (The CHECK constraint pools_seats_taken_check would also reject an overbooking.)
export async function claimSeats(tx: Tx, poolId: string, seats: number): Promise<boolean> {
  const updated = await tx.$executeRaw`
    UPDATE pools
    SET seats_taken = seats_taken + ${seats}
    WHERE id = ${poolId}::uuid
      AND status = 'OPEN'
      AND seats_taken + ${seats} <= capacity`;
  return updated === 1;
}

type PoolWithMembers = Prisma.PoolGetPayload<{ include: { members: { include: { dropoff: true } } } }>;

const asCandidate = (ride: RideRequest, dropoff: { xKm: number; yKm: number }): MatchCandidate => ({
  pickupZone: ride.pickupZone,
  dropoff,
  shareRide: ride.shareRide,
  sameGenderOnly: ride.sameGenderOnly,
  gender: ride.passengerGender,
});

const forMatching = (pool: PoolWithMembers): PoolForMatching => ({
  pickupZone: pool.pickupZone,
  members: pool.members.map((m) => ({
    dropoff: m.dropoff,
    shareRide: m.shareRide,
    sameGenderOnly: m.sameGenderOnly,
    gender: m.passengerGender,
  })),
});

// `automatic` = the system is adding the rider (not a driver tapping Accept). Then the trip's
// driver must have "auto-add riders" switched on.
async function joinPool(tx: Tx, ride: RideRequest, poolId: string, actorId: string, automatic = false): Promise<JoinResult> {
  if (!(await lockOpenPool(tx, poolId))) return 'POOL_CLOSED';

  if (automatic) {
    // Re-read inside the transaction (after tryAutoMatch's unlocked pre-filter): if the driver
    // switched auto-add off a moment ago, respect it. A plain read, not a lock: taking the
    // vehicle lock here would break the vehicle -> pool lock order and risk deadlocks.
    const vehicle = await tx.vehicle.findFirstOrThrow({ where: { pools: { some: { id: poolId } } } });
    if (!vehicle.autoAccept) return 'DRIVER_PICKS';
  }

  // Read under the lock: nobody can join or leave while we decide.
  const pool = await tx.pool.findUniqueOrThrow({
    where: { id: poolId },
    include: { members: { where: activeMembers, include: { dropoff: true } } },
  });
  const dropoff = await tx.zone.findUniqueOrThrow({ where: { code: ride.dropoffZone } });

  const candidate = asCandidate(ride, dropoff);
  const current = forMatching(pool);
  // Specific reasons first, so the driver is told *why* a rider can't join.
  if (!sharingAllowed(candidate, current)) return 'RIDING_ALONE';
  if (!genderPreferencesMet(candidate, current)) return 'SAME_GENDER_ONLY';
  if (!isCompatible(candidate, current)) return 'INCOMPATIBLE';

  if (!(await claimSeats(tx, poolId, ride.seats))) return 'FULL';

  // Only move the ride if it is still waiting. If it was cancelled or taken by another driver
  // meanwhile, throwing rolls back the whole transaction, including the seat claim above.
  const { count } = await tx.rideRequest.updateMany({
    where: { id: ride.id, status: 'REQUESTED' },
    data: { status: 'MATCHED', poolId },
  });
  if (count === 0) throw conflict('This ride has already been taken or cancelled', 'RIDE_NOT_AVAILABLE');

  await recordEvent(tx, {
    type: 'RIDE_MATCHED',
    rideRequestId: ride.id,
    poolId,
    actorId,
    fromStatus: 'REQUESTED',
    toStatus: 'MATCHED',
    data: { seats: ride.seats, sharedWith: pool.members.length },
  });
  return 'JOINED';
}

// Called right after a passenger requests a ride: try to put them in an OPEN pool that's
// already heading their way. If none fits, the ride stays REQUESTED and waits for a driver.
export async function tryAutoMatch(ride: RideRequest): Promise<boolean> {
  // Riding alone never joins an existing Tesla (open pools always have someone in them).
  if (!ride.shareRide) return false;

  const candidates = await prisma.pool.findMany({
    where: {
      status: 'OPEN',
      pickupZone: ride.pickupZone,
      // Only Teslas whose driver lets compatible riders join automatically.
      vehicle: { isOnline: true, autoAccept: true },
    },
    include: { members: { where: activeMembers, include: { dropoff: true } } },
  });
  const dropoff = await prisma.zone.findUniqueOrThrow({ where: { code: ride.dropoffZone } });

  // Pre-filter without locks (cheap). joinPool re-checks everything under the lock.
  const worthTrying = rankPools(
    candidates.filter(
      (p) =>
        p.seatsTaken + ride.seats <= p.capacity &&
        isCompatible(asCandidate(ride, dropoff), forMatching(p)),
    ),
  );

  // One short transaction per attempt, so a failed attempt doesn't keep a pool locked.
  for (const pool of worthTrying) {
    try {
      const result = await prisma.$transaction((tx) => joinPool(tx, ride, pool.id, ride.passengerId, true));
      if (result === 'JOINED') return true;
      logger.debug({ rideId: ride.id, poolId: pool.id, result }, 'auto-match attempt failed, trying next pool');
    } catch (err) {
      // The ride itself changed (e.g. cancelled): stop trying.
      if (err instanceof AppError && err.code === 'RIDE_NOT_AVAILABLE') return false;
      throw err;
    }
  }
  return false;
}

const joinFailures: Record<Exclude<JoinResult, 'JOINED'>, AppError> = {
  POOL_CLOSED: conflict('Your current trip is no longer taking passengers', 'POOL_CLOSED'),
  DRIVER_PICKS: conflict('This driver picks his riders himself', 'DRIVER_PICKS'), // only for automatic joins
  RIDING_ALONE: conflict('Someone in this trip chose to ride alone, so it can’t be shared', 'RIDING_ALONE'),
  SAME_GENDER_ONLY: conflict('This would break a same-gender request in this trip', 'SAME_GENDER_ONLY'),
  INCOMPATIBLE: conflict('This passenger is not heading the same way as your current passengers', 'INCOMPATIBLE_ROUTE'),
  FULL: conflict('Not enough free seats for this request', 'POOL_FULL'),
};

// A driver accepts a waiting request. With no active pool this opens a new one on their
// Tesla; with an OPEN pool the request joins it (same rules as auto-matching).
export async function acceptRequest(driverId: string, rideId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { driverId } });
  if (!vehicle) throw forbidden('You need a registered Tesla to accept rides');
  if (!vehicle.isOnline) throw conflict('Go online before accepting rides', 'DRIVER_OFFLINE');

  const ride = await prisma.rideRequest.findUnique({ where: { id: rideId } });
  if (!ride) throw notFound('Ride not found');
  if (ride.status !== 'REQUESTED') throw conflict('This ride has already been taken or cancelled', 'RIDE_NOT_AVAILABLE');

  try {
    return await prisma.$transaction(async (tx) => {
      // Lock Bullet's row and re-check: "go offline" takes the same lock, so a driver can't
      // go offline at the same instant they accept and end up offline with an open trip.
      if (!(await lockVehicle(tx, vehicle.id)).isOnline) {
        throw conflict('Go online before accepting rides', 'DRIVER_OFFLINE');
      }

      let pool = await tx.pool.findFirst({
        where: { vehicleId: vehicle.id, status: { in: [...ACTIVE_POOL_STATUSES] } },
      });

      if (!pool) {
        pool = await tx.pool.create({
          data: { vehicleId: vehicle.id, pickupZone: ride.pickupZone, capacity: vehicle.capacity },
        });
        await recordEvent(tx, {
          type: 'POOL_OPENED',
          poolId: pool.id,
          actorId: driverId,
          toStatus: 'OPEN',
          data: { vehicle: vehicle.name, capacity: vehicle.capacity, pickupZone: ride.pickupZone },
        });
      }

      const result = await joinPool(tx, ride, pool.id, driverId);
      if (result !== 'JOINED') throw joinFailures[result];
      return pool.id;
    });
  } catch (err) {
    // Two accepts at once on the same Tesla with no pool yet: the partial unique index
    // "one active pool per vehicle" lets only one of them create it.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('You just opened a trip. Refresh and try again.', 'STALE_STATE');
    }
    throw err;
  }
}

// Callers that change a pooled ride must lock its pool BEFORE touching the ride row.
export async function lockPool(tx: Tx, poolId: string) {
  await tx.$queryRaw`SELECT id FROM pools WHERE id = ${poolId}::uuid FOR UPDATE`;
}

// Used when a matched passenger cancels (pool already locked by the caller): give their seats
// back, and cancel the pool if they were the last active passenger, freeing the Tesla.
export async function releaseSeats(tx: Tx, ride: RideRequest, actorId: string) {
  if (!ride.poolId) return;

  await tx.$executeRaw`
    UPDATE pools SET seats_taken = seats_taken - ${ride.seats} WHERE id = ${ride.poolId}::uuid`;

  const remaining = await tx.rideRequest.count({
    where: { poolId: ride.poolId, id: { not: ride.id }, ...activeMembers },
  });
  if (remaining > 0) return;

  const pool = await tx.pool.update({
    where: { id: ride.poolId },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });
  await recordEvent(tx, {
    type: 'POOL_CANCELLED',
    poolId: pool.id,
    actorId,
    toStatus: 'CANCELLED',
    data: { reason: 'Last passenger cancelled' },
  });
}

export async function lockVehicle(tx: Tx, vehicleId: string) {
  const rows = await tx.$queryRaw<{ is_online: boolean }[]>`
    SELECT is_online FROM vehicles WHERE id = ${vehicleId}::uuid FOR UPDATE`;
  return { isOnline: rows[0]?.is_online ?? false };
}

// ---------------------------------------------------------------------------------------------
// Driver-driven trip transitions: OPEN → DRIVER_ARRIVED → STARTED → COMPLETED, or → CANCELLED.
// The pool and all its active passengers move together in one transaction (DESIGN.md §6).
// ---------------------------------------------------------------------------------------------

export type PoolTransition = 'DRIVER_ARRIVED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';

const poolEventType = {
  DRIVER_ARRIVED: 'DRIVER_ARRIVED',
  STARTED: 'TRIP_STARTED',
  COMPLETED: 'TRIP_COMPLETED',
  CANCELLED: 'POOL_CANCELLED',
} as const satisfies Record<PoolTransition, RideEventType>;

const timestampField = {
  DRIVER_ARRIVED: 'arrivedAt',
  STARTED: 'startedAt',
  COMPLETED: 'completedAt',
  CANCELLED: 'cancelledAt',
} as const satisfies Record<PoolTransition, keyof Pool>;

export async function transitionPool(driverId: string, to: PoolTransition): Promise<string> {
  const vehicle = await prisma.vehicle.findUnique({ where: { driverId } });
  if (!vehicle) throw forbidden('You need a registered Tesla to run trips');

  const pool = await prisma.pool.findFirst({
    where: { vehicleId: vehicle.id, status: { in: [...ACTIVE_POOL_STATUSES] } },
  });
  if (!pool) throw notFound('You have no active trip');
  if (!canPoolTransition(pool.status, to)) {
    throw conflict(`A trip that is ${pool.status} can't move to ${to}`, 'INVALID_TRANSITION');
  }

  await prisma.$transaction(async (tx) => {
    await lockPool(tx, pool.id);

    // Conditional on the status we read: a double-clicked "Start trip" runs this twice,
    // and the second one finds the status already changed and gets a 409.
    const now = new Date();
    const { count } = await tx.pool.updateMany({
      where: { id: pool.id, status: pool.status },
      data: { status: to, [timestampField[to]]: now },
    });
    if (count === 0) throw conflict('This trip changed in the meantime. Refresh and try again.', 'STALE_STATE');

    const members = await tx.rideRequest.findMany({ where: { poolId: pool.id, ...activeMembers } });

    for (const ride of members) {
      if (!canRideTransition(ride.status, to)) {
        // Can't happen while ride statuses mirror the pool; fail loudly rather than corrupt data.
        throw new Error(`Ride ${ride.id} is ${ride.status}, cannot follow its pool to ${to}`);
      }

      const data: Prisma.RideRequestUpdateInput = { status: to };
      let eventData: Prisma.InputJsonValue | undefined;

      if (to === 'STARTED') {
        // Final fare (DESIGN.md §5): membership can't change any more, so we now know for
        // certain whether this passenger shared the Tesla.
        const shared = members.length >= 2;
        const discount = poolDiscountPaisa(ride.subtotalPaisa, shared);
        data.poolDiscountPaisa = discount;
        data.farePaisa = ride.subtotalPaisa - discount;
        eventData = { shared, subtotalPaisa: ride.subtotalPaisa, poolDiscountPaisa: discount, farePaisa: ride.subtotalPaisa - discount };
      }
      if (to === 'CANCELLED') {
        data.cancelledAt = now;
        data.cancelReason = 'Driver cancelled the trip';
      }

      await tx.rideRequest.update({ where: { id: ride.id }, data });
      await recordEvent(tx, {
        type: poolEventType[to],
        rideRequestId: ride.id,
        poolId: pool.id,
        actorId: driverId,
        fromStatus: ride.status,
        toStatus: to,
        data: eventData,
      });
    }

    if (to === 'CANCELLED') {
      await tx.pool.update({ where: { id: pool.id }, data: { seatsTaken: 0 } });
    }

    await recordEvent(tx, {
      type: poolEventType[to],
      poolId: pool.id,
      actorId: driverId,
      fromStatus: pool.status,
      toStatus: to,
      data: { passengers: members.length },
    });
  });

  return pool.id;
}
