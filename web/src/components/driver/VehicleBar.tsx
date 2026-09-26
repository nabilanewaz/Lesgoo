'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { DriverStatus } from '@/lib/types';
import { Wheel } from '../art/Wheel';
import { Alert } from '../ui/Feedback';
import styles from './VehicleBar.module.css';

// Bullet's number plate and the online/offline switch.
export function VehicleBar({ status, onChanged }: { status: DriverStatus; onChanged: () => void }) {
  const { vehicle } = status;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      await api(`/driver/${vehicle.isOnline ? 'offline' : 'online'}`, { method: 'POST' });
      onChanged();
    } catch (err) {
      // e.g. ACTIVE_TRIP: can't go offline with passengers on board
      setError(err instanceof Error ? err.message : 'Could not change your status');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.bar} aria-label="Your Tesla">
      <div className={styles.vehicle}>
        <Wheel size={54} tyre="var(--turmeric)" spinning={vehicle.isOnline && Boolean(status.activePool?.startedAt)} />
        <div>
          <h1 className={`painted ${styles.name}`}>{vehicle.name}</h1>
          <p className={styles.meta}>
            <span className={styles.plate}>{vehicle.plate}</span> {vehicle.capacity} seats
          </p>
        </div>
      </div>

      <div className={styles.switchWrap}>
        <button
          type="button"
          role="switch"
          aria-checked={vehicle.isOnline}
          className={`${styles.switch} ${vehicle.isOnline ? styles.on : ''}`}
          onClick={toggle}
          disabled={pending}
        >
          <span className={styles.knob} aria-hidden="true" />
          <span className={styles.switchLabel}>
            {vehicle.isOnline ? 'Online' : 'Offline'}
            <span lang="bn">{vehicle.isOnline ? 'অনলাইন' : 'অফলাইন'}</span>
          </span>
        </button>
        {error && <Alert>{error}</Alert>}
      </div>
    </section>
  );
}
