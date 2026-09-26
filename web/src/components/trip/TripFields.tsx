'use client';

import type { Zone } from '@/lib/types';
import { Field } from '../ui/Field';
import styles from './TripFields.module.css';

export type Trip = { pickup: string; dropoff: string; seats: number };

type Props = {
  zones: Zone[];
  value: Trip;
  onChange: (trip: Trip) => void;
  idPrefix: string; // keeps label/input ids unique when two forms share a page
  errors?: Partial<Record<'pickupZone' | 'dropoffZone' | 'seats', string>>;
};

// From / To / Seats selectors, shared by the public estimator and the booking form.
export function TripFields({ zones, value, onChange, idPrefix, errors = {} }: Props) {
  const options = zones.map((z) => (
    <option key={z.code} value={z.code}>
      {z.name}
    </option>
  ));
  return (
    <div className={styles.row}>
      <Field label="From" bnLabel="থেকে" htmlFor={`${idPrefix}-pickup`} error={errors.pickupZone}>
        <select
          id={`${idPrefix}-pickup`}
          className="input"
          value={value.pickup}
          onChange={(e) => onChange({ ...value, pickup: e.target.value })}
        >
          {options}
        </select>
      </Field>
      <Field label="To" bnLabel="পর্যন্ত" htmlFor={`${idPrefix}-dropoff`} error={errors.dropoffZone}>
        <select
          id={`${idPrefix}-dropoff`}
          className="input"
          value={value.dropoff}
          onChange={(e) => onChange({ ...value, dropoff: e.target.value })}
        >
          {options}
        </select>
      </Field>
      <Field label="Seats" bnLabel="আসন" htmlFor={`${idPrefix}-seats`} error={errors.seats}>
        <select
          id={`${idPrefix}-seats`}
          className="input"
          value={value.seats}
          onChange={(e) => onChange({ ...value, seats: Number(e.target.value) })}
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
