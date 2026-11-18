import { addressRepository } from '../repositories/address.repository.js';
import { CreateAddressInput, UpdateAddressInput, IAddress } from '../types/index.js';
import { NotFoundError } from '../errors/app-error.js';

export class AddressService {
  async getUserAddresses(userId: string): Promise<IAddress[]> {
    return addressRepository.findByUserId(userId);
  }

  async getAddressById(userId: string, addressId: string): Promise<IAddress> {
    const address = await addressRepository.findById(addressId, userId);
    if (!address) {
      throw new NotFoundError(`Address with ID ${addressId} not found`);
    }
    return address;
  }

  async createAddress(userId: string, input: CreateAddressInput): Promise<IAddress> {
    const existingAddresses = await addressRepository.findByUserId(userId);
    // If it's the user's first address, make it the default automatically
    const isDefault = existingAddresses.length === 0 ? true : !!input.isDefault;

    return addressRepository.create({
      userId,
      fullName: input.fullName,
      phone: input.phone,
      line1: input.line1,
      line2: input.line2,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country || 'United States',
      label: input.label || 'Home',
      isDefault,
    });
  }

  async updateAddress(userId: string, addressId: string, input: UpdateAddressInput): Promise<IAddress> {
    const existing = await addressRepository.findById(addressId, userId);
    if (!existing) {
      throw new NotFoundError(`Address with ID ${addressId} not found`);
    }

    const updated = await addressRepository.update(addressId, userId, input);
    if (!updated) {
      throw new NotFoundError(`Address with ID ${addressId} could not be updated`);
    }
    return updated;
  }

  async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    const existing = await addressRepository.findById(addressId, userId);
    if (!existing) {
      throw new NotFoundError(`Address with ID ${addressId} not found`);
    }

    const wasDefault = existing.isDefault;
    const deleted = await addressRepository.delete(addressId, userId);

    // If default address was deleted, promote the newest remaining address to default
    if (deleted && wasDefault) {
      const remaining = await addressRepository.findByUserId(userId);
      if (remaining.length > 0) {
        await addressRepository.setDefault(remaining[0].id, userId);
      }
    }

    return deleted;
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<IAddress> {
    const existing = await addressRepository.findById(addressId, userId);
    if (!existing) {
      throw new NotFoundError(`Address with ID ${addressId} not found`);
    }

    const updated = await addressRepository.setDefault(addressId, userId);
    if (!updated) {
      throw new NotFoundError(`Address with ID ${addressId} could not be updated`);
    }
    return updated;
  }
}

export const addressService = new AddressService();
