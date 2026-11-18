import { v4 as uuidv4 } from 'uuid';
import { IUser, IUserRepository } from '../types/index.js';
import { UserModel } from '../models/user.schema.js';
import { isDatabaseConnected } from '../config/database.js';
import { logger } from '../config/logger.js';
import { hashPassword } from '../utils/crypto.js';

export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, IUser> = new Map();

  async findByEmail(email: string): Promise<IUser | null> {
    const normalized = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) {
        return { ...user };
      }
    }
    return null;
  }

  async findById(id: string): Promise<IUser | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async create(userData: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<IUser> {
    const now = new Date();
    const newUser: IUser = {
      id: userData.id || `usr_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
      email: userData.email.toLowerCase(),
      name: userData.name,
      passwordHash: userData.passwordHash,
      role: userData.role,
      companyName: userData.companyName,
      avatarUrl: userData.avatarUrl,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(newUser.id, newUser);
    return { ...newUser };
  }

  async seedDefaultUsers(): Promise<void> {
    const demo = await this.findByEmail('demo@payflow.io');
    if (!demo) {
      const hash = hashPassword('password123');
      await this.create({
        id: 'usr_pf_892348912',
        email: 'demo@payflow.io',
        name: 'Alex Morgan',
        passwordHash: hash,
        role: 'admin',
        companyName: 'Acme Payments Corp',
        avatarUrl:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      });
    }

    const admin = await this.findByEmail('admin@payflow.io');
    if (!admin) {
      const hash = hashPassword('payflow2026');
      await this.create({
        id: 'usr_pf_110293847',
        email: 'admin@payflow.io',
        name: 'Elena Rostova',
        passwordHash: hash,
        role: 'admin',
        companyName: 'Global Fintech Labs',
        avatarUrl:
          'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&q=80',
      });
    }
  }
}

export class MongoUserRepository implements IUserRepository {
  private fallbackRepo = new InMemoryUserRepository();

  async findByEmail(email: string): Promise<IUser | null> {
    const normalized = email.trim().toLowerCase();
    if (!isDatabaseConnected()) {
      return this.fallbackRepo.findByEmail(normalized);
    }
    const doc = await UserModel.findOne({ email: normalized }).lean();
    return doc ? (doc as unknown as IUser) : null;
  }

  async findById(id: string): Promise<IUser | null> {
    if (!isDatabaseConnected()) {
      return this.fallbackRepo.findById(id);
    }
    const doc = await UserModel.findOne({ id }).lean();
    return doc ? (doc as unknown as IUser) : null;
  }

  async create(userData: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<IUser> {
    if (!isDatabaseConnected()) {
      return this.fallbackRepo.create(userData);
    }
    const now = new Date();
    const id = userData.id || `usr_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const doc = await UserModel.create({
      id,
      email: userData.email.toLowerCase(),
      name: userData.name,
      passwordHash: userData.passwordHash,
      role: userData.role,
      companyName: userData.companyName,
      avatarUrl: userData.avatarUrl,
      createdAt: now,
      updatedAt: now,
    });
    return doc.toJSON() as unknown as IUser;
  }

  async seedDefaultUsers(): Promise<void> {
    await this.fallbackRepo.seedDefaultUsers();

    if (!isDatabaseConnected()) {
      logger.info('🍃 MongoDB not connected yet; in-memory users seeded.');
      return;
    }

    const demoUser = await UserModel.findOne({ email: 'demo@payflow.io' });
    if (!demoUser) {
      const hash = hashPassword('password123');
      await UserModel.create({
        id: 'usr_pf_892348912',
        email: 'demo@payflow.io',
        name: 'Alex Morgan',
        passwordHash: hash,
        role: 'admin',
        companyName: 'Acme Payments Corp',
        avatarUrl:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      });
      logger.info('🍃 [MongoDB Compass] Seeded default merchant admin: demo@payflow.io');
    }

    const adminUser = await UserModel.findOne({ email: 'admin@payflow.io' });
    if (!adminUser) {
      const hash = hashPassword('payflow2026');
      await UserModel.create({
        id: 'usr_pf_110293847',
        email: 'admin@payflow.io',
        name: 'Elena Rostova',
        passwordHash: hash,
        role: 'admin',
        companyName: 'Global Fintech Labs',
        avatarUrl:
          'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&q=80',
      });
      logger.info('🍃 [MongoDB Compass] Seeded default finance director: admin@payflow.io');
    }
  }
}

export const userRepository = new MongoUserRepository();
