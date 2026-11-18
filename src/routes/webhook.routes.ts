import { Router, raw } from 'express';
import { WebhookController } from '../controllers/webhook.controller.js';

const router = Router();

// CRITICAL: Webhook requires the raw unparsed request body to verify Stripe's HMAC signature!
router.post(
  '/stripe',
  raw({ type: 'application/json' }),
  WebhookController.handleStripe
);

export default router;
