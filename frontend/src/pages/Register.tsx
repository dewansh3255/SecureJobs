import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User as UserIcon, Eye, EyeOff, Phone } from 'lucide-react';
import { useAuth } from '@stores/authStore';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { toast } from 'sonner';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, error, clearError } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsLoading(true);
    try {
      await register(formData);
      navigate('/setup-2fa', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Ambient blobs */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-blob ambient-blob-1" />
        <div className="ambient-blob ambient-blob-2" />
        <div className="ambient-blob ambient-blob-3" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full py-5 px-8">
        <Link to="/" className="inline-flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg text-white"
            style={{
              background: 'linear-gradient(135deg, #7c6fe0, #e06fbc)',
              boxShadow: '0 4px 20px rgba(124,111,224,0.4)',
            }}
          >
            N
          </div>
          <span className="text-base font-bold" style={{ color: 'var(--color-text)', letterSpacing: '-0.3px' }}>
            Nexus
          </span>
        </Link>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-[420px]"
        >
          {/* Glassmorphism card */}
          <div className="sp-card rounded-2xl p-8">
            {/* Title */}
            <div className="mb-8">
              <h1
                className="text-2xl font-bold mb-1.5"
                style={{ color: 'var(--color-text)', letterSpacing: '-0.5px' }}
              >
                Join Nexus
              </h1>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                Build your professional network
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  leftIcon={<UserIcon className="w-4 h-4" />}
                  required
                />
                <Input
                  label="Last Name"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  leftIcon={<UserIcon className="w-4 h-4" />}
                  required
                />
              </div>

              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                leftIcon={<Mail className="w-4 h-4" />}
                error={error?.includes('email') ? error : undefined}
                required
              />

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="focus:outline-none">
                    {showPassword
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye className="w-4 h-4" />}
                  </button>
                }
                helperText="Min 8 chars · uppercase · lowercase · number · special"
                error={error?.includes('password') ? error : undefined}
                required
              />

              <Input
                label="Phone Number (optional)"
                type="tel"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                leftIcon={<Phone className="w-4 h-4" />}
                helperText="Used for account recovery — kept private by default"
              />

              {error && !error.includes('email') && !error.includes('password') && (
                <p className="text-xs font-medium text-red-400 flex items-center gap-1">
                  <span>⚠</span> {error}
                </p>
              )}

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  isLoading={isLoading}
                >
                  Create Account
                </Button>
              </div>

              <p className="text-xs text-center" style={{ color: 'var(--color-dim)' }}>
                By joining, you agree to our Terms of Service and Privacy Policy.
                <br />
                2FA setup is required after registration.
              </p>
            </form>

            {/* Google OAuth */}
            <div className="mt-4">
              <a
                href="/api/auth/google"
                className="flex items-center justify-center gap-3 w-full py-2.5 px-4 rounded-full border font-medium text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </a>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
              <span className="text-xs" style={{ color: 'var(--color-dim)' }}>or</span>
              <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
            </div>

            <p className="text-center text-sm" style={{ color: 'var(--color-muted)' }}>
              Already on Nexus?{' '}
              <Link
                to="/login"
                className="font-semibold hover:underline"
                style={{ color: '#9d94f0' }}
              >
                Sign in
              </Link>
            </p>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: 'var(--color-dim)' }}>
            &copy; 2026 Nexus · FCS-26 Security Project
          </p>
        </motion.div>
      </main>
    </div>
  );
}

