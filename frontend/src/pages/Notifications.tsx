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
  connection_request: <UserPlus className="w-4 h-4" style={{ color: '#9d94f0' }} />,
  connection_accepted: <UserPlus className="w-4 h-4 text-emerald-400" />,
  post_reaction: <Heart className="w-4 h-4" style={{ color: '#e06fbc' }} />,
  comment: <MessageCircle className="w-4 h-4 text-sky-400" />,
  job_application: <Briefcase className="w-4 h-4" style={{ color: '#9d94f0' }} />,
  message: <MessageCircle className="w-4 h-4 text-sky-400" />,
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-4 animate-pulse">
      <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 rounded-lg w-3/4" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="h-2 rounded-lg w-1/3" style={{ background: 'rgba(255,255,255,0.04)' }} />
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)', letterSpacing: '-0.3px' }}>Notifications</h1>
          {unread > 0 && (
            <span
              className="text-xs font-bold rounded-full px-2 py-0.5"
              style={{ background: 'rgba(224,111,188,0.2)', color: '#e06fbc', border: '1px solid rgba(224,111,188,0.3)' }}
            >
              {unread} new
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

      <Card className="overflow-hidden">
        {isLoading ? (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : isError ? (
          <div className="p-10 text-center">
            <p className="text-sm mb-3" style={{ color: 'var(--color-muted)' }}>Could not load notifications</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-dim)' }} />
            <p className="font-bold text-base mb-1" style={{ color: 'var(--color-text)' }}>No notifications yet</p>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Interactions will appear here</p>
          </div>
        ) : (
          <AnimatePresence>
            {notifications.map((n, idx) => (
              <motion.div
                key={n._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => { if (!n.read) markReadMutation.mutate(n._id); }}
                className="flex items-start gap-3 p-4 cursor-pointer transition-all duration-200"
                style={{
                  background: n.read ? 'transparent' : 'rgba(124,111,224,0.06)',
                  borderBottom: idx < notifications.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,111,224,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(124,111,224,0.06)')}
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
                      <span
                        className="absolute -bottom-0.5 -right-0.5 rounded-xl p-0.5"
                        style={{ background: 'var(--color-bg)' }}
                      >
                        {TYPE_ICON[n.type] ?? <Bell className="w-3 h-3" style={{ color: 'var(--color-dim)' }} />}
                      </span>
                    </>
                  ) : (
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    >
                      {TYPE_ICON[n.type] ?? <Bell className="w-4 h-4" style={{ color: 'var(--color-dim)' }} />}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                    {n.sender && (
                      <span className="font-semibold">{n.sender.firstName} {n.sender.lastName} </span>
                    )}
                    {n.message}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-dim)' }}>
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>

                {/* Unread dot */}
                {!n.read && (
                  <div
                    className="w-2 h-2 rounded-full shrink-0 mt-2"
                    style={{ background: '#9d94f0' }}
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </Card>
    </div>
  );
}
