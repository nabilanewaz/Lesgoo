'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { RequireRole } from '@/components/RequireRole';
import { StatusBadge } from '@/components/ride/StatusBadge';
import { Alert, EmptyState, Loading } from '@/components/ui/Feedback';
import { TinPlate } from '@/components/ui/TinPlate';
import { taka } from '@/lib/format';
import type { PassengerRide } from '@/lib/types';
import styles from './history.module.css';

function fareText(ride: PassengerRide) {
  if (ride.status === 'CANCELLED') return 'No charge';
  if (ride.fare.isFinal) return taka(ride.fare.farePaisa ?? 0);
  return `est. ${taka(ride.fare.pooledEstimatePaisa)}–${taka(ride.fare.subtotalPaisa)}`;
}

function History() {
  const { data, error } = useSWR<{ rides: PassengerRide[] }>('/rides');

  if (error) return <Alert>{error.message}</Alert>;
  if (!data) return <Loading label="Loading your rides…" />;
  if (data.rides.length === 0) {
    return (
      <EmptyState title="No rides yet">
        <Link href="/ride">Book your first Tesla →</Link>
      </EmptyState>
    );
  }

  return (
    <ul className={styles.list}>
      {data.rides.map((ride) => {
        const saved = ride.fare.poolDiscountPaisa ?? 0;
        return (
          <li key={ride.id} className={styles.item}>
            <div className={styles.main}>
              <strong>
                {ride.pickup.name} → {ride.dropoff.name}
              </strong>
              <span className={styles.meta}>
                {new Date(ride.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                {ride.pool && ` · ${ride.pool.driver.name} & ${ride.pool.vehicle.name}`}
                {saved > 0 && ` · shared, saved ${taka(saved)}`}
              </span>
            </div>
            <div className={styles.side}>
              <span className={styles.fare}>{fareText(ride)}</span>
              <StatusBadge status={ride.status} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function HistoryPage() {
  return (
    <RequireRole role="PASSENGER">
      <div className={`container ${styles.page}`}>
        <TinPlate title="My rides" bnTitle="আমার যাত্রা" frame="cobalt">
          <History />
        </TinPlate>
      </div>
    </RequireRole>
  );
}
