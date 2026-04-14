import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  UserPlus,
  ThumbsUp,
  MessageCircle,
  Briefcase,
  Star,
  TrendingUp,
  Check,
  X,
  Bell,
} from 'lucide-react';
import { Card, CardContent } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Avatar } from '@components/ui/Avatar';
import { Badge } from '@components/ui/Badge';
import { cn } from '@utils/index';

// Mock notifications
const mockNotifications = [
  {
    id: '1',
    type: 'connection_request',
    actor: { name: 'Alex Johnson', avatar: null },
    message: 'wants to connect with you',
    time: '2m',
    read: false,
    action: 'pending',
  },
  {
    id: '2',
    type: 'connection_accepted',
    actor: { name: 'Maria Garcia', avatar: null },
    message: 'accepted your connection request',
    time: '1h',
    read: false,
  },
  {
    id: '3',
    type: 'post_reaction',
    actor: { name: 'Sarah Chen', avatar: null },
    message: 'liked your post',
    time: '3h',
    read: false,
    postPreview: 'Excited to share that I just completed...',
  },
  {
    id: '4',
    type: 'comment',
    actor: { name: 'John Doe', avatar: null },
    message: 'commented on your post',
    time: '5h',
    read: true,
    postPreview: 'Security Tip of the Day...',
  },
  {
    id: '5',
    type: 'job_application',
    actor: { name: 'Tech Corp', avatar: null, isCompany: true },
    message: 'received your application for Senior Software Engineer',
    time: '1d',
    read: true,
  },
  {
    id: '6',
    type: 'job_posted',
    actor: { name: 'CyberDefense Inc', avatar: null, isCompany: true },
    message: 'posted a new job: Security Engineer',
    time: '2d',
    read: true,
  },
];

const notificationIcons = {
  connection_request: UserPlus,
  connection_accepted: Check,
  post_reaction: ThumbsUp,
  comment: MessageCircle,
  job_application: Briefcase,
  job_posted: Star,
  mention: TrendingUp,
  system: Bell,
};

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filteredNotifications =
    filter === 'unread'
      ? mockNotifications.filter((n) => !n.read)
      : mockNotifications;

  const unreadCount = mockNotifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Notifications
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Stay updated with your network activity
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="primary" size="md">
            {unreadCount} new
          </Badge>
          <Button variant="ghost" size="sm">
            Mark all read
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 mb-4">
        <Button
          variant={filter === 'all' ? 'primary' : 'ghost'}
          onClick={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          variant={filter === 'unread' ? 'primary' : 'ghost'}
          onClick={() => setFilter('unread')}
        >
          Unread
        </Button>
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {filteredNotifications.map((notification, index) => {
          const Icon = notificationIcons[notification.type as keyof typeof notificationIcons];

          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                variant={notification.read ? 'default' : 'hover'}
                className={cn(!notification.read && 'border-l-4 border-l-linkedin-500')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-4">
                    <Avatar
                      name={notification.actor.name}
                      src={notification.actor.avatar}
                      size="md"
                    />
                    <div className="flex-1">
                      <p className="text-gray-900 dark:text-white">
                        <span className="font-semibold hover:text-linkedin-600 dark:hover:text-linkedin-400 cursor-pointer">
                          {notification.actor.name}
                        </span>{' '}
                        <span className="text-gray-600 dark:text-gray-400">
                          {notification.message}
                        </span>
                      </p>
                      {notification.postPreview && (
                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 line-clamp-1">
                          "{notification.postPreview}"
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500 dark:text-gray-500">
                          {notification.time}
                        </span>
                        {notification.action === 'pending' && (
                          <div className="flex space-x-2">
                            <Button variant="primary" size="sm" leftIcon={<Check className="w-4 h-4" />}>
                              Accept
                            </Button>
                            <Button variant="ghost" size="sm" leftIcon={<X className="w-4 h-4" />}>
                              Ignore
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-gray-400">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {filteredNotifications.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No notifications
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {filter === 'unread'
                ? "You're all caught up!"
                : "You don't have any notifications yet."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
