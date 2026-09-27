import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../../lib/errors';
import { currentUser, requireAuth, requireRole } from '../../middleware/auth';
import {
  acceptRequest,
  BREAKDOWN_REASONS,
  dropOffPassenger,
  reportBreakdown,
  transitionPool,
  type PoolTransition,
} from '../pools/pools.service';
import { getDriverStatus, getPoolHistory, getRequestFeed, setAutoAccept, setOnline } from './driver.service';

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

driverRouter.post('/auto-accept', async (req, res) => {
  const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
  res.json(await setAutoAccept(currentUser(req).id, enabled));
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

// Let ONE passenger off: at their destination (no body), or early at an area on the way.
driverRouter.post('/rides/:id/drop-off', async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw notFound('Ride not found');
  const { zone } = z.object({ zone: z.string().min(1).optional() }).parse(req.body ?? {});
  const driverId = currentUser(req).id;
  await dropOffPassenger(driverId, id.data, zone);
  res.json(await getDriverStatus(driverId));
});

driverRouter.post('/pool/breakdown', async (req, res) => {
  const { reason } = z.object({ reason: z.enum(BREAKDOWN_REASONS) }).parse(req.body);
  const driverId = currentUser(req).id;
  await reportBreakdown(driverId, reason);
  res.json(await getDriverStatus(driverId));
});

driverRouter.get('/pools', async (req, res) => {
  res.json({ pools: await getPoolHistory(currentUser(req).id) });
});
