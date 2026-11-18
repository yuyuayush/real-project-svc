import { Request, Response } from 'express';
import { z } from 'zod';
import { stripeService } from '../services/stripe.service.js';
import { orderService } from '../services/order.service.js';
import { orderRepository } from '../repositories/order.repository.js';
import { BadRequestError, NotFoundError } from '../errors/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { validateSchema } from '../utils/validator.js';
import { type CreateIntentInput, type RefundInput } from '../types/index.js';
import { RefundReason } from '../constants/index.js';
import { env } from '../config/env.js';

export type { CreateIntentInput, RefundInput };

export const createIntentSchema = z
  .object({
    orderId: z.string().optional(),
    amount: z.number().int().positive('Amount in cents must be positive').optional(),
    currency: z.string().length(3).optional(),
    email: z.string().email().optional(),
    metadata: z.record(z.string()).optional(),
  })
  .refine((data) => data.orderId || data.amount, {
    message: 'Either orderId or amount (in cents) must be provided to create a PaymentIntent',
  });

export const refundSchema = z.object({
  paymentIntentId: z.string().min(5, 'Valid payment intent ID is required'),
  amount: z.number().int().positive().optional(),
  reason: z.nativeEnum(RefundReason).optional(),
});

export class PaymentController {
  /**
   * Create Payment Intent for custom UI / mobile SDK / local sandbox tests
   */
  static createIntent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const input = validateSchema(createIntentSchema, req.body);
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    let clientSecret = '';
    let paymentIntentId = '';
    let resolvedOrderId = input.orderId || null;
    let resolvedAmount = input.amount || 0;
    let resolvedCurrency = (input.currency || env.STRIPE_CURRENCY).toUpperCase();

    // 1. If orderId is provided, try looking it up in MongoDB
    if (input.orderId) {
      const order = await orderRepository.findById(input.orderId);
      if (order) {
        resolvedAmount = order.total;
        resolvedCurrency = order.currency;
        const result = await stripeService.createPaymentIntent(order, idempotencyKey);
        clientSecret = result.clientSecret;
        paymentIntentId = result.paymentIntentId;

        // Save paymentIntentId to order in MongoDB Compass
        await orderRepository.updateStatus(order.id, order.status, {
          stripePaymentIntentId: paymentIntentId,
        });
      } else if (!input.amount) {
        throw new NotFoundError(`Order with ID ${input.orderId} not found in database`);
      }
    }

    // 2. If no existing order or tested directly in sandbox with amount, generate raw intent
    if (!clientSecret) {
      const result = await stripeService.createRawPaymentIntent({
        amount: resolvedAmount,
        currency: resolvedCurrency,
        email: input.email || 'customer@example.com',
        metadata: {
          orderId: resolvedOrderId || 'sandbox_test_intent',
          ...(input.metadata || {}),
        },
        idempotencyKey,
      });
      clientSecret = result.clientSecret;
      paymentIntentId = result.paymentIntentId;
    }

    res.status(200).json({
      success: true,
      message: 'Stripe PaymentIntent created successfully. Pass clientSecret to <Elements> on your custom checkout UI.',
      data: {
        clientSecret,
        paymentIntentId,
        orderId: resolvedOrderId,
        amount: resolvedAmount,
        currency: resolvedCurrency,
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
