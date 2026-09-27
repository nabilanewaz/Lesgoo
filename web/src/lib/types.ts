// Shapes returned by the API (see api/src/modules/*/*.view.ts).

export type Role = 'PASSENGER' | 'DRIVER';
export type Gender = 'WOMAN' | 'MAN' | 'UNDISCLOSED';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  gender: Gender;
  vehicle?: { id: string; name: string; plate: string; capacity: number; isOnline: boolean } | null;
};

export type Zone = { code: string; name: string; xKm: number; yKm: number };
export type ZoneRef = { code: string; name: string };

export type FareBreakdown = {
  distanceKm: number;
  seats: number;
  baseFarePaisa: number;
  distanceChargePaisa: number;
  subtotalPaisa: number;
  poolDiscountPaisa: number;
  farePaisa: number;
};

export type Estimate = { pickup: ZoneRef; dropoff: ZoneRef; solo: FareBreakdown; pooled: FareBreakdown };

export type RideStatus = 'REQUESTED' | 'MATCHED' | 'DRIVER_ARRIVED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';
export type PoolStatus = 'OPEN' | 'DRIVER_ARRIVED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';

export type PassengerRide = {
  id: string;
  status: RideStatus;
  pickup: ZoneRef;
  dropoff: ZoneRef;
  seats: number;
  distanceKm: number;
  paymentMethod: 'CASH' | 'TESLAPAY';
  shareRide: boolean;
  sameGenderOnly: boolean;
  fare: {
    subtotalPaisa: number;
    pooledEstimatePaisa: number | null; // null when riding alone
    poolDiscountPaisa: number | null;
    farePaisa: number | null;
    isFinal: boolean;
  };
  pool: {
    id: string;
    status: PoolStatus;
    vehicle: { name: string; plate: string };
    driver: { name: string };
    sharedWith: number;
    coRiderGenders: Gender[]; // declared gender of each co-rider, nothing else
  } | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
};

export type RideEvent = { id: string; type: string; fromStatus: string | null; toStatus: string | null; createdAt: string };

export type DriverPassenger = {
  rideId: string;
  name: string;
  dropoff: ZoneRef;
  seats: number;
  status: RideStatus;
  paymentMethod: 'CASH' | 'TESLAPAY';
  shareRide: boolean;
  sameGenderOnly: boolean;
  gender: Gender;
  subtotalPaisa: number;
  farePaisa: number | null;
};

export type DriverPool = {
  id: string;
  status: PoolStatus;
  pickup: ZoneRef;
  capacity: number;
  seatsTaken: number;
  seatsLeft: number;
  passengers: DriverPassenger[];
  totalFarePaisa: number;
  createdAt: string;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
};

export type DriverStatus = {
  vehicle: { id: string; name: string; plate: string; capacity: number; isOnline: boolean; autoAccept: boolean };
  activePool: DriverPool | null;
};

export type FeedRequest = {
  rideId: string;
  passengerName: string;
  pickup: ZoneRef;
  dropoff: ZoneRef;
  seats: number;
  distanceKm: number;
  shareRide: boolean;
  sameGenderOnly: boolean;
  gender: Gender;
  subtotalPaisa: number;
  requestedAt: string;
};
