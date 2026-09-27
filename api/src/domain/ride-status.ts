import type { RideStatus } from '@prisma/client';

// A passenger's ride request state machine, DESIGN.md §6.
// Anything not listed here is an invalid transition and gets rejected with 409.
export const RIDE_TRANSITIONS: Record<RideStatus, readonly RideStatus[]> = {
  REQUESTED: ['MATCHED', 'CANCELLED'],
  MATCHED: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['STARTED', 'CANCELLED'],
  // STARTED -> CANCELLED only when the Tesla breaks down mid-trip: the passenger pays nothing.
  STARTED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const ACTIVE_RIDE_STATUSES: readonly RideStatus[] = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED'];

export function canRideTransition(from: RideStatus, to: RideStatus): boolean {
  return RIDE_TRANSITIONS[from].includes(to);
}

// A passenger can cancel for free until the trip starts. After that they're in the car: they get
// off (the driver drops them off, maybe early), and only a breakdown cancels a started ride.
export function passengerCanCancel(status: RideStatus): boolean {
  return status !== 'STARTED' && canRideTransition(status, 'CANCELLED');
}
