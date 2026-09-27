import { Prisma } from '@prisma/client';
import { calculateFare, estimateFare } from '../../domain/fare';
import { manhattanKm } from '../../domain/geo';
import { ACTIVE_RIDE_STATUSES, passengerCanCancel } from '../../domain/ride-status';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { recordEvent } from '../../lib/events';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { lockPool, releaseSeats, tryAutoMatch } from '../pools/pools.service';
import { getTripZones } from '../zones/zones.service';
import type { RequestRideInput } from './rides.schemas';
import { passengerRideInclude, toPassengerRide } from './rides.view';

export async function estimateTrip(pickupCode: string, dropoffCode: string, seats: number) {
  const { pickup, dropoff } = await getTripZones(pickupCode, dropoffCode);
  return {
    pickup: { code: pickup.code, name: pickup.name },
    dropoff: { code: dropoff.code, name: dropoff.name },
    ...estimateFare(manhattanKm(pickup, dropoff), seats),
  };
}

export async function requestRide(passengerId: string, input: RequestRideInput) {
  const { pickup, dropoff } = await getTripZones(input.pickupZone, input.dropoffZone);
  const distanceKm = manhattanKm(pickup, dropoff);
  const { subtotalPaisa } = calculateFare(distanceKm, input.seats, false);

  // The rider's declared gender is snapshotted onto the ride for matching and history.
  const { gender } = await prisma.user.findUniqueOrThrow({ where: { id: passengerId }, select: { gender: true } });
  if (input.sameGenderOnly && gender === 'UNDISCLOSED') {
    throw badRequest('Same-gender rides need a declared gender', [
      { path: 'sameGenderOnly', message: 'Same-gender rides are only available if you shared your gender at sign-up' },
    ]);
  }

  let ride;
  try {
    ride = await prisma.$transaction(async (tx) => {
      const created = await tx.rideRequest.create({
        data: {
          passengerId,
          pickupZone: pickup.code,
          dropoffZone: dropoff.code,
          seats: input.seats,
          distanceKm,
          subtotalPaisa,
          paymentMethod: input.paymentMethod,
          shareRide: input.shareRide,
          sameGenderOnly: input.sameGenderOnly,
          passengerGender: gender,
        },
        include: passengerRideInclude,
      });
      await recordEvent(tx, {
        type: 'RIDE_REQUESTED',
        rideRequestId: created.id,
        actorId: passengerId,
        toStatus: 'REQUESTED',
        data: {
          pickup: pickup.code,
          dropoff: dropoff.code,
          seats: input.seats,
          distanceKm,
          subtotalPaisa,
          shareRide: input.shareRide,
          sameGenderOnly: input.sameGenderOnly,
        },
      });
      return created;
    });
  } catch (err) {
    // The partial unique index "one active ride per passenger" rejected it. Checking in code
    // first would race with a double-click; the index can't.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('You already have an active ride. Cancel it before booking another.', 'ACTIVE_RIDE_EXISTS');
    }
    throw err;
  }

  // A Tesla may already be heading her way: try to join a compatible open pool now.
  // The ride is already saved, so if matching fails unexpectedly we still return it as
  // REQUESTED (a driver can accept it) instead of a 500 that would tempt a retry.
  try {
    if (await tryAutoMatch(ride)) return getMyRide(passengerId, ride.id);
  } catch (err) {
    logger.error({ err, rideId: ride.id }, 'auto-match failed; ride stays REQUESTED');
  }
  return toPassengerRide(ride);
}

export async function listMyRides(passengerId: string) {
  const rides = await prisma.rideRequest.findMany({
    where: { passengerId },
    include: passengerRideInclude,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return rides.map(toPassengerRide);
}

export async function getCurrentRide(passengerId: string) {
  const ride = await prisma.rideRequest.findFirst({
    where: { passengerId, status: { in: [...ACTIVE_RIDE_STATUSES] } },
    include: passengerRideInclude,
  });
  return ride ? toPassengerRide(ride) : null;
}

// Filtering by passengerId in the query itself means another user's ride is simply "not found".
// We return 404 rather than 403 so the API doesn't even confirm that the ride exists.
async function findOwnRide(passengerId: string, rideId: string) {
  const ride = await prisma.rideRequest.findFirst({ where: { id: rideId, passengerId }, include: passengerRideInclude });
  if (!ride) throw notFound('Ride not found');
  return ride;
}

export async function getMyRide(passengerId: string, rideId: string) {
  return toPassengerRide(await findOwnRide(passengerId, rideId));
}

export async function getMyRideEvents(passengerId: string, rideId: string) {
  await findOwnRide(passengerId, rideId);
  const events = await prisma.rideEvent.findMany({
    where: { rideRequestId: rideId },
    orderBy: { id: 'asc' },
    select: { id: true, type: true, fromStatus: true, toStatus: true, createdAt: true },
  });
  // ride_events.id is BIGINT, which Prisma returns as a JS BigInt, and JSON can't encode BigInt.
  return events.map((e) => ({ ...e, id: e.id.toString() }));
}

export async function cancelRide(passengerId: string, rideId: string, reason?: string) {
  const ride = await findOwnRide(passengerId, rideId);

  if (!passengerCanCancel(ride.status)) {
    throw conflict(`A ride that is ${ride.status} can no longer be cancelled`, 'INVALID_TRANSITION');
  }

  await prisma.$transaction(async (tx) => {
    // Lock order: pool first, then the ride (see pools.service.ts).
    if (ride.poolId) await lockPool(tx, ride.poolId);

    // Conditional update: only succeeds if the status is still what we just read. If a driver
    // started the trip in between, count is 0 and we refuse instead of overwriting it.
    const { count } = await tx.rideRequest.updateMany({
      where: { id: ride.id, status: ride.status },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason ?? 'Cancelled by passenger' },
    });
    if (count === 0) throw conflict('This ride changed while you were cancelling. Refresh and try again.', 'STALE_STATE');

    await recordEvent(tx, {
      type: 'RIDE_CANCELLED',
      rideRequestId: ride.id,
      poolId: ride.poolId ?? undefined,
      actorId: passengerId,
      fromStatus: ride.status,
      toStatus: 'CANCELLED',
      data: reason ? { reason } : undefined,
    });

    // Give the seats back so someone else (Shirin?) can take them.
    await releaseSeats(tx, ride, passengerId);
  });

  return getMyRide(passengerId, rideId);
}

// A waiting same-gender rider can choose to share with anyone instead (e.g. she's in a hurry).
// It only ever RELAXES a preference, only while still waiting, and she makes the choice herself.
// Afterwards she is an ordinary sharer, so the ordinary rule applies: she joins a compatible trip
// automatically if its driver has auto-add on; otherwise she appears in drivers' feeds.
export async function shareWithAnyone(passengerId: string, rideId: string) {
  const ride = await findOwnRide(passengerId, rideId);
  if (ride.status !== 'REQUESTED') {
    throw conflict('You can only change this while you’re still waiting for a Tesla', 'INVALID_TRANSITION');
  }
  if (!ride.sameGenderOnly) throw conflict('This ride already shares with anyone', 'NOTHING_TO_CHANGE');

  await prisma.$transaction(async (tx) => {
    // Conditional, like every other state change: if a driver took the ride meanwhile, refuse.
    const { count } = await tx.rideRequest.updateMany({
      where: { id: ride.id, status: 'REQUESTED', sameGenderOnly: true },
      data: { sameGenderOnly: false },
    });
    if (count === 0) throw conflict('This ride changed a moment ago. Refresh and try again.', 'STALE_STATE');
    await recordEvent(tx, {
      type: 'PREFERENCE_CHANGED',
      rideRequestId: ride.id,
      actorId: passengerId,
      data: { sameGenderOnly: false },
    });
  });

  const updated = await prisma.rideRequest.findUniqueOrThrow({ where: { id: ride.id } });
  try {
    await tryAutoMatch(updated);
  } catch (err) {
    logger.error({ err, rideId: ride.id }, 'auto-match after relaxing preference failed; ride stays REQUESTED');
  }
  return getMyRide(passengerId, rideId);
}
