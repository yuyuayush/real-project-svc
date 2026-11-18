import { Request, Response } from 'express';
import { orderService } from '../services/order.service.js';
import { orderRepository } from '../repositories/order.repository.js';
import { NotFoundError } from '../errors/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';

export class OrderController {
  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const order = await orderService.getOrder(id);
    res.status(200).json({
      success: true,
      data: order,
    });
  });

  static getByOrderNumber = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const orderNumber = Array.isArray(req.params.orderNumber) ? req.params.orderNumber[0] : req.params.orderNumber;
    const order = await orderRepository.findByOrderNumber(orderNumber);
    if (!order) {
      throw new NotFoundError(`Order ${orderNumber} not found`);
    }
    res.status(200).json({
      success: true,
      data: order,
    });
  });

  static listAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const orders = await orderRepository.listAll(limit);
    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  });
}
