export interface IAddress {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  label?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAddressInput {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country?: string;
  label?: string;
  isDefault?: boolean;
}

export interface UpdateAddressInput {
  fullName?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  label?: string;
  isDefault?: boolean;
}

export interface IAddressRepository {
  findByUserId(userId: string): Promise<IAddress[]>;
  findById(id: string, userId?: string): Promise<IAddress | null>;
  create(data: Omit<IAddress, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<IAddress>;
  update(id: string, userId: string, data: UpdateAddressInput): Promise<IAddress | null>;
  delete(id: string, userId: string): Promise<boolean>;
  setDefault(id: string, userId: string): Promise<IAddress | null>;
}
