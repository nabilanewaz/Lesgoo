import type { SpotRef } from '@/lib/types';
import styles from './SpotName.module.css';

// A pickup / drop-off spot as people say it: the Bangla landmark name first (what a Dhaka driver
// reads fastest), the English name and area underneath.
export function SpotName({ spot, area, size = 'normal' }: { spot: SpotRef; area?: string; size?: 'normal' | 'big' }) {
  return (
    <span className={`${styles.spot} ${size === 'big' ? styles.big : ''}`}>
      <span lang="bn" className={styles.bn}>
        {spot.nameBn}
      </span>
      <span className={styles.en}>
        {spot.name}
        {area ? `, ${area}` : ''}
      </span>
    </span>
  );
}
