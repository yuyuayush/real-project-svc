import { Router } from 'express';
import { CheckoutController } from '../controllers/checkout.controller.js';
import { paymentRateLimiter } from '../middlewares/rate-limiter.js';

const router = Router();

router.post('/create-session', paymentRateLimiter, CheckoutController.createSession);

export default router;
