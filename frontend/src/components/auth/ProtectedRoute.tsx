import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
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

  // 2FA is mandatory — redirect to setup unless already there
  if (user && !user.twoFactorEnabled && location.pathname !== '/setup-2fa') {
    return <Navigate to="/setup-2fa" replace />;
  }

  return <>{children}</>;
}
