import { Server } from 'http';
import os from 'os';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from './config/database.js';
import { userRepository } from './repositories/user.repository.js';

const app = createApp();

let server: Server | null = null;
let isShuttingDown = false;

async function startServer() {
  await connectDatabase();
  await userRepository.seedDefaultUsers();

  server = app.listen(env.PORT, () => {
    logger.info(`====================================================`);
    logger.info(`Payment Gateway Service listening on port ${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`Database: ${isDatabaseConnected() ? 'Connected to MongoDB (Compass)' : 'In-Memory Fallback'}`);
    logger.info(`Instance Hostname: ${process.env.HOSTNAME || os.hostname()} (PID: ${process.pid})`);
    logger.info(`Stripe Mode: ${env.isMockStripe ? 'Simulation (Set STRIPE_SECRET_KEY in .env for real gateway)' : 'Connected'}`);
    logger.info(`Resend Mode: ${env.isMockResend ? 'Simulation (Set RESEND_API_KEY in .env for live email)' : 'Connected'}`);
    logger.info(`Health & Telemetry: http://localhost:${env.PORT}/health`);
    logger.info(`Frontend UI: ${env.CLIENT_URL}`);
    logger.info(`====================================================`);
  });
}

startServer().catch((err) => {
  logger.fatal({ err }, 'Failed to start server on startup');
  process.exit(1);
});

// Enterprise Graceful Shutdown Function
export async function gracefulShutdown(reason: string, exitCode: number = 0) {
  if (isShuttingDown) {
    logger.warn('⚠️ Shutdown already in progress. Ignoring duplicate trigger.');
    return;
  }
  isShuttingDown = true;

  console.log('\n======================================================');
  console.log(`🛑 [GRACEFUL SHUTDOWN TRIGGERED]`);
  console.log(`📌 Reason: ${reason}`);
  console.log(`🆔 Instance: ${process.env.HOSTNAME || os.hostname()} (PID: ${process.pid})`);
  console.log(`⏱️  Timestamp: ${new Date().toISOString()}`);
  console.log('======================================================\n');

  logger.info({ reason, exitCode, pid: process.pid }, 'Initiating graceful shutdown sequence...');

  // 1. Close MongoDB connection cleanly
  try {
    logger.info('Closing MongoDB database connections...');
    await disconnectDatabase();
  } catch (dbErr) {
    logger.error({ dbErr }, 'Error closing database connection');
  }

  if (!server) {
    logger.info('Server instance was not active. Exiting process immediately.');
    process.exit(exitCode);
  }

  // 2. Tell HTTP server to stop accepting NEW incoming connections
  logger.info('2️⃣ Stopping HTTP server from accepting new connections...');
  server.close((err) => {
    if (err) {
      logger.error({ err }, ' Error occurred while closing HTTP server');
      process.exit(1);
    }
    logger.info('3️ Successfully closed all in-flight connections.');
    logger.info(`4️ Process exiting cleanly with exit code: ${exitCode}`);
    console.log(`\n [SHUTDOWN COMPLETE] Instance stopped. Docker will now restart this container.\n`);
    process.exit(exitCode);
  });

  // 3. Safety Timeout: Force kill if connections hang longer than 8 seconds
  const forceExitTimer = setTimeout(() => {
    logger.error('Forceful shutdown timeout exceeded (8s). Terminating process immediately.');
    process.exit(1);
  }, 8000);

  forceExitTimer.unref();
}

// 1. Capture OS termination signals (Docker stop, Kubernetes SIGTERM, Ctrl+C)
process.on('SIGINT', () => gracefulShutdown('SIGINT (Ctrl+C manual stop)', 0));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM (Container stop / orchestrator signal)', 0));

process.on('uncaughtException', (err: Error) => {
  console.error(err.stack || err.message);
  logger.fatal({ err }, ' Uncaught Exception detected! Commencing graceful shutdown to protect system integrity...');
  gracefulShutdown(`uncaughtException: ${err.message}`, 1);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error(reason);
  logger.fatal({ reason }, ' Unhandled Rejection detected! Commencing graceful shutdown...');
  gracefulShutdown(`unhandledRejection: ${String(reason)}`, 1);
});
