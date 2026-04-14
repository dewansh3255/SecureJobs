/**
 * Database Connection Module
 * Handles MongoDB connection with retry logic and error handling
 */

import mongoose from 'mongoose';
import config from './index';
import logger from '../utils/logger';

export const connectDatabase = async (): Promise<void> => {
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const conn = await mongoose.connect(config.database.uri, config.database.options);

      logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);

      // Handle connection events
      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        logger.info('MongoDB connection closing through app termination');
        await mongoose.connection.close();
        process.exit(0);
      });

      return;
    } catch (error) {
      retries++;
      logger.error(`Database connection attempt ${retries} failed:`, error);

      if (retries === maxRetries) {
        logger.error('❌ Unable to connect to MongoDB after multiple attempts');
        process.exit(1);
      }

      const delay = Math.min(1000 * Math.pow(2, retries), 30000);
      logger.info(`Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

export default connectDatabase;
