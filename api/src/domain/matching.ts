import { manhattanKm, type GridPoint } from './geo';

// Matching rule, DESIGN.md §4. A request can share a Tesla with a pool when:
//   1. it starts in the same pickup zone, and
//   2. its destination is within MAX_DESTINATION_SPREAD_KM of EVERY current member's destination.
// Seats are NOT checked here: capacity is enforced atomically by the database (DESIGN.md §8).
export const MAX_DESTINATION_SPREAD_KM = 2;

export type MatchCandidate = { pickupZone: string; dropoff: GridPoint };
export type PoolForMatching = { pickupZone: string; memberDropoffs: GridPoint[] };

export function isCompatible(request: MatchCandidate, pool: PoolForMatching): boolean {
  if (request.pickupZone !== pool.pickupZone) return false;
  return pool.memberDropoffs.every((d) => manhattanKm(request.dropoff, d) <= MAX_DESTINATION_SPREAD_KM);
}

// Fill the fullest Tesla first (fewer vehicles on the road); on a tie, the oldest pool.
export function rankPools<T extends { seatsTaken: number; createdAt: Date }>(pools: T[]): T[] {
  return [...pools].sort((a, b) => b.seatsTaken - a.seatsTaken || a.createdAt.getTime() - b.createdAt.getTime());
}
