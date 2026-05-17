/**
 * Setup2FA Page
 * Mandatory 2FA setup wizard — shown to every new user after registration
 * and to any existing user whose account doesn't have 2FA enabled yet.
 *
 * Steps:
 *  1. qr      — fetch secret + QR code, user scans with authenticator app
 *  2. verify  — enter 6-digit code via randomised virtual numpad
 *  3. backup  — view + acknowledge backup codes before entering the app
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  QrCode,
  KeyRound,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@services/api';
import useAuthStore from '@stores/authStore';
import VirtualKeypad from '@components/auth/VirtualKeypad';
import { Button } from '@components/ui/Button';

type Step = 'qr' | 'verify' | 'backup';

interface SetupData {
  secret: string;
  qrCode: string;
}

export default function Setup2FAPage() {
  const navigate = useNavigate();
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [step, setStep] = useState<Step>('qr');
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);
  const [backupCopied, setBackupCopied] = useState(false);
  const [backupAcknowledged, setBackupAcknowledged] = useState(false);

  // Fetch QR code on mount
  const fetchSetup = useCallback(async () => {
    setIsLoading(true);
    setFetchError('');
    try {
      const res = await apiService.auth.twoFASetup();
      setSetupData({ secret: res.data.data.secret, qrCode: res.data.data.qrCode });
    } catch (err: any) {
      // If 2FA is already enabled on this account, just go to the app
      if (err?.response?.data?.message?.includes('already enabled')) {
        await refreshUser();
        navigate('/', { replace: true });
        return;
      }
      setFetchError('Failed to generate QR code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [navigate, refreshUser]);

  useEffect(() => {
    fetchSetup();
  }, [fetchSetup]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6) return;
    setIsLoading(true);
    try {
      const res = await apiService.auth.twoFAEnable(totpCode);
      setBackupCodes(res.data.data.backupCodes);
      await refreshUser(); // update twoFactorEnabled in store
      setStep('backup');
      toast.success('2FA enabled successfully!');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Invalid code. Please try again.';
      toast.error(msg);
      setTotpCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const copySecret = () => {
    if (!setupData) return;
    navigator.clipboard.writeText(setupData.secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setBackupCopied(true);
    setTimeout(() => setBackupCopied(false), 2000);
  };

  const finishSetup = () => {
    navigate('/', { replace: true });
    toast.success('Welcome! Your account is secured with 2FA.');
  };

  const stepVariants = {
    enter: { opacity: 0, x: 40 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
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
      <header className="relative z-10 w-full py-5 px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg text-white"
            style={{ background: 'linear-gradient(135deg, #7c6fe0, #e06fbc)', boxShadow: '0 4px 20px rgba(124,111,224,0.4)' }}
          >
            N
          </div>
          <span className="text-base font-bold" style={{ color: 'var(--color-text)', letterSpacing: '-0.3px' }}>Nexus</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
          <ShieldCheck className="w-4 h-4" style={{ color: '#9d94f0' }} />
          <span>Security Setup</span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="relative z-10 w-full h-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #7c6fe0, #e06fbc)' }}
          animate={{ width: step === 'qr' ? '33%' : step === 'verify' ? '66%' : '100%' }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />
      </div>

      {/* Step labels */}
      <div className="relative z-10 flex justify-center gap-8 py-4 text-xs font-semibold">
        {(['qr', 'verify', 'backup'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all"
              style={{
                background: step === s ? 'linear-gradient(135deg, #7c6fe0, #e06fbc)'
                  : ((step === 'verify' && s === 'qr') || step === 'backup') ? 'rgba(111,224,160,0.25)' : 'rgba(255,255,255,0.08)',
                color: step === s ? 'white'
                  : ((step === 'verify' && s === 'qr') || step === 'backup') ? '#6fe0a0' : 'var(--color-dim)',
                border: step === s ? 'none' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {((step === 'verify' && s === 'qr') || step === 'backup') && s !== step ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (i + 1)}
            </div>
            <span style={{ color: step === s ? '#9d94f0' : 'var(--color-dim)' }}>
              {s === 'qr' ? 'Scan QR' : s === 'verify' ? 'Verify' : 'Backup'}
            </span>
          </div>
        ))}
      </div>

      {/* Main card */}
      <main className="relative z-10 flex-1 flex items-start justify-center px-4 py-4 pb-12">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {/* ── Step 1: QR Code ─────────────────────────────────── */}
            {step === 'qr' && (
              <motion.div
                key="qr"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
              >
                <div className="sp-card rounded-2xl p-8">
                  <div className="text-center mb-6">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ background: 'rgba(124,111,224,0.15)', border: '1px solid rgba(124,111,224,0.35)' }}
                    >
                      <QrCode className="w-7 h-7" style={{ color: '#9d94f0' }} />
                    </div>
                    <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)', letterSpacing: '-0.4px' }}>
                      Set up Two-Factor Auth
                    </h1>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                      2FA is required on Nexus. Scan the QR code with{' '}
                      <strong style={{ color: '#9d94f0' }}>Google Authenticator</strong>,{' '}
                      <strong style={{ color: '#9d94f0' }}>Authy</strong>, or any TOTP-compatible app.
                    </p>
                  </div>

                  {isLoading && (
                    <div className="flex flex-col items-center py-10 gap-3">
                      <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#7c6fe0', borderTopColor: 'transparent' }} />
                      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Generating your secret key…</p>
                    </div>
                  )}

                  {fetchError && (
                    <div className="flex flex-col items-center gap-4 py-6">
                      <AlertTriangle className="w-10 h-10 text-amber-500" />
                      <p className="text-sm text-red-400">{fetchError}</p>
                      <Button variant="secondary" size="sm" onClick={fetchSetup} leftIcon={<RefreshCw className="w-4 h-4" />}>
                        Try again
                      </Button>
                    </div>
                  )}

                  {setupData && !isLoading && (
                    <>
                      <div className="flex justify-center mb-5">
                        <div className="p-3 bg-white rounded-2xl">
                          <img src={setupData.qrCode} alt="TOTP QR Code" className="w-48 h-48 rounded-lg" />
                        </div>
                      </div>

                      <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-dim)' }}>
                          Can't scan? Enter this key manually:
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 font-mono text-xs rounded-lg px-3 py-2 break-all" style={{ background: 'rgba(255,255,255,0.06)', color: '#9d94f0' }}>
                            {setupData.secret}
                          </code>
                          <button type="button" onClick={copySecret} className="flex-shrink-0 p-2 rounded-lg transition-all" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            {secretCopied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" style={{ color: 'var(--color-dim)' }} />}
                          </button>
                        </div>
                      </div>

                      <Button variant="primary" size="lg" className="w-full" onClick={() => setStep('verify')} rightIcon={<ChevronRight className="w-5 h-5" />}>
                        I've scanned the QR code
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Verify TOTP ──────────────────────────────── */}
            {step === 'verify' && (
              <motion.div
                key="verify"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
              >
                <div className="sp-card rounded-2xl p-8">
                  <div className="text-center mb-6">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ background: 'rgba(111,224,160,0.12)', border: '1px solid rgba(111,224,160,0.3)' }}
                    >
                      <KeyRound className="w-7 h-7 text-emerald-400" />
                    </div>
                    <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
                      Verify your authenticator
                    </h1>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                      Open your authenticator app and enter the 6-digit code using the virtual keyboard below.
                    </p>
                  </div>

                  {/* TOTP display */}
                  <div
                    className="text-center py-4 rounded-xl mb-5 text-3xl font-bold"
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

                  <form onSubmit={handleVerify} className="space-y-5">
                    <VirtualKeypad
                      value={totpCode}
                      onChange={setTotpCode}
                      maxLength={6}
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-full"
                      isLoading={isLoading}
                      disabled={totpCode.length !== 6 || isLoading}
                    >
                      {isLoading ? 'Verifying…' : 'Verify & Enable 2FA'}
                    </Button>
                  </form>

                  <button
                    type="button"
                    onClick={() => { setTotpCode(''); setStep('qr'); }}
                    className="mt-4 w-full text-xs hover:underline"
                    style={{ color: 'var(--color-dim)' }}
                  >
                    ← Back to QR code
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Backup Codes ─────────────────────────────── */}
            {step === 'backup' && (
              <motion.div
                key="backup"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25 }}
              >
                <div className="sp-card rounded-2xl p-8">
                  <div className="text-center mb-6">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ background: 'rgba(224,189,111,0.12)', border: '1px solid rgba(224,189,111,0.3)' }}
                    >
                      <ShieldCheck className="w-7 h-7" style={{ color: '#e0c06f' }} />
                    </div>
                    <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
                      Save your backup codes
                    </h1>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                      If you lose your phone, use one of these codes to log in.{' '}
                      <strong style={{ color: '#e05555' }}>Each code can only be used once.</strong>{' '}
                      Store them somewhere safe — you won't see these again.
                    </p>
                  </div>

                  {/* Backup codes grid */}
                  <div className="rounded-2xl p-5 mb-4 font-mono" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="grid grid-cols-2 gap-2">
                      {backupCodes.map((code, i) => (
                        <div
                          key={i}
                          className="text-sm tracking-widest rounded-lg px-3 py-2 text-center"
                          style={{ color: '#6fe0a0', background: 'rgba(111,224,160,0.08)' }}
                        >
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={copyBackupCodes}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold mb-5 transition-all duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--color-text)',
                    }}
                  >
                    {backupCopied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {backupCopied ? 'Copied!' : 'Copy all backup codes'}
                  </button>

                  <label
                    className="flex items-start gap-3 cursor-pointer mb-5 p-4 rounded-xl"
                    style={{ background: 'rgba(224,189,111,0.08)', border: '1px solid rgba(224,189,111,0.2)' }}
                  >
                    <input
                      type="checkbox"
                      checked={backupAcknowledged}
                      onChange={(e) => setBackupAcknowledged(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded"
                      style={{ accentColor: '#7c6fe0' }}
                    />
                    <span className="text-xs leading-relaxed" style={{ color: '#e0c06f' }}>
                      I have saved my backup codes in a secure place. I understand that if I lose
                      my authenticator device and backup codes, I will be locked out of my account.
                    </span>
                  </label>

                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={finishSetup}
                    disabled={!backupAcknowledged}
                    rightIcon={<ChevronRight className="w-5 h-5" />}
                  >
                    Enter Nexus
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
