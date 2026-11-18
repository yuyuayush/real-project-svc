import { v4 as uuidv4 } from 'uuid';
import { Order, OrderItem, CustomerInfo, CreateOrderDTO } from '../types/index.js';
import { OrderStatus, PaymentProvider } from '../constants/order-status.js';
import { orderRepository } from '../repositories/order.repository.js';
import { stripeService } from './stripe.service.js';
import { emailService } from './email.service.js';
import { logger } from '../config/logger.js';
import { generateOrderNumber } from '../utils/formatters.js';
import { BadRequestError, NotFoundError } from '../errors/app-error.js';
import { env } from '../config/env.js';

export type { CreateOrderDTO };

export class OrderService {
  /**
   * Create an Order and initiate Stripe Checkout Session
   */
  async createCheckoutOrder(dto: CreateOrderDTO, successUrl?: string, cancelUrl?: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestError('An order must have at least one item');
    }

    const items: OrderItem[] = dto.items.map((item) => ({
      id: item.id || uuidv4(),
      name: item.name,
      description: item.description,
      price: Math.round(item.price),
      quantity: Math.max(1, item.quantity),
      imageUrl: item.imageUrl,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = dto.shippingFee !== undefined ? Math.round(dto.shippingFee) : (subtotal > 5000 ? 0 : 500); // Free shipping over $50
    const taxRate = dto.taxRate !== undefined ? dto.taxRate : 0.08; // 8% tax default
    const tax = Math.round(subtotal * taxRate);
    const total = subtotal + shipping + tax;
    const currency = (dto.currency || env.STRIPE_CURRENCY).toUpperCase();

    const orderId = uuidv4();
    const orderNumber = generateOrderNumber();

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      status: OrderStatus.PENDING,
      customer: dto.customer,
      items,
      subtotal,
      tax,
      shipping,
      total,
      currency,
      payment: {
        provider: PaymentProvider.STRIPE,
      },
      metadata: dto.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save order initially as PENDING
    await orderRepository.create(newOrder);
    logger.info({ orderId, orderNumber, total, customer: dto.customer.email }, ' New order record initialized');

    // Create checkout session with Stripe
    const finalSuccessUrl = successUrl || `${env.CLIENT_URL}/order-success.html`;
    const finalCancelUrl = cancelUrl || `${env.CLIENT_URL}/order-cancel.html`;

    const { url, sessionId } = await stripeService.createCheckoutSession(
      newOrder,
      finalSuccessUrl,
      finalCancelUrl
    );

    // Update order with session ID
    await orderRepository.updateStatus(orderId, OrderStatus.PENDING, {
      stripeSessionId: sessionId,
    });

    return {
      order: newOrder,
      checkoutUrl: url,
      sessionId,
    };
  }

  /**
   * Handle Payment Success (called by Webhook)
   */
  async handlePaymentSuccess(data: {
    stripeSessionId?: string;
    stripePaymentIntentId?: string;
    stripeChargeId?: string;
    receiptUrl?: string;
    paymentMethodType?: string;
    orderId?: string;
  }) {
    let order: Order | null = null;

    if (data.orderId) {
      order = await orderRepository.findById(data.orderId);
    }
    if (!order && data.stripeSessionId) {
      order = await orderRepository.findByStripeSessionId(data.stripeSessionId);
    }
    if (!order && data.stripePaymentIntentId) {
      order = await orderRepository.findByPaymentIntentId(data.stripePaymentIntentId);
    }

    if (!order) {
      logger.warn({ data }, '⚠️ Order not found for payment success webhook');
      return null;
    }

    // Idempotency check: If already paid, do not re-send email or re-process
    if (order.status === OrderStatus.PAID) {
      logger.info({ orderNumber: order.orderNumber }, 'ℹ️ Order already marked as PAID (Idempotent call)');
      return order;
    }

    const updatedOrder = await orderRepository.updateStatus(order.id, OrderStatus.PAID, {
      stripeSessionId: data.stripeSessionId || order.payment.stripeSessionId,
      stripePaymentIntentId: data.stripePaymentIntentId || order.payment.stripePaymentIntentId,
      stripeChargeId: data.stripeChargeId,
      receiptUrl: data.receiptUrl,
      paymentMethodType: data.paymentMethodType || 'card',
      paidAt: new Date(),
    });

    if (!updatedOrder) return null;

    logger.info(
      {
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        customer: updatedOrder.customer.email,
        total: updatedOrder.total,
      },
      '💰 Payment confirmed! Processing order and sending email receipt via Resend'
    );

    // Send confirmation email via Resend
    await emailService.sendOrderReceipt(updatedOrder);

    return updatedOrder;
  }

  /**
   * Handle Payment Failure (called by Webhook)
   */
  async handlePaymentFailure(data: {
    stripePaymentIntentId?: string;
    orderId?: string;
    failureReason?: string;
  }) {
    let order: Order | null = null;
    if (data.orderId) {
      order = await orderRepository.findById(data.orderId);
    }
    if (!order && data.stripePaymentIntentId) {
      order = await orderRepository.findByPaymentIntentId(data.stripePaymentIntentId);
    }

    if (!order) {
      logger.warn({ data }, '⚠️ Order not found for payment failure webhook');
      return null;
    }

    const updatedOrder = await orderRepository.updateStatus(order.id, OrderStatus.PAYMENT_FAILED, {
      failureReason: data.failureReason,
    });

    if (updatedOrder) {
      logger.warn({ orderNumber: updatedOrder.orderNumber, reason: data.failureReason }, '⚠️ Order marked as PAYMENT_FAILED');
      await emailService.sendPaymentFailureAlert(updatedOrder, data.failureReason);
    }

    return updatedOrder;
  }

  /**
   * Handle Payment Refund (called by Webhook)
   */
  async handleRefundSuccess(data: {
    stripePaymentIntentId?: string;
    stripeChargeId?: string;
    refundId?: string;
    refundAmount?: number;
    reason?: string;
    orderId?: string;
  }) {
    let order: Order | null = null;
    if (data.orderId) {
      order = await orderRepository.findById(data.orderId);
    }
    if (!order && data.stripePaymentIntentId) {
      order = await orderRepository.findByPaymentIntentId(data.stripePaymentIntentId);
    }

    if (!order) {
      logger.warn({ data }, '⚠️ Order not found for refund webhook');
      return null;
    }

    if (order.status === OrderStatus.REFUNDED) {
      logger.info({ orderNumber: order.orderNumber }, 'ℹ️ Order already marked as REFUNDED (Idempotent call)');
      return order;
    }

    const updatedOrder = await orderRepository.updateStatus(order.id, OrderStatus.REFUNDED, {
      refundId: data.refundId,
      refundAmount: data.refundAmount || order.total,
      refundedAt: new Date(),
      refundReason: data.reason || 'Requested by customer',
    });

    if (updatedOrder) {
      logger.info(
        { orderNumber: updatedOrder.orderNumber, refundAmount: data.refundAmount },
        '💸 Refund confirmed! Updating database and sending refund confirmation email via Resend'
      );
      await emailService.sendRefundConfirmation(updatedOrder, data.refundAmount, data.reason);
    }

    return updatedOrder;
  }

  /**
   * Get Order by ID
   */
  async getOrder(orderId: string): Promise<Order> {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError(`Order with ID ${orderId} not found`);
    }
    return order;
  }

  /**
   * List all recent orders
   */
  async listOrders() {
    return orderRepository.listAll(50);
  }
}

export const orderService = new OrderService();
