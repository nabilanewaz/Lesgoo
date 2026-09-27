import type { Prisma } from '@prisma/client';
import { poolDiscountPaisa } from '../../domain/fare';

export const passengerRideInclude = {
  pickup: true,
  dropoff: true,
  droppedOff: true,
  pool: {
    select: {
      id: true,
      status: true,
      vehicle: { select: { name: true, plate: true, driver: { select: { name: true } } } },
      // Co-riders' declared gender ONLY: never their names, ids or destinations.
      members: {
        where: { status: { not: 'CANCELLED' } },
        select: { id: true, passengerGender: true },
      },
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
    // Where they actually got off (differs from dropoff if they got off early).
    droppedOff: ride.droppedOff && { code: ride.droppedOff.code, name: ride.droppedOff.name },
    seats: ride.seats,
    distanceKm: ride.distanceKm,
    paymentMethod: ride.paymentMethod,
    shareRide: ride.shareRide,
    sameGenderOnly: ride.sameGenderOnly,
    fare: {
      subtotalPaisa: ride.subtotalPaisa,
      // Until the trip starts we don't know if it will be shared, so show both prices.
      // Riding alone is never shared, so there is no pooled price.
      pooledEstimatePaisa: ride.shareRide ? ride.subtotalPaisa - poolDiscountPaisa(ride.subtotalPaisa, true) : null,
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
      // Other passengers still in the Tesla (not counting this one): how many, and their
      // declared gender so the rider can decide whether they're comfortable (and cancel if not).
      sharedWith: pool.members.filter((m) => m.id !== ride.id).length,
      coRiderGenders: pool.members.filter((m) => m.id !== ride.id).map((m) => m.passengerGender),
    },
    createdAt: ride.createdAt,
    updatedAt: ride.updatedAt,
    completedAt: ride.completedAt,
    cancelledAt: ride.cancelledAt,
    cancelReason: ride.cancelReason,
  };
}
