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
import { emitOrderCreated, emitOrderUpdated, emitPaymentSuccess } from '../config/socket.js';

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
    const createdOrder = await orderRepository.create(newOrder);
    emitOrderCreated(createdOrder);
    logger.info({ orderId, orderNumber, total, customer: dto.customer.email }, ' New order record initialized');

    // Create checkout session with Stripe
    const finalSuccessUrl = successUrl || `${env.CLIENT_URL}/checkout/success`;
    const finalCancelUrl = cancelUrl || `${env.CLIENT_URL}/checkout`;

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
   * Create an Order and initialize a real Stripe PaymentIntent (for Stripe Elements in-page checkout)
   */
  async createPaymentIntentOrder(dto: CreateOrderDTO, idempotencyKey?: string) {
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
    const shipping = dto.shippingFee !== undefined ? Math.round(dto.shippingFee) : (subtotal > 5000 ? 0 : 500);
    const taxRate = dto.taxRate !== undefined ? dto.taxRate : 0.08;
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

    // Save order initially as PENDING in MongoDB
    const createdOrder = await orderRepository.create(newOrder);
    emitOrderCreated(createdOrder);
    logger.info(
      { orderId, orderNumber, total, customer: dto.customer.email },
      '🛒 PaymentIntent order initialized for Stripe Elements'
    );

    // Create PaymentIntent with Stripe
    const { clientSecret, paymentIntentId } = await stripeService.createPaymentIntent(
      createdOrder,
      idempotencyKey
    );

    // Save paymentIntentId to order in MongoDB
    await orderRepository.updateStatus(orderId, OrderStatus.PENDING, {
      stripePaymentIntentId: paymentIntentId,
    });

    return {
      order: createdOrder,
      clientSecret,
      paymentIntentId,
    };
  }

  /**
   * Create an Order and initialize an Embedded Checkout Session (ui_mode: 'elements')
   * Following Stripe's recommendation: Checkout Sessions API with Payment Element
   */
  async createElementsOrder(dto: CreateOrderDTO, returnUrl?: string) {
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
    const shipping = dto.shippingFee !== undefined ? Math.round(dto.shippingFee) : (subtotal > 5000 ? 0 : 500);
    const taxRate = dto.taxRate !== undefined ? dto.taxRate : 0.08;
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

    // Save order initially as PENDING in MongoDB
    const createdOrder = await orderRepository.create(newOrder);
    emitOrderCreated(createdOrder);
    logger.info(
      { orderId, orderNumber, total, customer: dto.customer.email },
      '🛒 Elements Checkout Session order initialized (ui_mode: elements)'
    );

    // Create Checkout Session with ui_mode: 'elements'
    const { clientSecret, sessionId } = await stripeService.createElementsCheckoutSession(
      createdOrder,
      returnUrl
    );

    // Save stripeSessionId to order in MongoDB
    await orderRepository.updateStatus(orderId, OrderStatus.PENDING, {
      stripeSessionId: sessionId,
    });

    return {
      order: createdOrder,
      clientSecret,
      sessionId,
    };
  }

  /**
   * Update delivery address and customer info on an existing order
   */
  async updateOrderAddress(
    orderId: string,
    address: Order['customer']['address'],
    customerName?: string,
    phone?: string
  ) {
    const order = await this.getOrder(orderId);
    const updatedCustomer = {
      ...order.customer,
      name: customerName || order.customer.name,
      phone: phone || order.customer.phone,
      address,
    };
    return orderRepository.updateCustomer(orderId, updatedCustomer);
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

    emitOrderUpdated(updatedOrder);
    emitPaymentSuccess({
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      amount: updatedOrder.total,
      currency: updatedOrder.currency,
      customer: {
        name: updatedOrder.customer.name,
        email: updatedOrder.customer.email,
      },
      paymentMethod: updatedOrder.payment.paymentMethodType,
    });

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
      emitOrderUpdated(updatedOrder);
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

  /**
   * Instant mock payment confirmation for testing checkout and real-time sockets
   */
  async simulatePaymentSuccess(orderId: string, paymentMethod: string = 'card') {
    return this.handlePaymentSuccess({
      orderId,
      paymentMethodType: paymentMethod,
      stripeChargeId: `ch_sim_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
      receiptUrl: `https://payflow.io/receipts/${orderId}`,
    });
  }
  /**
   * Verify and complete session upon return from Stripe Checkout
   */
  async verifyAndCompleteSession(sessionId?: string, orderId?: string): Promise<Order> {
    let order: Order | null = null;

    if (orderId) {
      order = await orderRepository.findById(orderId);
    }
    if (!order && sessionId) {
      order = await orderRepository.findByStripeSessionId(sessionId);
    }

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.status === OrderStatus.PAID) {
      return order;
    }

    // Verify payment completion directly with Stripe API
    if (sessionId) {
      try {
        const stripeSession = await stripeService.getCheckoutSession(sessionId);
        if (stripeSession && (stripeSession.payment_status === 'paid' || stripeSession.status === 'complete')) {
          const paymentIntentId =
            typeof stripeSession.payment_intent === 'string'
              ? stripeSession.payment_intent
              : stripeSession.payment_intent?.id;

          const updated = await this.handlePaymentSuccess({
            orderId: order.id,
            stripeSessionId: sessionId,
            stripePaymentIntentId: paymentIntentId,
            paymentMethodType: stripeSession.payment_method_types?.[0] || 'card',
          });
          if (updated) return updated;
        }
      } catch (stripeErr) {
        logger.error({ stripeErr, sessionId }, 'Stripe checkout session verification failed');
      }
    } else if (order.payment?.stripePaymentIntentId) {
      try {
        const pi = await stripeService.getPaymentIntent(order.payment.stripePaymentIntentId);
        if (pi && (pi.status === 'succeeded' || pi.status === 'processing')) {
          const updated = await this.handlePaymentSuccess({
            orderId: order.id,
            stripePaymentIntentId: pi.id,
            paymentMethodType: pi.payment_method_types?.[0] || 'card',
          });
          if (updated) return updated;
        }
      } catch (piErr) {
        logger.error({ piErr, paymentIntentId: order.payment.stripePaymentIntentId }, 'Stripe PaymentIntent verification failed');
      }
    }

    return order;
  }
}

export const orderService = new OrderService();
