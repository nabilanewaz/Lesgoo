'use client';

import useSWR from 'swr';
import type { ApiError } from './api';
import type { DriverStatus, FeedRequest, PassengerRide, Zone } from './types';

// Zones never change at runtime: fetch once and keep them.
export function useZones() {
  return useSWR<{ zones: Zone[] }, ApiError>('/zones', { revalidateOnFocus: false });
}

const POLL_MS = 3000;

// The passenger's active ride. Polls every 3 s while there is one (DESIGN.md §2: rides take
// minutes, so a few seconds of delay is fine and far simpler than WebSockets). Stops polling
// when there is no active ride.
export function useCurrentRide(onRide?: (ride: PassengerRide) => void) {
  return useSWR<{ ride: PassengerRide | null }, ApiError>('/rides/current', {
    refreshInterval: (data) => (data?.ride ? POLL_MS : 0),
    onSuccess: (data) => {
      if (data.ride) onRide?.(data.ride);
    },
  });
}

// One specific ride (used to show the summary once a ride has finished).
export function useRide(id: string | null) {
  return useSWR<{ ride: PassengerRide }, ApiError>(id ? `/rides/${id}` : null);
}

// Jashim's vehicle and current trip. Polls while online so new riders and
// passenger cancellations show up without a refresh.
export function useDriverStatus() {
  return useSWR<DriverStatus, ApiError>('/driver/me', {
    refreshInterval: (data) => (data?.vehicle.isOnline ? POLL_MS : 0),
  });
}

export function useRequestFeed(online: boolean) {
  return useSWR<{ requests: FeedRequest[] }, ApiError>(online ? '/driver/requests' : null, {
    refreshInterval: POLL_MS,
  });
}
