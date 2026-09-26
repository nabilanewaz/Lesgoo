// Money arrives from the API as integer paisa. We only turn it into taka for display.
export function taka(paisa: number): string {
  const whole = Math.floor(paisa / 100);
  const rest = paisa % 100;
  const grouped = whole.toLocaleString('en-IN');
  return rest === 0 ? `৳${grouped}` : `৳${grouped}.${String(rest).padStart(2, '0')}`;
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
