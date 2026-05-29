import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Bell, UserPlus, Heart, MessageCircle, Briefcase, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiService } from '@services/api';
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

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; bg: string }> = {
  connection_request: { icon: <UserPlus className="w-2.5 h-2.5 text-white" />, bg: '#0A66C2' },
  connection_accepted: { icon: <UserPlus className="w-2.5 h-2.5 text-white" />, bg: '#0A66C2' },
  post_reaction: { icon: <Heart className="w-2.5 h-2.5 text-white" />, bg: '#e06fbc' },
  comment: { icon: <MessageCircle className="w-2.5 h-2.5 text-white" />, bg: '#0A66C2' },
  job_application: { icon: <Briefcase className="w-2.5 h-2.5 text-white" />, bg: '#6b7280' },
  message: { icon: <MessageCircle className="w-2.5 h-2.5 text-white" />, bg: '#0A66C2' },
};

const TABS = ['All', 'My network', 'Jobs', 'Mentions'] as const;
type Tab = typeof TABS[number];

function SkeletonRow() {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 animate-pulse"
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: 'var(--color-shade)' }} />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 rounded-lg w-3/4" style={{ background: 'var(--color-shade)' }} />
        <div className="h-2.5 rounded-lg w-1/4" style={{ background: 'var(--color-shade)' }} />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('All');

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
    <div className="max-w-[860px] mx-auto px-4 pt-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)', letterSpacing: '-0.3px' }}>
          Notifications
        </h1>
        {unread > 0 && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<CheckCheck className="w-4 h-4" />}
            onClick={() => markAllMutation.mutate()}
            isLoading={markAllMutation.isPending}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Tab bar */}
      <div
        className="flex items-center gap-0 mb-4 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative"
            style={{
              color: activeTab === tab ? 'var(--color-accent)' : 'var(--color-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--color-accent)' : '2px solid transparent',
              background: 'transparent',
              marginBottom: -1,
            }}
          >
            {tab}
            {tab === 'All' && unread > 0 && (
              <span
                className="ml-1.5 inline-flex items-center justify-center text-xs font-bold rounded-full"
                style={{
                  background: 'var(--color-accent)',
                  color: 'white',
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  fontSize: 11,
                }}
              >
                {unread}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list card */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
      >
        {isLoading ? (
          <div>
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
            {notifications.map((n, idx) => {
              const cfg = TYPE_CONFIG[n.type];
              return (
                <motion.div
                  key={n._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => { if (!n.read) markReadMutation.mutate(n._id); }}
                  className="flex items-center gap-3 px-4 cursor-pointer transition-colors"
                  style={{
                    minHeight: 72,
                    paddingTop: 12,
                    paddingBottom: 12,
                    background: n.read ? 'transparent' : 'rgba(10,102,194,0.04)',
                    borderBottom: idx < notifications.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-shade)')}
                  onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(10,102,194,0.04)')}
                >
                  {/* Avatar + type icon badge */}
                  <div className="relative flex-shrink-0">
                    {n.sender ? (
                      <>
                        <Avatar
                          name={`${n.sender.firstName} ${n.sender.lastName}`}
                          src={n.sender.profilePicture}
                          size="md"
                        />
                        {cfg && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ background: cfg.bg, border: '1.5px solid var(--color-card)' }}
                          >
                            {cfg.icon}
                          </span>
                        )}
                      </>
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ background: cfg?.bg ?? 'var(--color-shade)' }}
                      >
                        {cfg?.icon ?? <Bell className="w-4 h-4 text-white" />}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug" style={{ color: 'var(--color-text)' }}>
                      {n.sender && (
                        <strong className="font-semibold">{n.sender.firstName} {n.sender.lastName} </strong>
                      )}
                      {n.message}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{
                        color: n.read ? 'var(--color-dim)' : 'var(--color-accent)',
                        fontWeight: n.read ? 400 : 600,
                      }}
                    >
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>

                  {/* Unread blue dot */}
                  {!n.read && (
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: 'var(--color-accent)' }}
                    />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
