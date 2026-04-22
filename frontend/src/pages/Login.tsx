import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@stores/authStore';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Card, CardContent } from '@components/ui/Card';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, validate2fa, twoFactorRequired, error, clearError } = useAuth();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsLoading(true);
    try {
      await login(formData.email, formData.password);
      // If twoFactorRequired, state updates and we render the 2FA step
      if (!twoFactorRequired) {
        toast.success('Welcome back!');
        const from = searchParams.get('from');
        navigate(from || '/', { replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handle2faSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsLoading(true);
    try {
      await validate2fa(totpCode);
      toast.success('Welcome back!');
      const from = searchParams.get('from');
      navigate(from || '/', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid code');
      setTotpCode('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-900 dark:to-dark-800">
      <header className="w-full py-4 px-6">
        <Link to="/" className="inline-flex items-center space-x-2">
          <div className="w-10 h-10 bg-linkedin-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">in</span>
          </div>
          <span className="text-xl font-semibold text-gray-900 dark:text-white">Professional Network</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <Card className="shadow-soft-lg">
            <CardContent className="pt-8 pb-8 px-8">
              <AnimatePresence mode="wait">
                {!twoFactorRequired ? (
                  <motion.div
                    key="credentials"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="text-center mb-8">
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Welcome back</h1>
                      <p className="text-gray-600 dark:text-gray-400">Sign in to your professional network</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                      <Input
                        label="Email"
                        type="email"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        leftIcon={<Mail className="w-5 h-5" />}
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
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="focus:outline-none">
                              {showPassword ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                            </button>
                          }
                          required
                        />
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <label className="flex items-center">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-linkedin-500 focus:ring-linkedin-500" />
                          <span className="ml-2 text-gray-600 dark:text-gray-400">Remember me</span>
                        </label>
                        <Link to="/forgot-password" className="text-linkedin-600 hover:text-linkedin-700 dark:text-linkedin-400 font-medium">
                          Forgot password?
                        </Link>
                      </div>

                      {error && (
                        <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
                      )}

                      <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
                        Sign In
                      </Button>
                    </form>

                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200 dark:border-dark-700" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white dark:bg-dark-800 text-gray-500">or</span>
                      </div>
                    </div>

                    <p className="text-center text-gray-600 dark:text-gray-400">
                      New to Professional Network?{' '}
                      <Link to="/register" className="text-linkedin-600 hover:text-linkedin-700 dark:text-linkedin-400 font-medium">
                        Join now
                      </Link>
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="totp"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-linkedin-100 dark:bg-linkedin-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck className="w-8 h-8 text-linkedin-600 dark:text-linkedin-400" />
                      </div>
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Two-Factor Authentication</h1>
                      <p className="text-gray-600 dark:text-gray-400">
                        Enter the 6-digit code from your authenticator app
                      </p>
                    </div>

                    <form onSubmit={handle2faSubmit} className="space-y-5">
                      <div>
                        <Input
                          label="Verification Code"
                          type="text"
                          inputMode="numeric"
                          pattern="\d{6}"
                          maxLength={6}
                          placeholder="000000"
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                          leftIcon={<ShieldCheck className="w-5 h-5" />}
                          required
                          autoFocus
                        />
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                          Code refreshes every 30 seconds. You can also use a backup code.
                        </p>
                      </div>

                      {error && (
                        <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
                      )}

                      <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading} disabled={totpCode.length !== 6}>
                        Verify
                      </Button>

                      <button
                        type="button"
                        onClick={() => { clearError(); window.location.reload(); }}
                        className="w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
                      >
                        Back to sign in
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <footer className="w-full py-6 px-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>&copy; 2026 Professional Network. FCS-26 Project.</p>
      </footer>
    </div>
  );
}
