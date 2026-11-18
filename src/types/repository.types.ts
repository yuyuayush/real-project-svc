import { Order } from './order.types.js';
import { OrderStatus } from '../constants/order-status.js';

export interface IOrderRepository {
  create(order: Order): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findByOrderNumber(orderNumber: string): Promise<Order | null>;
  findByStripeSessionId(sessionId: string): Promise<Order | null>;
  findByPaymentIntentId(paymentIntentId: string): Promise<Order | null>;
  updateStatus(
    id: string,
    status: OrderStatus,
    paymentUpdates?: Partial<Order['payment']>
  ): Promise<Order | null>;
  updateCustomer(id: string, customer: Order['customer']): Promise<Order | null>;
  listAll(limit?: number): Promise<Order[]>;
}
