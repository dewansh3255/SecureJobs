import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ThemeProvider } from './stores/themeStore';
import { AuthProvider } from './stores/authStore';

// Layout
import MainLayout from './components/layout/MainLayout';

// Pages
import HomePage from './pages/Home';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import FeedPage from './pages/Feed';
import NetworkPage from './pages/Network';
import JobsPage from './pages/Jobs';
import MessagingPage from './pages/Messaging';
import NotificationsPage from './pages/Notifications';
import ProfilePage from './pages/Profile';
import SettingsPage from './pages/Settings';
import NotFoundPage from './pages/NotFound';

// Protected Route
import ProtectedRoute from './components/auth/ProtectedRoute';

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
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<FeedPage />} />
                <Route path="network" element={<NetworkPage />} />
                <Route path="jobs" element={<JobsPage />} />
                <Route path="messaging" element={<MessagingPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="profile/:id?" element={<ProfilePage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>

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
