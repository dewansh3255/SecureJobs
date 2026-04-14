import { useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Check, X, Users, Search } from 'lucide-react';
import { Card, CardContent } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Avatar } from '@components/ui/Avatar';
import { Badge } from '@components/ui/Badge';
import { Input } from '@components/ui/Input';

// Mock data
const mockPendingRequests = [
  {
    id: '1',
    name: 'Alex Johnson',
    headline: 'Full Stack Developer at StartupXYZ',
    mutualConnections: 12,
    avatar: null,
  },
  {
    id: '2',
    name: 'Maria Garcia',
    headline: 'Product Manager | MBA',
    mutualConnections: 8,
    avatar: null,
  },
];

const mockSuggestions = [
  {
    id: '3',
    name: 'David Kim',
    headline: 'DevOps Engineer',
    mutualConnections: 5,
    avatar: null,
  },
  {
    id: '4',
    name: 'Emily Watson',
    headline: 'UX Designer at Creative Agency',
    mutualConnections: 15,
    avatar: null,
  },
  {
    id: '5',
    name: 'Michael Brown',
    headline: 'Data Scientist | ML Engineer',
    mutualConnections: 3,
    avatar: null,
  },
];

const mockConnections = [
  {
    id: '6',
    name: 'Sarah Chen',
    headline: 'Security Researcher | CISSP',
    mutualConnections: 20,
    avatar: null,
    isOnline: true,
  },
  {
    id: '7',
    name: 'John Doe',
    headline: 'Software Engineer at Tech Corp',
    mutualConnections: 18,
    avatar: null,
    isOnline: false,
  },
];

export default function NetworkPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'connections' | 'suggestions'>('pending');

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          My Network
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Grow your professional network and discover opportunities
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card variant="hover">
          <CardContent className="py-4 px-4 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-linkedin-500" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {mockConnections.length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Connections</p>
          </CardContent>
        </Card>
        <Card variant="hover">
          <CardContent className="py-4 px-4 text-center">
            <UserPlus className="w-8 h-8 mx-auto mb-2 text-linkedin-500" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {mockPendingRequests.length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Pending Requests</p>
          </CardContent>
        </Card>
        <Card variant="hover">
          <CardContent className="py-4 px-4 text-center">
            <Badge variant="primary" size="md" className="text-lg">
              2nd
            </Badge>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
              500+
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">2nd Degree</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <Input
            placeholder="Search by name, email, or company"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-5 h-5" />}
          />
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex space-x-2 mb-4">
        <Button
          variant={activeTab === 'pending' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('pending')}
        >
          Pending ({mockPendingRequests.length})
        </Button>
        <Button
          variant={activeTab === 'connections' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('connections')}
        >
          Connections ({mockConnections.length})
        </Button>
        <Button
          variant={activeTab === 'suggestions' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('suggestions')}
        >
          Suggestions
        </Button>
      </div>

      {/* Content */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {mockPendingRequests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  No pending connection requests
                </p>
              </CardContent>
            </Card>
          ) : (
            mockPendingRequests.map((request) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Avatar name={request.name} size="lg" />
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {request.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {request.headline}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            {request.mutualConnections} mutual connections
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="primary" size="sm" leftIcon={<Check className="w-4 h-4" />}>
                          Accept
                        </Button>
                        <Button variant="ghost" size="sm" leftIcon={<X className="w-4 h-4" />}>
                          Ignore
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      )}

      {activeTab === 'connections' && (
        <div className="space-y-3">
          {mockConnections.map((connection) => (
            <motion.div key={connection.id}>
              <Card variant="hover">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Avatar
                        name={connection.name}
                        size="lg"
                        isOnline={connection.isOnline}
                      />
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white hover:text-linkedin-600 dark:hover:text-linkedin-400 cursor-pointer">
                          {connection.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {connection.headline}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {connection.mutualConnections} mutual connections
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Message
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {activeTab === 'suggestions' && (
        <div className="space-y-3">
          {mockSuggestions.map((suggestion) => (
            <motion.div key={suggestion.id}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Avatar name={suggestion.name} size="lg" />
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {suggestion.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {suggestion.headline}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {suggestion.mutualConnections} mutual connections
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<UserPlus className="w-4 h-4" />}
                    >
                      Connect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
