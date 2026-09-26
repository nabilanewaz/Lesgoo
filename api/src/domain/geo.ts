// Zones sit on a km grid with Banani at (0, 0). See DESIGN.md §3.
export type GridPoint = { xKm: number; yKm: number };

// Manhattan distance: Dhaka roads are closer to a grid than a straight line,
// and it's whole kilometres, so fares can be checked by hand.
export function manhattanKm(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.xKm - b.xKm) + Math.abs(a.yKm - b.yKm);
}
