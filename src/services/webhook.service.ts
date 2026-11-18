import Stripe from 'stripe';
import { logger } from '../config/logger.js';
import { orderService } from './order.service.js';

export class WebhookService {
  // Simple in-memory LRU cache / Set for processed event deduplication
  private processedEventIds: Set<string> = new Set();
  private maxCacheSize = 1000;

  private isDuplicate(eventId: string): boolean {
    if (this.processedEventIds.has(eventId)) {
      return true;
    }
    if (this.processedEventIds.size >= this.maxCacheSize) {
      const firstEntry = this.processedEventIds.values().next().value;
      if (firstEntry) this.processedEventIds.delete(firstEntry);
    }
    this.processedEventIds.add(eventId);
    return false;
  }

  /**
   * Process a verified Stripe event
   */
  async processStripeEvent(event: Stripe.Event): Promise<{ handled: boolean; eventType: string }> {
    logger.info({ eventId: event.id, eventType: event.type }, '⚡ Processing verified Stripe Webhook event');

    if (this.isDuplicate(event.id)) {
      logger.info({ eventId: event.id }, 'ℹ️ Skipping duplicate webhook event (already processed)');
      return { handled: true, eventType: event.type };
    }

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        logger.info({ sessionId: session.id, paymentStatus: session.payment_status }, '💳 Checkout session completed');

        if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
          const orderId = (session.metadata?.orderId || session.client_reference_id) as string | undefined;
          
          await orderService.handlePaymentSuccess({
            stripeSessionId: session.id,
            stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
            paymentMethodType: session.payment_method_types?.[0] || 'card',
            orderId,
          });
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata?.orderId;
        const charge = paymentIntent.latest_charge as Stripe.Charge | undefined;

        await orderService.handlePaymentSuccess({
          stripePaymentIntentId: paymentIntent.id,
          orderId,
          receiptUrl: typeof charge === 'object' ? charge?.receipt_url || undefined : undefined,
          paymentMethodType: paymentIntent.payment_method_types?.[0] || 'card',
        });
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata?.orderId;
        const failureReason = paymentIntent.last_payment_error?.message || 'Transaction was declined';

        await orderService.handlePaymentFailure({
          stripePaymentIntentId: paymentIntent.id,
          orderId,
          failureReason,
        });
        break;
      }

      case 'refund.created':
      case 'refund.updated': {
        const refund = event.data.object as Stripe.Refund;
        logger.info({ refundId: refund.id, status: refund.status, amount: refund.amount }, '💸 Stripe Refund event received');

        if (refund.status === 'succeeded') {
          const paymentIntentId =
            typeof refund.payment_intent === 'string'
              ? refund.payment_intent
              : refund.payment_intent?.id;

          const chargeId =
            typeof refund.charge === 'string'
              ? refund.charge
              : refund.charge?.id;

          await orderService.handleRefundSuccess({
            stripePaymentIntentId: paymentIntentId,
            stripeChargeId: chargeId,
            refundId: refund.id,
            refundAmount: refund.amount,
            reason: refund.reason || 'Requested by customer',
          });
        }
        break;
      }

      case 'charge.refunded':
      case 'charge.refund.updated': {
        const charge = event.data.object as Stripe.Charge;
        logger.info({ chargeId: charge.id, amountRefunded: charge.amount_refunded }, '💸 Stripe Charge Refund event received');

        const paymentIntentId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id;

        await orderService.handleRefundSuccess({
          stripePaymentIntentId: paymentIntentId,
          stripeChargeId: charge.id,
          refundAmount: charge.amount_refunded,
          reason: 'Charge refunded via Stripe Dashboard',
        });
        break;
      }

      default:
        logger.info({ eventType: event.type }, 'ℹ️ Unhandled Stripe event type ignored');
        return { handled: false, eventType: event.type };
    }

    return { handled: true, eventType: event.type };
  }
}

export const webhookService = new WebhookService();
