import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore, { useAuth } from '@stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Silently logs out and navigates to /login.
 * Used when a user's 2FA setup session flag is absent — meaning
 * someone opened the site in a new tab/browser after a previous
 * user left mid-2FA on a shared machine.
 */
function ForceLogout() {
  const logout = useAuthStore((s) => s.logout);
  useEffect(() => {
    logout();
  }, [logout]);
  return <Navigate to="/login" replace state={{ message: 'Session expired. Please log in again.' }} />;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-linkedin-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 2FA is mandatory for all users
  if (user && !user.twoFactorEnabled) {
    // Only allow reaching /setup-2fa if this is the tab that triggered the auth.
    // sessionStorage is cleared on tab close — so a new tab (or different browser)
    // will not have the flag and gets silently logged out instead of shown the QR.
    const setupPending = sessionStorage.getItem('2fa_setup_pending');
    if (!setupPending) {
      return <ForceLogout />;
    }
    if (location.pathname !== '/setup-2fa') {
      return <Navigate to="/setup-2fa" replace />;
    }
  }

  return <>{children}</>;
}
