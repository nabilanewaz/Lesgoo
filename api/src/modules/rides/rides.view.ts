import type { Prisma } from '@prisma/client';
import { poolDiscountPaisa } from '../../domain/fare';

export const passengerRideInclude = {
  pickup: true,
  dropoff: true,
} satisfies Prisma.RideRequestInclude;

type RideWithZones = Prisma.RideRequestGetPayload<{ include: typeof passengerRideInclude }>;

// What a passenger sees about their OWN ride. Never includes other passengers' details.
export function toPassengerRide(ride: RideWithZones) {
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
    createdAt: ride.createdAt,
    updatedAt: ride.updatedAt,
    cancelledAt: ride.cancelledAt,
    cancelReason: ride.cancelReason,
  };
}
