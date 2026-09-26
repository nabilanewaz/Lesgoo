'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { homeFor, useSession } from '@/lib/session';
import type { Role } from '@/lib/types';
import { Alert, Loading } from './ui/Feedback';

// Client-side guard for a page. This is only for navigation: the API enforces
// the real rules (401/403) on every request, whatever the browser does.
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, isLoading, error } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading || error) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (user.role !== role) router.replace(homeFor(user));
  }, [user, isLoading, error, role, router, pathname]);

  if (error) {
    return (
      <div className="container" style={{ marginTop: 32 }}>
        <Alert>{error.message}</Alert>
      </div>
    );
  }
  if (!user || user.role !== role) return <Loading label="Checking your ticket…" />;
  return <>{children}</>;
}
