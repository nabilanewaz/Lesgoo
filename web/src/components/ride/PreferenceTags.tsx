import { SAME_GENDER_TAG } from '@/lib/labels';
import type { Gender } from '@/lib/types';
import styles from './PreferenceTags.module.css';

type Props = { shareRide: boolean; sameGenderOnly: boolean; gender: Gender };

// Small tags that surface a passenger's sharing choice wherever it matters.
export function PreferenceTags({ shareRide, sameGenderOnly, gender }: Props) {
  const sameGender = sameGenderOnly && gender !== 'UNDISCLOSED';
  if (shareRide && !sameGender) return null;
  return (
    <span className={styles.tags}>
      {!shareRide && <span className={`${styles.tag} ${styles.solo}`}>Riding alone</span>}
      {sameGender && (
        <span className={`${styles.tag} ${gender === 'WOMAN' ? styles.women : styles.men}`}>{SAME_GENDER_TAG[gender]}</span>
      )}
    </span>
  );
}
