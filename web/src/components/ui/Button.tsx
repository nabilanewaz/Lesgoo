import type { ButtonHTMLAttributes } from 'react';
import { Wheel } from '../art/Wheel';
import styles from './Button.module.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  full?: boolean;
};

// While `loading`, the button is disabled (no double submits) and shows a small spinning wheel.
export function Button({ variant = 'primary', loading = false, full = false, disabled, children, className, ...rest }: Props) {
  return (
    <button
      className={[styles.button, styles[variant], full ? styles.full : '', className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Wheel size={20} spinning />}
      <span>{children}</span>
    </button>
  );
}
