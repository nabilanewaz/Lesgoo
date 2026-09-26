'use client';

import { RequireRole } from '@/components/RequireRole';
import { EmptyState } from '@/components/ui/Feedback';

// Placeholder: Jashim's dashboard arrives in step 7c.
export default function DriverPage() {
  return (
    <RequireRole role="DRIVER">
      <div className="container">
        <EmptyState title="Jashim's dashboard is being painted…" />
      </div>
    </RequireRole>
  );
}
