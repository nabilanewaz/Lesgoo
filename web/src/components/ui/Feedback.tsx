import type { ReactNode } from 'react';
import { Wheel } from '../art/Wheel';
import styles from './Feedback.module.css';

// The three states every data-driven screen needs: loading, error, empty.

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className={styles.center} role="status">
      <Wheel size={56} spinning />
      <p>{label}</p>
    </div>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'info' | 'success'; children: ReactNode }) {
  return (
    <div className={`${styles.alert} ${styles[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.center}>
      <Wheel size={56} />
      <p className={styles.emptyTitle}>{title}</p>
      {children}
    </div>
  );
}
