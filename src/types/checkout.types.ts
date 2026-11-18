import { CustomerInfo } from './order.types.js';

export interface CheckoutItemInput {
  id?: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface CreateCheckoutInput {
  customer: CustomerInfo;
  items: CheckoutItemInput[];
  currency?: string;
  shippingFee?: number;
  taxRate?: number;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  url: string;
  sessionId: string;
}
