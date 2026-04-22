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
        // Refresh failed — only redirect to /login if not already on a public page
        const publicPages = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
        const isPublicPage = publicPages.some((p) => window.location.pathname.startsWith(p));
        if (!isPublicPage) {
          window.location.href = '/login';
        }
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
    me: () => api.get('/users/me'),
    get: (id: string) => api.get(`/users/${id}`),
    update: (data: Record<string, unknown>) => api.put('/users/me', data),
    search: (query: string, page = 1) => api.get('/users/search', { params: { q: query, page } }),
    uploadPhoto: (formData: FormData) =>
      api.post('/users/me/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    uploadCover: (formData: FormData) =>
      api.post('/users/me/cover', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
  },

  // Connections
  connections: {
    send: (userId: string) => api.post(`/connections/request/${userId}`),
    accept: (connectionId: string) => api.put(`/connections/${connectionId}/accept`),
    reject: (connectionId: string) => api.put(`/connections/${connectionId}/reject`),
    remove: (connectionId: string) => api.delete(`/connections/${connectionId}`),
    getPending: () => api.get('/connections/pending'),
    getAll: () => api.get('/connections'),
    getSuggestions: () => api.get('/connections/suggestions'),
  },

  // Posts
  posts: {
    getFeed: (page = 1, limit = 10) =>
      api.get('/posts/feed', { params: { page, limit } }),
    create: (data: { content: string; visibility?: string; tags?: string[] }) =>
      api.post('/posts', data),
    get: (id: string) => api.get(`/posts/${id}`),
    update: (id: string, data: { content?: string; visibility?: string }) =>
      api.put(`/posts/${id}`, data),
    delete: (id: string) => api.delete(`/posts/${id}`),
    react: (id: string, type: string) => api.post(`/posts/${id}/react`, { type }),
    addComment: (postId: string, content: string) =>
      api.post(`/posts/${postId}/comments`, { content }),
    deleteComment: (postId: string, commentId: string) =>
      api.delete(`/posts/${postId}/comments/${commentId}`),
  },

  // Messages
  messages: {
    getConversations: () => api.get('/messages/conversations'),
    getConversation: (conversationId: string) =>
      api.get(`/messages/conversations/${conversationId}`),
    createConversation: (participantId: string) =>
      api.post('/messages/conversations', { participantId }),
    send: (conversationId: string, content: string) =>
      api.post(`/messages/conversations/${conversationId}`, { content }),
    markRead: (conversationId: string) =>
      api.patch(`/messages/conversations/${conversationId}/read`),
  },

  // Jobs
  jobs: {
    getJobs: (params?: Record<string, string | number>) =>
      api.get('/jobs', { params }),
    getJob: (id: string) => api.get(`/jobs/${id}`),
    create: (data: Record<string, unknown>) => api.post('/jobs', data),
    update: (id: string, data: Record<string, unknown>) =>
      api.put(`/jobs/${id}`, data),
    delete: (id: string) => api.delete(`/jobs/${id}`),
    apply: (jobId: string, data?: { coverLetter?: string; resumeUrl?: string }) =>
      api.post(`/jobs/${jobId}/apply`, data),
    getMyApplications: () => api.get('/jobs/applications/mine'),
  },

  // Notifications
  notifications: {
    get: (page = 1, limit = 20) =>
      api.get('/notifications', { params: { page, limit } }),
    markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),
    markAllAsRead: () => api.patch('/notifications/read-all'),
    getUnreadCount: () => api.get('/notifications/unread-count'),
  },
};

export default api;
