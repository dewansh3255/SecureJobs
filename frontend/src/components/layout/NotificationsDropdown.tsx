/**
 * NotificationsDropdown
 * - Hover to peek (500ms delay so it doesn't trigger on accidental movers)
 * - Click to pin open / click outside to close
 * - Badge count fed from parent (from useQuery in MainLayout)
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, UserPlus, Heart, MessageCircle, Briefcase, CheckCheck, BellOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiService } from '@services/api';
import { Avatar } from '@components/ui/Avatar';
import { Link } from 'react-router-dom';

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
  connection_request:  <UserPlus  className="w-3.5 h-3.5" style={{ color: '#9d94f0' }} />,
  connection_accepted: <UserPlus  className="w-3.5 h-3.5 text-emerald-400" />,
  post_reaction:       <Heart     className="w-3.5 h-3.5" style={{ color: '#e06fbc' }} />,
  comment:             <MessageCircle className="w-3.5 h-3.5 text-sky-400" />,
  job_application:     <Briefcase className="w-3.5 h-3.5" style={{ color: '#9d94f0' }} />,
  message:             <MessageCircle className="w-3.5 h-3.5 text-sky-400" />,
};

interface Props { badgeCount: number }

export default function NotificationsDropdown({ badgeCount }: Props) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const isOpen = pinned || hovered;

  // Fetch notifications only when open
  const { data, isLoading } = useQuery({
    queryKey: ['notifications-dropdown'],
    queryFn: () => apiService.notifications.get(1, 20).then(r => r.data),
    staleTime: 30_000,
    enabled: isOpen,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiService.notifications.markAsRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-dropdown'] });
      qc.invalidateQueries({ queryKey: ['unread-notif-count'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => apiService.notifications.markAllAsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-dropdown'] });
      qc.invalidateQueries({ queryKey: ['unread-notif-count'] });
    },
  });

  // Click outside → unpin
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setPinned(false);
    }
  }, []);

  useEffect(() => {
    if (pinned) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pinned, handleClickOutside]);

  const handleMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(true), 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(false), 400);
  };

  const notifications: Notification[] = data?.data ?? [];
  const unread = notifications.filter(n => !n.read);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Bell button */}
      <button
        onClick={() => setPinned(prev => !prev)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200"
        style={{
          background: isOpen ? 'rgba(124,111,224,0.18)' : "var(--color-card)",
          border: `1px solid ${isOpen ? 'rgba(124,111,224,0.45)' : 'var(--color-border)'}`,
          color: isOpen ? '#9d94f0' : 'var(--color-muted)',
        }}
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {badgeCount > 0 && (
          <span
            className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 flex items-center justify-center text-white text-[8px] font-bold rounded-full px-0.5"
            style={{ background: '#e06fbc', border: '2px solid var(--color-bg)' }}
          >
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 rounded-2xl overflow-hidden z-50"
            style={{
              width: 360,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                  Notifications
                </span>
                {unread.length > 0 && (
                  <span
                    className="text-[10px] font-bold rounded-full px-1.5 py-0.5"
                    style={{ background: 'rgba(224,111,188,0.2)', color: '#e06fbc', border: '1px solid rgba(224,111,188,0.3)' }}
                  >
                    {unread.length} new
                  </span>
                )}
              </div>
              {unread.length > 0 && (
                <button
                  onClick={() => markAllMutation.mutate()}
                  disabled={markAllMutation.isPending}
                  className="flex items-center gap-1 text-xs font-medium transition-colors"
                  style={{ color: '#9d94f0' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#b3abf5'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#9d94f0'}
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-9 h-9 rounded-xl flex-shrink-0" style={{ background: 'var(--color-shade)' }} />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 rounded-lg w-3/4" style={{ background: 'var(--color-shade)' }} />
                        <div className="h-2 rounded-lg w-1/3" style={{ background: 'var(--color-shade)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-2">
                  <BellOff className="w-8 h-8" style={{ color: 'var(--color-dim)' }} />
                  <p className="text-sm" style={{ color: 'var(--color-muted)' }}>All caught up!</p>
                </div>
              ) : (
                notifications.map(n => (
                  <button
                    key={n._id}
                    onClick={() => { if (!n.read) markReadMutation.mutate(n._id); }}
                    className="w-full flex items-start gap-3 px-4 py-3 transition-all duration-150 text-left"
                    style={{
                      background: n.read ? 'transparent' : 'rgba(124,111,224,0.06)',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-shade)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = n.read ? 'transparent' : 'rgba(124,111,224,0.06)'}
                  >
                    {/* Avatar with icon badge */}
                    <div className="relative flex-shrink-0">
                      {n.sender ? (
                        <Avatar
                          name={`${n.sender.firstName} ${n.sender.lastName}`}
                          src={n.sender.profilePicture}
                          size="sm"
                        />
                      ) : (
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ background: 'rgba(124,111,224,0.18)' }}
                        >
                          <Bell className="w-4 h-4" style={{ color: '#9d94f0' }} />
                        </div>
                      )}
                      {TYPE_ICON[n.type] && (
                        <div
                          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
                        >
                          {TYPE_ICON[n.type]}
                        </div>
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-snug" style={{ color: 'var(--color-text)' }}>
                        {n.title}
                      </p>
                      <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--color-muted)' }}>
                        {n.message}
                      </p>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--color-dim)' }}>
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!n.read && (
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                        style={{ background: '#e06fbc' }}
                      />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid var(--color-border)' }}>
              <Link
                to="/notifications"
                onClick={() => setPinned(false)}
                className="block text-center py-2.5 text-xs font-semibold transition-colors"
                style={{ color: '#9d94f0' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#b3abf5'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#9d94f0'}
              >
                View all notifications →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
