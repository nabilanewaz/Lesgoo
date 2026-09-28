import { isCompatible } from '../../domain/matching';
import { ACTIVE_POOL_STATUSES } from '../../domain/pool-status';
import { ACTIVE_RIDE_STATUSES } from '../../domain/ride-status';
import { conflict, forbidden } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { lockVehicle } from '../pools/pools.service';
import { driverPoolInclude, feedRequestInclude, toDriverPool, toFeedRequest } from './driver.view';

async function getVehicle(driverId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { driverId } });
  if (!vehicle) throw forbidden('You need a registered Tesla to drive');
  return vehicle;
}

async function findActivePool(vehicleId: string) {
  return prisma.pool.findFirst({
    where: { vehicleId, status: { in: [...ACTIVE_POOL_STATUSES] } },
    include: driverPoolInclude,
  });
}

export async function getDriverStatus(driverId: string) {
  const vehicle = await getVehicle(driverId);
  const pool = await findActivePool(vehicle.id);
  // Needed to offer "got off early" stops; ten reference rows.
  const zones = pool?.status === 'STARTED' ? await prisma.zone.findMany() : [];
  return {
    vehicle: {
      id: vehicle.id,
      name: vehicle.name,
      plate: vehicle.plate,
      capacity: vehicle.capacity,
      isOnline: vehicle.isOnline,
      autoAccept: vehicle.autoAccept,
    },
    activePool: pool ? toDriverPool(pool, zones) : null,
  };
}

export async function setOnline(driverId: string, online: boolean) {
  const vehicle = await getVehicle(driverId);

  await prisma.$transaction(async (tx) => {
    // Same lock as acceptRequest, so "go offline" and "accept" can't interleave.
    await lockVehicle(tx, vehicle.id);
    if (!online) {
      const active = await tx.pool.count({ where: { vehicleId: vehicle.id, status: { in: [...ACTIVE_POOL_STATUSES] } } });
      if (active > 0) throw conflict('Finish or cancel your current trip before going offline', 'ACTIVE_TRIP');
    }
    await tx.vehicle.update({ where: { id: vehicle.id }, data: { isOnline: online } });
  });

  return getDriverStatus(driverId);
}

// "Relevant requests" for this driver right now:
//   - offline, or trip already underway: nothing
//   - no trip: every waiting request that fits in the Tesla, oldest first
//   - an OPEN trip: only waiting requests that match it and fit in the seats left
export async function getRequestFeed(driverId: string) {
  const vehicle = await getVehicle(driverId);
  if (!vehicle.isOnline) return [];

  const pool = await findActivePool(vehicle.id);
  if (pool && pool.status !== 'OPEN') return [];

  const seatsLeft = pool ? pool.capacity - pool.seatsTaken : vehicle.capacity;
  const waiting = await prisma.rideRequest.findMany({
    where: {
      status: 'REQUESTED',
      seats: { lte: seatsLeft },
      ...(pool && { pickupZone: pool.pickupZone }),
    },
    include: feedRequestInclude,
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  if (!pool) return waiting.map(toFeedRequest);

  // Same rules as joinPool, so the feed only offers riders the driver can actually accept.
  const members = pool.members
    .filter((m) => ACTIVE_RIDE_STATUSES.includes(m.status))
    .map((m) => ({ dropoff: m.dropoffSpot, shareRide: m.shareRide, sameGenderOnly: m.sameGenderOnly, gender: m.passengerGender }));
  const trip = { pickupZone: pool.pickupZone, meetingSpot: pool.meetingSpot, members };
  return waiting
    .filter((r) =>
      isCompatible(
        {
          pickupZone: r.pickupZone,
          pickup: r.pickupSpot,
          dropoff: r.dropoffSpot,
          shareRide: r.shareRide,
          sameGenderOnly: r.sameGenderOnly,
          gender: r.passengerGender,
        },
        trip,
      ),
    )
    .map(toFeedRequest);
}

export async function getPoolHistory(driverId: string) {
  const vehicle = await getVehicle(driverId);
  const pools = await prisma.pool.findMany({
    where: { vehicleId: vehicle.id },
    include: driverPoolInclude,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return pools.map((p) => toDriverPool(p));
}

// The driver decides how he works: compatible riders join automatically, or wait for him.
export async function setAutoAccept(driverId: string, enabled: boolean) {
  const vehicle = await getVehicle(driverId);
  await prisma.vehicle.update({ where: { id: vehicle.id }, data: { autoAccept: enabled } });
  return getDriverStatus(driverId);
}
