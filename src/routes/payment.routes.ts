import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller.js';
import { paymentRateLimiter } from '../middlewares/rate-limiter.js';

const router = Router();

router.post('/create-intent', paymentRateLimiter, PaymentController.createIntent);
router.post('/refund', PaymentController.refund);

// Development/testing route to simulate payment completion & Resend receipt
router.post('/simulate-success/:orderId', PaymentController.simulateSuccess);

export default router;
