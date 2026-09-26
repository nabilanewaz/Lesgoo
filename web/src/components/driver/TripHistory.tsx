'use client';

import useSWR from 'swr';
import { taka } from '@/lib/format';
import { POOL_STATUS } from '@/lib/labels';
import type { DriverPool } from '@/lib/types';
import { Alert, EmptyState, Loading } from '../ui/Feedback';
import { TinPlate } from '../ui/TinPlate';
import styles from './TripHistory.module.css';

// Finished trips (completed or cancelled), newest first. `version` re-fetches after a trip ends.
export function TripHistory({ version }: { version: string }) {
  const { data, error } = useSWR<{ pools: DriverPool[] }>(`/driver/pools?v=${version}`);

  const finished = data?.pools.filter((p) => p.status === 'COMPLETED' || p.status === 'CANCELLED');

  return (
    <TinPlate title="Past trips" bnTitle="আগের যাত্রা" frame="vermilion">
      {error ? (
        <Alert>{error.message}</Alert>
      ) : !finished ? (
        <Loading label="Loading your trips…" />
      ) : finished.length === 0 ? (
        <EmptyState title="No finished trips yet" />
      ) : (
        <ul className={styles.list}>
          {finished.map((p) => {
            const riders = p.passengers.filter((x) => x.status !== 'CANCELLED');
            return (
              <li key={p.id}>
                <div>
                  <strong>
                    From {p.pickup.name} · {riders.length || p.passengers.length} rider
                    {(riders.length || p.passengers.length) === 1 ? '' : 's'}
                  </strong>
                  <span className={styles.meta}>
                    {new Date(p.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
                    {(riders.length ? riders : p.passengers).map((x) => `${x.name} to ${x.dropoff.name}`).join(', ')}
                  </span>
                </div>
                <div className={styles.right}>
                  <strong>{p.status === 'COMPLETED' ? taka(p.totalFarePaisa) : '—'}</strong>
                  <span className={styles.meta}>{POOL_STATUS[p.status].label}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </TinPlate>
  );
}
