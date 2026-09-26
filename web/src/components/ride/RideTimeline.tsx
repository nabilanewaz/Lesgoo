'use client';

import useSWR from 'swr';
import { EVENT_LABEL } from '@/lib/labels';
import type { PassengerRide, RideEvent } from '@/lib/types';
import styles from './RideTimeline.module.css';

// "What happened": the ride's audit trail from ride_events, so a passenger can see exactly
// when each step happened. Re-fetched whenever the ride changes (updatedAt is in the key).
export function RideTimeline({ ride }: { ride: PassengerRide }) {
  const { data, error } = useSWR<{ events: RideEvent[] }>(`/rides/${ride.id}/events?v=${ride.updatedAt}`);

  return (
    <details className={styles.details}>
      <summary>What happened so far</summary>
      {error ? (
        <p>Couldn&apos;t load the history: {error.message}</p>
      ) : !data ? (
        <p>Loading…</p>
      ) : (
        <ol className={styles.list}>
          {data.events.map((e) => (
            <li key={e.id}>
              <time dateTime={e.createdAt}>
                {new Date(e.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </time>
              <span>{EVENT_LABEL[e.type] ?? e.type}</span>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
