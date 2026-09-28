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

// A landmark inside an area where a Tesla stops. The Bangla name is what drivers read first;
// lat/lon only feed the maps links.
export type SpotRef = { code: string; name: string; nameBn: string; lat: number; lon: number };
export type Spot = SpotRef & { isMain: boolean };

export type Zone = { code: string; name: string; xKm: number; yKm: number; spots: Spot[] };
export type ZoneRef = { code: string; name: string };
// An area plus the exact spot in it.
export type Place = ZoneRef & { spot: SpotRef };

export type FareBreakdown = {
  distanceM: number;
  seats: number;
  baseFarePaisa: number;
  distanceChargePaisa: number;
  subtotalPaisa: number;
  poolDiscountPaisa: number;
  farePaisa: number;
};

export type Estimate = { pickup: Place; dropoff: Place; solo: FareBreakdown; pooled: FareBreakdown };

export type RideStatus = 'REQUESTED' | 'MATCHED' | 'DRIVER_ARRIVED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';
export type PoolStatus = 'OPEN' | 'DRIVER_ARRIVED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';

export type PassengerRide = {
  id: string;
  status: RideStatus;
  pickup: Place;
  dropoff: Place;
  droppedOff: ZoneRef | null; // where they actually got off; differs from dropoff if early
  seats: number;
  distanceM: number;
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
    meetingSpot: SpotRef; // where to meet the Tesla
    vehicle: { name: string; plate: string };
    driver: { name: string };
    sharedWith: number;
    coRiderGenders: Gender[]; // declared gender of each co-rider, nothing else
  } | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
};

export type RideEvent = { id: string; type: string; fromStatus: string | null; toStatus: string | null; createdAt: string };

export type DriverPassenger = {
  rideId: string;
  name: string;
  dropoff: Place;
  pickupSpot: SpotRef; // where they booked from (they walk to the meeting spot if different)
  seats: number;
  status: RideStatus;
  paymentMethod: 'CASH' | 'TESLAPAY';
  shareRide: boolean;
  sameGenderOnly: boolean;
  gender: Gender;
  subtotalPaisa: number;
  farePaisa: number | null;
  droppedOff: ZoneRef | null;
  cancelReason: string | null;
  stopsOnTheWay: ZoneRef[]; // where they could get off early, nearest first (only while riding)
};

export type DriverPool = {
  id: string;
  status: PoolStatus;
  pickup: ZoneRef;
  meetingSpot: SpotRef; // where the driver picks everyone up
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
  pickup: Place;
  dropoff: Place;
  seats: number;
  distanceM: number;
  shareRide: boolean;
  sameGenderOnly: boolean;
  gender: Gender;
  subtotalPaisa: number;
  requestedAt: string;
};
