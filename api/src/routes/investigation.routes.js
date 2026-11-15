import { Router } from 'express';
import { list, getById, getTelemetry } from '../controllers/investigation.controller.js';

const router = Router();

router.get('/', list);
router.get('/:id/telemetry', getTelemetry);
router.get('/:id', getById);

export default router;
