'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { taka } from '@/lib/format';
import { gotOffEarly, PAYMENT_LABEL, POOL_STATUS } from '@/lib/labels';
import type { DriverPool } from '@/lib/types';
import { PreferenceTags } from '../ride/PreferenceTags';
import { StatusBadge } from '../ride/StatusBadge';
import { Button } from '../ui/Button';
import { Alert, EmptyState } from '../ui/Feedback';
import { TinPlate } from '../ui/TinPlate';
import { BreakdownButton, DropOffButtons, type BreakdownReason } from './MidTrip';
import { SeatMeter } from './SeatMeter';
import styles from './TripPanel.module.css';

type Action = 'arrive' | 'start' | 'cancel';

// The one obvious next step before the trip (mirrors the API's state machine). Once it has
// started, each passenger gets their own drop-off button instead.
const NEXT: Record<'OPEN' | 'DRIVER_ARRIVED', { action: Action; label: string; hint: string }> = {
  OPEN: { action: 'arrive', label: 'I’ve arrived at pickup', hint: 'Marking arrival locks the passenger list.' },
  DRIVER_ARRIVED: { action: 'start', label: 'Start trip', hint: 'Starting finalises every passenger’s fare.' },
};

// How the last trip ended, shown once it has gone from the panel.
const ENDED = {
  completed: { tone: 'success', text: 'Trip complete. Everyone has been dropped off.' },
  breakdown: { tone: 'info', text: 'Breakdown reported. Your passengers were not charged. Go online again once Bullet is fixed.' },
} as const;

export function TripPanel({ pool, online, onChanged }: { pool: DriverPool | null; online: boolean; onChanged: () => void }) {
  // What is in flight: a trip action, a passenger's ride id (drop-off), or 'breakdown'.
  const [pending, setPending] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState<keyof typeof ENDED | null>(null);

  if (!pool) {
    return (
      <TinPlate title="Your trip" bnTitle="আপনার যাত্রা" frame="emerald">
        {ended && <Alert tone={ENDED[ended].tone}>{ENDED[ended].text}</Alert>}
        <EmptyState title={online ? 'No trip yet' : 'You’re offline'}>
          <p>{online ? 'Accept a waiting rider to start a trip.' : 'Go online to see riders waiting nearby.'}</p>
        </EmptyState>
      </TinPlate>
    );
  }

  // Every button goes through here: one request at a time, errors shown, then a fresh view.
  async function send(key: string, path: string, body?: unknown) {
    setPending(key);
    setError(null);
    setEnded(null);
    try {
      const res = await api<{ activePool: DriverPool | null }>(path, { method: 'POST', body });
      if (!res.activePool && key === 'breakdown') setEnded('breakdown');
      else if (!res.activePool && key !== 'cancel') setEnded('completed');
    } catch (err) {
      // e.g. 409 because a double tap already moved the trip on: show it, then refresh.
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPending(null);
      setConfirmCancel(false);
      onChanged();
    }
  }

  const run = (action: Action) => send(action, `/driver/pool/${action}`);
  const dropOff = (rideId: string, zone?: string) => send(rideId, `/driver/rides/${rideId}/drop-off`, zone ? { zone } : {});
  const reportBreakdown = (reason: BreakdownReason) => send('breakdown', '/driver/pool/breakdown', { reason });

  const status = POOL_STATUS[pool.status];
  const next = pool.status in NEXT ? NEXT[pool.status as keyof typeof NEXT] : null;
  const riding = pool.status === 'STARTED';
  const canCancel = pool.status === 'OPEN' || pool.status === 'DRIVER_ARRIVED';
  const fareKnown = pool.startedAt !== null;
  const active = pool.passengers.filter((p) => p.status !== 'CANCELLED');
  const sameGender = active.find((p) => p.sameGenderOnly && p.gender !== 'UNDISCLOSED');
  const soloRider = active.find((p) => !p.shareRide);

  return (
    <TinPlate title={status.label} bnTitle={status.bn} frame="rani">
      <p className={styles.pickup}>
        Pickup at <strong>{pool.pickup.name}</strong>
      </p>
      <SeatMeter taken={pool.seatsTaken} capacity={pool.capacity} />

      {pool.status === 'OPEN' && soloRider && (
        <p className={styles.banner}>{soloRider.name} is riding alone, so nobody else can join this trip.</p>
      )}
      {pool.status === 'OPEN' && sameGender && (
        <p className={styles.banner}>
          {sameGender.name} asked for a {sameGender.gender === 'WOMAN' ? 'women' : 'men'}-only ride. Only{' '}
          {sameGender.gender === 'WOMAN' ? 'women' : 'men'} can join this trip, and your list below already reflects that.
        </p>
      )}

      <ul className={styles.passengers} aria-label="Passengers">
        {pool.passengers.map((p) => (
          <li key={p.rideId} className={p.status === 'CANCELLED' ? styles.cancelled : undefined}>
            <div>
              <strong>{p.name}</strong>
              <span className={styles.drop}>
                to {p.dropoff.name} · {p.seats} seat{p.seats > 1 ? 's' : ''} · {PAYMENT_LABEL[p.paymentMethod]}
              </span>
              {p.droppedOff && gotOffEarly(p) && <span className={styles.early}>Got off early at {p.droppedOff.name}</span>}
              <PreferenceTags shareRide={p.shareRide} sameGenderOnly={p.sameGenderOnly} gender={p.gender} />
            </div>
            <div className={styles.right}>
              <span className={styles.fare}>
                {p.status === 'CANCELLED' ? '—' : p.farePaisa !== null ? taka(p.farePaisa) : `≈ ${taka(p.subtotalPaisa)}`}
              </span>
              <StatusBadge status={p.status} viewer="driver" />
            </div>
            {riding && p.status === 'STARTED' && (
              <DropOffButtons
                passenger={p}
                busy={pending !== null}
                loading={pending === p.rideId}
                onDropOff={(zone) => dropOff(p.rideId, zone)} />
            )}
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
      {riding && <p className={styles.hint}>Tap a passenger’s button as you let them off. The trip ends with the last one.</p>}

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

      <div className={styles.trouble}>
        <BreakdownButton busy={pending !== null} riding={riding} onReport={reportBreakdown} />
      </div>
    </TinPlate>
  );
}
