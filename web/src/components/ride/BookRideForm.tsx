'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { useZones } from '@/lib/hooks';
import type { PassengerRide } from '@/lib/types';
import { PriceCompare } from '../trip/PriceCompare';
import { TripFields, type Trip } from '../trip/TripFields';
import { Button } from '../ui/Button';
import { Alert, Loading } from '../ui/Feedback';
import { TinPlate } from '../ui/TinPlate';
import styles from './BookRideForm.module.css';

type Props = { initialTrip: Trip; onBooked: (ride: PassengerRide) => void };

export function BookRideForm({ initialTrip, onBooked }: Props) {
  const zones = useZones();
  const [trip, setTrip] = useState<Trip>(initialTrip);
  const [payment, setPayment] = useState<'CASH' | 'TESLAPAY'>('CASH');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const { ride } = await api<{ ride: PassengerRide }>('/rides', {
        method: 'POST',
        body: { pickupZone: trip.pickup, dropoffZone: trip.dropoff, seats: trip.seats, paymentMethod: payment },
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
          {error && <Alert>{error}</Alert>}
          <TripFields zones={zones.data.zones} value={trip} onChange={setTrip} idPrefix="book" errors={fieldErrors} />

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

          <PriceCompare trip={trip} />

          <Button type="submit" loading={pending} disabled={trip.pickup === trip.dropoff} full>
            Request ride
          </Button>
          <p className={styles.note}>
            If a Tesla is already heading your way, you&apos;ll join it straight away. Otherwise the next free driver picks you up.
          </p>
        </form>
      )}
    </TinPlate>
  );
}
