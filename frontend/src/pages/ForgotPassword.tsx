import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@services/api';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiService.auth.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      // Even on error we show success to prevent email enumeration
      const msg = err?.response?.data?.message;
      if (msg && msg.includes('rate limit')) {
        toast.error('Too many requests. Please wait a few minutes and try again.');
      } else {
        setSent(true);
      }
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
            {!sent ? (
              <>
                <div className="mb-8">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5"
                    style={{ background: 'rgba(124,111,224,0.15)', border: '1px solid rgba(124,111,224,0.35)' }}
                  >
                    <Mail className="w-6 h-6" style={{ color: '#9d94f0' }} />
                  </div>
                  <h1 className="text-2xl font-bold mb-1.5 text-center" style={{ color: 'var(--color-text)', letterSpacing: '-0.5px' }}>
                    Forgot your password?
                  </h1>
                  <p className="text-sm text-center leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                    Enter the email address linked to your account and we'll send a reset link.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <Input
                    label="Email address"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    leftIcon={<Mail className="w-4 h-4" />}
                    required
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    isLoading={isLoading}
                  >
                    Send reset link
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
                    style={{ color: '#9d94f0' }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to sign in
                  </Link>
                </div>
              </>
            ) : (
              <motion.div
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
                  Check your inbox
                </h2>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-muted)' }}>
                  If <strong style={{ color: 'var(--color-text)' }}>{email}</strong> is registered,
                  you'll receive a password reset link shortly. The link expires in <strong style={{ color: '#9d94f0' }}>1 hour</strong>.
                </p>
                <p className="text-xs mb-6" style={{ color: 'var(--color-dim)' }}>
                  Didn't get the email? Check your spam folder or{' '}
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="font-semibold hover:underline"
                    style={{ color: '#9d94f0' }}
                  >
                    try again
                  </button>.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
                  style={{ color: '#9d94f0' }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </Link>
              </motion.div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
