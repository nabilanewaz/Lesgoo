'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { homeFor, useSession } from '@/lib/session';
import type { User } from '@/lib/types';
import { Button } from './ui/Button';
import { Alert } from './ui/Feedback';
import { Field } from './ui/Field';
import { TinPlate } from './ui/TinPlate';
import styles from './AuthForm.module.css';

type Mode = 'login' | 'signup';

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Only follow internal paths, so ?next=https://evil.example can't bounce users off-site.
  const next = params.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const { user } = await api<{ user: User }>(`/auth/${mode}`, {
        method: 'POST',
        body: Object.fromEntries(form),
      });
      await refresh({ user }, { revalidate: false });
      router.push(user.role === 'PASSENGER' && safeNext ? safeNext : homeFor(user));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') setFieldErrors(err.fieldErrors());
      else setError(err instanceof Error ? err.message : 'Something went wrong');
      setPending(false);
    }
  }

  const isSignup = mode === 'signup';
  const fieldProps = (name: string) => ({
    id: name,
    name,
    className: 'input',
    'aria-invalid': fieldErrors[name] ? true : undefined,
    'aria-describedby': fieldErrors[name] ? `${name}-error` : undefined,
  });

  return (
    <div className={styles.wrap}>
      <TinPlate
        title={isSignup ? 'Join the pool' : 'Welcome back'}
        bnTitle={isSignup ? 'যোগ দিন' : 'স্বাগতম'}
        frame={isSignup ? 'rani' : 'cobalt'}
      >
        {error && <Alert>{error}</Alert>}
        <form onSubmit={onSubmit} noValidate>
          {isSignup && (
            <Field label="Your name" bnLabel="নাম" htmlFor="name" error={fieldErrors.name}>
              <input {...fieldProps('name')} autoComplete="name" required />
            </Field>
          )}
          {isSignup && (
            <fieldset className={styles.gender} aria-describedby={fieldErrors.gender ? 'gender-error' : undefined}>
              <legend>
                I am <span className="bn" lang="bn">আমি</span>
              </legend>
              {(
                [
                  ['WOMAN', 'A woman'],
                  ['MAN', 'A man'],
                  ['UNDISCLOSED', 'Prefer not to say'],
                ] as const
              ).map(([value, label]) => (
                <label key={value}>
                  <input type="radio" name="gender" value={value} required />
                  {label}
                </label>
              ))}
              <small>
                When you share a ride, your co-riders see your gender, never your name or destination. It also lets
                you ask for a same-gender ride.
              </small>
              {fieldErrors.gender && (
                <p id="gender-error" className={styles.error} role="alert">
                  {fieldErrors.gender}
                </p>
              )}
            </fieldset>
          )}
          <Field label="Email" bnLabel="ইমেইল" htmlFor="email" error={fieldErrors.email}>
            <input {...fieldProps('email')} type="email" autoComplete="email" required />
          </Field>
          <Field label="Password" bnLabel="পাসওয়ার্ড" htmlFor="password" error={fieldErrors.password}>
            <input
              {...fieldProps('password')}
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
            />
          </Field>
          <Button type="submit" loading={pending} full>
            {isSignup ? 'Create passenger account' : 'Sign in'}
          </Button>
        </form>

        <p className={styles.switch}>
          {isSignup ? (
            <>
              Already riding with us? <Link href={`/login${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ''}`}>Sign in</Link>
            </>
          ) : (
            <>
              New to Tesla Pool? <Link href={`/signup${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ''}`}>Create an account</Link>
            </>
          )}
        </p>
        {isSignup && (
          <p className={styles.note}>
            Driving a Tesla? Drivers are onboarded after we check their vehicle. Sign in with the account we gave you.
          </p>
        )}
      </TinPlate>
    </div>
  );
}
