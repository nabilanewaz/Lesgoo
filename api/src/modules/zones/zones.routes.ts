import { Router } from 'express';
import { listZones } from './zones.service';

export const zonesRouter = Router();

// Public: the booking form needs the list before anyone signs in.
zonesRouter.get('/', async (_req, res) => {
  res.json({ zones: await listZones() });
});
