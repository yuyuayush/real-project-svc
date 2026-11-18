import { UserRole } from '../constants/index.js';

export interface UserPublicProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole | 'admin' | 'finance_manager' | 'viewer';
  companyName?: string;
  phone?: string | number;
  avatarUrl?: string;
}

export interface IUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole | 'admin' | 'finance_manager' | 'viewer';
  companyName?: string;
  phone?: string | number;
  avatarUrl?: string;
  addresses?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  companyName?: string;
  phone?: string | number;
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string | number;
  companyName?: string;
  avatarUrl?: string;
}

export interface AuthSessionResponse {
  user: UserPublicProfile;
  token: string;
  expiresAt: string;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<IUser | null>;
  findById(id: string): Promise<IUser | null>;
  create(userData: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<IUser>;
  update(id: string, data: Partial<IUser>): Promise<IUser | null>;
  seedDefaultUsers(): Promise<void>;
}
