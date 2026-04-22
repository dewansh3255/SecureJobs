import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Bell, UserPlus, Heart, MessageCircle, Briefcase, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiService } from '@services/api';
import { Card } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Avatar } from '@components/ui/Avatar';

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  sender?: { _id: string; firstName: string; lastName: string; profilePicture?: string };
  read: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  connection_request: <UserPlus className="w-4 h-4 text-linkedin-600" />,
  connection_accepted: <UserPlus className="w-4 h-4 text-green-500" />,
  post_reaction: <Heart className="w-4 h-4 text-red-500" />,
  comment: <MessageCircle className="w-4 h-4 text-blue-500" />,
  job_application: <Briefcase className="w-4 h-4 text-purple-500" />,
  message: <MessageCircle className="w-4 h-4 text-indigo-500" />,
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-4 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-dark-700 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded w-3/4" />
        <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded w-1/3" />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiService.notifications.get(1, 50).then(r => r.data),
    staleTime: 20_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiService.notifications.markAsRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => apiService.notifications.markAllAsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
      toast.success('All notifications marked as read');
    },
  });

  const notifications: Notification[] = data?.data ?? [];
  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto pb-10 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-6 h-6 text-linkedin-600" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Notifications</h1>
          {unread > 0 && (
            <span className="bg-linkedin-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
              {unread}
            </span>
          )}
        </div>
        {unread > 0 && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<CheckCheck className="w-4 h-4" />}
            onClick={() => markAllMutation.mutate()}
            isLoading={markAllMutation.isPending}
          >
            Mark all read
          </Button>
        )}
      </div>

      <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-dark-700">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : isError ? (
          <div className="p-10 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-3">Could not load notifications</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="font-semibold text-gray-700 dark:text-gray-300">No notifications yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Interactions will appear here</p>
          </div>
        ) : (
          <AnimatePresence>
            {notifications.map(n => (
              <motion.div
                key={n._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => { if (!n.read) markReadMutation.mutate(n._id); }}
                className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${
                  n.read
                    ? 'bg-white dark:bg-dark-800'
                    : 'bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20'
                }`}
              >
                {/* Avatar or icon */}
                <div className="relative shrink-0">
                  {n.sender ? (
                    <>
                      <Avatar
                        name={`${n.sender.firstName} ${n.sender.lastName}`}
                        src={n.sender.profilePicture}
                        size="md"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 bg-white dark:bg-dark-800 rounded-full p-0.5">
                        {TYPE_ICON[n.type] ?? <Bell className="w-3 h-3 text-gray-400" />}
                      </span>
                    </>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
                      {TYPE_ICON[n.type] ?? <Bell className="w-4 h-4 text-gray-400" />}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {n.sender && (
                      <span className="font-semibold">{n.sender.firstName} {n.sender.lastName} </span>
                    )}
                    {n.message}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>

                {/* Unread dot */}
                {!n.read && (
                  <div className="w-2.5 h-2.5 rounded-full bg-linkedin-600 shrink-0 mt-1.5" />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </Card>
    </div>
  );
}
