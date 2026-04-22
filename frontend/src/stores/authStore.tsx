import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';
import axios from 'axios';


/** Ensure XSRF-TOKEN cookie exists; fetch from server if absent */
async function ensureCsrfToken(): Promise<void> {
  if (!getCsrfCookie()) {
    await axios.get('/api/csrf-token');
  }
}

function getCsrfCookie(): string | null {
  const v = `; ${document.cookie}`;
  const parts = v.split('; XSRF-TOKEN=');
  if (parts.length === 2) return parts.pop()?.split(';').shift() ?? null;
  return null;
}

// API configuration
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Configure axios defaults
axios.defaults.baseURL = API_URL;
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  headline?: string;
  location?: string;
  profilePicture?: string;
  role: 'user' | 'admin' | 'moderator';
  isVerified: boolean;
  settings: {
    emailNotifications: boolean;
    profileVisibility: 'public' | 'connections' | 'private';
    darkMode: boolean;
  };
  followers: number;
  following: number;
  connections: number;
}

interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
  };
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// Create auth store
const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      login: async (email: string, password: string) => {
        await ensureCsrfToken();
        set({ isLoading: true, error: null });
        try {
          const response = await axios.post<AuthResponse>('/auth/login', {
            email,
            password,
          });

          if (response.data.success) {
            set({
              user: response.data.data?.user || null,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.data.message || 'Login failed');
          }
        } catch (error) {
          const message =
            error instanceof axios.AxiosError
              ? error.response?.data?.message || 'Login failed'
              : 'An unexpected error occurred';
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      register: async (data: RegisterData) => {
        await ensureCsrfToken();
        set({ isLoading: true, error: null });
        try {
          const response = await axios.post<AuthResponse>('/auth/register', data);

          if (response.data.success) {
            set({
              user: response.data.data?.user || null,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            throw new Error(response.data.message || 'Registration failed');
          }
        } catch (error) {
          const message =
            error instanceof axios.AxiosError
              ? error.response?.data?.message || 'Registration failed'
              : 'An unexpected error occurred';
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      logout: async () => {
        try {
          await axios.post('/auth/logout');
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      refreshUser: async () => {
        set({ isLoading: true });
        try {
          const response = await axios.get<AuthResponse>('/auth/me');

          if (response.data.success) {
            set({
              user: response.data.data?.user || null,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Auth provider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const refreshUser = useAuthStore((state) => state.refreshUser);

  useEffect(() => {
    // Refresh user data on mount
    refreshUser();
  }, [refreshUser]);

  return <>{children}</>;
};

// Custom hook for using auth
export const useAuth = () => {
  const { user, isAuthenticated, isLoading, error, login, register, logout, clearError } =
    useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  };
};

export default useAuthStore;
