import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../../lib/errors';
import { currentUser, requireAuth, requireRole } from '../../middleware/auth';
import { cancelRideSchema, estimateQuerySchema, requestRideSchema } from './rides.schemas';
import {
  cancelRide,
  estimateTrip,
  getCurrentRide,
  getMyRide,
  getMyRideEvents,
  listMyRides,
  requestRide,
  shareWithAnyone,
} from './rides.service';

export const ridesRouter = Router();

// A malformed id can't match any ride, so answer 404 before it reaches the database
// (Postgres would reject a non-UUID with an error, which would become a 500).
function rideId(value: unknown): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw notFound('Ride not found');
  return parsed.data;
}

// Public: lets anyone see a price before signing in.
ridesRouter.get('/estimate', async (req, res) => {
  const q = estimateQuerySchema.parse(req.query);
  res.json({ estimate: await estimateTrip(q) });
});

// Everything below: signed-in passengers only, and only their own rides.
ridesRouter.use(requireAuth, requireRole('PASSENGER'));

ridesRouter.post('/', async (req, res) => {
  const ride = await requestRide(currentUser(req).id, requestRideSchema.parse(req.body));
  res.status(201).json({ ride });
});

ridesRouter.get('/', async (req, res) => {
  res.json({ rides: await listMyRides(currentUser(req).id) });
});

ridesRouter.get('/current', async (req, res) => {
  res.json({ ride: await getCurrentRide(currentUser(req).id) });
});

ridesRouter.get('/:id', async (req, res) => {
  res.json({ ride: await getMyRide(currentUser(req).id, rideId(req.params.id)) });
});

ridesRouter.get('/:id/events', async (req, res) => {
  res.json({ events: await getMyRideEvents(currentUser(req).id, rideId(req.params.id)) });
});

ridesRouter.post('/:id/share-with-anyone', async (req, res) => {
  res.json({ ride: await shareWithAnyone(currentUser(req).id, rideId(req.params.id)) });
});

ridesRouter.post('/:id/cancel', async (req, res) => {
  const { reason } = cancelRideSchema.parse(req.body ?? {});
  res.json({ ride: await cancelRide(currentUser(req).id, rideId(req.params.id), reason) });
});
