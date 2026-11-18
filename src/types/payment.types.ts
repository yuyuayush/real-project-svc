export interface CreateIntentInput {
  orderId: string;
}

export interface RefundInput {
  paymentIntentId: string;
  amount?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

export interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
}

export interface RefundResult {
  refundId: string;
  status: string;
  amount: number;
  currency: string;
  paymentIntentId: string;
}
