'use client';

import useSWR from 'swr';
import { api, ApiError } from './api';
import type { User } from './types';

// The signed-in user, or null. The session itself is an httpOnly cookie that JavaScript
// can't read, so we ask the API who we are.
export function useSession() {
  const { data, error, isLoading, mutate } = useSWR<{ user: User } | null>('/auth/me', async (path: string) => {
    try {
      return await api<{ user: User }>(path);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null; // signed out is not an error
      throw err;
    }
  });

  return {
    user: data?.user ?? null,
    isLoading,
    error: error as ApiError | undefined,
    refresh: mutate,
    async logout() {
      await api('/auth/logout', { method: 'POST' });
      await mutate(null, { revalidate: false });
    },
  };
}

export const homeFor = (user: User) => (user.role === 'DRIVER' ? '/driver' : '/ride');
