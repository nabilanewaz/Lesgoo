'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, homeFor } from '@/lib/session';
import { Wheel } from './art/Wheel';
import styles from './Header.module.css';

export function Header() {
  const { user, isLoading, logout } = useSession();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push('/');
  }

  return (
    <header className={styles.header}>
      <div className={`container ${styles.bar}`}>
        <Link href={user ? homeFor(user) : '/'} className={styles.brand}>
          <Wheel size={40} tyre="var(--turmeric)" />
          <span className={styles.name}>
            <span className="painted">Tesla Pool</span>
            <span className={styles.bnName} lang="bn">
              টেসলা পুল
            </span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Account">
          {isLoading ? null : user ? (
            <>
              <span className={styles.who}>
                {user.role === 'DRIVER' ? 'Driver' : 'Passenger'} · <strong>{user.name}</strong>
              </span>
              {user.role === 'PASSENGER' && <Link href="/ride/history">My rides</Link>}
              <button type="button" className={styles.linkButton} onClick={handleLogout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link href="/signup" className={styles.cta}>
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
      <div className="scallops" />
    </header>
  );
}
