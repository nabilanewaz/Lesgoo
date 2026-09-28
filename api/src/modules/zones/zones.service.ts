import type { Spot } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { badRequest } from '../../lib/errors';

// Areas with their pickup / drop-off spots (main spot first).
export function listZones() {
  return prisma.zone.findMany({
    orderBy: { name: 'asc' },
    include: {
      spots: {
        orderBy: { sortOrder: 'asc' },
        select: { code: true, name: true, nameBn: true, lat: true, lon: true, isMain: true },
      },
    },
  });
}

// How a spot appears in every API response: names for people, lat/lon for the maps link.
export const spotRef = (spot: Pick<Spot, 'code' | 'name' | 'nameBn' | 'lat' | 'lon'>) => ({
  code: spot.code,
  name: spot.name,
  nameBn: spot.nameBn,
  lat: spot.lat,
  lon: spot.lon,
});

// One end of a trip: an exact spot, or just an area (which means that area's main spot).
export type TripEnd = { spot?: string; zone?: string };

async function resolveEnd(end: TripEnd, label: 'pickup' | 'dropoff') {
  if (end.spot) {
    const spot = await prisma.spot.findUnique({ where: { code: end.spot }, include: { zone: true } });
    if (!spot) throw badRequest(`Unknown ${label} spot: ${end.spot}`);
    if (end.zone && end.zone !== spot.zoneCode) throw badRequest(`${spot.name} is not in ${end.zone}`);
    return spot;
  }
  const spot = await prisma.spot.findFirst({ where: { zoneCode: end.zone, isMain: true }, include: { zone: true } });
  if (!spot) throw badRequest(`Unknown ${label} zone: ${end.zone}`);
  return spot;
}

// Loads both ends of a trip, or explains what's wrong with them.
export async function getTripSpots(pickup: TripEnd, dropoff: TripEnd) {
  const from = await resolveEnd(pickup, 'pickup');
  const to = await resolveEnd(dropoff, 'dropoff');
  // Trips inside one area are too short for a Tesla (and the fare grid can't price them fairly).
  if (from.zoneCode === to.zoneCode) {
    throw badRequest('Pickup and destination must be in different areas', [
      { path: 'dropoffZone', message: 'Pickup and destination must be in different areas' },
    ]);
  }
  return { pickup: from, dropoff: to };
}
