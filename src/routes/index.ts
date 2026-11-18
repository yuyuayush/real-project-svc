import { Router } from 'express';
import checkoutRoutes from './checkout.routes.js';
import paymentRoutes from './payment.routes.js';
import webhookRoutes from './webhook.routes.js';
import orderRoutes from './order.routes.js';
import testRoutes from './test.routes.js';
import authRoutes from './auth.routes.js';
import addressRoutes from './address.routes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/addresses', addressRoutes);
apiRouter.use('/checkout', checkoutRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/webhooks', webhookRoutes);
apiRouter.use('/orders', orderRoutes);
apiRouter.use('/test', testRoutes);

export default apiRouter;
