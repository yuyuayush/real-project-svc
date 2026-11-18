import mongoose, { Schema } from 'mongoose';
import { Order, type IOrderDocument } from '../types/index.js';
import { OrderStatus, PaymentProvider } from '../constants/order-status.js';

export type { IOrderDocument };

const OrderItemSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    imageUrl: { type: String },
  },
  { _id: false }
);

const CustomerSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    phone: { type: String },
    address: {
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String },
    },
  },
  { _id: false }
);

const PaymentDetailsSchema = new Schema(
  {
    provider: { type: String, enum: Object.values(PaymentProvider), default: PaymentProvider.STRIPE },
    stripeSessionId: { type: String, index: true },
    stripePaymentIntentId: { type: String, index: true },
    stripeChargeId: { type: String },
    paymentMethodType: { type: String },
    receiptUrl: { type: String },
    paidAt: { type: Date },
    failureReason: { type: String },
    refundId: { type: String },
    refundAmount: { type: Number },
    refundedAt: { type: Date },
    refundReason: { type: String },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    orderNumber: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
      index: true,
    },
    customer: { type: CustomerSchema, required: true },
    items: { type: [OrderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true, default: 0 },
    shipping: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, required: true, uppercase: true, default: 'USD' },
    payment: { type: PaymentDetailsSchema, default: () => ({}) },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'orders',
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        // Strip mongo internal _id and __v from output
        delete (ret as Record<string, unknown>)._id;
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  }
);

export const OrderModel = mongoose.model<IOrderDocument>('Order', OrderSchema);
