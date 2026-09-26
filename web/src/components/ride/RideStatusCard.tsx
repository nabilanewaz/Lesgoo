'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { CANCELLABLE_STATUSES, PAYMENT_LABEL, RIDE_STATUS } from '@/lib/labels';
import type { PassengerRide } from '@/lib/types';
import { Wheel } from '../art/Wheel';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Feedback';
import { TinPlate } from '../ui/TinPlate';
import { FareSummary } from './FareSummary';
import { RideTimeline } from './RideTimeline';
import { StatusTrack } from './StatusTrack';
import styles from './RideStatusCard.module.css';

type Props = {
  ride: PassengerRide;
  onChanged: () => void; // refetch after an action
  onBookAnother?: () => void; // shown once the ride is over
};

function headline(ride: PassengerRide): string {
  const driver = ride.pool ? `${ride.pool.driver.name} and ${ride.pool.vehicle.name}` : 'your Tesla';
  switch (ride.status) {
    case 'REQUESTED':
      return 'Looking for a Tesla heading your way…';
    case 'MATCHED':
      return `${driver} are coming to ${ride.pickup.name}.`;
    case 'DRIVER_ARRIVED':
      return `${ride.pool?.vehicle.name ?? 'Your Tesla'} is waiting at ${ride.pickup.name}. Hop on!`;
    case 'STARTED':
      return `Riding to ${ride.dropoff.name}. Hold on tight.`;
    case 'COMPLETED':
      return `You made it to ${ride.dropoff.name}.`;
    case 'CANCELLED':
      return ride.cancelReason ?? 'This ride was cancelled.';
  }
}

function sharingText(sharedWith: number) {
  if (sharedWith === 0) return 'Just you so far';
  return `Sharing with ${sharedWith} other passenger${sharedWith > 1 ? 's' : ''}`;
}

const FRAME = {
  REQUESTED: 'cobalt',
  MATCHED: 'emerald',
  DRIVER_ARRIVED: 'rani',
  STARTED: 'rani',
  COMPLETED: 'emerald',
  CANCELLED: 'vermilion',
} as const;

export function RideStatusCard({ ride, onChanged, onBookAnother }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = RIDE_STATUS[ride.status];
  const canCancel = CANCELLABLE_STATUSES.includes(ride.status);
  const finished = ride.status === 'COMPLETED' || ride.status === 'CANCELLED';

  async function cancel() {
    setPending(true);
    setError(null);
    try {
      await api(`/rides/${ride.id}/cancel`, { method: 'POST', body: {} });
      onChanged();
    } catch (err) {
      // e.g. 409 because the driver started the trip a moment ago: show why, then refresh.
      setError(err instanceof Error ? err.message : 'Could not cancel');
      onChanged();
    } finally {
      setPending(false);
      setConfirming(false);
    }
  }

  return (
    <TinPlate title={status.label} bnTitle={status.bn} frame={FRAME[ride.status]}>
      <StatusTrack status={ride.status} />

      <div className={styles.headline} aria-live="polite">
        {ride.status === 'REQUESTED' && <Wheel size={44} spinning />}
        {ride.status === 'STARTED' && <Wheel size={44} spinning />}
        <p>{headline(ride)}</p>
      </div>

      <p className={styles.route}>
        <strong>{ride.pickup.name}</strong> → <strong>{ride.dropoff.name}</strong> · {ride.distanceKm} km · {ride.seats}{' '}
        seat{ride.seats > 1 ? 's' : ''} · {PAYMENT_LABEL[ride.paymentMethod]}
      </p>

      {ride.pool && (
        <div className={styles.tesla}>
          <Wheel size={36} />
          <div>
            <strong>
              {ride.pool.driver.name} · {ride.pool.vehicle.name}
            </strong>
            <span className={styles.plate}>{ride.pool.vehicle.plate}</span>
            {!finished && <span>{sharingText(ride.pool.sharedWith)}</span>}
          </div>
        </div>
      )}

      <FareSummary ride={ride} />

      {error && (
        <div className={styles.spaced}>
          <Alert>{error}</Alert>
        </div>
      )}

      <div className={styles.actions}>
        {canCancel &&
          (confirming ? (
            <>
              <span className={styles.confirmText}>Cancel this ride?</span>
              <Button variant="danger" loading={pending} onClick={cancel}>
                Yes, cancel
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                Keep my ride
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              Cancel ride
            </Button>
          ))}
        {finished && onBookAnother && <Button onClick={onBookAnother}>Book another ride</Button>}
      </div>

      <RideTimeline ride={ride} />
    </TinPlate>
  );
}
