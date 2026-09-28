'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { useZones } from '@/lib/hooks';
import { SAME_GENDER_OPTION } from '@/lib/labels';
import { useSession } from '@/lib/session';
import type { PassengerRide } from '@/lib/types';
import { PriceCompare } from '../trip/PriceCompare';
import { TripFields, withSpots, type Trip } from '../trip/TripFields';
import { Button } from '../ui/Button';
import { Alert, Loading } from '../ui/Feedback';
import { TinPlate } from '../ui/TinPlate';
import styles from './BookRideForm.module.css';

// `note` explains a pre-filled rebooking (e.g. after a breakdown).
type Props = { initialTrip: Trip; note?: string; onBooked: (ride: PassengerRide) => void };

export function BookRideForm({ initialTrip, note, onBooked }: Props) {
  const zones = useZones();
  const { user } = useSession();
  const gender = user?.gender ?? 'UNDISCLOSED';
  const [trip, setTrip] = useState<Trip>(initialTrip);
  const [payment, setPayment] = useState<'CASH' | 'TESLAPAY'>('CASH');
  const [shareRide, setShareRide] = useState(true);
  const [sameGenderOnly, setSameGenderOnly] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // The trip with a spot at each end (the area's main spot until the rider picks another).
  const full = zones.data ? withSpots(trip, zones.data.zones) : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const { ride } = await api<{ ride: PassengerRide }>('/rides', {
        method: 'POST',
        body: {
          pickupSpot: full!.pickupSpot,
          dropoffSpot: full!.dropoffSpot,
          seats: trip.seats,
          paymentMethod: payment,
          shareRide,
          sameGenderOnly: shareRide && sameGenderOnly && gender !== 'UNDISCLOSED',
        },
      });
      onBooked(ride);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') setFieldErrors(err.fieldErrors());
      else setError(err instanceof Error ? err.message : 'Could not book the ride');
    } finally {
      setPending(false);
    }
  }

  return (
    <TinPlate title="Where to?" bnTitle="কোথায় যাবেন?" frame="rani">
      {zones.error ? (
        <Alert>Couldn&apos;t load Dhaka&apos;s zones. {zones.error.message}</Alert>
      ) : !zones.data ? (
        <Loading label="Loading zones…" />
      ) : (
        <form onSubmit={onSubmit} noValidate>
          {note && <Alert tone="info">{note}</Alert>}
          {error && <Alert>{error}</Alert>}
          <TripFields zones={zones.data.zones} value={trip} onChange={setTrip} idPrefix="book" errors={fieldErrors} />

          <fieldset className={styles.payment}>
            <legend>
              Sharing <span className="bn" lang="bn">শেয়ার</span>
            </legend>
            <label className={shareRide ? styles.chosen : undefined}>
              <input type="radio" name="share" checked={shareRide} onChange={() => setShareRide(true)} />
              Share my ride (save 25%)
            </label>
            <label className={!shareRide ? styles.chosen : undefined}>
              <input type="radio" name="share" checked={!shareRide} onChange={() => setShareRide(false)} />
              Ride alone
            </label>
          </fieldset>

          {!shareRide ? (
            <p className={styles.soloNote}>Nobody else will be added to your Tesla. You pay the full fare.</p>
          ) : gender !== 'UNDISCLOSED' ? (
            <label className={styles.preference}>
              <input type="checkbox" checked={sameGenderOnly} onChange={(e) => setSameGenderOnly(e.target.checked)} />
              <span>
                {SAME_GENDER_OPTION[gender]}
                <small>
                  We only put you with riders who declared the same gender, and only they can join you. Fewer matches can
                  mean a longer wait.
                </small>
              </span>
            </label>
          ) : (
            <p className={styles.soloNote}>
              Same-gender rides are available to riders who shared their gender at sign-up.
            </p>
          )}
          {fieldErrors.sameGenderOnly && <Alert>{fieldErrors.sameGenderOnly}</Alert>}

          <fieldset className={styles.payment}>
            <legend>
              Pay with <span className="bn" lang="bn">পেমেন্ট</span>
            </legend>
            {(['CASH', 'TESLAPAY'] as const).map((method) => (
              <label key={method} className={payment === method ? styles.chosen : undefined}>
                <input
                  type="radio"
                  name="payment"
                  value={method}
                  checked={payment === method}
                  onChange={() => setPayment(method)}
                />
                {method === 'CASH' ? 'Cash' : 'TeslaPay (simulated)'}
              </label>
            ))}
          </fieldset>

          <PriceCompare trip={full!} />

          <Button type="submit" loading={pending} disabled={trip.pickup === trip.dropoff} full>
            Request ride
          </Button>
          <p className={styles.note}>
            {shareRide
              ? 'If a Tesla is already heading your way, you’ll join it straight away. Otherwise the next free driver picks you up.'
              : 'The next free driver picks you up.'}
          </p>
        </form>
      )}
    </TinPlate>
  );
}
