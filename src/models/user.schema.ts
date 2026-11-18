import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from '../types/index.js';
import { UserRole } from '../constants/index.js';

export interface IUserDocument extends Omit<IUser, 'id'>, Document {
  id: string;
}

const UserSchema = new Schema<IUserDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true },
    phone: { type: Schema.Types.Mixed, sparse: true },
    role: {
      type: String,
      required: true,
      enum: Object.values(UserRole),
      default: UserRole.ADMIN,
    },
    avatarUrl: { type: String },
    addresses: [{ type: Schema.Types.ObjectId, ref: 'Address' }],
  },
  {
    timestamps: true,
    collection: 'users',
    toJSON: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>)._id;
        delete (ret as Record<string, unknown>).__v;
        delete (ret as Record<string, unknown>).passwordHash;
        return ret;
      },
    },
  }
);

export const UserModel = mongoose.model<IUserDocument>('User', UserSchema);
