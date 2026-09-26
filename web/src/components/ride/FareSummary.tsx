import { taka } from '@/lib/format';
import { PAYMENT_LABEL } from '@/lib/labels';
import type { PassengerRide } from '@/lib/types';
import styles from './FareSummary.module.css';

// Before the trip starts nobody knows yet whether it will be shared, so we show both prices.
// From the start, the fare is final and we show exactly how it was calculated.
export function FareSummary({ ride }: { ride: PassengerRide }) {
  const { fare } = ride;

  if (ride.status === 'CANCELLED') {
    return (
      <div className={styles.box}>
        <span className={styles.caption}>Fare</span>
        <strong className={styles.big}>No charge</strong>
      </div>
    );
  }

  if (!fare.isFinal) {
    return (
      <div className={styles.box}>
        <span className={styles.caption}>
          Estimated fare <span lang="bn">· ভাড়া</span>
        </span>
        <p className={styles.estimate}>
          <strong className={styles.big}>{taka(fare.pooledEstimatePaisa)}</strong> if shared ·{' '}
          <strong>{taka(fare.subtotalPaisa)}</strong> alone
        </p>
        <span className={styles.caption}>Final when the trip starts · {PAYMENT_LABEL[ride.paymentMethod]}</span>
      </div>
    );
  }

  const shared = (fare.poolDiscountPaisa ?? 0) > 0;
  return (
    <div className={`${styles.box} ${styles.final}`}>
      <span className={styles.caption}>
        Your fare <span lang="bn">· আপনার ভাড়া</span>
      </span>
      <strong className={styles.big}>{taka(fare.farePaisa ?? 0)}</strong>
      <dl className={styles.breakdown}>
        <dt>Trip ({ride.distanceKm} km{ride.seats > 1 ? `, ${ride.seats} seats` : ''})</dt>
        <dd>{taka(fare.subtotalPaisa)}</dd>
        <dt>{shared ? 'Pool discount (25%)' : 'Pool discount (rode alone)'}</dt>
        <dd>−{taka(fare.poolDiscountPaisa ?? 0)}</dd>
      </dl>
      <span className={styles.caption}>Pay by {PAYMENT_LABEL[ride.paymentMethod]}</span>
    </div>
  );
}
