import styles from './SeatMeter.module.css';

// Bullet's seats at a glance: filled = taken, empty = free.
export function SeatMeter({ taken, capacity }: { taken: number; capacity: number }) {
  return (
    <div className={styles.meter} role="img" aria-label={`${taken} of ${capacity} seats taken`}>
      {Array.from({ length: capacity }, (_, i) => (
        <span key={i} className={i < taken ? styles.taken : styles.free} />
      ))}
      <span className={styles.text}>
        {taken} of {capacity} seats taken
      </span>
    </div>
  );
}
