import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';

const router = Router();

router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', AuthController.me);
router.patch('/profile', AuthController.updateProfile);
router.put('/profile', AuthController.updateProfile);

export default router;
