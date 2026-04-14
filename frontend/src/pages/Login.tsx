import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@stores/authStore';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Card, CardContent } from '@components/ui/Card';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, error, clearError } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsLoading(true);

    try {
      await login(formData.email, formData.password);
      toast.success('Welcome back!');

      // Redirect to intended page or home
      const from = searchParams.get('from');
      navigate(from || '/', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-900 dark:to-dark-800">
      {/* Header */}
      <header className="w-full py-4 px-6">
        <Link to="/" className="inline-flex items-center space-x-2">
          <div className="w-10 h-10 bg-linkedin-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">in</span>
          </div>
          <span className="text-xl font-semibold text-gray-900 dark:text-white">
            Professional Network
          </span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <Card className="shadow-soft-lg">
            <CardContent className="pt-8 pb-8 px-8">
              {/* Title */}
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Welcome back
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Sign in to your professional network
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  leftIcon={<Mail className="w-5 h-5" />}
                  error={error?.includes('email') ? error : undefined}
                  required
                />

                <div className="relative">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    leftIcon={<Lock className="w-5 h-5" />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="focus:outline-none"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5 text-gray-400" />
                        ) : (
                          <Eye className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    }
                    error={error?.includes('password') ? error : undefined}
                    required
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-linkedin-500 focus:ring-linkedin-500"
                    />
                    <span className="ml-2 text-gray-600 dark:text-gray-400">Remember me</span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-linkedin-600 hover:text-linkedin-700 dark:text-linkedin-400 font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  isLoading={isLoading}
                >
                  Sign In
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-dark-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white dark:bg-dark-800 text-gray-500">
                    or
                  </span>
                </div>
              </div>

              {/* Sign up link */}
              <p className="text-center text-gray-600 dark:text-gray-400">
                New to Professional Network?{' '}
                <Link
                  to="/register"
                  className="text-linkedin-600 hover:text-linkedin-700 dark:text-linkedin-400 font-medium"
                >
                  Join now
                </Link>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 px-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>&copy; 2026 Professional Network. FCS-26 Project.</p>
      </footer>
    </div>
  );
}
