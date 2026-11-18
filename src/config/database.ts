import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

let isConnected = false;

export async function connectDatabase(): Promise<boolean> {
  if (isConnected) return true;

  try {
    logger.info({ uri: env.MONGODB_URI }, 'Connecting to MongoDB (Compass local)...');

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 4000,
    });

    isConnected = true;
    logger.info('Successfully connected to MongoDB local database');

    mongoose.connection.on('error', (err) => {
      logger.error({ err }, 'MongoDB connection error');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      isConnected = false;
    });

    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn(
      { error: errorMsg },
      'MongoDB connection failed. Make sure MongoDB service is running locally on port 27017 or in MongoDB Compass. Falling back gracefully...'
    );
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (isConnected || mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('MongoDB connection closed.');
  }
}

export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
