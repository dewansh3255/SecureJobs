/**
 * API Service
 * Centralized API client with interceptors
 */

import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add CSRF token if available
    const csrfToken = getCookie('XSRF-TOKEN');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle 401 - Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });

        // Retry original request
        return api(originalRequest);
      } catch {
        // Refresh failed - redirect to login
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// Helper to get cookie value
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

// API methods
export const apiService = {
  // Auth
  auth: {
    login: (email: string, password: string) =>
      api.post('/auth/login', { email, password }),
    register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
      api.post('/auth/register', data),
    logout: () => api.post('/auth/logout'),
    me: () => api.get('/auth/me'),
    refresh: () => api.post('/auth/refresh'),
    forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
    resetPassword: (token: string, password: string) =>
      api.post('/auth/reset-password', { token, password }),
  },

  // Users
  users: {
    get: (id: string) => api.get(`/users/${id}`),
    update: (data: Record<string, unknown>) => api.put('/users/me', data),
    search: (query: string) => api.get('/users/search', { params: { q: query } }),
    getProfile: (id: string) => api.get(`/users/${id}/profile`),
    uploadPhoto: (formData: FormData) =>
      api.post('/users/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
  },

  // Connections
  connections: {
    send: (userId: string, message?: string) =>
      api.post('/connections/request', { userId, message }),
    accept: (connectionId: string) => api.put(`/connections/${connectionId}/accept`),
    reject: (connectionId: string) => api.put(`/connections/${connectionId}/reject`),
    remove: (connectionId: string) => api.delete(`/connections/${connectionId}`),
    getPending: () => api.get('/connections/pending'),
    getConnections: (userId: string) => api.get(`/users/${userId}/connections`),
  },

  // Posts
  posts: {
    getFeed: (page = 1, limit = 20) =>
      api.get('/posts/feed', { params: { page, limit } }),
    create: (data: { content: string; imageUrl?: string }) =>
      api.post('/posts', data),
    update: (id: string, data: { content?: string }) => api.put(`/posts/${id}`, data),
    delete: (id: string) => api.delete(`/posts/${id}`),
    react: (id: string, type: string) => api.post(`/posts/${id}/react`, { type }),
    getComments: (postId: string) => api.get(`/posts/${postId}/comments`),
    addComment: (postId: string, content: string, parentCommentId?: string) =>
      api.post(`/posts/${postId}/comments`, { content, parentCommentId }),
    share: (id: string) => api.post(`/posts/${id}/share`),
  },

  // Messages
  messages: {
    getConversations: () => api.get('/messages/conversations'),
    getMessages: (conversationId: string) =>
      api.get(`/messages/conversations/${conversationId}`),
    send: (conversationId: string, content: string) =>
      api.post('/messages', { conversationId, content }),
    markAsRead: (messageId: string) => api.put(`/messages/${messageId}/read`),
    createConversation: (participantIds: string[]) =>
      api.post('/messages/conversations', { participantIds }),
  },

  // Jobs
  jobs: {
    getJobs: (params?: Record<string, string>) =>
      api.get('/jobs', { params }),
    getJob: (id: string) => api.get(`/jobs/${id}`),
    create: (data: Record<string, unknown>) => api.post('/jobs', data),
    update: (id: string, data: Record<string, unknown>) =>
      api.put(`/jobs/${id}`, data),
    delete: (id: string) => api.delete(`/jobs/${id}`),
    apply: (jobId: string, data?: { coverLetter?: string; resumeUrl?: string }) =>
      api.post(`/jobs/${jobId}/apply`, data),
    getApplications: () => api.get('/jobs/applications'),
  },

  // Notifications
  notifications: {
    get: (page = 1, limit = 50) =>
      api.get('/notifications', { params: { page, limit } }),
    markAsRead: (id: string) => api.put(`/notifications/${id}/read`),
    markAllAsRead: () => api.put('/notifications/read-all'),
    delete: (id: string) => api.delete(`/notifications/${id}`),
    getUnreadCount: () => api.get('/notifications/unread-count'),
  },
};

export default api;
