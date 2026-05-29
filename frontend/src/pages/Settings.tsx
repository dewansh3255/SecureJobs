import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Shield,
  Eye,
  Mail,
  Lock,
  User,
  Trash2,
  Download,
  Save,
  Moon,
  ShieldCheck,
  ShieldOff,
  Copy,
  CheckCircle2,
  Briefcase,
  GraduationCap,
  KeySquare,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@stores/authStore';
import { useTheme } from '@stores/themeStore';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Badge } from '@components/ui/Badge';
import { toast } from 'sonner';
import api, { apiService } from '@services/api';
import VirtualKeypad from '@components/auth/VirtualKeypad';

const settingsSections = [
  { id: 'account', name: 'Account', icon: User },
  { id: 'account-type', name: 'Account Type', icon: Briefcase },
  { id: 'security', name: 'Security', icon: Shield },
  { id: 'privacy', name: 'Privacy', icon: Eye },
  { id: 'notifications', name: 'Notifications', icon: Bell },
  { id: 'appearance', name: 'Appearance', icon: Eye },
];

// Reusable toggle switch
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="relative w-12 h-6 rounded-full transition-colors focus:outline-none"
      style={{ background: checked ? 'var(--color-accent)' : 'var(--color-shade-md)' }}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'left-7' : 'left-1'}`} />
    </button>
  );
}

// 2FA Setup flow component
function TwoFactorSection({ enabled, onRefresh }: { enabled: boolean; onRefresh: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'backup' | 'disabling'>('idle');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const startSetup = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/auth/2fa/setup');
      setQrCode(res.data.data.qrCode);
      setSecret(res.data.data.secret);
      setCode('');
      setPhase('scanning');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to start 2FA setup');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmEnable = async () => {
    if (code.length !== 6) return;
    setIsLoading(true);
    try {
      const res = await api.post('/auth/2fa/enable', { code });
      setBackupCodes(res.data.data.backupCodes);
      setPhase('backup');
      toast.success('2FA enabled successfully!');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid code');
      setCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const disable2fa = async () => {
    if (code.length < 6) return;
    setIsLoading(true);
    try {
      await api.post('/auth/2fa/disable', { code });
      setPhase('idle');
      setCode('');
      toast.success('2FA has been disabled');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid code');
      setCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (phase === 'scanning') {
    return (
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Scan this QR code with <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app.
        </p>
        <div className="flex justify-center">
          <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 rounded-xl"
            style={{ border: '1px solid var(--color-border)' }} />
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs px-3 py-2 rounded-xl font-mono break-all"
            style={{ background: 'var(--color-bg)', color: 'var(--color-muted)', border: '1px solid var(--color-shade-md)' }}>{secret}</code>
          <button onClick={copySecret} title="Copy secret" className="p-2 rounded-lg hover-shade transition">
            {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" style={{ color: 'var(--color-dim)' }} />}
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-dim)' }}>Can't scan? Enter the code manually in your app.</p>
        <Input
          label="Enter 6-digit verification code"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          autoFocus
        />
        <div className="flex gap-3">
          <Button variant="primary" onClick={confirmEnable} isLoading={isLoading} disabled={code.length !== 6} className="flex-1">
            Enable 2FA
          </Button>
          <Button variant="ghost" onClick={() => { setPhase('idle'); setCode(''); }}>Cancel</Button>
        </div>
      </div>
    );
  }

  if (phase === 'backup') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">2FA is now enabled!</span>
        </div>
        <div className="p-4 rounded-xl" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
          <p className="text-sm font-medium mb-3" style={{ color: 'rgb(253,224,71)' }}>
            ⚠️ Save these backup codes now — they won't be shown again.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((c) => (
              <code key={c} className="text-center text-xs font-mono px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid rgba(234,179,8,0.2)' }}>
                {c}
              </code>
            ))}
          </div>
        </div>
        <Button variant="primary" onClick={() => setPhase('idle')} className="w-full">I've saved my backup codes</Button>
      </div>
    );
  }

  if (phase === 'disabling') {
    return (
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Enter your current TOTP code (or a backup code) to disable 2FA.
        </p>
        <Input
          label="Verification code"
          type="text"
          inputMode="numeric"
          maxLength={8}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          autoFocus
        />
        <div className="flex gap-3">
          <Button variant="danger" onClick={disable2fa} isLoading={isLoading} disabled={code.length < 6} className="flex-1">Disable 2FA</Button>
          <Button variant="ghost" onClick={() => { setPhase('idle'); setCode(''); }}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium" style={{ color: 'var(--color-text)' }}>Two-Factor Authentication</p>
          {enabled
            ? <Badge variant="success"><ShieldCheck className="w-3 h-3 mr-1 inline" />Enabled</Badge>
            : <Badge variant="warning">Not enabled</Badge>
          }
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
          {enabled ? 'Your account is protected with an authenticator app.' : 'Protect your account with a TOTP authenticator app.'}
        </p>
      </div>
      {enabled ? (
        <Button variant="outline" size="sm" onClick={() => { setPhase('disabling'); setCode(''); }} leftIcon={<ShieldOff className="w-4 h-4" />}>Disable</Button>
      ) : (
        <Button variant="primary" size="sm" onClick={startSetup} isLoading={isLoading} leftIcon={<ShieldCheck className="w-4 h-4" />}>Enable</Button>
      )}
    </div>
  );
}

/* ── TOTP gate modal for recruiter upgrade ──────────────────── */
function RecruiterTOTPModal({
  targetType,
  onConfirm,
  onClose,
  loading,
  attemptsLeft,
  lockSeconds,
}: {
  targetType: 'candidate' | 'recruiter';
  onConfirm: (code: string) => void;
  onClose: () => void;
  loading: boolean;
  attemptsLeft: number | null;
  lockSeconds: number | null;
}) {
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(lockSeconds ?? 0);

  // Countdown timer when locked
  useEffect(() => {
    if (!lockSeconds) return;
    setCountdown(lockSeconds);
    const t = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(t); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [lockSeconds]);

  const isLocked = lockSeconds !== null;
  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && !isLocked && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="sp-card rounded-2xl w-full max-w-sm overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: isLocked ? 'rgba(239,68,68,0.15)' : 'rgba(111,205,224,0.15)', border: `1px solid ${isLocked ? 'rgba(239,68,68,0.3)' : 'rgba(111,205,224,0.3)'}` }}>
              <KeySquare className="w-4 h-4" style={{ color: isLocked ? '#ef4444' : '#6fcde0' }} />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                {isLocked ? 'Account Temporarily Locked' : 'Verify Identity'}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                {isLocked ? 'Too many failed TOTP attempts' : `Required to switch to ${targetType === 'recruiter' ? 'Recruiter' : 'Candidate'}`}
              </p>
            </div>
          </div>
          {!isLocked && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover-shade transition">
              <X className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {isLocked ? (
            <>
              <div className="rounded-xl p-4 text-center space-y-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-sm font-medium" style={{ color: '#ef4444' }}>
                  You have been locked out for too many incorrect TOTP attempts.
                </p>
                {countdown > 0 ? (
                  <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-text)' }}>
                    {mins}:{String(secs).padStart(2, '0')}
                  </p>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--color-muted)' }}>You may try again now.</p>
                )}
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                  Please wait before attempting again. If this wasn't you, contact support.
                </p>
              </div>
              <Button variant="secondary" className="w-full" onClick={onClose}>
                Close
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                For security, upgrading your account to <strong style={{ color: 'var(--color-text)' }}>Recruiter</strong> requires
                your current TOTP code from your authenticator app.
              </p>

              {attemptsLeft !== null && (
                <div className="rounded-xl px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span className="text-xs font-medium" style={{ color: '#ef4444' }}>
                    Incorrect code — {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining before lockout.
                  </span>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-muted)' }}>
                  Enter 6-digit code
                </p>
                {/* Display */}
                <div className="flex justify-center gap-2 mb-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i}
                      className="w-10 h-12 rounded-xl flex items-center justify-center text-lg font-bold transition"
                      style={{
                        background: 'var(--color-bg)',
                        border: `2px solid ${code[i] ? (attemptsLeft !== null ? '#ef4444' : 'var(--color-accent)') : 'var(--color-border)'}`,
                        color: 'var(--color-text)',
                      }}>
                      {code[i] || ''}
                    </div>
                  ))}
                </div>
                <VirtualKeypad value={code} onChange={setCode} maxLength={6} />
              </div>

              <Button
                variant="primary"
                className="w-full"
                disabled={code.length !== 6 || loading}
                isLoading={loading}
                onClick={() => { onConfirm(code); setCode(''); }}
              >
                Confirm &amp; Switch to Recruiter
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Granular Notification Preferences ─── */
const EMAIL_PREFS: { key: string; label: string; desc: string }[] = [
  { key: 'email.connections', label: 'Connection requests', desc: 'When someone sends you a connection request' },
  { key: 'email.messages', label: 'New messages', desc: 'When you receive a new message' },
  { key: 'email.jobAlerts', label: 'Job alerts', desc: 'New job postings matching your profile' },
  { key: 'email.postLikes', label: 'Post reactions', desc: 'When someone reacts to your post' },
  { key: 'email.comments', label: 'Comments', desc: 'When someone comments on your post' },
  { key: 'email.mentions', label: 'Mentions', desc: 'When you are mentioned in a post or comment' },
];
const PUSH_PREFS: { key: string; label: string; desc: string }[] = [
  { key: 'push.connections', label: 'Connection requests', desc: 'Browser push for connection requests' },
  { key: 'push.messages', label: 'New messages', desc: 'Browser push for incoming messages' },
  { key: 'push.postLikes', label: 'Post reactions', desc: 'Browser push for reactions on your posts' },
  { key: 'push.comments', label: 'Comments', desc: 'Browser push for comments on your posts' },
];

function NotificationPrefsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => apiService.users.getNotificationPrefs().then(r => r.data?.data ?? {}),
    staleTime: 60_000,
  });
  const [local, setLocal] = useState<Record<string, boolean>>({});
  useEffect(() => { if (data) setLocal(data); }, [data]);

  const saveMut = useMutation({
    mutationFn: (prefs: Record<string, boolean>) => apiService.users.updateNotificationPrefs(prefs),
    onSuccess: () => { toast.success('Preferences saved'); qc.invalidateQueries({ queryKey: ['notification-prefs'] }); },
    onError: () => toast.error('Failed to save preferences'),
  });

  const toggle = (key: string) => setLocal(prev => ({ ...prev, [key]: !prev[key] }));
  const ToggleRow = ({ item }: { item: { key: string; label: string; desc: string } }) => (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
      <div>
        <p className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{item.label}</p>
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{item.desc}</p>
      </div>
      <Toggle checked={local[item.key] ?? true} onChange={() => toggle(item.key)} />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {isLoading ? (
        <div className="sp-card rounded-2xl p-8 text-center" style={{ color: 'var(--color-muted)' }}>Loading…</div>
      ) : (
        <>
          <div className="sp-card rounded-2xl">
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Email Notifications</h2>
              </div>
            </div>
            <div className="px-6 pb-2">
              {EMAIL_PREFS.map(item => <ToggleRow key={item.key} item={item} />)}
            </div>
          </div>
          <div className="sp-card rounded-2xl">
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Push Notifications</h2>
              </div>
            </div>
            <div className="px-6 pb-2">
              {PUSH_PREFS.map(item => <ToggleRow key={item.key} item={item} />)}
            </div>
          </div>
          <Button onClick={() => saveMut.mutate(local)} disabled={saveMut.isPending} className="w-full">
            {saveMut.isPending ? 'Saving…' : 'Save Notification Preferences'}
          </Button>
        </>
      )}
    </motion.div>
  );
}

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState('account');
  const [switchingAccountType, setSwitchingAccountType] = useState(false);
  const [showRecruiterTOTP, setShowRecruiterTOTP] = useState(false);
  const [pendingAccountType, setPendingAccountType] = useState<'candidate' | 'recruiter' | null>(null);
  const [totpAttemptsLeft, setTotpAttemptsLeft] = useState<number | null>(null);
  const [totpLockSeconds, setTotpLockSeconds] = useState<number | null>(null);
  const [settings, setSettings] = useState({
    emailNotifications: user?.settings?.emailNotifications ?? true,
    pushNotifications: true,
    profileVisibility: user?.settings?.profileVisibility ?? 'public',
    showOnlineStatus: true,
    darkMode: theme === 'dark',
  });

  // Field-level privacy settings
  const defaultPrivacy = {
    email: 'private' as const,
    phone: 'private' as const,
    headline: 'public' as const,
    about: 'public' as const,
    experience: 'public' as const,
    education: 'public' as const,
    skills: 'public' as const,
    connections: 'connections' as const,
    resume: 'private' as const,
  };
  type PrivacyLevel = 'public' | 'connections' | 'private';
  type PrivacyField = keyof typeof defaultPrivacy;
  const [privacySettings, setPrivacySettings] = useState<Record<PrivacyField, PrivacyLevel>>(
    (user?.privacySettings as Record<PrivacyField, PrivacyLevel> | undefined) ?? defaultPrivacy
  );
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteTotpCode, setDeleteTotpCode] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteAccount = async () => {
    if (!deletePassword || deleteTotpCode.length !== 6) {
      toast.error('Enter your password and 6-digit TOTP code');
      return;
    }
    setDeleteLoading(true);
    try {
      await apiService.users.deleteAccount(deletePassword, deleteTotpCode);
      toast.success('Account deleted');
      await logout();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Deletion failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSavePrivacy = async () => {
    setSavingPrivacy(true);
    try {
      await apiService.users.updatePrivacy(privacySettings as Record<string, string>);
      toast.success('Privacy settings saved');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to save privacy settings');
    } finally {
      setSavingPrivacy(false);
    }
  };

  // Treat missing accountType (pre-migration users) as 'candidate'
  const currentType: 'candidate' | 'recruiter' = user?.accountType ?? 'candidate';

  const handleAccountTypeSwitch = (newType: 'candidate' | 'recruiter') => {
    if (newType === currentType) return;           // already on this type — no-op
    // TOTP required for any account type change
    setTotpAttemptsLeft(null);
    setTotpLockSeconds(null);
    setPendingAccountType(newType);
    setShowRecruiterTOTP(true);
  };

  const doSwitch = async (newType: 'candidate' | 'recruiter', totpCode?: string) => {
    setSwitchingAccountType(true);
    try {
      await apiService.users.switchAccountType(newType, totpCode);
      await refreshUser();
      toast.success(`Switched to ${newType === 'recruiter' ? 'Recruiter' : 'Candidate'} mode!`);
      setShowRecruiterTOTP(false);
      setTotpAttemptsLeft(null);
      setTotpLockSeconds(null);
      setPendingAccountType(null);
    } catch (e: any) {
      const status = e?.response?.status;
      const data = e?.response?.data;

      if (status === 422) {
        // Wrong TOTP — show attempts remaining inside the modal (don't close it)
        setTotpAttemptsLeft(data?.attemptsLeft ?? null);
      } else if (status === 429) {
        // Locked out — show countdown inside the modal
        setTotpLockSeconds(data?.lockSeconds ?? 900);
      } else {
        toast.error(data?.message || 'Failed to switch account type');
        setShowRecruiterTOTP(false);
        setPendingAccountType(null);
      }
    } finally {
      setSwitchingAccountType(false);
    }
  };

  return (
    <>
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>Settings</h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Manage your account settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="md:col-span-1">
          <div className="sp-card rounded-2xl p-2">
            <nav className="space-y-1">
              {settingsSections.map((section) => {
                const Icon = section.icon;
                const active = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition"
                    style={{
                      background: active ? 'rgba(124,111,224,0.15)' : 'transparent',
                      color: active ? 'var(--color-accent)' : 'var(--color-muted)',
                    }}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {section.name}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 space-y-6">
          {/* Account Settings */}
          {activeSection === 'account' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="sp-card rounded-2xl">
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Account Settings</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="First Name" defaultValue={user?.firstName} />
                    <Input label="Last Name" defaultValue={user?.lastName} />
                  </div>
                  <Input label="Email" type="email" defaultValue={user?.email} />
                  <Input label="Headline" defaultValue={user?.headline} placeholder="e.g., Software Engineer at Tech Corp" />
                  <Button variant="primary" leftIcon={<Save className="w-4 h-4" />}>Save Changes</Button>
                </div>
              </div>

              <div className="sp-card rounded-2xl">
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Data & Privacy</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--color-text)' }}>Download your data</p>
                      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Get a copy of your profile and activity</p>
                    </div>
                    <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />}>Download</Button>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-red-400">Delete account</p>
                      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Permanently delete your account and all data</p>
                    </div>
                    <Button variant="danger" size="sm" leftIcon={<Trash2 className="w-4 h-4" />}
                      onClick={() => setShowDeleteModal(true)}>Delete</Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Account Type */}
          {activeSection === 'account-type' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="sp-card rounded-2xl">
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Account Type</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
                    Choose your mode. You can switch at any time.
                  </p>
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Candidate card */}
                  <button
                    onClick={() => handleAccountTypeSwitch('candidate')}
                    disabled={switchingAccountType || currentType === 'candidate'}
                    className="relative p-5 rounded-2xl text-left transition-all duration-200 disabled:cursor-default disabled:pointer-events-none"
                    style={{
                      border: `2px solid ${currentType === 'candidate' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      background: currentType === 'candidate' ? 'rgba(124,111,224,0.08)' : 'var(--color-bg)',
                      opacity: switchingAccountType ? 0.7 : 1,
                    }}
                  >
                    {currentType === 'candidate' && (
                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--color-accent)' }}>
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </span>
                    )}
                    <GraduationCap className="w-8 h-8 mb-3" style={{ color: currentType === 'candidate' ? 'var(--color-accent)' : 'var(--color-muted)' }} />
                    <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Candidate</p>
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Browse and apply for jobs posted on the platform.</p>
                    <div className="mt-3 space-y-1 text-xs" style={{ color: 'var(--color-dim)' }}>
                      <div>✓ Browse all job listings</div>
                      <div>✓ Apply for jobs</div>
                      <div>✓ Track your applications</div>
                    </div>
                  </button>

                  {/* Recruiter card */}
                  <button
                    onClick={() => handleAccountTypeSwitch('recruiter')}
                    disabled={switchingAccountType || currentType === 'recruiter'}
                    className="relative p-5 rounded-2xl text-left transition-all duration-200 disabled:cursor-default disabled:pointer-events-none"
                    style={{
                      border: `2px solid ${currentType === 'recruiter' ? '#6fcde0' : 'var(--color-border)'}`,
                      background: currentType === 'recruiter' ? 'rgba(111,205,224,0.08)' : 'var(--color-bg)',
                      opacity: switchingAccountType ? 0.7 : 1,
                    }}
                  >
                    {currentType === 'recruiter' && (
                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: '#6fcde0' }}>
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </span>
                    )}
                    <Briefcase className="w-8 h-8 mb-3" style={{ color: currentType === 'recruiter' ? '#6fcde0' : 'var(--color-muted)' }} />
                    <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Recruiter</p>
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Post jobs and find talent for your organization.</p>
                    <div className="mt-3 space-y-1 text-xs" style={{ color: 'var(--color-dim)' }}>
                      <div>✓ Post job listings</div>
                      <div>✓ View & manage applicants</div>
                      <div>✓ Browse candidate profiles</div>
                    </div>
                  </button>
                </div>

                <div className="px-6 pb-5">
                  <p className="text-xs rounded-xl p-3" style={{ background: 'var(--color-shade)', color: 'var(--color-dim)' }}>
                    💡 Your account type only controls job posting access. Your profile, connections, and posts are shared across both modes.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Security Settings */}
          {activeSection === 'security' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="sp-card rounded-2xl">
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Password & Security</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--color-text)' }}>Password</p>
                      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Change your account password</p>
                    </div>
                    <Button variant="outline" size="sm" leftIcon={<Lock className="w-4 h-4" />}>Change</Button>
                  </div>

                  <div className="py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <TwoFactorSection enabled={!!user?.twoFactorEnabled} onRefresh={refreshUser} />
                  </div>

                  <div className="py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium" style={{ color: 'var(--color-text)' }}>Email Verification</p>
                      {user?.isVerified
                        ? <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1 inline" />Verified</Badge>
                        : <Badge variant="warning">Not verified</Badge>
                      }
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                      {user?.isVerified ? 'Your email address is verified.' : 'Please verify your email address to unlock all features.'}
                    </p>
                    {!user?.isVerified && (
                      <Button variant="outline" size="sm" className="mt-3" leftIcon={<Mail className="w-4 h-4" />}
                        onClick={async () => {
                          try { await api.post('/auth/resend-verification'); toast.success('Verification email sent!'); }
                          catch (e: any) { toast.error(e?.response?.data?.message || 'Failed to send email'); }
                        }}>
                        Resend Verification Email
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Privacy Settings */}
          {activeSection === 'privacy' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="sp-card rounded-2xl">
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Privacy Settings</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>Control who can see each part of your profile</p>
                </div>
                <div className="p-6 space-y-6">
                  {/* Profile-wide visibility */}
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--color-muted)' }}>
                      Profile Visibility
                    </label>
                    <select
                      value={settings.profileVisibility}
                      onChange={(e) => setSettings({ ...settings, profileVisibility: e.target.value as 'public' | 'connections' | 'private' })}
                      className="w-full px-4 py-2.5 text-sm rounded-xl outline-none"
                      style={{ background: 'var(--color-bg)', border: '1px solid var(--color-shade-md)', color: 'var(--color-text)' }}
                    >
                      <option value="public">Public - Anyone can see your profile</option>
                      <option value="connections">Connections - Only connections can see</option>
                      <option value="private">Private - Limited visibility</option>
                    </select>
                  </div>

                  {/* Online status toggle */}
                  <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--color-text)' }}>Show online status</p>
                      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Let others see when you're active</p>
                    </div>
                    <Toggle checked={settings.showOnlineStatus} onChange={() => setSettings({ ...settings, showOnlineStatus: !settings.showOnlineStatus })} />
                  </div>

                  {/* Field-level privacy */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-muted)' }}>
                      Field-Level Privacy
                    </p>
                    <div className="space-y-4">
                      {(
                        [
                          { key: 'email', label: 'Email Address' },
                          { key: 'phone', label: 'Phone Number' },
                          { key: 'headline', label: 'Headline' },
                          { key: 'about', label: 'About / Bio' },
                          { key: 'experience', label: 'Experience' },
                          { key: 'education', label: 'Education' },
                          { key: 'skills', label: 'Skills' },
                          { key: 'connections', label: 'Connections List' },
                          { key: 'resume', label: 'Resume' },
                        ] as { key: PrivacyField; label: string }[]
                      ).map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{label}</p>
                          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                            {(['public', 'connections', 'private'] as PrivacyLevel[]).map((level) => {
                              const active = privacySettings[key] === level;
                              return (
                                <button
                                  key={level}
                                  type="button"
                                  onClick={() => setPrivacySettings({ ...privacySettings, [key]: level })}
                                  className="px-3 py-1.5 text-xs font-medium transition-colors"
                                  style={{
                                    background: active ? 'var(--color-accent)' : 'transparent',
                                    color: active ? '#fff' : 'var(--color-muted)',
                                    borderRight: level !== 'private' ? '1px solid var(--color-border)' : 'none',
                                  }}
                                >
                                  {level.charAt(0).toUpperCase() + level.slice(1)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    leftIcon={savingPrivacy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    onClick={handleSavePrivacy}
                    disabled={savingPrivacy}
                  >
                    Save Privacy Settings
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Notification Settings */}
          {activeSection === 'notifications' && (
            <NotificationPrefsSection />
          )}

          {/* Appearance Settings */}
          {activeSection === 'appearance' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="sp-card rounded-2xl">
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Appearance Settings</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Moon className="w-5 h-5" style={{ color: theme === 'dark' ? 'var(--color-accent)' : 'var(--color-dim)' }} />
                      <div>
                        <p className="font-medium" style={{ color: 'var(--color-text)' }}>Dark Mode</p>
                        <p className="text-sm capitalize" style={{ color: 'var(--color-muted)' }}>Currently: {theme}</p>
                      </div>
                    </div>
                    <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
                  </div>
                  <div className="pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                      Dark mode reduces eye strain and is easier on the battery for OLED screens.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>

    {/* TOTP verification modal for recruiter upgrade */}
    <AnimatePresence>
      {showRecruiterTOTP && pendingAccountType && (
        <RecruiterTOTPModal
          targetType={pendingAccountType}
          onConfirm={(code) => doSwitch(pendingAccountType, code)}
          onClose={() => { setShowRecruiterTOTP(false); setTotpAttemptsLeft(null); setTotpLockSeconds(null); setPendingAccountType(null); }}
          loading={switchingAccountType}
          attemptsLeft={totpAttemptsLeft}
          lockSeconds={totpLockSeconds}
        />
      )}
    </AnimatePresence>

    {/* Delete Account Modal */}
    <AnimatePresence>
      {showDeleteModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: 'var(--color-card)', border: '1px solid #f8717140' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-red-400">Delete Account</h3>
              </div>
              <button onClick={() => setShowDeleteModal(false)} className="p-1 rounded-lg hover-shade">
                <X className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
              </button>
            </div>
            <p className="text-sm mb-5" style={{ color: 'var(--color-muted)' }}>
              This is permanent and cannot be undone. All your data will be deleted. Please confirm with your password and authenticator code.
            </p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-muted)' }}>Current Password</label>
                <input type="password" placeholder="Enter your password" value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm"
                  style={{ background: 'var(--color-input-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', outline: 'none' }} />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-muted)' }}>Authenticator Code (6 digits)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                  placeholder="000000" value={deleteTotpCode}
                  onChange={e => setDeleteTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-2.5 rounded-xl text-center text-xl font-mono tracking-widest"
                  style={{ background: 'var(--color-input-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', outline: 'none' }} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold sp-hover"
                style={{ color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
                Cancel
              </button>
              <button onClick={handleDeleteAccount}
                disabled={!deletePassword || deleteTotpCode.length !== 6 || deleteLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition"
                style={{ background: '#ef4444', color: 'white', opacity: (!deletePassword || deleteTotpCode.length !== 6) ? 0.5 : 1 }}>
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete Forever
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}


