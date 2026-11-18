import mongoose, { Schema, Document } from 'mongoose';

export interface IAddress {
  id: string;
  userId: string;
  user?: mongoose.Types.ObjectId;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  label?: string; // 'Home' | 'Office' | 'Billing' | 'Other'
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAddressDocument extends Omit<IAddress, 'id'>, Document {
  id: string;
}

const AddressSchema = new Schema<IAddressDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, default: 'United States', trim: true },
    label: { type: String, default: 'Home', trim: true },
    isDefault: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'addresses',
    toJSON: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>)._id;
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  }
);

AddressSchema.index({ userId: 1, isDefault: -1 });

export const AddressModel = mongoose.model<IAddressDocument>('Address', AddressSchema);
