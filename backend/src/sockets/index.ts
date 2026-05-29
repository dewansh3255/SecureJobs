/**
 * Socket.IO Handler
 * Real-time communication for messaging, notifications, etc.
 */

import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config';
import logger from '../utils/logger';
import { getRedisClient } from '../config/redis';
import Message from '../models/Message';
import Conversation from '../models/Conversation';
import Notification from '../models/Notification';
import User from '../models/User';

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
      // eslint-disable-next-line @typescript-eslint/no-var-requires
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
  // ===========================================
  // Cookie-based authentication middleware
  // Browser sends HttpOnly cookies automatically with withCredentials:true
  // ===========================================
  io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie || '';
    // Parse cookies manually — no dep needed
    const cookies: Record<string, string> = {};
    cookieHeader.split(';').forEach(pair => {
      const idx = pair.indexOf('=');
      if (idx < 0) return;
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      try { cookies[k] = decodeURIComponent(v); } catch { cookies[k] = v; }
    });

    const token = cookies['accessToken'];
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      socket.data.userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    logger.debug(`Socket connected: ${socket.id} user: ${userId}`);

    // Track online user and join personal room
    onlineUsers.set(userId, socket.id);
    socket.join(`user:${userId}`);
    socket.broadcast.emit('user:online', { userId });


    socket.on('message:send', async (data: { conversationId: string; content: string }, callback) => {
      try {
        // Input validation — guard against oversized or missing content
        if (!data?.conversationId || typeof data.content !== 'string') {
          return callback?.({ success: false, error: 'Invalid message data' });
        }
        if (data.content.trim().length === 0 || data.content.length > 5000) {
          return callback?.({ success: false, error: 'Message must be between 1 and 5000 characters' });
        }

        const conversation = await Conversation.findById(data.conversationId).lean();
        if (!conversation) {
          return callback?.({ success: false, error: 'Conversation not found' });
        }
        const participantIds = conversation.participants.map(String);
        if (!participantIds.includes(userId)) {
          return callback?.({ success: false, error: 'Not a participant' });
        }

        // Persist message to MongoDB — readBy includes the sender immediately
        const saved = await Message.create({
          conversation: data.conversationId,
          sender: userId,
          content: data.content.trim(),
          encrypted: false,
          readBy: [{ user: userId, readAt: new Date() }],
        });

        // Update conversation's lastMessage + lastMessageAt + messageCount
        await Conversation.findByIdAndUpdate(data.conversationId, {
          lastMessage: saved._id,
          lastMessageAt: saved.createdAt,
          $inc: { messageCount: 1 },
        });

        // Populate sender for clients
        await saved.populate('sender', 'firstName lastName profilePicture');

        // Emit to all participants in the conversation room (including sender)
        io.to(`conversation:${data.conversationId}`).emit('message:new', {
          _id: saved._id,
          conversationId: data.conversationId,
          sender: saved.sender,
          content: saved.content,
          createdAt: saved.createdAt,
        });

        // Push in-app notification to offline recipients
        for (const pid of participantIds.filter((p) => p !== userId)) {
          try {
            await Notification.create({
              recipient: pid,
              sender: userId,
              type: 'message',
              data: { conversationId: data.conversationId, messageId: String(saved._id) },
              message: 'sent you a message',
            });
            // Deliver real-time notification if recipient is online
            io.to(`user:${pid}`).emit('notification:new', { type: 'message', senderId: userId });
          } catch {
            // Non-critical: notification creation failure should not fail message delivery
          }
        }

        callback?.({ success: true, message: saved });
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

    socket.on('conversation:join', async (conversationId: string) => {
      try {
        // Verify the user is actually a participant before joining
        const conv = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        }).lean();

        if (!conv) {
          logger.warn(`Socket ${socket.id} tried to join unauthorized conversation ${conversationId}`);
          return;
        }

        socket.join(`conversation:${conversationId}`);
        logger.debug(`Socket ${socket.id} joined conversation ${conversationId}`);
      } catch (err) {
        logger.error('Error joining conversation room:', err);
      }
    });

    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      logger.debug(`Socket ${socket.id} left conversation ${conversationId}`);
    });

    // ===========================================
    // Notification Events
    // ===========================================
    socket.on('notification:read', async (data: { notificationId: string }) => {
      try {
        const userId = socket.data.userId;
        if (!userId) return;
        await Notification.findOneAndUpdate(
          { _id: data.notificationId, recipient: userId },
          { read: true, readAt: new Date() }
        );
        logger.debug(`Notification ${data.notificationId} marked as read`);
      } catch (err) {
        logger.error('Error marking notification read:', err);
      }
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
        // Update lastSeen timestamp
        User.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch(() => {});
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
