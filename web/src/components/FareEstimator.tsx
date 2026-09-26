'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { taka } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { Estimate, Zone } from '@/lib/types';
import { Alert, Loading } from './ui/Feedback';
import { Field } from './ui/Field';
import { TinPlate } from './ui/TinPlate';
import styles from './FareEstimator.module.css';

// Public price check. Defaults to Nusrat's trip from the story: Banani → Mohakhali.
export function FareEstimator() {
  const { user } = useSession();
  const [pickup, setPickup] = useState('BANANI');
  const [dropoff, setDropoff] = useState('MOHAKHALI');
  const [seats, setSeats] = useState(1);

  const zones = useSWR<{ zones: Zone[] }>('/zones');
  const sameZone = pickup === dropoff;
  const estimate = useSWR<{ estimate: Estimate }>(
    sameZone ? null : `/rides/estimate?pickupZone=${pickup}&dropoffZone=${dropoff}&seats=${seats}`,
    { keepPreviousData: true },
  );

  const bookHref = `/ride?pickup=${pickup}&dropoff=${dropoff}&seats=${seats}`;

  return (
    <TinPlate title="What will it cost?" bnTitle="ভাড়া কত?" frame="emerald">
      {zones.error ? (
        <Alert>Couldn&apos;t load Dhaka&apos;s zones. {zones.error.message}</Alert>
      ) : !zones.data ? (
        <Loading label="Loading zones…" />
      ) : (
        <>
          <div className={styles.row}>
            <Field label="From" bnLabel="থেকে" htmlFor="est-pickup">
              <select id="est-pickup" className="input" value={pickup} onChange={(e) => setPickup(e.target.value)}>
                {zones.data.zones.map((z) => (
                  <option key={z.code} value={z.code}>
                    {z.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="To" bnLabel="পর্যন্ত" htmlFor="est-dropoff">
              <select id="est-dropoff" className="input" value={dropoff} onChange={(e) => setDropoff(e.target.value)}>
                {zones.data.zones.map((z) => (
                  <option key={z.code} value={z.code}>
                    {z.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Seats" bnLabel="আসন" htmlFor="est-seats">
              <select id="est-seats" className="input" value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {sameZone ? (
            <Alert tone="info">Pick a destination different from where you start.</Alert>
          ) : estimate.error ? (
            <Alert>{estimate.error.message}</Alert>
          ) : !estimate.data ? (
            <Loading label="Asking the rickshaw-wallahs…" />
          ) : (
            <div className={styles.prices} aria-live="polite">
              <div className={styles.price}>
                <span className={styles.label}>Alone</span>
                <span className={styles.amount}>{taka(estimate.data.estimate.solo.farePaisa)}</span>
              </div>
              <div className={`${styles.price} ${styles.pooled}`}>
                <span className={styles.label}>If you share</span>
                <span className={styles.amount}>{taka(estimate.data.estimate.pooled.farePaisa)}</span>
                <span className={styles.save}>save {taka(estimate.data.estimate.pooled.poolDiscountPaisa)}</span>
              </div>
              <p className={styles.math}>
                {taka(estimate.data.estimate.solo.baseFarePaisa)} base + {taka(estimate.data.estimate.solo.distanceChargePaisa)} for{' '}
                {estimate.data.estimate.solo.distanceKm} km{seats > 1 ? ` (${seats} seats)` : ''} · discount only if your Tesla is shared
              </p>
            </div>
          )}

          <Link href={user ? bookHref : `/signup?next=${encodeURIComponent(bookHref)}`} className={styles.book}>
            {user ? 'Book this ride' : 'Sign up to book'} →
          </Link>
        </>
      )}
    </TinPlate>
  );
}
