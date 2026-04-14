/**
 * Socket.IO Handler
 * Real-time communication for messaging, notifications, etc.
 */

import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config';
import logger from '../utils/logger';
import { getRedisClient } from '../config/redis';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

// Map to track online users
const onlineUsers = new Map<string, string>();

/**
 * Initialize Socket.IO with authentication and event handlers
 */
export const initializeSocketIO = (io: Server) => {
  // Redis adapter for horizontal scaling (optional)
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const pubClient = redisClient.duplicate();
      const subClient = redisClient.duplicate();

      Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        logger.info('✅ Socket.IO Redis adapter initialized');
      });
    } catch (error) {
      logger.warn('Socket.IO Redis adapter not available:', error);
    }
  }

  io.on('connection', (socket: Socket) => {
    logger.debug(`Socket connected: ${socket.id}`);

    // ===========================================
    // Authentication
    // ===========================================
    socket.on('authenticate', async (token: string, callback: (success: boolean, error?: string) => void) => {
      try {
        const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

        // Store user mapping
        onlineUsers.set(decoded.id, socket.id);
        socket.data.userId = decoded.id;

        // Join user's personal room
        socket.join(`user:${decoded.id}`);

        logger.info(`User ${decoded.email} authenticated on socket ${socket.id}`);
        callback(true);

        // Broadcast user online status
        socket.broadcast.emit('user:online', { userId: decoded.id });
      } catch (error) {
        logger.warn('Socket authentication failed:', error);
        callback(false, 'Invalid token');
      }
    });

    // ===========================================
    // Messaging Events
    // ===========================================
    socket.on('message:send', async (data: { conversationId: string; content: string }, callback) => {
      try {
        const userId = socket.data.userId;
        if (!userId) {
          return callback?.({ success: false, error: 'Not authenticated' });
        }

        // Emit to all participants in the conversation
        socket.to(`conversation:${data.conversationId}`).emit('message:new', {
          conversationId: data.conversationId,
          senderId: userId,
          content: data.content,
          createdAt: new Date(),
        });

        callback?.({ success: true });
      } catch (error) {
        logger.error('Error sending message:', error);
        callback?.({ success: false, error: 'Failed to send message' });
      }
    });

    socket.on('message:typing', (data: { conversationId: string; isTyping: boolean }) => {
      const userId = socket.data.userId;
      if (userId) {
        socket.to(`conversation:${data.conversationId}`).emit('message:typing', {
          conversationId: data.conversationId,
          userId,
          isTyping: data.isTyping,
        });
      }
    });

    socket.on('conversation:join', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      logger.debug(`Socket ${socket.id} joined conversation ${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      logger.debug(`Socket ${socket.id} left conversation ${conversationId}`);
    });

    // ===========================================
    // Notification Events
    // ===========================================
    socket.on('notification:read', (data: { notificationId: string }) => {
      // Handle marking notification as read
      logger.debug(`Notification ${data.notificationId} marked as read`);
    });

    // ===========================================
    // Connection Request Events
    // ===========================================
    socket.on('connection:request', async (data: { receiverId: string }, callback) => {
      try {
        const userId = socket.data.userId;
        if (!userId) {
          return callback?.({ success: false, error: 'Not authenticated' });
        }

        // Emit to receiver
        const receiverSocketId = onlineUsers.get(data.receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('connection:request_received', {
            senderId: userId,
            ...data,
          });
        }

        callback?.({ success: true });
      } catch (error) {
        logger.error('Error sending connection request:', error);
        callback?.({ success: false, error: 'Failed to send request' });
      }
    });

    // ===========================================
    // Disconnect
    // ===========================================
    socket.on('disconnect', () => {
      const userId = socket.data.userId;
      if (userId) {
        onlineUsers.delete(userId);
        logger.info(`User ${userId} disconnected from socket ${socket.id}`);

        // Broadcast user offline status
        socket.broadcast.emit('user:offline', { userId });
      }
      logger.debug(`Socket disconnected: ${socket.id}`);
    });

    // ===========================================
    // Error Handling
    // ===========================================
    socket.on('error', (error: Error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  logger.info('✅ Socket.IO initialized');
};

// Export for use in other modules
export const getOnlineUsers = () => onlineUsers;
