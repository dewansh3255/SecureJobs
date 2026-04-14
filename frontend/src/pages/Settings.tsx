import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Shield,
  Eye,
  Mail,
  Lock,
  User,
  Globe,
  Trash2,
  Download,
  Save,
  Moon,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '@stores/authStore';
import { useTheme } from '@stores/themeStore';
import { Card, CardContent, CardHeader } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Badge } from '@components/ui/Badge';

const settingsSections = [
  { id: 'account', name: 'Account', icon: User },
  { id: 'privacy', name: 'Privacy', icon: Shield },
  { id: 'notifications', name: 'Notifications', icon: Bell },
  { id: 'appearance', name: 'Appearance', icon: Eye },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState('account');
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    profileVisibility: 'public',
    showOnlineStatus: true,
    darkMode: theme === 'dark',
  });

  const handleSave = () => {
    // Save settings logic
    console.log('Saving settings...', settings);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account settings and preferences
        </p>
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
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Account Settings
                  </h2>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="First Name"
                      defaultValue={user?.firstName}
                    />
                    <Input
                      label="Last Name"
                      defaultValue={user?.lastName}
                    />
                  </div>
                  <Input
                    label="Email"
                    type="email"
                    defaultValue={user?.email}
                  />
                  <Input
                    label="Headline"
                    defaultValue={user?.headline}
                    placeholder="e.g., Software Engineer at Tech Corp"
                  />
                  <div className="pt-4">
                    <Button variant="primary" leftIcon={<Save className="w-4 h-4" />}>
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Password & Security
                  </h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-dark-700">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Password</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Last changed 30 days ago
                      </p>
                    </div>
                    <Button variant="outline" size="sm" leftIcon={<Lock className="w-4 h-4" />}>
                      Change
                    </Button>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Add an extra layer of security
                      </p>
                    </div>
                    <Badge variant="warning">Not enabled</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Data & Privacy
                  </h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-dark-700">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Download your data</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Get a copy of your profile and activity
                      </p>
                    </div>
                    <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />}>
                      Download
                    </Button>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-red-600 dark:text-red-400">Delete account</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Permanently delete your account and all data
                      </p>
                    </div>
                    <Button variant="danger" size="sm" leftIcon={<Trash2 className="w-4 h-4" />}>
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Privacy Settings */}
          {activeSection === 'privacy' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Privacy Settings
                  </h2>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Profile Visibility
                    </label>
                    <select
                      value={settings.profileVisibility}
                      onChange={(e) =>
                        setSettings({ ...settings, profileVisibility: e.target.value })
                      }
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
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Let others see when you're active
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setSettings({ ...settings, showOnlineStatus: !settings.showOnlineStatus })
                      }
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        settings.showOnlineStatus ? 'bg-linkedin-500' : 'bg-gray-300 dark:bg-dark-600'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.showOnlineStatus ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="pt-4">
                    <Button variant="primary" leftIcon={<Save className="w-4 h-4" />}>
                      Save Privacy Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Notification Settings */}
          {activeSection === 'notifications' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Notification Preferences
                  </h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-dark-700">
                    <div className="flex items-center space-x-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Email notifications</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Receive updates via email
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setSettings({ ...settings, emailNotifications: !settings.emailNotifications })
                      }
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        settings.emailNotifications ? 'bg-linkedin-500' : 'bg-gray-300 dark:bg-dark-600'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.emailNotifications ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center space-x-3">
                      <Bell className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Push notifications</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Receive browser notifications
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setSettings({ ...settings, pushNotifications: !settings.pushNotifications })
                      }
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        settings.pushNotifications ? 'bg-linkedin-500' : 'bg-gray-300 dark:bg-dark-600'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          settings.pushNotifications ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Appearance Settings */}
          {activeSection === 'appearance' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Appearance Settings
                  </h2>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {theme === 'dark' ? (
                        <Moon className="w-5 h-5 text-linkedin-500" />
                      ) : (
                        <Globe className="w-5 h-5 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Toggle dark theme (currently: {theme})
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={toggleTheme}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        theme === 'dark' ? 'bg-linkedin-500' : 'bg-gray-300 dark:bg-dark-600'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          theme === 'dark' ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
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
