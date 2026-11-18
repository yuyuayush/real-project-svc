import { Request, Response } from 'express';
import { z } from 'zod';
import { orderService } from '../services/order.service.js';
import { stripeService } from '../services/stripe.service.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/async-handler.js';
import { validateSchema } from '../utils/validator.js';
import { type CreateCheckoutInput } from '../types/index.js';

export type { CreateCheckoutInput };

export const createCheckoutSchema = z.object({
  customer: z.object({
    name: z.string().min(2, 'Name is required'),
    email: z.string().email('Valid email is required'),
    phone: z.string().optional(),
    address: z
      .object({
        line1: z.string().min(3),
        line2: z.string().optional(),
        city: z.string().min(2),
        state: z.string().optional(),
        postalCode: z.string().min(2),
        country: z.string().min(2),
      })
      .optional(),
  }),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1, 'Item name is required'),
        description: z.string().optional(),
        price: z.number().int().positive('Price in cents must be positive'),
        quantity: z.number().int().positive('Quantity must be >= 1'),
        imageUrl: z.string().url().optional(),
      })
    )
    .min(1, 'At least one item is required'),
  currency: z.string().length(3).optional(),
  shippingFee: z.number().int().nonnegative().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  metadata: z.record(z.string()).optional(),
});

export class CheckoutController {
  static createSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = validateSchema(createCheckoutSchema, req.body);

    const result = await orderService.createCheckoutOrder(
      {
        customer: data.customer,
        items: data.items,
        currency: data.currency,
        shippingFee: data.shippingFee,
        taxRate: data.taxRate,
        metadata: data.metadata,
      },
      data.successUrl,
      data.cancelUrl
    );

    res.status(201).json({
      success: true,
      data: {
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        total: result.order.total,
        currency: result.order.currency,
        sessionId: result.sessionId,
        checkoutUrl: result.checkoutUrl,
      },
    });
  });

  /**
   * Create Checkout Session with ui_mode: 'elements' for Payment Element in-page checkout
   * (Stripe's recommended integration over raw PaymentIntents)
   */
  static createPaymentIntentOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = validateSchema(createCheckoutSchema, req.body);

    const result = await orderService.createElementsOrder(
      {
        customer: data.customer,
        items: data.items,
        currency: data.currency,
        shippingFee: data.shippingFee,
        taxRate: data.taxRate,
        metadata: data.metadata,
      },
      data.successUrl
    );

    res.status(201).json({
      success: true,
      data: {
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        total: result.order.total,
        currency: result.order.currency,
        clientSecret: result.clientSecret,
        sessionId: result.sessionId,
      },
    });
  });

  static confirmPayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { orderId, paymentMethod = 'card', paymentIntentId } = req.body;
    if (!orderId) {
      res.status(400).json({ success: false, message: 'orderId is required' });
      return;
    }

    // Verify settlement with Stripe to prevent unauthorized confirmation
    if (paymentIntentId) {
      const pi = await stripeService.getPaymentIntent(paymentIntentId);
      if (pi && pi.status !== 'succeeded' && pi.status !== 'processing') {
        res.status(400).json({
          success: false,
          message: `Stripe PaymentIntent status is '${pi.status}'. Payment has not been authorized.`,
        });
        return;
      }
    }

    const order = await orderService.handlePaymentSuccess({
      orderId,
      paymentMethodType: paymentMethod,
      stripePaymentIntentId: paymentIntentId,
    });
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }
    res.status(200).json({
      success: true,
      message: 'Payment confirmed successfully',
      data: order,
    });
  });

  static verifySession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const sessionId = (req.query.session_id || req.query.sessionId) as string | undefined;
    const orderId = (req.query.order_id || req.query.orderId) as string | undefined;

    const order = await orderService.verifyAndCompleteSession(sessionId, orderId);
    res.status(200).json({
      success: true,
      data: order,
    });
  });
}
