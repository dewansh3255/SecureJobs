import { useState } from 'react';
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
  onConfirm,
  onClose,
  loading,
}: {
  onConfirm: (code: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [code, setCode] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="sp-card rounded-2xl w-full max-w-sm overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(111,205,224,0.15)', border: '1px solid rgba(111,205,224,0.3)' }}>
              <KeySquare className="w-4 h-4" style={{ color: '#6fcde0' }} />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Verify Identity</p>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Required to switch to Recruiter</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover-shade transition">
            <X className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            For security, upgrading your account to <strong style={{ color: 'var(--color-text)' }}>Recruiter</strong> requires
            your current TOTP code from your authenticator app.
          </p>

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
                    border: `2px solid ${code[i] ? 'var(--color-accent)' : 'var(--color-border)'}`,
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
            onClick={() => onConfirm(code)}
          >
            Confirm &amp; Switch to Recruiter
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState('account');
  const [switchingAccountType, setSwitchingAccountType] = useState(false);
  const [showRecruiterTOTP, setShowRecruiterTOTP] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: user?.settings?.emailNotifications ?? true,
    pushNotifications: true,
    profileVisibility: user?.settings?.profileVisibility ?? 'public',
    showOnlineStatus: true,
    darkMode: theme === 'dark',
  });

  const handleAccountTypeSwitch = (newType: 'candidate' | 'recruiter') => {
    if (newType === user?.accountType) return;
    if (newType === 'recruiter') {
      // Always require TOTP for recruiter upgrade
      setShowRecruiterTOTP(true);
      return;
    }
    // Downgrade to candidate — no TOTP needed
    doSwitch('candidate');
  };

  const doSwitch = async (newType: 'candidate' | 'recruiter', totpCode?: string) => {
    setSwitchingAccountType(true);
    try {
      await apiService.users.switchAccountType(newType, totpCode);
      await refreshUser();
      toast.success(`Switched to ${newType === 'recruiter' ? 'Recruiter' : 'Candidate'} mode!`);
      setShowRecruiterTOTP(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to switch account type');
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
                    <Button variant="danger" size="sm" leftIcon={<Trash2 className="w-4 h-4" />}>Delete</Button>
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
                    disabled={switchingAccountType || user?.accountType === 'candidate'}
                    className="relative p-5 rounded-2xl text-left transition-all duration-200 disabled:cursor-default"
                    style={{
                      border: `2px solid ${user?.accountType === 'candidate' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      background: user?.accountType === 'candidate' ? 'rgba(124,111,224,0.08)' : 'var(--color-bg)',
                      opacity: switchingAccountType ? 0.7 : 1,
                    }}
                  >
                    {user?.accountType === 'candidate' && (
                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--color-accent)' }}>
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </span>
                    )}
                    <GraduationCap className="w-8 h-8 mb-3" style={{ color: user?.accountType === 'candidate' ? 'var(--color-accent)' : 'var(--color-muted)' }} />
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
                    disabled={switchingAccountType || user?.accountType === 'recruiter'}
                    className="relative p-5 rounded-2xl text-left transition-all duration-200 disabled:cursor-default"
                    style={{
                      border: `2px solid ${user?.accountType === 'recruiter' ? '#6fcde0' : 'var(--color-border)'}`,
                      background: user?.accountType === 'recruiter' ? 'rgba(111,205,224,0.08)' : 'var(--color-bg)',
                      opacity: switchingAccountType ? 0.7 : 1,
                    }}
                  >
                    {user?.accountType === 'recruiter' && (
                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: '#6fcde0' }}>
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </span>
                    )}
                    <Briefcase className="w-8 h-8 mb-3" style={{ color: user?.accountType === 'recruiter' ? '#6fcde0' : 'var(--color-muted)' }} />
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
                </div>
                <div className="p-6 space-y-6">
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
                  <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--color-text)' }}>Show online status</p>
                      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Let others see when you're active</p>
                    </div>
                    <Toggle checked={settings.showOnlineStatus} onChange={() => setSettings({ ...settings, showOnlineStatus: !settings.showOnlineStatus })} />
                  </div>
                  <Button variant="primary" leftIcon={<Save className="w-4 h-4" />}>Save Privacy Settings</Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Notification Settings */}
          {activeSection === 'notifications' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="sp-card rounded-2xl">
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Notification Preferences</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div className="flex items-center space-x-3">
                      <Mail className="w-5 h-5" style={{ color: 'var(--color-dim)' }} />
                      <div>
                        <p className="font-medium" style={{ color: 'var(--color-text)' }}>Email notifications</p>
                        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Receive updates via email</p>
                      </div>
                    </div>
                    <Toggle checked={settings.emailNotifications} onChange={() => setSettings({ ...settings, emailNotifications: !settings.emailNotifications })} />
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center space-x-3">
                      <Bell className="w-5 h-5" style={{ color: 'var(--color-dim)' }} />
                      <div>
                        <p className="font-medium" style={{ color: 'var(--color-text)' }}>Push notifications</p>
                        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Receive browser notifications</p>
                      </div>
                    </div>
                    <Toggle checked={settings.pushNotifications} onChange={() => setSettings({ ...settings, pushNotifications: !settings.pushNotifications })} />
                  </div>
                </div>
              </div>
            </motion.div>
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
      {showRecruiterTOTP && (
        <RecruiterTOTPModal
          onConfirm={(code) => doSwitch('recruiter', code)}
          onClose={() => setShowRecruiterTOTP(false)}
          loading={switchingAccountType}
        />
      )}
    </AnimatePresence>
    </>
  );
}


