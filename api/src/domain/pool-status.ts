import type { PoolStatus } from '@prisma/client';

// The Tesla's trip state machine, DESIGN.md §6.
export const POOL_TRANSITIONS: Record<PoolStatus, readonly PoolStatus[]> = {
  OPEN: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['STARTED', 'CANCELLED'],
  STARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const ACTIVE_POOL_STATUSES: readonly PoolStatus[] = ['OPEN', 'DRIVER_ARRIVED', 'STARTED'];

export function canPoolTransition(from: PoolStatus, to: PoolStatus): boolean {
  return POOL_TRANSITIONS[from].includes(to);
}
