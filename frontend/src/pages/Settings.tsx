import { useState } from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { useAuth } from '@stores/authStore';
import { useTheme } from '@stores/themeStore';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Badge } from '@components/ui/Badge';
import { toast } from 'sonner';
import api from '@services/api';

const settingsSections = [
  { id: 'account', name: 'Account', icon: User },
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
          <button onClick={copySecret} title="Copy secret" className="p-2 rounded-lg hover:bg-white/5 transition">
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

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState('account');
  const [settings, setSettings] = useState({
    emailNotifications: user?.settings?.emailNotifications ?? true,
    pushNotifications: true,
    profileVisibility: user?.settings?.profileVisibility ?? 'public',
    showOnlineStatus: true,
    darkMode: theme === 'dark',
  });

  return (
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
  );
}


