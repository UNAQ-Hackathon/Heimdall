import { Router } from 'express';
import { list, getById, getTelemetry, summarize } from '../controllers/investigation.controller.js';

const router = Router();

router.get('/', list);
router.get('/:id/telemetry', getTelemetry);
router.post('/:id/summarize', summarize);
router.get('/:id', getById);

export default router;
