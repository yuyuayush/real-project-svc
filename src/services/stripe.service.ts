import Stripe from 'stripe';
import { env } from '../config/env.js';
import { Order } from '../models/order.model.js';
import { PaymentGatewayError } from '../errors/app-error.js';

export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }

  /**
   * Create a real Stripe Checkout Session (Redirect Flow)
   */
  async createCheckoutSession(
    order: Order,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ url: string; sessionId: string }> {
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

    // Add sales tax if applicable
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

    // Add shipping fee if applicable
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
      cancel_url: `${cancelUrl}?order_id=${order.id}&canceled=true`,
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
   * Create an Embedded/Elements Checkout Session (ui_mode: 'elements')
   * Stripe's recommended approach: combines Checkout Sessions features (adaptive pricing,
   * automatic tax, line items) with in-page Payment Element via CheckoutElementsProvider.
   */
  async createElementsCheckoutSession(
    order: Order,
    returnUrl?: string
  ): Promise<{ clientSecret: string; sessionId: string }> {
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

    const defaultReturnUrl = `${env.CLIENT_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`;

    const session = await this.stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      customer_email: order.customer.email,
      line_items: lineItems,
      return_url: returnUrl || defaultReturnUrl,
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
      },
    });

    if (!session.client_secret) {
      throw new PaymentGatewayError('Stripe Checkout Session client_secret was not generated');
    }

    return {
      clientSecret: session.client_secret,
      sessionId: session.id,
    };
  }

  /**
   * Retrieve a Checkout Session from Stripe
   */
  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.retrieve(sessionId);
  }

  /**
   * Retrieve a PaymentIntent from Stripe
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Create a PaymentIntent directly with Stripe
   */
  async createPaymentIntent(
    order: Order,
    idempotencyKey?: string
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
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
   * Create a PaymentIntent directly with an arbitrary amount (for sandbox tests / custom UI)
   */
  async createRawPaymentIntent(params: {
    amount: number;
    currency?: string;
    email?: string;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<{ clientSecret: string; paymentIntentId: string }> {
    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: Math.round(params.amount),
        currency: (params.currency || env.STRIPE_CURRENCY).toLowerCase(),
        receipt_email: params.email,
        metadata: params.metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      },
      params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined
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
    return this.stripe.webhooks.constructEvent(
      rawPayload,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  }

  /**
   * Refund a payment intent via Stripe
   */
  async refundPayment(
    paymentIntentId: string,
    amountInCents?: number,
    reason?: Stripe.RefundCreateParams.Reason
  ): Promise<{ refundId: string; status: string }> {
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
