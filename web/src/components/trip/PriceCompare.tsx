'use client';

import useSWR from 'swr';
import { km, taka } from '@/lib/format';
import type { Estimate } from '@/lib/types';
import { Alert, Loading } from '../ui/Feedback';
import type { FullTrip } from './TripFields';
import styles from './PriceCompare.module.css';

// "Alone" vs "If you share" prices for a trip, straight from the API's fare model.
export function PriceCompare({ trip }: { trip: FullTrip }) {
  const sameZone = trip.pickup === trip.dropoff;
  const { data, error } = useSWR<{ estimate: Estimate }>(
    sameZone ? null : `/rides/estimate?pickupSpot=${trip.pickupSpot}&dropoffSpot=${trip.dropoffSpot}&seats=${trip.seats}`,
    { keepPreviousData: true },
  );

  if (sameZone) return <Alert tone="info">Pick a destination in a different area from where you start.</Alert>;
  if (error) return <Alert>{error.message}</Alert>;
  if (!data) return <Loading label="Asking the rickshaw-wallahs…" />;

  const { solo, pooled } = data.estimate;
  return (
    <div className={styles.prices} aria-live="polite">
      <div className={styles.price}>
        <span className={styles.label}>Alone</span>
        <span className={styles.amount}>{taka(solo.farePaisa)}</span>
      </div>
      <div className={`${styles.price} ${styles.pooled}`}>
        <span className={styles.label}>If you share</span>
        <span className={styles.amount}>{taka(pooled.farePaisa)}</span>
        <span className={styles.save}>save {taka(pooled.poolDiscountPaisa)}</span>
      </div>
      <p className={styles.math}>
        {taka(solo.baseFarePaisa)} base + {taka(solo.distanceChargePaisa)} for {km(solo.distanceM)}
        {trip.seats > 1 ? ` (${trip.seats} seats)` : ''} · discount only if your Tesla is shared
      </p>
    </div>
  );
}
