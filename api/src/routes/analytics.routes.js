import { Router } from 'express';
import { trends, flammability } from '../controllers/analytics.controller.js';
import { firehazrMetadata, predictFirehazr } from '../services/firehazr.service.js';

const router = Router();

router.get('/firehazr', async (_req, res) => res.json(await firehazrMetadata()));
router.post('/firehazr/predict', async (req, res) => res.json(await predictFirehazr(req.body)));
router.post('/trends', trends);
router.post('/flammability-map', flammability);

export default router;
