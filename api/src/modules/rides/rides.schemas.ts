import { z } from 'zod';

const zoneCode = z.string().trim().toUpperCase().min(1, 'Choose a zone');
const seats = z.coerce.number().int().min(1, 'At least 1 seat').max(3, 'At most 3 seats');

const differentZones = (v: { pickupZone: string; dropoffZone: string }) => v.pickupZone !== v.dropoffZone;
const differentZonesError = { message: 'Pickup and destination must be different', path: ['dropoffZone'] };

export const requestRideSchema = z
  .object({
    pickupZone: zoneCode,
    dropoffZone: zoneCode,
    seats: seats.default(1),
    paymentMethod: z.enum(['CASH', 'TESLAPAY']).default('CASH'),
    shareRide: z.boolean().default(true),
    sameGenderOnly: z.boolean().default(false),
  })
  .refine(differentZones, differentZonesError)
  // Mirrors part of the DB check ride_requests_same_gender_check, with a friendlier message.
  // (The "declared a gender" half needs the user record, so the service checks it.)
  .refine((v) => v.shareRide || !v.sameGenderOnly, {
    message: 'Same-gender rides only apply when you share your ride',
    path: ['sameGenderOnly'],
  });

export const estimateQuerySchema = z
  .object({ pickupZone: zoneCode, dropoffZone: zoneCode, seats: seats.default(1) })
  .refine(differentZones, differentZonesError);

export const cancelRideSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export type RequestRideInput = z.infer<typeof requestRideSchema>;
