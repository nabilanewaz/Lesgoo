import { RIDE_STATUS, RIDE_STATUS_FOR_DRIVER } from '@/lib/labels';
import type { RideStatus } from '@/lib/types';
import styles from './StatusBadge.module.css';

// Same colours for everyone; wording depends on who is looking.
export function StatusBadge({ status, viewer = 'passenger' }: { status: RideStatus; viewer?: 'passenger' | 'driver' }) {
  const label = viewer === 'driver' ? RIDE_STATUS_FOR_DRIVER[status] : RIDE_STATUS[status].label;
  return <span className={`${styles.badge} ${styles[status]}`}>{label}</span>;
}
