import type { Gender, RideStatus } from './types';

// Status wording shown to passengers, with a Bangla line for the painted-sign feel.
export const RIDE_STATUS: Record<RideStatus, { label: string; bn: string }> = {
  REQUESTED: { label: 'Finding your Tesla', bn: 'টেসলা খোঁজা হচ্ছে' },
  MATCHED: { label: 'Driver on the way', bn: 'চালক আসছেন' },
  DRIVER_ARRIVED: { label: 'Your Tesla is here', bn: 'চালক পৌঁছেছেন' },
  STARTED: { label: 'On the way', bn: 'যাত্রা চলছে' },
  COMPLETED: { label: 'Trip complete', bn: 'যাত্রা শেষ' },
  CANCELLED: { label: 'Cancelled', bn: 'বাতিল' },
};

// Human wording for ride_events rows (the audit trail).
export const EVENT_LABEL: Record<string, string> = {
  RIDE_REQUESTED: 'You requested the ride',
  RIDE_MATCHED: 'Matched with a Tesla',
  DRIVER_ARRIVED: 'Driver arrived at pickup',
  TRIP_STARTED: 'Trip started, fare finalised',
  TRIP_COMPLETED: 'Trip completed',
  RIDE_CANCELLED: 'You cancelled the ride',
  PREFERENCE_CHANGED: 'You chose to share with anyone',
  POOL_CANCELLED: 'The driver cancelled the trip',
  PASSENGER_DROPPED_OFF: 'You were dropped off',
  TESLA_BROKE_DOWN: 'The Tesla broke down, no charge',
};

// True when a finished ride ended somewhere other than where it was booked to.
export const gotOffEarly = (r: { dropoff: { code: string }; droppedOff: { code: string } | null }) =>
  r.droppedOff !== null && r.droppedOff.code !== r.dropoff.code;

// Cancelled because the Tesla broke down (the API's cancel reason says so).
export const brokeDown = (r: { cancelReason: string | null }) => r.cancelReason?.startsWith('The Tesla broke down') ?? false;

export const PAYMENT_LABEL = { CASH: 'Cash', TESLAPAY: 'TeslaPay' } as const;

export const ACTIVE_STATUSES: RideStatus[] = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED'];
export const CANCELLABLE_STATUSES: RideStatus[] = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED'];

// A passenger's status as the DRIVER sees it ("Driver on the way" makes no sense to the driver).
export const RIDE_STATUS_FOR_DRIVER: Record<RideStatus, string> = {
  REQUESTED: 'Waiting',
  MATCHED: 'To pick up',
  DRIVER_ARRIVED: 'At pickup',
  STARTED: 'Riding',
  COMPLETED: 'Dropped off',
  CANCELLED: 'Cancelled',
};

// The driver's view of their trip.
export const POOL_STATUS = {
  OPEN: { label: 'Pick up your riders', bn: 'যাত্রী তুলুন' },
  DRIVER_ARRIVED: { label: 'Waiting at pickup', bn: 'অপেক্ষা করছেন' },
  STARTED: { label: 'On the road', bn: 'পথে আছেন' },
  COMPLETED: { label: 'Trip complete', bn: 'যাত্রা শেষ' },
  CANCELLED: { label: 'Trip cancelled', bn: 'বাতিল' },
} as const;

// Same-gender wording, from the rider's own declared gender.
export const SAME_GENDER_OPTION: Record<Exclude<Gender, 'UNDISCLOSED'>, string> = {
  WOMAN: 'Only share with other women',
  MAN: 'Only share with other men',
};
export const SAME_GENDER_TAG: Record<Exclude<Gender, 'UNDISCLOSED'>, string> = {
  WOMAN: 'Women-only ride',
  MAN: 'Men-only ride',
};

// "1 woman, 1 man": how a passenger learns who they're sharing with (gender only).
export function describeCoRiders(genders: Gender[]): string {
  const count = (g: Gender) => genders.filter((x) => x === g).length;
  const parts = [
    [count('WOMAN'), 'woman', 'women'],
    [count('MAN'), 'man', 'men'],
    [count('UNDISCLOSED'), 'person who didn’t say', 'people who didn’t say'],
  ] as const;
  return parts
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
    .join(', ');
}
