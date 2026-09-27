'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { brokeDown, CANCELLABLE_STATUSES, gotOffEarly, PAYMENT_LABEL, RIDE_STATUS, describeCoRiders } from '@/lib/labels';
import type { Gender, PassengerRide } from '@/lib/types';
import { Wheel } from '../art/Wheel';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Feedback';
import { TinPlate } from '../ui/TinPlate';
import { FareSummary } from './FareSummary';
import { PreferenceTags } from './PreferenceTags';
import { RideTimeline } from './RideTimeline';
import { StatusTrack } from './StatusTrack';
import styles from './RideStatusCard.module.css';

type Props = {
  ride: PassengerRide;
  onChanged: () => void; // refetch after an action
  // Shown once the ride is over. After a breakdown it carries the trip to rebook.
  onBookAnother?: (rebook?: { pickup: string; dropoff: string; seats: number; note: string }) => void;
};

const OTHER_GENDER = { WOMAN: 'men', MAN: 'women', UNDISCLOSED: '' } as const;

function headline(ride: PassengerRide, gender: Gender): string {
  const driver = ride.pool ? `${ride.pool.driver.name} and ${ride.pool.vehicle.name}` : 'your Tesla';
  switch (ride.status) {
    case 'REQUESTED':
      // Tell a same-gender rider WHY it may take longer.
      if (ride.sameGenderOnly && gender !== 'UNDISCLOSED') {
        return `Waiting for a Tesla with no ${OTHER_GENDER[gender]} on board…`;
      }
      return 'Looking for a Tesla heading your way…';
    case 'MATCHED':
      return `${driver} are coming to ${ride.pickup.name}.`;
    case 'DRIVER_ARRIVED':
      return `${ride.pool?.vehicle.name ?? 'Your Tesla'} is waiting at ${ride.pickup.name}. Hop on!`;
    case 'STARTED':
      return `Riding to ${ride.dropoff.name}. Hold on tight.`;
    case 'COMPLETED':
      if (ride.droppedOff && gotOffEarly(ride)) return `You got off at ${ride.droppedOff.name}, on the way to ${ride.dropoff.name}.`;
      return `You made it to ${ride.dropoff.name}.`;
    case 'CANCELLED':
      return ride.cancelReason ?? 'This ride was cancelled.';
  }
}

function sharingText(ride: PassengerRide) {
  const pool = ride.pool;
  if (!ride.shareRide) return 'Riding alone';
  if (!pool || pool.sharedWith === 0) return 'Just you so far';
  return `Sharing with ${describeCoRiders(pool.coRiderGenders)}`;
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
  const { user } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [confirmRelax, setConfirmRelax] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = RIDE_STATUS[ride.status];
  const canCancel = CANCELLABLE_STATUSES.includes(ride.status);
  const finished = ride.status === 'COMPLETED' || ride.status === 'CANCELLED';
  const broken = ride.status === 'CANCELLED' && brokeDown(ride);
  // A breakdown after pick-up leaves the rider somewhere on the way: they choose where they are.
  const brokeMidTrip = broken && ride.fare.farePaisa !== null;

  // Same-gender rider still waiting: let her choose to share with anyone instead.
  async function shareWithAnyone() {
    setPending(true);
    setError(null);
    try {
      await api(`/rides/${ride.id}/share-with-anyone`, { method: 'POST' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your ride');
    } finally {
      setPending(false);
      setConfirmRelax(false);
      onChanged();
    }
  }

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
        <p>{headline(ride, user?.gender ?? 'UNDISCLOSED')}</p>
      </div>

      <p className={styles.route}>
        <strong>{ride.pickup.name}</strong> →{' '}
        {ride.droppedOff && gotOffEarly(ride) ? (
          <>
            <s>{ride.dropoff.name}</s> <strong>{ride.droppedOff.name}</strong>
          </>
        ) : (
          <strong>{ride.dropoff.name}</strong>
        )}{' '}
        · {ride.distanceKm} km · {ride.seats}{' '}
        seat{ride.seats > 1 ? 's' : ''} · {PAYMENT_LABEL[ride.paymentMethod]}
        <br />
        <PreferenceTags shareRide={ride.shareRide} sameGenderOnly={ride.sameGenderOnly} gender={user?.gender ?? 'UNDISCLOSED'} />
      </p>

      {ride.pool && (
        <div className={styles.tesla}>
          <Wheel size={36} />
          <div>
            <strong>
              {ride.pool.driver.name} · {ride.pool.vehicle.name}
            </strong>
            <span className={styles.plate}>{ride.pool.vehicle.plate}</span>
            {!finished && <span>{sharingText(ride)}</span>}
          </div>
        </div>
      )}

      {ride.status === 'REQUESTED' && ride.sameGenderOnly && (
        <div className={styles.relax}>
          {confirmRelax ? (
            <>
              <p>
                You&apos;ll join a Tesla heading your way if its driver adds riders automatically, or drivers will see
                you and can pick you up. You&apos;ll see your co-riders&apos; gender and can still cancel.
              </p>
              <div className={styles.relaxButtons}>
                <Button variant="secondary" loading={pending} onClick={shareWithAnyone}>
                  Yes, share with anyone
                </Button>
                <Button variant="ghost" disabled={pending} onClick={() => setConfirmRelax(false)}>
                  Keep waiting
                </Button>
              </div>
            </>
          ) : (
            <>
              <p>In a hurry? Same-gender rides can take longer to match.</p>
              <Button variant="ghost" onClick={() => setConfirmRelax(true)}>
                Share with anyone instead
              </Button>
            </>
          )}
        </div>
      )}

      {ride.status === 'STARTED' && (
        <p className={styles.prefNote}>
          Need to get off before {ride.dropoff.name}? Tell {ride.pool?.driver.name ?? 'your driver'}. You only pay for the part you
          ride.
        </p>
      )}

      {broken && (
        <div className={styles.spaced}>
          <Alert tone="info">
            Sorry! {brokeMidTrip ? 'You won’t be charged for this ride.' : 'Nothing was charged.'} Book another Tesla and we’ll
            get you to {ride.dropoff.name}.
          </Alert>
        </div>
      )}

      {canCancel && ride.pool && ride.pool.sharedWith > 0 && (
        <p className={styles.prefNote}>Not comfortable with who you&apos;re sharing with? You can cancel for free until the trip starts.</p>
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
        {finished && onBookAnother && !broken && <Button onClick={() => onBookAnother()}>Book another ride</Button>}
        {broken && onBookAnother && (
          <Button
            onClick={() =>
              onBookAnother({
                pickup: ride.pickup.code,
                dropoff: ride.dropoff.code,
                seats: ride.seats,
                note: brokeMidTrip
                  ? `Your destination is filled in. Choose where you are now.`
                  : `Same trip, filled in for you. We’ll find another Tesla.`,
              })
            }
          >
            Book another Tesla
          </Button>
        )}
      </div>

      <RideTimeline ride={ride} />
    </TinPlate>
  );
}
