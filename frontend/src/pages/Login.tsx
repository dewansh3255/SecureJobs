import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@stores/authStore';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { toast } from 'sonner';
import VirtualKeypad from '@components/auth/VirtualKeypad';

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
        <Link
          to="/"
          className="inline-flex items-center gap-3"
        >
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
            <AnimatePresence mode="wait">
              {!twoFactorRequired ? (
                <motion.div
                  key="credentials"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Title */}
                  <div className="mb-8">
                    <h1
                      className="text-2xl font-bold mb-1.5"
                      style={{ color: 'var(--color-text)', letterSpacing: '-0.5px' }}
                    >
                      Welcome back
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                      Sign in to your professional network
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      label="Email address"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      leftIcon={<Mail className="w-4 h-4" />}
                      required
                    />

                    <Input
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Your password"
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
                      required
                    />

                    <div className="flex items-center justify-between text-xs pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 rounded"
                          style={{ accentColor: '#7c6fe0' }}
                        />
                        <span style={{ color: 'var(--color-muted)' }}>Remember me</span>
                      </label>
                      <Link
                        to="/forgot-password"
                        className="font-semibold hover:underline"
                        style={{ color: '#9d94f0' }}
                      >
                        Forgot password?
                      </Link>
                    </div>

                    {error && (
                      <p className="text-xs font-medium text-red-400 flex items-center gap-1">
                        <span>⚠</span> {error}
                      </p>
                    )}

                    <Button type="submit" variant="primary" size="lg" className="w-full mt-2" isLoading={isLoading}>
                      Sign In
                    </Button>
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
                    New to Nexus?{' '}
                    <Link
                      to="/register"
                      className="font-semibold hover:underline"
                      style={{ color: '#9d94f0' }}
                    >
                      Create account
                    </Link>
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="totp"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="text-center mb-8">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{
                        background: 'rgba(124,111,224,0.15)',
                        border: '1px solid rgba(124,111,224,0.35)',
                      }}
                    >
                      <ShieldCheck className="w-8 h-8" style={{ color: '#9d94f0' }} />
                    </div>
                    <h1 className="text-xl font-bold mb-1.5" style={{ color: 'var(--color-text)' }}>
                      Two-Factor Auth
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                      Enter the 6-digit code from your authenticator app
                    </p>
                  </div>

                  <form onSubmit={handle2faSubmit} className="space-y-5">
                    {/* TOTP display */}
                    <div
                      className="text-center py-4 rounded-xl text-3xl font-bold tracking-[0.4em]"
                      style={{
                        background: 'rgba(124,111,224,0.08)',
                        border: '1px solid rgba(124,111,224,0.25)',
                        color: totpCode ? '#9d94f0' : 'var(--color-dim)',
                        letterSpacing: '0.4em',
                        minHeight: '64px',
                      }}
                    >
                      {totpCode || '——————'}
                    </div>

                    {/* Virtual randomized keypad */}
                    <VirtualKeypad
                      value={totpCode}
                      onChange={setTotpCode}
                      maxLength={6}
                    />

                    {error && (
                      <p className="text-xs font-medium text-red-400 flex items-center gap-1 justify-center">
                        <span>⚠</span> {error}
                      </p>
                    )}

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-full"
                      isLoading={isLoading}
                      disabled={totpCode.length !== 6}
                    >
                      Verify Code
                    </Button>

                    <button
                      type="button"
                      onClick={() => { clearError(); window.location.reload(); }}
                      className="w-full text-xs hover:underline"
                      style={{ color: 'var(--color-dim)' }}
                    >
                      ← Back to sign in
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <p className="text-center text-xs mt-6" style={{ color: 'var(--color-dim)' }}>
            &copy; 2026 Nexus · FCS-26 Security Project
          </p>
        </motion.div>
      </main>
    </div>
  );
}

