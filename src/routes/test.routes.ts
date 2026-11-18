import { Router, Request, Response } from 'express';
import os from 'os';

const router = Router();

/**
 * Endpoint to deliberately trigger a synchronous uncaughtException.
 * Using process.nextTick escapes Express's error boundary and bubbles directly
 * into the Node.js process event loop, triggering process.on('uncaughtException').
 */
router.post('/uncaught-exception', (req: Request, res: Response) => {
  res.status(200).json({
    message: '💥 Uncaught exception dispatched! Watch terminal logs for graceful shutdown and Docker auto-restart...',
    instance: process.env.HOSTNAME || os.hostname(),
    pid: process.pid,
  });

  // Escapes Express error boundary to trigger Node's uncaughtException handler
  process.nextTick(() => {
    throw new Error('💥 Deliberate Uncaught Exception: Simulating fatal runtime crash for testing!');
  });
});

/**
 * Endpoint to deliberately trigger an unhandledRejection
 */
router.post('/unhandled-rejection', (req: Request, res: Response) => {
  res.status(200).json({
    message: '💥 Unhandled promise rejection dispatched! Watch terminal logs for graceful shutdown...',
    instance: process.env.HOSTNAME || os.hostname(),
    pid: process.pid,
  });

  // Rejects a promise without a catch block to trigger Node's unhandledRejection handler
  Promise.reject(new Error('💥 Deliberate Unhandled Rejection: Simulating unhandled async rejection!'));
});

export default router;
