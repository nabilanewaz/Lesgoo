'use client';

import type { Zone } from '@/lib/types';
import { Field } from '../ui/Field';
import styles from './TripFields.module.css';

// pickup / dropoff are area codes; the spots are exact landmarks inside them. A missing spot
// means the area's main spot (e.g. a link like /ride?pickup=BANANI).
export type Trip = { pickup: string; dropoff: string; seats: number; pickupSpot?: string; dropoffSpot?: string };
export type FullTrip = Required<Trip>;

const mainSpot = (zones: Zone[], zone: string) => {
  const spots = zones.find((z) => z.code === zone)?.spots ?? [];
  return (spots.find((s) => s.isMain) ?? spots[0])?.code ?? '';
};

// Fills in the main spot wherever a spot isn't chosen (or doesn't belong to the chosen area).
export function withSpots(trip: Trip, zones: Zone[]): FullTrip {
  const inArea = (zone: string, spot?: string) =>
    spot && zones.find((z) => z.code === zone)?.spots.some((s) => s.code === spot) ? spot : mainSpot(zones, zone);
  return {
    ...trip,
    pickupSpot: inArea(trip.pickup, trip.pickupSpot),
    dropoffSpot: inArea(trip.dropoff, trip.dropoffSpot),
  };
}

type Props = {
  zones: Zone[];
  value: Trip;
  onChange: (trip: FullTrip) => void;
  idPrefix: string; // keeps label/input ids unique when two forms share a page
  errors?: Partial<Record<'pickupZone' | 'dropoffZone' | 'seats', string>>;
};

// From / To (area, then the exact spot in it) and Seats, for the booking form.
export function TripFields({ zones, value, onChange, idPrefix, errors = {} }: Props) {
  const trip = withSpots(value, zones);
  const areas = zones.map((z) => (
    <option key={z.code} value={z.code}>
      {z.name}
    </option>
  ));
  const spotsIn = (zone: string) =>
    zones
      .find((z) => z.code === zone)
      ?.spots.map((s) => (
        <option key={s.code} value={s.code}>
          {s.name} · {s.nameBn}
        </option>
      ));

  return (
    <div className={styles.row}>
      <div className={styles.end}>
        <Field label="From" bnLabel="থেকে" htmlFor={`${idPrefix}-pickup`} error={errors.pickupZone}>
          <select
            id={`${idPrefix}-pickup`}
            className="input"
            value={trip.pickup}
            // A new area starts at its main spot.
            onChange={(e) => onChange(withSpots({ ...trip, pickup: e.target.value, pickupSpot: undefined }, zones))}
          >
            {areas}
          </select>
        </Field>
        <Field label="Pickup spot" bnLabel="কোথায় উঠবেন" htmlFor={`${idPrefix}-pickup-spot`}>
          <select
            id={`${idPrefix}-pickup-spot`}
            className="input"
            value={trip.pickupSpot}
            onChange={(e) => onChange({ ...trip, pickupSpot: e.target.value })}
          >
            {spotsIn(trip.pickup)}
          </select>
        </Field>
      </div>
      <div className={styles.end}>
        <Field label="To" bnLabel="পর্যন্ত" htmlFor={`${idPrefix}-dropoff`} error={errors.dropoffZone}>
          <select
            id={`${idPrefix}-dropoff`}
            className="input"
            value={trip.dropoff}
            onChange={(e) => onChange(withSpots({ ...trip, dropoff: e.target.value, dropoffSpot: undefined }, zones))}
          >
            {areas}
          </select>
        </Field>
        <Field label="Drop-off spot" bnLabel="কোথায় নামবেন" htmlFor={`${idPrefix}-dropoff-spot`}>
          <select
            id={`${idPrefix}-dropoff-spot`}
            className="input"
            value={trip.dropoffSpot}
            onChange={(e) => onChange({ ...trip, dropoffSpot: e.target.value })}
          >
            {spotsIn(trip.dropoff)}
          </select>
        </Field>
      </div>
      <Field label="Seats" bnLabel="আসন" htmlFor={`${idPrefix}-seats`} error={errors.seats}>
        <select
          id={`${idPrefix}-seats`}
          className="input"
          value={trip.seats}
          onChange={(e) => onChange({ ...trip, seats: Number(e.target.value) })}
        >
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
