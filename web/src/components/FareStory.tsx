'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { taka } from '@/lib/format';
import { homeFor, useSession } from '@/lib/session';
import type { Estimate } from '@/lib/types';
import { Wheel } from './art/Wheel';
import styles from './FareStory.module.css';

// The landing page's pitch: part of the road is shared, so each rider pays less.
// It uses the brief's example trip (Banani → Mohakhali, Banani → Gulshan 1) without naming
// anyone; the story cast lives in the seed data, tests and demo instead. Prices come live
// from the API's fare model, so this signboard can never disagree with real charges.

const DROPOFFS = [
  { code: 'MOHAKHALI', name: 'Mohakhali' },
  { code: 'GULSHAN_1', name: 'Gulshan 1' },
] as const;

function useEstimate(dropoff: string) {
  return useSWR<{ estimate: Estimate }>(`/rides/estimate?pickupZone=BANANI&dropoffZone=${dropoff}&seats=1`);
}

function Ticket({ destination, estimate }: { destination: string; estimate?: Estimate }) {
  return (
    <article className={styles.ticket}>
      <header className={styles.ticketHead}>
        <span className={styles.ticketLabel}>To</span>
        <strong>{destination}</strong>
        {estimate && <span>from Banani · {estimate.solo.distanceKm} km</span>}
      </header>
      {estimate ? (
        <>
          <p className={styles.prices}>
            <s aria-label={`${taka(estimate.solo.farePaisa)} alone`}>{taka(estimate.solo.farePaisa)}</s>
            <span className={styles.shared}>{taka(estimate.pooled.farePaisa)}</span>
          </p>
          <p className={styles.stamp}>saved {taka(estimate.pooled.poolDiscountPaisa)}</p>
        </>
      ) : (
        <p className={styles.loadingPrice}>
          <Wheel size={28} spinning /> pricing…
        </p>
      )}
    </article>
  );
}

export function FareStory() {
  const { user } = useSession();
  const first = useEstimate(DROPOFFS[0].code);
  const second = useEstimate(DROPOFFS[1].code);
  const failed = first.error || second.error;

  return (
    <section className={styles.board} aria-labelledby="story-title">
      <p className={styles.kicker}>Rush hour · from Banani</p>
      <h2 id="story-title" className={`painted ${styles.title}`}>
        Same road, smaller fare
      </h2>
      <p className={styles.bn} lang="bn">
        একই পথে, কম ভাড়ায়
      </p>

      {/* Route ribbon: the shared stretch is thick and pink, the solo stretch thin. */}
      <ol className={styles.route} aria-label="Two riders share the road from Banani to Mohakhali, then one continues to Gulshan 1">
        <li>
          <span className={styles.stop} />
          <strong>Banani</strong>
          <span>pick-up</span>
        </li>
        <li className={`${styles.leg} ${styles.sharedLeg}`} aria-hidden="true">
          <Wheel size={28} tyre="var(--turmeric)" />
          <span className={styles.legLabel}>
            2 km <b>shared</b>
          </span>
        </li>
        <li>
          <span className={styles.stop} />
          <strong>{DROPOFFS[0].name}</strong>
          <span>1st drop-off</span>
        </li>
        <li className={styles.leg} aria-hidden="true">
          <span className={styles.legLabel}>
            1 km <b>solo</b>
          </span>
        </li>
        <li>
          <span className={styles.stop} />
          <strong>{DROPOFFS[1].name}</strong>
          <span>2nd drop-off</span>
        </li>
      </ol>

      {failed ? (
        <p className={styles.error}>Fares are taking a tea break. Try again in a moment.</p>
      ) : (
        <div className={styles.tickets}>
          <Ticket destination={DROPOFFS[0].name} estimate={first.data?.estimate} />
          <Ticket destination={DROPOFFS[1].name} estimate={second.data?.estimate} />
        </div>
      )}

      <p className={styles.formula}>৳30 base + ৳20 per km · 25% off when you actually share</p>

      <div className={styles.ctas}>
        {user ? (
          <Link href={homeFor(user)} className={styles.primary}>
            {user.role === 'DRIVER' ? 'Go to your Tesla' : 'Book your seat'} →
          </Link>
        ) : (
          <>
            <Link href="/signup" className={styles.primary}>
              Book your seat →
            </Link>
            <Link href="/login" className={styles.secondary}>
              Driving a Tesla? Sign in
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
