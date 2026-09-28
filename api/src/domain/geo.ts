// Zones sit on a km grid with Banani at (0, 0). See DESIGN.md §3.
export type GridPoint = { xKm: number; yKm: number };

// Manhattan distance: Dhaka roads are closer to a grid than a straight line,
// and it's whole kilometres, so fares can be checked by hand.
export function manhattanKm(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.xKm - b.xKm) + Math.abs(a.yKm - b.yKm);
}

// Spots (landmarks inside an area) sit on the same grid, in metres. An area's main spot is
// exactly on the area's point, so main spot to main spot = the area distance x 1000.
export type SpotPoint = { xM: number; yM: number };

export function manhattanM(a: SpotPoint, b: SpotPoint): number {
  return Math.abs(a.xM - b.xM) + Math.abs(a.yM - b.yM);
}

// Areas a passenger could get off at on the way: zones that add no detour between pickup and
// destination (on a grid, anything inside the rectangle the trip spans). Nearest to the pickup
// first, which is the order the driver passes them. Excludes both ends of the trip.
export function zonesOnTheWay<Z extends GridPoint & { code: string }>(pickup: Z, dropoff: Z, zones: readonly Z[]): Z[] {
  const direct = manhattanKm(pickup, dropoff);
  return zones
    .filter((z) => z.code !== pickup.code && z.code !== dropoff.code)
    .filter((z) => manhattanKm(pickup, z) + manhattanKm(z, dropoff) === direct)
    .sort((a, b) => manhattanKm(pickup, a) - manhattanKm(pickup, b));
}
