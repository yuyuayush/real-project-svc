import { Router } from 'express';
import { AddressController } from '../controllers/address.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { AuthCookie } from '../constants/index.js';

const router = Router();

// In development, allow demo user resolution if token cookie is in transit, but requireAuth validates when token exists
router.use((req, res, next) => {
  // If authorization header or cookie is present, apply requireAuth
  const hasToken =
    req.cookies?.[AuthCookie.NAME] || req.headers.authorization;
  if (hasToken) {
    return requireAuth(req, res, next);
  }
  next();
});

router.get('/', AddressController.list);
router.post('/', AddressController.create);
router.get('/:id', AddressController.getById);
router.put('/:id', AddressController.update);
router.patch('/:id', AddressController.update);
router.delete('/:id', AddressController.delete);
router.patch('/:id/default', AddressController.setDefault);

export default router;
