/**
 * Server Entry Point
 * Starts the application server
 */

import http from 'http';
import { Server } from 'socket.io';
import config from './config';
import createApp from './app';
import connectDatabase from './config/database';
import connectRedis, { getRedisClient } from './config/redis';
import logger from './utils/logger';
import { initializeSocketIO } from './sockets';
import { initGenesis } from './utils/blockchain';

// Create Express app
const app = createApp();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
});

// Initialize Socket.IO handlers
initializeSocketIO(io);

// ===========================================
// Start Server
// ===========================================
const PORT = config.server.port;

const startServer = async () => {
  try {
    // Connect to databases
    await Promise.all([connectDatabase(), connectRedis().catch(() => {
      logger.warn('Redis not available, continuing without it');
    })]);

    // Initialize blockchain (genesis block if chain is empty)
    await initGenesis();

    // Start listening
    server.listen(PORT, () => {
      logger.info(`
╔════════════════════════════════════════════════════════╗
║     Professional Network API - FCS-26                  ║
╠════════════════════════════════════════════════════════╣
║  🚀 Server running on port ${PORT}                      ║
║  🌍 Environment: ${config.server.env.padEnd(23)}║
║  📅 Started at: ${new Date().toLocaleString().padEnd(22)}║
╚════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// ===========================================
// Graceful Shutdown
// ===========================================
const gracefulShutdown = (signal: string) => {
  logger.info(`\n${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    logger.info('HTTP server closed');

    // Close database connections
    import('mongoose').then((mongoose) => {
      mongoose.connection.close().then(() => {
        logger.info('MongoDB connection closed');

        // Close Redis connection
        const redisClient = getRedisClient();
        if (redisClient) {
          redisClient.quit().then(() => {
            logger.info('Redis connection closed');
            logger.info('Graceful shutdown completed');
            process.exit(0);
          });
        } else {
          process.exit(0);
        }
      });
    });
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer();

export default server;
