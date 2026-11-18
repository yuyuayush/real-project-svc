import { OrderStatus, PaymentProvider } from '../constants/order-status.js';
import type { Document } from 'mongoose';

export interface CustomerAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface CustomerInfo {
  name: string;
  email: string;
  phone?: string;
  address?: CustomerAddress;
}

export interface OrderItem {
  id: string;
  name: string;
  description?: string;
  price: number; // in cents (e.g. $19.99 = 1999)
  quantity: number;
  imageUrl?: string;
}

export interface PaymentDetails {
  provider: PaymentProvider;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  paymentMethodType?: string;
  receiptUrl?: string;
  paidAt?: Date;
  failureReason?: string;
  refundId?: string;
  refundAmount?: number;
  refundedAt?: Date;
  refundReason?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customer: CustomerInfo;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  payment: PaymentDetails;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderDTO {
  customer: CustomerInfo;
  items: Array<{
    id?: string;
    name: string;
    description?: string;
    price: number; // in cents
    quantity: number;
    imageUrl?: string;
  }>;
  currency?: string;
  shippingFee?: number; // in cents
  taxRate?: number; // e.g. 0.08 for 8%
  metadata?: Record<string, string>;
}

export interface IOrderDocument extends Omit<Order, 'id'>, Document {
  id: string;
}
