// Money arrives from the API as integer paisa. We only turn it into taka for display.
export function taka(paisa: number): string {
  const whole = Math.floor(paisa / 100);
  const rest = paisa % 100;
  const grouped = whole.toLocaleString('en-IN');
  return rest === 0 ? `৳${grouped}` : `৳${grouped}.${String(rest).padStart(2, '0')}`;
}

// Distances arrive in metres. Shown to one decimal, without a trailing ".0": 2 km, 1.4 km.
export function km(metres: number): string {
  return `${Number((metres / 1000).toFixed(1))} km`;
}

// Opens a spot in the phone's maps app. `drive` gives the driver turn-by-turn directions.
export function mapsLink(spot: { lat: number; lon: number }, drive = false): string {
  const at = `${spot.lat},${spot.lon}`;
  return drive
    ? `https://www.google.com/maps/dir/?api=1&destination=${at}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${at}`;
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

// Bengali numerals, for decorative numbering (১, ২, ৩).
export function bnNumber(n: number): string {
  return String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]!);
}

export function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}
