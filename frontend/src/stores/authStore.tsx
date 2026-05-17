import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';
import axios from 'axios';
import api from '@services/api';

/**
 * Ensure the XSRF-TOKEN cookie exists.
 * Uses the `api` instance so the response cookie is set by the same origin.
 * `/csrf-token` maps to `/api/csrf-token` because api.baseURL is already `/api`.
 */
async function ensureCsrfToken(): Promise<void> {
  if (!getCsrfCookie()) {
    await api.get('/csrf-token');
  }
}

function getCsrfCookie(): string | null {
  const v = `; ${document.cookie}`;
  const parts = v.split('; XSRF-TOKEN=');
  if (parts.length === 2) return parts.pop()?.split(';').shift() ?? null;
  return null;
}

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
  accountType: 'candidate' | 'recruiter';
  isVerified: boolean;
  twoFactorEnabled: boolean;
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
  twoFactorRequired?: boolean;
  data?: {
    user: User;
  };
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  twoFactorRequired: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  validate2fa: (code: string) => Promise<void>;
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
      twoFactorRequired: false,
      error: null,

      login: async (email: string, password: string) => {
        await ensureCsrfToken();
        set({ isLoading: true, error: null, twoFactorRequired: false });
        try {
          // api instance has the CSRF interceptor — header is attached automatically
          const response = await api.post<AuthResponse>('/auth/login', { email, password });

          if (response.data.twoFactorRequired) {
            set({ twoFactorRequired: true, isLoading: false });
            return;
          }

          if (response.data.success) {
            set({
              user: response.data.data?.user ?? null,
              isAuthenticated: true,
              isLoading: false,
              twoFactorRequired: false,
              error: null,
            });
            // If user hasn't set up 2FA yet, mark this tab as the setup session.
            // Without this flag, ProtectedRoute treats other tabs/browsers as intruders.
            if (response.data.data?.user?.twoFactorEnabled === false) {
              sessionStorage.setItem('2fa_setup_pending', '1');
            }
          } else {
            throw new Error(response.data.message || 'Login failed');
          }
        } catch (error) {
          const message =
            axios.isAxiosError(error)
              ? error.response?.data?.message || 'Login failed'
              : 'An unexpected error occurred';
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      validate2fa: async (code: string) => {
        await ensureCsrfToken();
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<AuthResponse>('/auth/2fa/validate', { code });
          if (response.data.success) {
            set({
              user: response.data.data?.user ?? null,
              isAuthenticated: true,
              isLoading: false,
              twoFactorRequired: false,
              error: null,
            });
          } else {
            throw new Error(response.data.message || '2FA validation failed');
          }
        } catch (error) {
          const message =
            axios.isAxiosError(error)
              ? error.response?.data?.message || 'Invalid code'
              : 'An unexpected error occurred';
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      register: async (data: RegisterData) => {
        await ensureCsrfToken();
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<AuthResponse>('/auth/register', data);

          if (response.data.success) {
            set({
              user: response.data.data?.user ?? null,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            // New accounts always need 2FA setup — mark this tab as the originator.
            sessionStorage.setItem('2fa_setup_pending', '1');
          } else {
            throw new Error(response.data.message || 'Registration failed');
          }
        } catch (error) {
          const message =
            axios.isAxiosError(error)
              ? error.response?.data?.message || 'Registration failed'
              : 'An unexpected error occurred';
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      logout: async () => {
        // Clear the 2FA setup session flag so other browser sessions don't
        // get trapped at /setup-2fa after this user logs out.
        sessionStorage.removeItem('2fa_setup_pending');
        try {
          await api.post('/auth/logout');
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            twoFactorRequired: false,
            error: null,
          });
        }
      },

      refreshUser: async () => {
        set({ isLoading: true });
        try {
          const response = await api.get<AuthResponse>('/auth/me');

          if (response.data.success) {
            set({
              user: response.data.data?.user ?? null,
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
    refreshUser();
  }, [refreshUser]);

  return <>{children}</>;
};

// Custom hook for using auth
export const useAuth = () => {
  const { user, isAuthenticated, isLoading, twoFactorRequired, error, login, validate2fa, register, logout, refreshUser, clearError } =
    useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    twoFactorRequired,
    error,
    login,
    validate2fa,
    register,
    logout,
    refreshUser,
    clearError,
  };
};

export default useAuthStore;

