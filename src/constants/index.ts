/**
 * Centralized Application Enums and Constants
 * Single source of truth for all domain enums to prevent naming collisions and discrepancies.
 */

export enum UserRole {
  ADMIN = 'admin',
  FINANCE_MANAGER = 'finance_manager',
  VIEWER = 'viewer',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  CARD = 'card',
  UPI = 'upi',
  NETBANKING = 'netbanking',
  WALLET = 'wallet',
}

export enum PaymentProvider {
  STRIPE = 'STRIPE',
}

export enum RefundReason {
  DUPLICATE = 'duplicate',
  FRAUDULENT = 'fraudulent',
  REQUESTED_BY_CUSTOMER = 'requested_by_customer',
}

export enum AuthCookie {
  NAME = 'payflow_auth_token',
}
