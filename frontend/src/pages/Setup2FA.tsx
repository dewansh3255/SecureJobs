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
import VirtualNumpad from '@components/ui/VirtualNumpad';
import { Button } from '@components/ui/Button';
import { Card, CardContent } from '@components/ui/Card';

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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-900">
      {/* Header */}
      <header className="w-full py-5 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-linkedin-500 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-lg">in</span>
          </div>
          <span className="text-xl font-semibold text-gray-900 dark:text-white">
            Professional Network
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <ShieldCheck className="w-4 h-4 text-linkedin-500" />
          <span>Account Security Setup</span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="w-full h-1 bg-gray-100 dark:bg-dark-700">
        <motion.div
          className="h-full bg-linkedin-500 rounded-full"
          animate={{
            width: step === 'qr' ? '33%' : step === 'verify' ? '66%' : '100%',
          }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />
      </div>

      {/* Step labels */}
      <div className="flex justify-center gap-8 py-4 text-xs font-medium">
        {(['qr', 'verify', 'backup'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s
                  ? 'bg-linkedin-500 text-white'
                  : (step === 'verify' && s === 'qr') || step === 'backup'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 dark:bg-dark-600 text-gray-400'
              }`}
            >
              {((step === 'verify' && s === 'qr') || step === 'backup') && s !== step ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                i + 1
              )}
            </div>
            <span
              className={
                step === s
                  ? 'text-linkedin-600 dark:text-linkedin-400'
                  : 'text-gray-400 dark:text-gray-500'
              }
            >
              {s === 'qr' ? 'Scan QR' : s === 'verify' ? 'Verify' : 'Backup Codes'}
            </span>
          </div>
        ))}
      </div>

      {/* Main card */}
      <main className="flex-1 flex items-start justify-center px-4 py-4 pb-12">
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
                <Card className="shadow-soft-xl border-0">
                  <CardContent className="pt-8 pb-8 px-8">
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-linkedin-100 dark:bg-linkedin-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <QrCode className="w-8 h-8 text-linkedin-600 dark:text-linkedin-400" />
                      </div>
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        Set up Two-Factor Authentication
                      </h1>
                      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                        2FA is required on this platform. Scan the QR code with{' '}
                        <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any
                        TOTP-compatible app.
                      </p>
                    </div>

                    {isLoading && (
                      <div className="flex flex-col items-center py-10 gap-3">
                        <div className="w-10 h-10 border-4 border-linkedin-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-gray-500">Generating your secret key…</p>
                      </div>
                    )}

                    {fetchError && (
                      <div className="flex flex-col items-center gap-4 py-6">
                        <AlertTriangle className="w-10 h-10 text-amber-500" />
                        <p className="text-sm text-red-600 dark:text-red-400">{fetchError}</p>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={fetchSetup}
                          leftIcon={<RefreshCw className="w-4 h-4" />}
                        >
                          Try again
                        </Button>
                      </div>
                    )}

                    {setupData && !isLoading && (
                      <>
                        {/* QR Code */}
                        <div className="flex justify-center mb-5">
                          <div className="p-3 bg-white rounded-2xl shadow-inner border border-gray-100 dark:border-dark-600">
                            <img
                              src={setupData.qrCode}
                              alt="TOTP QR Code"
                              className="w-48 h-48 rounded-lg"
                            />
                          </div>
                        </div>

                        {/* Manual entry key */}
                        <div className="bg-gray-50 dark:bg-dark-700 rounded-xl p-4 mb-6">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium uppercase tracking-wide">
                            Can't scan? Enter this key manually:
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 font-mono text-sm text-gray-900 dark:text-white bg-white dark:bg-dark-600 rounded-lg px-3 py-2 border border-gray-200 dark:border-dark-500 break-all">
                              {setupData.secret}
                            </code>
                            <button
                              type="button"
                              onClick={copySecret}
                              className="flex-shrink-0 p-2 rounded-lg bg-white dark:bg-dark-600 border border-gray-200 dark:border-dark-500 hover:bg-gray-100 dark:hover:bg-dark-500 transition-colors"
                              title="Copy secret"
                            >
                              {secretCopied ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          </div>
                        </div>

                        <Button
                          variant="primary"
                          size="lg"
                          className="w-full"
                          onClick={() => setStep('verify')}
                          rightIcon={<ChevronRight className="w-5 h-5" />}
                        >
                          I've scanned the QR code
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
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
                <Card className="shadow-soft-xl border-0">
                  <CardContent className="pt-8 pb-8 px-8">
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <KeyRound className="w-8 h-8 text-green-600 dark:text-green-400" />
                      </div>
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        Verify your authenticator
                      </h1>
                      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                        Open your authenticator app and enter the 6-digit code shown for this
                        account. Use the virtual keyboard below.
                      </p>
                    </div>

                    <form onSubmit={handleVerify} className="space-y-6">
                      <VirtualNumpad
                        value={totpCode}
                        onChange={setTotpCode}
                        maxLength={6}
                        disabled={isLoading}
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
                      className="mt-4 w-full text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline transition-colors"
                    >
                      ← Back to QR code
                    </button>
                  </CardContent>
                </Card>
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
                <Card className="shadow-soft-xl border-0">
                  <CardContent className="pt-8 pb-8 px-8">
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        Save your backup codes
                      </h1>
                      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                        If you lose your phone, use one of these codes to log in.{' '}
                        <strong className="text-red-600 dark:text-red-400">
                          Each code can only be used once.
                        </strong>{' '}
                        Store them somewhere safe — you won't see these again.
                      </p>
                    </div>

                    {/* Backup codes grid */}
                    <div className="bg-gray-900 dark:bg-dark-900 rounded-2xl p-5 mb-4 font-mono">
                      <div className="grid grid-cols-2 gap-2">
                        {backupCodes.map((code, i) => (
                          <div
                            key={i}
                            className="text-green-400 text-sm tracking-widest bg-black/20 rounded-lg px-3 py-2 text-center"
                          >
                            {code}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Copy button */}
                    <button
                      type="button"
                      onClick={copyBackupCodes}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-dark-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors mb-5"
                    >
                      {backupCopied ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {backupCopied ? 'Copied!' : 'Copy all backup codes'}
                    </button>

                    {/* Acknowledgement checkbox */}
                    <label className="flex items-start gap-3 cursor-pointer mb-5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                      <input
                        type="checkbox"
                        checked={backupAcknowledged}
                        onChange={(e) => setBackupAcknowledged(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-amber-500 border-amber-400 focus:ring-amber-400"
                      />
                      <span className="text-sm text-amber-800 dark:text-amber-300">
                        I have saved my backup codes in a secure place. I understand that if I lose
                        my authenticator device and backup codes, I will be locked out of my
                        account.
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
                      Enter Professional Network
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
