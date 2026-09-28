import type { Gender } from '@prisma/client';
import { manhattanM, type SpotPoint } from './geo';

// Matching rules, DESIGN.md §4. A request can share a Tesla with a pool when:
//   1. it starts in the same pickup zone, within a short walk of the trip's meeting spot,
//   2. its destination is within MAX_DESTINATION_SPREAD_M (2 km) of EVERY current member's destination,
//   3. everyone agrees to share: a "ride alone" request only goes into an empty Tesla, and
//      nobody joins a Tesla that has a "ride alone" passenger in it,
//   4. same-gender requests are honoured both ways: a "women only" rider only shares with
//      women, and only women can join a Tesla that has a "women only" rider (same for men).
// Seats are NOT checked here: capacity is enforced atomically by the database (DESIGN.md §8).
// These rules apply to automatic matching AND to driver accepts alike.
export const MAX_DESTINATION_SPREAD_M = 2000;
// Riders sharing a Tesla meet it at one spot. Someone booked from another spot in the same area
// is only added if that's a short walk (500 m along the streets, a few minutes).
export const MAX_WALK_TO_MEETING_SPOT_M = 500;

export type Rider = { dropoff: SpotPoint; shareRide: boolean; sameGenderOnly: boolean; gender: Gender };
export type MatchCandidate = Rider & { pickupZone: string; pickup: SpotPoint };
export type PoolForMatching = { pickupZone: string; meetingSpot: SpotPoint; members: Rider[] };

// Rule 1, second half.
export function withinWalkOfMeetingSpot(request: MatchCandidate, pool: PoolForMatching): boolean {
  return manhattanM(request.pickup, pool.meetingSpot) <= MAX_WALK_TO_MEETING_SPOT_M;
}

// Rule 3.
export function sharingAllowed(request: MatchCandidate, pool: PoolForMatching): boolean {
  if (!request.shareRide && pool.members.length > 0) return false;
  return pool.members.every((m) => m.shareRide);
}

// Rule 4, checked in both directions for every pair. An undisclosed gender never satisfies a
// same-gender request (and can't make one: see ride_requests_same_gender_check).
export function genderPreferencesMet(request: MatchCandidate, pool: PoolForMatching): boolean {
  return pool.members.every(
    (m) =>
      (!request.sameGenderOnly || (m.gender === request.gender && m.gender !== 'UNDISCLOSED')) &&
      (!m.sameGenderOnly || (request.gender === m.gender && request.gender !== 'UNDISCLOSED')),
  );
}

export function isCompatible(request: MatchCandidate, pool: PoolForMatching): boolean {
  if (request.pickupZone !== pool.pickupZone) return false;
  if (!withinWalkOfMeetingSpot(request, pool)) return false;
  if (!sharingAllowed(request, pool)) return false;
  if (!genderPreferencesMet(request, pool)) return false;
  return pool.members.every((m) => manhattanM(request.dropoff, m.dropoff) <= MAX_DESTINATION_SPREAD_M);
}

// Fill the fullest Tesla first (fewer vehicles on the road); on a tie, the oldest pool.
export function rankPools<T extends { seatsTaken: number; createdAt: Date }>(pools: T[]): T[] {
  return [...pools].sort((a, b) => b.seatsTaken - a.seatsTaken || a.createdAt.getTime() - b.createdAt.getTime());
}
