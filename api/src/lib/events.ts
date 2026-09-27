import type { Prisma } from '@prisma/client';

// Every state change writes one row to ride_events, inside the same transaction as the
// change itself, so the history can never disagree with the data. See DESIGN.md §6.
export type RideEventType =
  | 'RIDE_REQUESTED'
  | 'RIDE_CANCELLED'
  | 'PREFERENCE_CHANGED'
  | 'RIDE_MATCHED'
  | 'POOL_OPENED'
  | 'DRIVER_ARRIVED'
  | 'TRIP_STARTED'
  | 'TRIP_COMPLETED'
  | 'PASSENGER_DROPPED_OFF'
  | 'TESLA_BROKE_DOWN'
  | 'POOL_CANCELLED';

export type RideEventInput = {
  type: RideEventType;
  rideRequestId?: string;
  poolId?: string;
  actorId?: string;
  fromStatus?: string;
  toStatus?: string;
  data?: Prisma.InputJsonValue;
};

export function recordEvent(tx: Prisma.TransactionClient, event: RideEventInput) {
  return tx.rideEvent.create({ data: event });
}
