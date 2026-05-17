import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@services/api';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  // Password strength helper
  const getStrength = (pw: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const labels: Record<number, { label: string; color: string }> = {
      0: { label: 'Too short', color: '#ef4444' },
      1: { label: 'Weak', color: '#f97316' },
      2: { label: 'Fair', color: '#eab308' },
      3: { label: 'Good', color: '#22c55e' },
      4: { label: 'Strong', color: '#10b981' },
      5: { label: 'Very strong', color: '#6fe0a0' },
    };
    return { score, ...labels[score] };
  };
  const strength = password ? getStrength(password) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Reset link is invalid or missing. Please request a new one.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      await apiService.auth.resetPassword(token, password);
      setDone(true);
      toast.success('Password reset! Redirecting to login…');
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Reset failed. The link may have expired.';
      setError(msg);
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
        <Link to="/login" className="inline-flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg text-white"
            style={{ background: 'linear-gradient(135deg, #7c6fe0, #e06fbc)', boxShadow: '0 4px 20px rgba(124,111,224,0.4)' }}
          >
            N
          </div>
          <span className="text-base font-bold" style={{ color: 'var(--color-text)', letterSpacing: '-0.3px' }}>Nexus</span>
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
          <div className="sp-card rounded-2xl p-8">
            <AnimatePresence mode="wait">
              {/* Invalid / missing token */}
              {!token && !done && (
                <motion.div
                  key="invalid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-4"
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}
                  >
                    <AlertTriangle className="w-7 h-7 text-red-400" />
                  </div>
                  <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
                    Link is invalid
                  </h2>
                  <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-muted)' }}>
                    This password reset link is missing or malformed. Please request a new one.
                  </p>
                  <Link
                    to="/forgot-password"
                    className="inline-flex items-center justify-center w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #7c6fe0, #e06fbc)' }}
                  >
                    Request new link
                  </Link>
                </motion.div>
              )}

              {/* Success state */}
              {done && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-center py-4"
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                    style={{ background: 'rgba(111,224,160,0.12)', border: '1px solid rgba(111,224,160,0.35)' }}
                  >
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)', letterSpacing: '-0.4px' }}>
                    Password updated!
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                    Your password has been reset. Redirecting you to the login page…
                  </p>
                </motion.div>
              )}

              {/* Form */}
              {token && !done && (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mb-8">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5"
                      style={{ background: 'rgba(124,111,224,0.15)', border: '1px solid rgba(124,111,224,0.35)' }}
                    >
                      <ShieldCheck className="w-6 h-6" style={{ color: '#9d94f0' }} />
                    </div>
                    <h1 className="text-2xl font-bold mb-1.5 text-center" style={{ color: 'var(--color-text)', letterSpacing: '-0.5px' }}>
                      Set new password
                    </h1>
                    <p className="text-sm text-center leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                      Choose a strong password for your account.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      label="New password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      leftIcon={<Lock className="w-4 h-4" />}
                      rightIcon={
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="focus:outline-none">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                      required
                    />

                    {/* Password strength bar */}
                    {strength && (
                      <div className="space-y-1.5 -mt-1">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className="flex-1 h-1 rounded-full transition-all duration-300"
                              style={{
                                background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.08)',
                              }}
                            />
                          ))}
                        </div>
                        <p className="text-xs font-medium" style={{ color: strength.color }}>
                          {strength.label}
                        </p>
                      </div>
                    )}

                    <Input
                      label="Confirm password"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      leftIcon={<Lock className="w-4 h-4" />}
                      rightIcon={
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="focus:outline-none">
                          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                      required
                    />

                    {/* Match indicator */}
                    {confirmPassword && (
                      <p
                        className="text-xs font-medium flex items-center gap-1 -mt-1"
                        style={{ color: password === confirmPassword ? '#6fe0a0' : '#ef4444' }}
                      >
                        {password === confirmPassword ? (
                          <><CheckCircle2 className="w-3.5 h-3.5" /> Passwords match</>
                        ) : (
                          <><AlertTriangle className="w-3.5 h-3.5" /> Passwords do not match</>
                        )}
                      </p>
                    )}

                    {error && (
                      <div
                        className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-full mt-2"
                      isLoading={isLoading}
                      disabled={password !== confirmPassword || password.length < 8}
                    >
                      Reset password
                    </Button>
                  </form>

                  <div className="mt-5 text-center">
                    <Link
                      to="/login"
                      className="text-sm font-semibold hover:underline"
                      style={{ color: '#9d94f0' }}
                    >
                      ← Back to sign in
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
