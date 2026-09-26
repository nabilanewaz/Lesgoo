import type { Prisma } from '@prisma/client';
import { poolDiscountPaisa } from '../../domain/fare';

export const passengerRideInclude = {
  pickup: true,
  dropoff: true,
  pool: {
    select: {
      id: true,
      status: true,
      vehicle: { select: { name: true, plate: true, driver: { select: { name: true } } } },
      // Only a count: a passenger never learns who else is in the Tesla or where they're going.
      _count: { select: { members: { where: { status: { not: 'CANCELLED' } } } } },
    },
  },
} satisfies Prisma.RideRequestInclude;

type PassengerRide = Prisma.RideRequestGetPayload<{ include: typeof passengerRideInclude }>;

// What a passenger sees about their OWN ride.
export function toPassengerRide(ride: PassengerRide) {
  const pool = ride.pool;
  return {
    id: ride.id,
    status: ride.status,
    pickup: { code: ride.pickup.code, name: ride.pickup.name },
    dropoff: { code: ride.dropoff.code, name: ride.dropoff.name },
    seats: ride.seats,
    distanceKm: ride.distanceKm,
    paymentMethod: ride.paymentMethod,
    fare: {
      subtotalPaisa: ride.subtotalPaisa,
      // Until the trip starts we don't know if it will be shared, so show both prices.
      pooledEstimatePaisa: ride.subtotalPaisa - poolDiscountPaisa(ride.subtotalPaisa, true),
      // Set when the trip starts; null until then.
      poolDiscountPaisa: ride.poolDiscountPaisa,
      farePaisa: ride.farePaisa,
      isFinal: ride.farePaisa !== null,
    },
    pool: pool && {
      id: pool.id,
      status: pool.status,
      vehicle: { name: pool.vehicle.name, plate: pool.vehicle.plate },
      driver: { name: pool.vehicle.driver.name },
      // Other passengers still in the Tesla (not counting this one).
      sharedWith: Math.max(0, pool._count.members - (ride.status === 'CANCELLED' ? 0 : 1)),
    },
    createdAt: ride.createdAt,
    updatedAt: ride.updatedAt,
    cancelledAt: ride.cancelledAt,
    cancelReason: ride.cancelReason,
  };
}
