import { z } from 'zod';

const code = z.string().trim().toUpperCase().min(1);
const seats = z.coerce.number().int().min(1, 'At least 1 seat').max(3, 'At most 3 seats');

// Each end of a trip is an exact spot (e.g. BANANI_KAKOLI), or just an area (its main spot).
const tripEnds = {
  pickupZone: code.optional(),
  pickupSpot: code.optional(),
  dropoffZone: code.optional(),
  dropoffSpot: code.optional(),
};
type TripEnds = { pickupZone?: string; pickupSpot?: string; dropoffZone?: string; dropoffSpot?: string };

// Shared checks for booking and estimating. (Spots in the same area are caught by the service,
// which knows each spot's area.)
function checkTripEnds<T extends z.ZodType<TripEnds>>(schema: T) {
  return schema
    .refine((v) => v.pickupZone || v.pickupSpot, { message: 'Choose where to be picked up', path: ['pickupZone'] })
    .refine((v) => v.dropoffZone || v.dropoffSpot, { message: 'Choose a destination', path: ['dropoffZone'] })
    .refine((v) => !v.pickupZone || v.pickupZone !== v.dropoffZone, {
      message: 'Pickup and destination must be different',
      path: ['dropoffZone'],
    });
}

export const requestRideSchema = checkTripEnds(
  z.object({
    ...tripEnds,
    seats: seats.default(1),
    paymentMethod: z.enum(['CASH', 'TESLAPAY']).default('CASH'),
    shareRide: z.boolean().default(true),
    sameGenderOnly: z.boolean().default(false),
  }),
)
  // Mirrors part of the DB check ride_requests_same_gender_check, with a friendlier message.
  // (The "declared a gender" half needs the user record, so the service checks it.)
  .refine((v) => v.shareRide || !v.sameGenderOnly, {
    message: 'Same-gender rides only apply when you share your ride',
    path: ['sameGenderOnly'],
  });

export const estimateQuerySchema = checkTripEnds(z.object({ ...tripEnds, seats: seats.default(1) }));
export type EstimateQuery = z.infer<typeof estimateQuerySchema>;

export const cancelRideSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export type RequestRideInput = z.infer<typeof requestRideSchema>;
