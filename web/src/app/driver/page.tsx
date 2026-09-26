'use client';

import { RequireRole } from '@/components/RequireRole';
import { RequestFeed } from '@/components/driver/RequestFeed';
import { TripHistory } from '@/components/driver/TripHistory';
import { TripPanel } from '@/components/driver/TripPanel';
import { VehicleBar } from '@/components/driver/VehicleBar';
import { Alert, Loading } from '@/components/ui/Feedback';
import { useDriverStatus } from '@/lib/hooks';
import styles from './driver.module.css';

// Jashim's dashboard: Bullet + online switch, the current trip, riders waiting, past trips.
function Dashboard() {
  const status = useDriverStatus();

  if (status.error) return <Alert>{status.error.message}</Alert>;
  if (!status.data) return <Loading label="Warming up Bullet…" />;

  const { vehicle, activePool } = status.data;
  const refresh = () => status.mutate();

  return (
    <>
      {/* keyed by trip state so an old error (e.g. "can't go offline mid-trip") clears once the trip moves on */}
      <VehicleBar key={activePool ? `${activePool.id}-${activePool.status}` : 'idle'} status={status.data} onChanged={refresh} />
      <div className={styles.grid}>
        <TripPanel pool={activePool} online={vehicle.isOnline} onChanged={refresh} />
        <RequestFeed online={vehicle.isOnline} pool={activePool} onAccepted={refresh} />
      </div>
      <div className={styles.history}>
        {/* re-fetch history whenever the active trip appears, changes or ends */}
        <TripHistory version={activePool ? `${activePool.id}-${activePool.status}` : 'idle'} />
      </div>
    </>
  );
}

export default function DriverPage() {
  return (
    <RequireRole role="DRIVER">
      <div className={`container ${styles.page}`}>
        <Dashboard />
      </div>
    </RequireRole>
  );
}
