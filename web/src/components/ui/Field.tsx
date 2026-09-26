import type { ReactNode } from 'react';
import styles from './Field.module.css';

type Props = {
  label: string;
  bnLabel?: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
};

// Label + control + inline error. The error is linked to the input via aria-describedby
// (set by the caller as `${htmlFor}-error`) so screen readers read it out.
export function Field({ label, bnLabel, htmlFor, error, children }: Props) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor} className={styles.label}>
        {label}
        {bnLabel && (
          <span className="bn" lang="bn">
            {bnLabel}
          </span>
        )}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
