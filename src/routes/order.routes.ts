import { Router } from 'express';
import { OrderController } from '../controllers/order.controller.js';

const router = Router();

router.get('/', OrderController.listAll);
router.get('/:id', OrderController.getById);
router.get('/number/:orderNumber', OrderController.getByOrderNumber);
router.patch('/:id/address', OrderController.updateAddress);

export default router;
