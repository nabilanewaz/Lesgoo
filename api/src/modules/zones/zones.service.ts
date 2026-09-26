import { prisma } from '../../lib/prisma';
import { badRequest } from '../../lib/errors';

export function listZones() {
  return prisma.zone.findMany({ orderBy: { name: 'asc' } });
}

// Loads both ends of a trip, or explains which zone code is unknown.
export async function getTripZones(pickupCode: string, dropoffCode: string) {
  const zones = await prisma.zone.findMany({ where: { code: { in: [pickupCode, dropoffCode] } } });
  const pickup = zones.find((z) => z.code === pickupCode);
  const dropoff = zones.find((z) => z.code === dropoffCode);
  if (!pickup) throw badRequest(`Unknown pickup zone: ${pickupCode}`);
  if (!dropoff) throw badRequest(`Unknown dropoff zone: ${dropoffCode}`);
  return { pickup, dropoff };
}
