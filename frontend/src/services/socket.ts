/**
 * Socket.IO Service
 * Real-time communication handler
 */

import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || '/ws';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(token: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.socket?.connected) {
        resolve(true);
        return;
      }

      this.socket = io(WS_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.socket.on('connect', () => {
        console.log('Socket connected');
        this.reconnectAttempts = 0;

        // Authenticate
        this.socket?.emit('authenticate', token, (success: boolean) => {
          resolve(success);
        });
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        this.reconnectAttempts++;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          resolve(false);
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!this.socket?.connected) {
          resolve(false);
        }
      }, 5000);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Message events
  sendMessage(conversationId: string, content: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }

      this.socket.emit('message:send', { conversationId, content }, resolve);
    });
  }

  joinConversation(conversationId: string): void {
    this.socket?.emit('conversation:join', conversationId);
  }

  leaveConversation(conversationId: string): void {
    this.socket?.emit('conversation:leave', conversationId);
  }

  sendTypingStatus(conversationId: string, isTyping: boolean): void {
    this.socket?.emit('message:typing', { conversationId, isTyping });
  }

  // Connection events
  sendConnectionRequest(receiverId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }

      this.socket.emit('connection:request', { receiverId }, resolve);
    });
  }

  // Notification events
  markNotificationAsRead(notificationId: string): void {
    this.socket?.emit('notification:read', { notificationId });
  }

  // Event listeners
  onNewMessage(callback: (data: { conversationId: string; senderId: string; content: string; createdAt: Date }) => void): void {
    this.socket?.on('message:new', callback);
  }

  onTyping(callback: (data: { conversationId: string; userId: string; isTyping: boolean }) => void): void {
    this.socket?.on('message:typing', callback);
  }

  onConnectionRequest(callback: (data: { senderId: string }) => void): void {
    this.socket?.on('connection:request_received', callback);
  }

  onUserOnline(callback: (data: { userId: string }) => void): void {
    this.socket?.on('user:online', callback);
  }

  onUserOffline(callback: (data: { userId: string }) => void): void {
    this.socket?.on('user:offline', callback);
  }

  // Remove listeners
  off(event: string): void {
    this.socket?.off(event);
  }

  offAll(): void {
    this.socket?.removeAllListeners();
  }
}

// Singleton instance
export const socketService = new SocketService();

export default socketService;
