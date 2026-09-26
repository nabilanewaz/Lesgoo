import { RIDE_STATUS } from '@/lib/labels';
import type { RideStatus } from '@/lib/types';
import styles from './StatusTrack.module.css';

const STEPS: RideStatus[] = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED'];
const SHORT: Record<RideStatus, string> = {
  REQUESTED: 'Requested',
  MATCHED: 'Matched',
  DRIVER_ARRIVED: 'Arrived',
  STARTED: 'Riding',
  COMPLETED: 'Done',
  CANCELLED: 'Cancelled',
};

// The ride's lifecycle as a row of painted beads: done, current, still to come.
export function StatusTrack({ status }: { status: RideStatus }) {
  const current = STEPS.indexOf(status);
  return (
    <ol className={styles.track} aria-label="Ride progress">
      {STEPS.map((step, i) => {
        const state = status === 'CANCELLED' ? 'todo' : i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={step} className={styles[state]} aria-current={state === 'current' ? 'step' : undefined}>
            <span className={styles.bead} aria-hidden="true" />
            <span className={styles.label}>{SHORT[step]}</span>
            <span className="sr-only">{state === 'done' ? '(done)' : state === 'current' ? `(now: ${RIDE_STATUS[step].label})` : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}
