import { Component, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ThemeProvider } from './stores/themeStore';
import { AuthProvider } from './stores/authStore';

// Layout
import MainLayout from './components/layout/MainLayout';

// Pages
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import ForgotPasswordPage from './pages/ForgotPassword';
import ResetPasswordPage from './pages/ResetPassword';
import FeedPage from './pages/Feed';
import NetworkPage from './pages/Network';
import JobsPage from './pages/Jobs';
import MessagingPage from './pages/Messaging';
import NotificationsPage from './pages/Notifications';
import ProfilePage from './pages/Profile';
import SettingsPage from './pages/Settings';
import NotFoundPage from './pages/NotFound';

import Setup2FAPage from './pages/Setup2FA';
import AdminPage from './pages/Admin';
import CompanyPage from './pages/Company';
import ApplicationsPage from './pages/Applications';

// Protected Route
import ProtectedRoute from './components/auth/ProtectedRoute';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './stores/authStore';

/* ─── AdminGuard ─────────────────────────────────────────────── */
/** Redirects admin users away from the main app to /admin. */
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  if (isAuthenticated && user?.role === 'admin' && !location.pathname.startsWith('/admin')) {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}

/* ─── Global Error Boundary ─── */
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg)',
          }}
        >
          <div
            style={{
              background: 'var(--color-card)',
              borderRadius: '1rem',
              padding: '2rem',
              maxWidth: '420px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            <h1 style={{ color: 'var(--color-text)', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Something went wrong
            </h1>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              {this.state.error?.message ?? 'An unexpected error occurred. Please try reloading the page.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '0.75rem',
                padding: '0.625rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* 2FA Setup — needs auth, but NOT the 2FA guard (that's for subsequent visits) */}
              <Route
                path="/setup-2fa"
                element={
                  <ProtectedRoute>
                    <Setup2FAPage />
                  </ProtectedRoute>
                }
              />

              {/* Admin — full-screen, no MainLayout */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AdminGuard>
                      <MainLayout />
                    </AdminGuard>
                  </ProtectedRoute>
                }
              >
                <Route index element={<FeedPage />} />
                <Route path="network" element={<NetworkPage />} />
                <Route path="jobs" element={<JobsPage />} />
                <Route path="applications" element={<ApplicationsPage />} />
                <Route path="messaging" element={<MessagingPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="profile/:id?" element={<ProfilePage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="company/:id?" element={<CompanyPage />} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
          </ErrorBoundary>

          {/* Global Toast Notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--toast-bg)',
                color: 'var(--toast-color)',
              },
              classNames: {
                success: 'toast-success',
                error: 'toast-error',
                warning: 'toast-warning',
                info: 'toast-info',
              },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
