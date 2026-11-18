import mongoose, { Schema, Document } from 'mongoose';

export interface ISession {
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISessionDocument extends ISession, Document {}

const SessionSchema = new Schema<ISessionDocument>(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  {
    timestamps: true,
    collection: 'sessions',
    toJSON: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>)._id;
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  }
);

export const SessionModel = mongoose.model<ISessionDocument>('Session', SessionSchema);
