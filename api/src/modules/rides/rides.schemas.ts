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
  })
  .refine(differentZones, differentZonesError);

export const estimateQuerySchema = z
  .object({ pickupZone: zoneCode, dropoffZone: zoneCode, seats: seats.default(1) })
  .refine(differentZones, differentZonesError);

export const cancelRideSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export type RequestRideInput = z.infer<typeof requestRideSchema>;
