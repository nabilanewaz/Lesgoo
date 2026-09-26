'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { taka, timeAgo } from '@/lib/format';
import { useRequestFeed } from '@/lib/hooks';
import type { DriverPool } from '@/lib/types';
import { Button } from '../ui/Button';
import { Alert, EmptyState, Loading } from '../ui/Feedback';
import { TinPlate } from '../ui/TinPlate';
import styles from './RequestFeed.module.css';

type Props = { online: boolean; pool: DriverPool | null; onAccepted: () => void };

// Riders waiting for a Tesla. The API decides what's "relevant": everyone who fits when
// Bullet has no trip, only compatible riders once a trip is open, nobody once it's moving.
export function RequestFeed({ online, pool, onAccepted }: Props) {
  const feed = useRequestFeed(online);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accept(rideId: string) {
    setAccepting(rideId);
    setError(null);
    try {
      await api(`/driver/requests/${rideId}/accept`, { method: 'POST' });
      onAccepted();
    } catch (err) {
      // Taken by another driver, cancelled, or no longer fits: say why, refresh the list.
      setError(err instanceof Error ? err.message : 'Could not accept this rider');
    } finally {
      setAccepting(null);
      feed.mutate();
    }
  }

  const locked = pool !== null && pool.status !== 'OPEN';
  const subtitle = pool?.status === 'OPEN' ? `Heading your way from ${pool.pickup.name}` : 'Anyone who fits in your Tesla';

  return (
    <TinPlate title="Riders waiting" bnTitle="অপেক্ষমাণ যাত্রী" frame="cobalt">
      {!online ? (
        <EmptyState title="Go online to see riders" />
      ) : locked ? (
        <EmptyState title="Trip under way">
          <p>New riders will appear once you finish this trip.</p>
        </EmptyState>
      ) : feed.error ? (
        <Alert>{feed.error.message}</Alert>
      ) : !feed.data ? (
        <Loading label="Looking for riders…" />
      ) : (
        <>
          <p className={styles.subtitle}>{subtitle}</p>
          {error && <Alert>{error}</Alert>}
          {feed.data.requests.length === 0 ? (
            <EmptyState title="Nobody waiting right now">
              <p>This list refreshes by itself.</p>
            </EmptyState>
          ) : (
            <ul className={styles.list}>
              {feed.data.requests.map((r) => (
                <li key={r.rideId}>
                  <div className={styles.info}>
                    <strong>{r.passengerName}</strong>
                    <span>
                      {r.pickup.name} → {r.dropoff.name} · {r.distanceKm} km · {r.seats} seat{r.seats > 1 ? 's' : ''}
                    </span>
                    <span className={styles.when}>
                      ≈ {taka(r.subtotalPaisa)} · {timeAgo(r.requestedAt)}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    loading={accepting === r.rideId}
                    disabled={accepting !== null}
                    onClick={() => accept(r.rideId)}
                  >
                    Accept
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </TinPlate>
  );
}
