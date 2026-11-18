import { Request, Response } from 'express';
import { z } from 'zod';
import { addressService } from '../services/address.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { validateSchema } from '../utils/validator.js';
import { UnauthorizedError } from '../errors/app-error.js';

export const createAddressSchema = z.object({
  fullName: z.string().min(2, 'Full recipient name must be at least 2 characters'),
  phone: z.string().min(6, 'Valid contact phone number is required'),
  line1: z.string().min(3, 'Street address line 1 is required'),
  line2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().optional(),
  postalCode: z.string().min(2, 'ZIP / Postal code is required'),
  country: z.string().min(2, 'Country is required').default('United States'),
  label: z.string().default('Home'),
  isDefault: z.boolean().optional(),
});

export const updateAddressSchema = createAddressSchema.partial();

export class AddressController {
  private static getUserId(req: Request): string {
    if (req.user?.id) {
      return req.user.id;
    }
    // Fallback in local development if demo header present or default merchant
    const headerUserId = req.headers['x-user-id'] as string;
    if (headerUserId) return headerUserId;
    return 'usr_pf_892348912'; // Default demo user
  }

  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = AddressController.getUserId(req);
    const addresses = await addressService.getUserAddresses(userId);

    res.status(200).json({
      success: true,
      count: addresses.length,
      data: addresses,
    });
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = AddressController.getUserId(req);
    const addressId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const address = await addressService.getAddressById(userId, addressId);

    res.status(200).json({
      success: true,
      data: address,
    });
  });

  static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = AddressController.getUserId(req);
    const data = validateSchema(createAddressSchema, req.body);
    const address = await addressService.createAddress(userId, data);

    res.status(201).json({
      success: true,
      message: 'Address saved successfully in MongoDB Compass',
      data: address,
    });
  });

  static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = AddressController.getUserId(req);
    const addressId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = validateSchema(updateAddressSchema, req.body);
    const address = await addressService.updateAddress(userId, addressId, data);

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: address,
    });
  });

  static delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = AddressController.getUserId(req);
    const addressId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await addressService.deleteAddress(userId, addressId);

    res.status(200).json({
      success: true,
      message: 'Address removed successfully',
    });
  });

  static setDefault = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = AddressController.getUserId(req);
    const addressId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const address = await addressService.setDefaultAddress(userId, addressId);

    res.status(200).json({
      success: true,
      message: 'Default address updated successfully',
      data: address,
    });
  });
}
