import { Request, Response } from 'express';
import { z } from 'zod';
import { stripeService } from '../services/stripe.service.js';
import { orderService } from '../services/order.service.js';
import { BadRequestError } from '../errors/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { validateSchema } from '../utils/validator.js';
import { type CreateIntentInput, type RefundInput } from '../types/index.js';
import { RefundReason } from '../constants/index.js';

export type { CreateIntentInput, RefundInput };

export const createIntentSchema = z.object({
  orderId: z.string().uuid('Valid order UUID is required'),
});

export const refundSchema = z.object({
  paymentIntentId: z.string().min(5, 'Valid payment intent ID is required'),
  amount: z.number().int().positive().optional(),
  reason: z.nativeEnum(RefundReason).optional(),
});

export class PaymentController {
  /**
   * Create Payment Intent for custom UI / mobile SDK
   */
  static createIntent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { orderId } = validateSchema(createIntentSchema, req.body);
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    const order = await orderService.getOrder(orderId);
    const { clientSecret, paymentIntentId } = await stripeService.createPaymentIntent(
      order,
      idempotencyKey
    );

    res.status(200).json({
      success: true,
      data: {
        clientSecret,
        paymentIntentId,
        orderId: order.id,
        amount: order.total,
        currency: order.currency,
      },
    });
  });

  /**
   * Refund an existing payment
   */
  static refund = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { paymentIntentId, amount, reason } = validateSchema(refundSchema, req.body);

    const result = await stripeService.refundPayment(paymentIntentId, amount, reason);

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * Development endpoint to trigger a simulated payment completion & Resend email
   */
  static simulateSuccess = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
    if (!orderId) {
      throw new BadRequestError('orderId is required');
    }

    const updatedOrder = await orderService.handlePaymentSuccess({
      orderId,
      paymentMethodType: 'visa_demo',
      stripePaymentIntentId: `pi_simulated_${Date.now()}`,
    });

    res.status(200).json({
      success: true,
      message: 'Order simulated as PAID and confirmation email triggered via Resend',
      data: updatedOrder,
    });
  });
}
