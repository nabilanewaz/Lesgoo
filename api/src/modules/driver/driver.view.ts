import type { Prisma, Zone } from '@prisma/client';
import { zonesOnTheWay } from '../../domain/geo';

export const driverPoolInclude = {
  zone: true,
  members: {
    include: { passenger: { select: { name: true } }, dropoff: true, droppedOff: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.PoolInclude;

type DriverPool = Prisma.PoolGetPayload<{ include: typeof driverPoolInclude }>;

// What Jashim sees about his own trip: who is riding, where each one gets off, and what
// each pays. Passengers who cancelled stay in the list (with their status) for the record.
// `zones` (all of them) is only needed during the trip, to offer the "got off early" stops.
export function toDriverPool(pool: DriverPool, zones: Zone[] = []) {
  const passengers = pool.members.map((m) => ({
    rideId: m.id,
    name: m.passenger.name,
    dropoff: { code: m.dropoff.code, name: m.dropoff.name },
    seats: m.seats,
    status: m.status,
    paymentMethod: m.paymentMethod,
    shareRide: m.shareRide,
    sameGenderOnly: m.sameGenderOnly,
    gender: m.passengerGender,
    subtotalPaisa: m.subtotalPaisa,
    farePaisa: m.farePaisa,
    droppedOff: m.droppedOff && { code: m.droppedOff.code, name: m.droppedOff.name },
    cancelReason: m.cancelReason,
    // Where this passenger could get off early, nearest first. Empty unless they are on board.
    stopsOnTheWay:
      m.status === 'STARTED' ? zonesOnTheWay(pool.zone, m.dropoff, zones).map((z) => ({ code: z.code, name: z.name })) : [],
  }));

  return {
    id: pool.id,
    status: pool.status,
    pickup: { code: pool.zone.code, name: pool.zone.name },
    capacity: pool.capacity,
    seatsTaken: pool.seatsTaken,
    seatsLeft: pool.capacity - pool.seatsTaken,
    passengers,
    // Only final fares count: before the trip starts nothing has been charged yet.
    totalFarePaisa: passengers
      .filter((p) => p.status !== 'CANCELLED')
      .reduce((sum, p) => sum + (p.farePaisa ?? 0), 0),
    createdAt: pool.createdAt,
    arrivedAt: pool.arrivedAt,
    startedAt: pool.startedAt,
    completedAt: pool.completedAt,
    cancelledAt: pool.cancelledAt,
  };
}

export const feedRequestInclude = {
  passenger: { select: { name: true } },
  pickup: true,
  dropoff: true,
} satisfies Prisma.RideRequestInclude;

type FeedRequest = Prisma.RideRequestGetPayload<{ include: typeof feedRequestInclude }>;

export function toFeedRequest(ride: FeedRequest) {
  return {
    rideId: ride.id,
    passengerName: ride.passenger.name,
    pickup: { code: ride.pickup.code, name: ride.pickup.name },
    dropoff: { code: ride.dropoff.code, name: ride.dropoff.name },
    seats: ride.seats,
    distanceKm: ride.distanceKm,
    shareRide: ride.shareRide,
    sameGenderOnly: ride.sameGenderOnly,
    gender: ride.passengerGender,
    subtotalPaisa: ride.subtotalPaisa,
    requestedAt: ride.createdAt,
  };
}
