import { Router } from 'express';
import { ask, pollSession, status } from '../controllers/chat.controller.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.get('/status', status);

router.post(
  '/',
  validateBody({
    question: { required: true, type: 'string' },
    sessionId: { required: false, type: 'string' },
    audience: { required: false, type: 'string' },
    scenario: { required: false, type: 'object' },
  }),
  ask
);

router.get('/sessions/:sessionId', pollSession);

export default router;
