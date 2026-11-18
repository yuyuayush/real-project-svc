import { v4 as uuidv4 } from 'uuid';
import { IAddress, IAddressRepository, UpdateAddressInput } from '../types/index.js';
import { AddressModel } from '../models/address.schema.js';
import { UserModel } from '../models/user.schema.js';
import { isDatabaseConnected } from '../config/database.js';
import { logger } from '../config/logger.js';

export class InMemoryAddressRepository implements IAddressRepository {
  private addresses: Map<string, IAddress> = new Map();

  async findByUserId(userId: string): Promise<IAddress[]> {
    const list: IAddress[] = [];
    for (const addr of this.addresses.values()) {
      if (addr.userId === userId) {
        list.push({ ...addr });
      }
    }
    // Sort default first, then newest
    return list.sort((a, b) => {
      if (a.isDefault === b.isDefault) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return a.isDefault ? -1 : 1;
    });
  }

  async findById(id: string, userId?: string): Promise<IAddress | null> {
    const addr = this.addresses.get(id);
    if (!addr) return null;
    if (userId && addr.userId !== userId) return null;
    return { ...addr };
  }

  async create(data: Omit<IAddress, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<IAddress> {
    const now = new Date();
    const id = data.id || `addr_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    // If marked default, unset other defaults
    if (data.isDefault) {
      for (const [key, addr] of this.addresses.entries()) {
        if (addr.userId === data.userId && addr.isDefault) {
          this.addresses.set(key, { ...addr, isDefault: false, updatedAt: now });
        }
      }
    }

    const newAddress: IAddress = {
      id,
      userId: data.userId,
      fullName: data.fullName,
      phone: data.phone,
      line1: data.line1,
      line2: data.line2,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      country: data.country || 'United States',
      label: data.label || 'Home',
      isDefault: !!data.isDefault,
      createdAt: now,
      updatedAt: now,
    };

    this.addresses.set(id, newAddress);
    return { ...newAddress };
  }

  async update(id: string, userId: string, data: UpdateAddressInput): Promise<IAddress | null> {
    const existing = this.addresses.get(id);
    if (!existing || existing.userId !== userId) return null;

    const now = new Date();
    if (data.isDefault) {
      for (const [key, addr] of this.addresses.entries()) {
        if (addr.userId === userId && addr.id !== id && addr.isDefault) {
          this.addresses.set(key, { ...addr, isDefault: false, updatedAt: now });
        }
      }
    }

    const updated: IAddress = {
      ...existing,
      ...data,
      country: data.country || existing.country,
      label: data.label || existing.label,
      updatedAt: now,
    };

    this.addresses.set(id, updated);
    return { ...updated };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const existing = this.addresses.get(id);
    if (!existing || existing.userId !== userId) return false;
    this.addresses.delete(id);
    return true;
  }

  async setDefault(id: string, userId: string): Promise<IAddress | null> {
    return this.update(id, userId, { isDefault: true });
  }
}

export class MongoAddressRepository implements IAddressRepository {
  private fallbackRepo = new InMemoryAddressRepository();

  async findByUserId(userId: string): Promise<IAddress[]> {
    if (!isDatabaseConnected()) {
      return this.fallbackRepo.findByUserId(userId);
    }
    const docs = await AddressModel.find({ userId })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();
    return docs as unknown as IAddress[];
  }

  async findById(id: string, userId?: string): Promise<IAddress | null> {
    if (!isDatabaseConnected()) {
      return this.fallbackRepo.findById(id, userId);
    }
    const query: Record<string, unknown> = { id };
    if (userId) query.userId = userId;
    const doc = await AddressModel.findOne(query).lean();
    return doc ? (doc as unknown as IAddress) : null;
  }

  async create(data: Omit<IAddress, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<IAddress> {
    if (!isDatabaseConnected()) {
      return this.fallbackRepo.create(data);
    }

    const id = data.id || `addr_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    // If new address is default, clear existing default addresses for this user
    if (data.isDefault) {
      await AddressModel.updateMany({ userId: data.userId }, { isDefault: false });
    }

    // Check if user has corresponding user document
    const userDoc = await UserModel.findOne({ id: data.userId });

    const doc = await AddressModel.create({
      id,
      userId: data.userId,
      user: userDoc?._id,
      fullName: data.fullName,
      phone: data.phone,
      line1: data.line1,
      line2: data.line2,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      country: data.country || 'United States',
      label: data.label || 'Home',
      isDefault: !!data.isDefault,
    });

    // Reference in User document
    if (userDoc) {
      await UserModel.updateOne(
        { id: data.userId },
        { $addToSet: { addresses: doc._id } }
      );
    }

    logger.info({ addressId: id, userId: data.userId }, '📍 Saved new address in MongoDB Compass');
    return doc.toJSON() as unknown as IAddress;
  }

  async update(id: string, userId: string, data: UpdateAddressInput): Promise<IAddress | null> {
    if (!isDatabaseConnected()) {
      return this.fallbackRepo.update(id, userId, data);
    }

    if (data.isDefault) {
      await AddressModel.updateMany({ userId, id: { $ne: id } }, { isDefault: false });
    }

    const doc = await AddressModel.findOneAndUpdate(
      { id, userId },
      { $set: data },
      { new: true }
    ).lean();

    return doc ? (doc as unknown as IAddress) : null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    if (!isDatabaseConnected()) {
      return this.fallbackRepo.delete(id, userId);
    }

    const doc = await AddressModel.findOneAndDelete({ id, userId });
    if (!doc) return false;

    // Remove reference from User document
    await UserModel.updateOne(
      { id: userId },
      { $pull: { addresses: doc._id } }
    );

    return true;
  }

  async setDefault(id: string, userId: string): Promise<IAddress | null> {
    return this.update(id, userId, { isDefault: true });
  }
}

export const addressRepository = new MongoAddressRepository();
