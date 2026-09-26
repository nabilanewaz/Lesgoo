'use client';

import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { fetcher } from '@/lib/api';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, revalidateOnFocus: true, shouldRetryOnError: false }}>{children}</SWRConfig>
  );
}
