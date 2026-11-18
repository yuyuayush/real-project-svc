import { Order, type IOrderRepository } from '../types/index.js';
import { OrderModel } from '../models/order.schema.js';
import { OrderStatus } from '../constants/order-status.js';

export type { IOrderRepository };

export class MongoOrderRepository implements IOrderRepository {
  async create(order: Order): Promise<Order> {
    const created = await OrderModel.create({ ...order });
    return created.toJSON() as unknown as Order;
  }

  async findById(id: string): Promise<Order | null> {
    const doc = await OrderModel.findOne({ id }).lean();
    return doc ? (doc as unknown as Order) : null;
  }

  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    const doc = await OrderModel.findOne({ orderNumber }).lean();
    return doc ? (doc as unknown as Order) : null;
  }

  async findByStripeSessionId(sessionId: string): Promise<Order | null> {
    const doc = await OrderModel.findOne({ 'payment.stripeSessionId': sessionId }).lean();
    return doc ? (doc as unknown as Order) : null;
  }

  async findByPaymentIntentId(paymentIntentId: string): Promise<Order | null> {
    const doc = await OrderModel.findOne({ 'payment.stripePaymentIntentId': paymentIntentId }).lean();
    return doc ? (doc as unknown as Order) : null;
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    paymentUpdates?: Partial<Order['payment']>
  ): Promise<Order | null> {
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (paymentUpdates) {
      for (const [key, value] of Object.entries(paymentUpdates)) {
        updateData[`payment.${key}`] = value;
      }
    }

    const updated = await OrderModel.findOneAndUpdate(
      { id },
      { $set: updateData },
      { new: true, lean: true }
    );

    return updated ? (updated as unknown as Order) : null;
  }

  async updateCustomer(id: string, customer: Order['customer']): Promise<Order | null> {
    const updated = await OrderModel.findOneAndUpdate(
      { id },
      { $set: { customer, updatedAt: new Date() } },
      { new: true, lean: true }
    );

    return updated ? (updated as unknown as Order) : null;
  }

  async listAll(limit: number = 50): Promise<Order[]> {
    const docs = await OrderModel.find().sort({ createdAt: -1 }).limit(limit).lean();
    return docs as unknown as Order[];
  }
}

export const orderRepository = new MongoOrderRepository();
