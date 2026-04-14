/**
 * Redis Connection Module
 * Handles Redis connection for caching, sessions, and pub/sub
 */

import { createClient, RedisClientType } from 'redis';
import config from './index';
import logger from '../utils/logger';

let redisClient: RedisClientType | null = null;

export const connectRedis = async (): Promise<RedisClientType> => {
  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = createClient({
      url: config.redis.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            logger.error('Redis max reconnection attempts reached');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis Connected');
    });

    redisClient.on('disconnect', () => {
      logger.warn('Redis disconnected');
    });

    await redisClient.connect();

    return redisClient;
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    // Continue without Redis (graceful degradation)
    logger.warn('Running without Redis - some features may be limited');
    throw error;
  }
};

export const getRedisClient = (): RedisClientType | null => {
  return redisClient;
};

export default connectRedis;
