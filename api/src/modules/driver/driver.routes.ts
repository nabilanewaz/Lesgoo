import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../../lib/errors';
import { currentUser, requireAuth, requireRole } from '../../middleware/auth';
import { acceptRequest, transitionPool, type PoolTransition } from '../pools/pools.service';
import { getDriverStatus, getPoolHistory, getRequestFeed, setOnline } from './driver.service';

export const driverRouter = Router();

driverRouter.use(requireAuth, requireRole('DRIVER'));

driverRouter.get('/me', async (req, res) => {
  res.json(await getDriverStatus(currentUser(req).id));
});

driverRouter.post('/online', async (req, res) => {
  res.json(await setOnline(currentUser(req).id, true));
});

driverRouter.post('/offline', async (req, res) => {
  res.json(await setOnline(currentUser(req).id, false));
});

driverRouter.get('/requests', async (req, res) => {
  res.json({ requests: await getRequestFeed(currentUser(req).id) });
});

driverRouter.post('/requests/:id/accept', async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw notFound('Ride not found');
  const driverId = currentUser(req).id;
  await acceptRequest(driverId, id.data);
  res.json(await getDriverStatus(driverId));
});

// One endpoint per transition instead of PATCH { status }: each has its own rules and side
// effects (arrive locks the passenger list, start finalises fares), see DESIGN.md §9.
const transitions: Record<string, PoolTransition> = {
  arrive: 'DRIVER_ARRIVED',
  start: 'STARTED',
  complete: 'COMPLETED',
  cancel: 'CANCELLED',
};

for (const [action, to] of Object.entries(transitions)) {
  driverRouter.post(`/pool/${action}`, async (req, res) => {
    const driverId = currentUser(req).id;
    await transitionPool(driverId, to);
    res.json(await getDriverStatus(driverId));
  });
}

driverRouter.get('/pools', async (req, res) => {
  res.json({ pools: await getPoolHistory(currentUser(req).id) });
});
