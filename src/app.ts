import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import os from 'os';
import webhookRoutes from './routes/webhook.routes.js';
import apiRouter from './routes/index.js';
import { requestIdMiddleware } from './middlewares/request-id.js';
import { errorHandler } from './errors/error-handler.js';
import { apiRateLimiter } from './middlewares/rate-limiter.js';
import { env } from './config/env.js';
import { isDatabaseConnected } from './config/database.js';

export function createApp(): Express {
  const app = express();

  // 1. Basic Security & Headers for pure headless API
  app.use(helmet());
  app.use(
    cors({
      origin: [env.CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
    })
  );
  app.use(requestIdMiddleware);
  app.use(cookieParser());

  // 2. CRITICAL: Mount Webhooks BEFORE express.json()
  // Stripe signature verification requires exact raw binary payload
  app.use('/api/v1/webhooks', webhookRoutes);

  // 3. Body Parsers for standard REST APIs
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. Rate Limiting for general API
  app.use('/api', apiRateLimiter);

  // 5. Healthcheck endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'payment-gateway-service',
      environment: env.NODE_ENV,
      instanceId: process.env.HOSTNAME || os.hostname(),
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      database: isDatabaseConnected() ? 'connected (mongodb)' : 'in-memory (fallback)',
      stripeMode: env.isMockStripe ? 'mock/simulation' : 'live/test-gateway',
      resendMode: env.isMockResend ? 'mock/simulation' : 'live/resend-api',
    });
  });

  // 6. Mount Core REST API
  app.use('/api/v1', apiRouter);

  // 7. Global Error Handler Middleware
  app.use(errorHandler);

  return app;
}
