// Shapes returned by the API (see api/src/modules/*/*.view.ts).

export type Role = 'PASSENGER' | 'DRIVER';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
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
