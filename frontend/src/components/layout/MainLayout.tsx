import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home,
  Users,
  Briefcase,
  MessageSquare,
  Bell,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { ThemeToggle } from '@stores/themeStore';
import { useAuth } from '@stores/authStore';
import Avatar from '@components/ui/Avatar';
import Badge from '@components/ui/Badge';
import { useState } from 'react';

const navigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Network', href: '/network', icon: Users },
  { name: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'Messaging', href: '/messaging', icon: MessageSquare, badge: true },
  { name: 'Notifications', href: '/notifications', icon: Bell },
];

export default function MainLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      {/* ===========================================
          Header
      =========================================== */}
      <header className="sticky top-0 z-50 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-linkedin-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">in</span>
              </div>
              <span className="hidden sm:block text-xl font-semibold text-gray-900 dark:text-white">
                Professional Network
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`
                      relative flex items-center px-4 py-2 text-sm font-medium rounded-lg
                      transition-all duration-200
                      ${
                        isActive
                          ? 'text-linkedin-600 dark:text-linkedin-400 bg-linkedin-50 dark:bg-linkedin-900/20'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5 mr-1.5" />
                    {item.name}
                    {item.badge && (
                      <Badge variant="error" size="sm" className="ml-2">
                        3
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center space-x-2">
              {/* Theme Toggle */}
              <ThemeToggle />

              {/* User Menu */}
              <div className="hidden sm:flex items-center space-x-3 pl-3 border-l border-gray-200 dark:border-dark-700">
                <Link
                  to={`/profile/${user?.id}`}
                  className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                >
                  <Avatar
                    name={user?.fullName}
                    src={user?.profilePicture}
                    size="sm"
                    isOnline
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[120px] truncate">
                    {user?.firstName}
                  </span>
                </Link>

                <Link
                  to="/settings"
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </Link>

                {user?.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Admin Panel"
                  >
                    <Shield className="w-5 h-5" />
                  </Link>
                )}

                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden border-t border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 px-4 py-3 space-y-1"
          >
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center px-4 py-3 text-sm font-medium rounded-lg
                  ${
                    location.pathname === item.href
                      ? 'text-linkedin-600 dark:text-linkedin-400 bg-linkedin-50 dark:bg-linkedin-900/20'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700'
                  }
                `}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
                {item.badge && (
                  <Badge variant="error" size="sm" className="ml-auto">
                    3
                  </Badge>
                )}
              </Link>
            ))}
            <div className="pt-3 border-t border-gray-200 dark:border-dark-700">
              <Link
                to={`/profile/${user?.id}`}
                className="flex items-center px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
              >
                <User className="w-5 h-5 mr-3" />
                View Profile
              </Link>
              <Link
                to="/settings"
                className="flex items-center px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
              >
                <Settings className="w-5 h-5 mr-3" />
                Settings
              </Link>
              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  className="flex items-center px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Shield className="w-5 h-5 mr-3" />
                  Admin Panel
                </Link>
              )}
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </header>

      {/* ===========================================
          Main Content
      =========================================== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
