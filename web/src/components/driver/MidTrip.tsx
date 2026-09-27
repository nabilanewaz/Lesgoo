'use client';

import { useState } from 'react';
import type { DriverPassenger } from '@/lib/types';
import { Button } from '../ui/Button';
import styles from './MidTrip.module.css';

// What can happen once the Tesla is on the road (DESIGN.md §6), built for a driver at the
// roadside: big buttons, Bangla first with an icon, one tap, and at most one follow-up question
// answered by tapping a picture or a place name. No typing, no menus.

type Busy = { busy: boolean };

// One passenger on board: they reached their destination, or they got off early on the way.
export function DropOffButtons({
  passenger,
  busy,
  loading,
  onDropOff,
}: Busy & { passenger: DriverPassenger; loading: boolean; onDropOff: (zone?: string) => void }) {
  const [askWhere, setAskWhere] = useState(false);

  if (askWhere) {
    return (
      <div className={styles.panel} role="group" aria-label={`Where did ${passenger.name} get off?`}>
        <p className={styles.question}>
          <span lang="bn">কোথায় নেমেছে?</span> Where did {passenger.name} get off?
        </p>
        <div className={styles.choices}>
          {passenger.stopsOnTheWay.map((stop) => (
            <Button key={stop.code} variant="secondary" className={styles.big} disabled={busy} onClick={() => onDropOff(stop.code)}>
              <span aria-hidden>📍</span> {stop.name}
            </Button>
          ))}
        </div>
        <p className={styles.note}>They pay only for the part they rode.</p>
        <Button variant="ghost" disabled={busy} onClick={() => setAskWhere(false)}>
          ← Back
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.dropOff}>
      <Button variant="secondary" full className={styles.big} disabled={busy} loading={loading} onClick={() => onDropOff()}>
        <span aria-hidden>✅</span> <span lang="bn">পৌঁছেছে</span> · Reached {passenger.dropoff.name}
      </Button>
      {passenger.stopsOnTheWay.length > 0 && (
        <Button variant="ghost" full disabled={busy} onClick={() => setAskWhere(true)}>
          <span aria-hidden>🚶</span> <span lang="bn">আগে নেমেছে</span> · Got off early
        </Button>
      )}
    </div>
  );
}

const REASONS = [
  { reason: 'FLAT_TYRE', icon: '🛞', bn: 'টায়ার পাংচার', en: 'Flat tyre' },
  { reason: 'BATTERY', icon: '🔋', bn: 'ব্যাটারি শেষ', en: 'Battery' },
  { reason: 'OTHER', icon: '⚠️', bn: 'অন্য সমস্যা', en: 'Other problem' },
] as const;

export type BreakdownReason = (typeof REASONS)[number]['reason'];

// The Tesla can't go on. Asking "what happened?" is the confirmation: an accidental tap on the
// red button changes nothing until the driver picks a reason.
export function BreakdownButton({ busy, riding, onReport }: Busy & { riding: boolean; onReport: (reason: BreakdownReason) => void }) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Button variant="danger" full className={styles.big} disabled={busy} onClick={() => setAsking(true)}>
        <span aria-hidden>🛠️</span> <span lang="bn">গাড়ি নষ্ট</span> · Tesla broke down
      </Button>
    );
  }

  return (
    <div className={`${styles.panel} ${styles.danger}`} role="group" aria-label="What happened?">
      <p className={styles.question}>
        <span lang="bn">কী হয়েছে?</span> What happened?
      </p>
      <div className={styles.reasons}>
        {REASONS.map((r) => (
          <button key={r.reason} type="button" className={styles.reason} disabled={busy} onClick={() => onReport(r.reason)}>
            <span className={styles.reasonIcon} aria-hidden>
              {r.icon}
            </span>
            <span lang="bn">{r.bn}</span>
            <span className={styles.reasonEn}>{r.en}</span>
          </button>
        ))}
      </div>
      <p className={styles.note}>
        {riding ? 'Passengers still on board pay nothing.' : 'Your passengers are told to book another Tesla.'} You go offline
        until you turn back on.
      </p>
      <Button variant="ghost" disabled={busy} onClick={() => setAsking(false)}>
        ← Back, keep driving
      </Button>
    </div>
  );
}
