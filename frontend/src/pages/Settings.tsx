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
import { Card, CardContent, CardHeader } from '@components/ui/Card';
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
      className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-linkedin-500 focus:ring-offset-2 ${checked ? 'bg-linkedin-500' : 'bg-gray-300 dark:bg-dark-600'}`}
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
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Scan this QR code with <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app.
        </p>
        <div className="flex justify-center">
          <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 rounded-lg border border-gray-200 dark:border-dark-600" />
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-gray-100 dark:bg-dark-700 px-3 py-2 rounded-lg font-mono break-all">{secret}</code>
          <button onClick={copySecret} title="Copy secret" className="p-2 text-gray-500 hover:text-linkedin-600 transition-colors">
            {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Can't scan? Enter the code manually in your app.</p>
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
          <Button variant="ghost" onClick={() => { setPhase('idle'); setCode(''); }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'backup') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">2FA is now enabled!</span>
        </div>
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-3">
            ⚠️ Save these backup codes now — they won't be shown again.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((c) => (
              <code key={c} className="text-center text-xs font-mono bg-white dark:bg-dark-800 px-3 py-1.5 rounded border border-yellow-200 dark:border-yellow-800">
                {c}
              </code>
            ))}
          </div>
        </div>
        <Button variant="primary" onClick={() => setPhase('idle')} className="w-full">
          I've saved my backup codes
        </Button>
      </div>
    );
  }

  if (phase === 'disabling') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
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
          <Button variant="danger" onClick={disable2fa} isLoading={isLoading} disabled={code.length < 6} className="flex-1">
            Disable 2FA
          </Button>
          <Button variant="ghost" onClick={() => { setPhase('idle'); setCode(''); }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Idle state
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication</p>
          {enabled
            ? <Badge variant="success"><ShieldCheck className="w-3 h-3 mr-1 inline" />Enabled</Badge>
            : <Badge variant="warning">Not enabled</Badge>
          }
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {enabled
            ? 'Your account is protected with an authenticator app.'
            : 'Protect your account with a TOTP authenticator app.'}
        </p>
      </div>
      {enabled ? (
        <Button variant="outline" size="sm" onClick={() => { setPhase('disabling'); setCode(''); }} leftIcon={<ShieldOff className="w-4 h-4" />}>
          Disable
        </Button>
      ) : (
        <Button variant="primary" size="sm" onClick={startSetup} isLoading={isLoading} leftIcon={<ShieldCheck className="w-4 h-4" />}>
          Enable
        </Button>
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your account settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="md:col-span-1">
          <Card>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {settingsSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                        activeSection === section.id
                          ? 'bg-linkedin-50 dark:bg-linkedin-900/20 text-linkedin-600 dark:text-linkedin-400'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700'
                      }`}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {section.name}
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 space-y-6">
          {/* Account Settings */}
          {activeSection === 'account' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Account Settings</h2>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="First Name" defaultValue={user?.firstName} />
                    <Input label="Last Name" defaultValue={user?.lastName} />
                  </div>
                  <Input label="Email" type="email" defaultValue={user?.email} />
                  <Input label="Headline" defaultValue={user?.headline} placeholder="e.g., Software Engineer at Tech Corp" />
                  <div className="pt-4">
                    <Button variant="primary" leftIcon={<Save className="w-4 h-4" />}>Save Changes</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Data & Privacy</h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-dark-700">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Download your data</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Get a copy of your profile and activity</p>
                    </div>
                    <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />}>Download</Button>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-red-600 dark:text-red-400">Delete account</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Permanently delete your account and all data</p>
                    </div>
                    <Button variant="danger" size="sm" leftIcon={<Trash2 className="w-4 h-4" />}>Delete</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Security Settings */}
          {activeSection === 'security' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Password & Security</h2>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-dark-700">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Password</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Change your account password</p>
                    </div>
                    <Button variant="outline" size="sm" leftIcon={<Lock className="w-4 h-4" />}>Change</Button>
                  </div>

                  <div className="py-3 border-b border-gray-100 dark:border-dark-700">
                    <TwoFactorSection enabled={!!user?.twoFactorEnabled} onRefresh={refreshUser} />
                  </div>

                  <div className="py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium text-gray-900 dark:text-white">Email Verification</p>
                      {user?.isVerified
                        ? <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1 inline" />Verified</Badge>
                        : <Badge variant="warning">Not verified</Badge>
                      }
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {user?.isVerified
                        ? 'Your email address is verified.'
                        : 'Please verify your email address to unlock all features.'}
                    </p>
                    {!user?.isVerified && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        leftIcon={<Mail className="w-4 h-4" />}
                        onClick={async () => {
                          try {
                            await api.post('/auth/resend-verification');
                            toast.success('Verification email sent!');
                          } catch (e: any) {
                            toast.error(e?.response?.data?.message || 'Failed to send email');
                          }
                        }}
                      >
                        Resend Verification Email
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Privacy Settings */}
          {activeSection === 'privacy' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Privacy Settings</h2>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Profile Visibility
                    </label>
                    <select
                      value={settings.profileVisibility}
                      onChange={(e) => setSettings({ ...settings, profileVisibility: e.target.value as 'public' | 'connections' | 'private' })}
                      className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-linkedin-500"
                    >
                      <option value="public">Public - Anyone can see your profile</option>
                      <option value="connections">Connections - Only connections can see</option>
                      <option value="private">Private - Limited visibility</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-dark-700">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Show online status</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Let others see when you're active</p>
                    </div>
                    <Toggle checked={settings.showOnlineStatus} onChange={() => setSettings({ ...settings, showOnlineStatus: !settings.showOnlineStatus })} />
                  </div>
                  <div className="pt-4">
                    <Button variant="primary" leftIcon={<Save className="w-4 h-4" />}>Save Privacy Settings</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Notification Settings */}
          {activeSection === 'notifications' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notification Preferences</h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-dark-700">
                    <div className="flex items-center space-x-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Email notifications</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Receive updates via email</p>
                      </div>
                    </div>
                    <Toggle checked={settings.emailNotifications} onChange={() => setSettings({ ...settings, emailNotifications: !settings.emailNotifications })} />
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center space-x-3">
                      <Bell className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Push notifications</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Receive browser notifications</p>
                      </div>
                    </div>
                    <Toggle checked={settings.pushNotifications} onChange={() => setSettings({ ...settings, pushNotifications: !settings.pushNotifications })} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Appearance Settings */}
          {activeSection === 'appearance' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Appearance Settings</h2>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Moon className={`w-5 h-5 ${theme === 'dark' ? 'text-linkedin-500' : 'text-gray-400'}`} />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Currently: {theme}</p>
                      </div>
                    </div>
                    <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
                  </div>
                  <div className="pt-4 border-t border-gray-100 dark:border-dark-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Dark mode reduces eye strain and is easier on the battery for OLED screens.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}


