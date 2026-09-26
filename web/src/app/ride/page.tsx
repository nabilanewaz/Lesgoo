'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { RequireRole } from '@/components/RequireRole';
import { BookRideForm } from '@/components/ride/BookRideForm';
import { RideStatusCard } from '@/components/ride/RideStatusCard';
import { Alert, Loading } from '@/components/ui/Feedback';
import { useCurrentRide, useRide } from '@/lib/hooks';
import styles from './ride.module.css';

// The passenger's home. Three states:
//   1. an active ride    → live status card (polled every 3 s)
//   2. a ride just ended → its summary, until "Book another ride"
//   3. nothing           → the booking form
function RideScreen() {
  const params = useSearchParams();
  // The last ride we saw as active. When /rides/current turns empty (completed or cancelled),
  // we keep showing that ride's outcome instead of jumping straight back to the form.
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const current = useCurrentRide((ride) => setSummaryId(ride.id));
  const summary = useRide(!current.data?.ride ? summaryId : null);

  if (current.error) return <Alert>{current.error.message}</Alert>;
  if (!current.data) return <Loading label="Checking for your ride…" />;

  if (current.data.ride) {
    return <RideStatusCard ride={current.data.ride} onChanged={() => current.mutate()} />;
  }

  if (summaryId) {
    if (summary.error) return <Alert>{summary.error.message}</Alert>;
    if (!summary.data) return <Loading label="Loading your trip…" />;
    return (
      <RideStatusCard ride={summary.data.ride} onChanged={() => summary.mutate()} onBookAnother={() => setSummaryId(null)} />
    );
  }

  const initialTrip = {
    pickup: params.get('pickup') ?? 'BANANI',
    dropoff: params.get('dropoff') ?? 'MOHAKHALI',
    seats: Math.min(3, Math.max(1, Number(params.get('seats')) || 1)),
  };
  return (
    <BookRideForm
      initialTrip={initialTrip}
      onBooked={(ride) => {
        setSummaryId(ride.id);
        current.mutate({ ride });
      }}
    />
  );
}

export default function RidePage() {
  return (
    <RequireRole role="PASSENGER">
      <div className={`container ${styles.page}`}>
        <Suspense>
          <RideScreen />
        </Suspense>
      </div>
    </RequireRole>
  );
}
