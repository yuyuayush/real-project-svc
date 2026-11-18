import { Router } from 'express';
import { CheckoutController } from '../controllers/checkout.controller.js';
import { paymentRateLimiter } from '../middlewares/rate-limiter.js';

const router = Router();

router.post('/create-session', paymentRateLimiter, CheckoutController.createSession);
router.post('/create-intent-order', paymentRateLimiter, CheckoutController.createPaymentIntentOrder);
router.post('/confirm-payment', paymentRateLimiter, CheckoutController.confirmPayment);
router.get('/verify-session', CheckoutController.verifySession);

export default router;
