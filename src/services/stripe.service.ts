import Stripe from 'stripe';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Order } from '../models/order.model.js';
import { PaymentGatewayError } from '../errors/app-error.js';

export class StripeService {
  private stripe: Stripe | null = null;

  constructor() {
    if (!env.isMockStripe) {
      this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
        typescript: true,
      });
      logger.info('💳 Stripe Gateway initialized with configured Secret Key');
    } else {
      logger.warn('⚠️ STRIPE_SECRET_KEY is placeholder or not set. Running in development simulation mode.');
    }
  }

  /**
   * Create a Stripe Checkout Session (Redirect Flow)
   */
  async createCheckoutSession(order: Order, successUrl: string, cancelUrl: string): Promise<{ url: string; sessionId: string }> {
    if (env.isMockStripe || !this.stripe) {
      const mockSessionId = `cs_test_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      logger.info({ orderId: order.id, mockSessionId }, '💳 [MOCK STRIPE] Generating mock checkout session');
      return {
        url: `${env.CLIENT_URL}/checkout-mock.html?session_id=${mockSessionId}&order_id=${order.id}`,
        sessionId: mockSessionId,
      };
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((item) => ({
      price_data: {
        currency: order.currency.toLowerCase(),
        product_data: {
          name: item.name,
          description: item.description,
          images: item.imageUrl ? [item.imageUrl] : undefined,
        },
        unit_amount: item.price,
      },
      quantity: item.quantity,
    }));

    // Add tax as line item if present
    if (order.tax > 0) {
      lineItems.push({
        price_data: {
          currency: order.currency.toLowerCase(),
          product_data: {
            name: 'Estimated Sales Tax',
          },
          unit_amount: order.tax,
        },
        quantity: 1,
      });
    }

    // Add shipping as line item if present
    if (order.shipping > 0) {
      lineItems.push({
        price_data: {
          currency: order.currency.toLowerCase(),
          product_data: {
            name: 'Standard Shipping',
          },
          unit_amount: order.shipping,
        },
        quantity: 1,
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: order.customer.email,
      line_items: lineItems,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
      cancel_url: `${cancelUrl}?order_id=${order.id}`,
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
      },
    });

    if (!session.url) {
      throw new PaymentGatewayError('Stripe Checkout Session URL was not generated');
    }

    return {
      url: session.url,
      sessionId: session.id,
    };
  }

  /**
   * Create a PaymentIntent directly (for custom elements / mobile apps)
   */
  async createPaymentIntent(
    order: Order,
    idempotencyKey?: string
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    if (env.isMockStripe || !this.stripe) {
      const mockPaymentIntentId = `pi_mock_${Date.now()}`;
      return {
        clientSecret: `${mockPaymentIntentId}_secret_mock`,
        paymentIntentId: mockPaymentIntentId,
      };
    }

    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: order.total,
        currency: order.currency.toLowerCase(),
        receipt_email: order.customer.email,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      },
      idempotencyKey ? { idempotencyKey } : undefined
    );

    return {
      clientSecret: paymentIntent.client_secret || '',
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * Construct and verify Webhook Event with raw signature
   */
  constructWebhookEvent(rawPayload: Buffer | string, signature: string): Stripe.Event {
    if (env.isMockStripe || !this.stripe) {
      const payloadString = Buffer.isBuffer(rawPayload) ? rawPayload.toString('utf8') : rawPayload;
      return JSON.parse(payloadString) as Stripe.Event;
    }

    return this.stripe.webhooks.constructEvent(
      rawPayload,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  }

  /**
   * Refund a payment intent
   */
  async refundPayment(
    paymentIntentId: string,
    amountInCents?: number,
    reason?: Stripe.RefundCreateParams.Reason
  ): Promise<{ refundId: string; status: string }> {
    if (env.isMockStripe || !this.stripe) {
      return {
        refundId: `re_mock_${Date.now()}`,
        status: 'succeeded',
      };
    }

    const refund = await this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountInCents,
      reason,
    });

    return {
      refundId: refund.id,
      status: refund.status || 'unknown',
    };
  }
}

export const stripeService = new StripeService();
