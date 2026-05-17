/**
 * authStore — Unit Tests (Vitest)
 *
 * Tests the Zustand store logic using mocked API calls.
 * No real network or DOM rendering needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the api module ─────────────────────────────────────────────────────
vi.mock('@services/api', () => {
  const mockAxiosInstance: any = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { baseURL: '/api' },
  };
  return {
    default: mockAxiosInstance,
    apiService: {
      auth: {
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        me: vi.fn(),
      },
    },
  };
});

// ── Mock document.cookie for getCsrfCookie ──────────────────────────────────
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: 'XSRF-TOKEN=test-csrf-token',
});

import api from '@services/api';

// Dynamic import after mocks are set
const getStore = async () => {
  // Reset module between tests
  const { default: useAuthStore } = await import('@stores/authStore');
  return useAuthStore;
};

describe('authStore — initial state', () => {
  it('starts with null user and not authenticated', async () => {
    const useAuthStore = await getStore();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('has twoFactorRequired = false initially', async () => {
    const useAuthStore = await getStore();
    expect(useAuthStore.getState().twoFactorRequired).toBe(false);
  });

  it('clearError resets error to null', async () => {
    const useAuthStore = await getStore();
    useAuthStore.setState({ error: 'Some error' });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});

describe('authStore — login flow', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const useAuthStore = await getStore();
    // Full reset to prevent state leaking from previous tests
    useAuthStore.setState({
      user: null, isAuthenticated: false, isLoading: false,
      twoFactorRequired: false, error: null,
    });
  });

  it('sets twoFactorRequired when server demands 2FA', async () => {
    const mockApi = api as any;
    mockApi.get.mockResolvedValueOnce({ data: {} }); // csrf-token call
    mockApi.post.mockResolvedValueOnce({
      data: { success: false, twoFactorRequired: true, message: '2FA required' },
    });

    const useAuthStore = await getStore();
    useAuthStore.setState({ user: null, isAuthenticated: false, twoFactorRequired: false });

    await useAuthStore.getState().login('test@example.com', 'password123');
    expect(useAuthStore.getState().twoFactorRequired).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('sets user and isAuthenticated on successful login', async () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      fullName: 'Test User',
      role: 'user' as const,
      accountType: 'candidate' as const,
      isVerified: true,
      twoFactorEnabled: true,
      settings: { emailNotifications: true, profileVisibility: 'public' as const, darkMode: false },
      followers: 0,
      following: 0,
      connections: 0,
    };

    const mockApi = api as any;
    mockApi.get.mockResolvedValueOnce({ data: {} }); // csrf-token
    mockApi.post.mockResolvedValueOnce({
      data: { success: true, twoFactorRequired: false, data: { user: mockUser } },
    });

    const useAuthStore = await getStore();
    useAuthStore.setState({ user: null, isAuthenticated: false });

    await useAuthStore.getState().login('test@example.com', 'password123');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.email).toBe('test@example.com');
    expect(useAuthStore.getState().twoFactorRequired).toBe(false);
  });

  it('sets error on login failure', async () => {
    const mockApi = api as any;
    mockApi.get.mockResolvedValueOnce({ data: {} }); // csrf-token
    const axiosErr: any = new Error('Request failed');
    axiosErr.isAxiosError = true;
    axiosErr.response = { data: { message: 'Invalid credentials' } };
    mockApi.post.mockRejectedValueOnce(axiosErr);

    const useAuthStore = await getStore();
    useAuthStore.setState({ error: null });

    try {
      await useAuthStore.getState().login('bad@example.com', 'wrongpass');
    } catch {
      // store re-throws — expected
    }
    expect(useAuthStore.getState().error).toBe('Invalid credentials');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe('authStore — logout', () => {
  it('clears user state on logout', async () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      fullName: 'Test User',
      role: 'user' as const,
      accountType: 'candidate' as const,
      isVerified: true,
      twoFactorEnabled: true,
      settings: { emailNotifications: true, profileVisibility: 'public' as const, darkMode: false },
      followers: 0,
      following: 0,
      connections: 0,
    };

    const mockApi = api as any;
    mockApi.post.mockResolvedValueOnce({ data: { success: true } });

    const useAuthStore = await getStore();
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });

    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
