'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { taka } from '@/lib/format';
import { PAYMENT_LABEL, POOL_STATUS } from '@/lib/labels';
import type { DriverPool } from '@/lib/types';
import { StatusBadge } from '../ride/StatusBadge';
import { Button } from '../ui/Button';
import { Alert, EmptyState } from '../ui/Feedback';
import { TinPlate } from '../ui/TinPlate';
import { SeatMeter } from './SeatMeter';
import styles from './TripPanel.module.css';

type Action = 'arrive' | 'start' | 'complete' | 'cancel';

// The one obvious next step for each trip state (mirrors the API's state machine).
const NEXT: Record<'OPEN' | 'DRIVER_ARRIVED' | 'STARTED', { action: Action; label: string; hint: string }> = {
  OPEN: { action: 'arrive', label: 'I’ve arrived at pickup', hint: 'Marking arrival locks the passenger list.' },
  DRIVER_ARRIVED: { action: 'start', label: 'Start trip', hint: 'Starting finalises every passenger’s fare.' },
  STARTED: { action: 'complete', label: 'Complete trip', hint: 'Complete once everyone has been dropped off.' },
};

export function TripPanel({ pool, online, onChanged }: { pool: DriverPool | null; online: boolean; onChanged: () => void }) {
  const [pending, setPending] = useState<Action | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pool) {
    return (
      <TinPlate title="Your trip" bnTitle="আপনার যাত্রা" frame="emerald">
        <EmptyState title={online ? 'No trip yet' : 'You’re offline'}>
          <p>{online ? 'Accept a waiting rider to start a trip.' : 'Go online to see riders waiting nearby.'}</p>
        </EmptyState>
      </TinPlate>
    );
  }

  async function run(action: Action) {
    setPending(action);
    setError(null);
    try {
      await api(`/driver/pool/${action}`, { method: 'POST' });
    } catch (err) {
      // e.g. 409 because a double tap already moved the trip on: show it, then refresh.
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPending(null);
      setConfirmCancel(false);
      onChanged();
    }
  }

  const status = POOL_STATUS[pool.status];
  const next = pool.status in NEXT ? NEXT[pool.status as keyof typeof NEXT] : null;
  const canCancel = pool.status === 'OPEN' || pool.status === 'DRIVER_ARRIVED';
  const fareKnown = pool.startedAt !== null;

  return (
    <TinPlate title={status.label} bnTitle={status.bn} frame="rani">
      <p className={styles.pickup}>
        Pickup at <strong>{pool.pickup.name}</strong>
      </p>
      <SeatMeter taken={pool.seatsTaken} capacity={pool.capacity} />

      <ul className={styles.passengers} aria-label="Passengers">
        {pool.passengers.map((p) => (
          <li key={p.rideId} className={p.status === 'CANCELLED' ? styles.cancelled : undefined}>
            <div>
              <strong>{p.name}</strong>
              <span className={styles.drop}>
                to {p.dropoff.name} · {p.seats} seat{p.seats > 1 ? 's' : ''} · {PAYMENT_LABEL[p.paymentMethod]}
              </span>
            </div>
            <div className={styles.right}>
              <span className={styles.fare}>
                {p.status === 'CANCELLED' ? '—' : p.farePaisa !== null ? taka(p.farePaisa) : `≈ ${taka(p.subtotalPaisa)}`}
              </span>
              <StatusBadge status={p.status} viewer="driver" />
            </div>
          </li>
        ))}
      </ul>

      <p className={styles.total}>
        {fareKnown ? (
          <>
            Trip total <strong>{taka(pool.totalFarePaisa)}</strong>
          </>
        ) : (
          'Fares are final once you start the trip.'
        )}
      </p>

      {error && <Alert>{error}</Alert>}

      {next && (
        <>
          <Button full loading={pending === next.action} disabled={pending !== null} onClick={() => run(next.action)}>
            {next.label}
          </Button>
          <p className={styles.hint}>{next.hint}</p>
        </>
      )}

      {canCancel && (
        <div className={styles.cancelRow}>
          {confirmCancel ? (
            <>
              <span>Cancel for every passenger?</span>
              <Button variant="danger" loading={pending === 'cancel'} onClick={() => run('cancel')}>
                Yes, cancel trip
              </Button>
              <Button variant="ghost" onClick={() => setConfirmCancel(false)} disabled={pending !== null}>
                Keep trip
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmCancel(true)} disabled={pending !== null}>
              Cancel trip
            </Button>
          )}
        </div>
      )}
    </TinPlate>
  );
}
