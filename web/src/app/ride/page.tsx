'use client';

import { RequireRole } from '@/components/RequireRole';
import { EmptyState } from '@/components/ui/Feedback';

// Placeholder: the booking and live status screens arrive in step 7b.
export default function RidePage() {
  return (
    <RequireRole role="PASSENGER">
      <div className="container">
        <EmptyState title="Your ride screen is being painted…" />
      </div>
    </RequireRole>
  );
}
