import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Users,
  Briefcase,
  MessageSquare,
  Settings,
  LogOut,
  Shield,
  Compass,
  Bookmark,
  Search,
  X,
} from 'lucide-react';
import { ThemeToggle } from '@stores/themeStore';
import { useAuth } from '@stores/authStore';
import { useState } from 'react';
import { useE2EKeys } from '@hooks/useE2EKeys';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@services/api';
import NotificationsDropdown from './NotificationsDropdown';

const navItems = [
  { name: 'Home',    href: '/',          icon: Home },
  { name: 'Network', href: '/network',   icon: Users },
  { name: 'Messages',href: '/messaging', icon: MessageSquare, badge: true },
  { name: 'Jobs',    href: '/jobs',      icon: Briefcase },
  { name: 'Explore', href: '/network',   icon: Compass },
  { name: 'Saved',   href: '/jobs',      icon: Bookmark },
];

const PAGE_LABELS: Record<string, string> = {
  '/':             'Feed',
  '/network':      'Network',
  '/jobs':         'Jobs',
  '/messaging':    'Messages',
  '/notifications':'Notifications',
  '/settings':     'Settings',
  '/admin':        'Admin',
};

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize E2E encryption key pair (background, non-blocking)
  useE2EKeys();

  // Real-time badge counts
  const { data: notifCount } = useQuery({
    queryKey: ['unread-notif-count'],
    queryFn: () => apiService.notifications.getUnreadCount().then(r => r.data?.data?.count ?? 0),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: msgCount } = useQuery({
    queryKey: ['unread-msg-count'],
    queryFn: () => apiService.messages.getUnreadCount().then(r => r.data?.data?.count ?? 0),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const unreadNotif = notifCount ?? 0;
  const unreadMsg = msgCount ?? 0;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const pageLabel = PAGE_LABELS[location.pathname] ||
    (location.pathname.startsWith('/profile') ? 'Profile' : 'Nexus');

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : 'U';

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      {/* ── Ambient background blobs ── */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-blob ambient-blob-1" />
        <div className="ambient-blob ambient-blob-2" />
        <div className="ambient-blob ambient-blob-3" />
      </div>

      {/* ── Left Dock ── */}
      <nav
        className="fixed left-0 top-0 bottom-0 z-50 flex flex-col items-center py-5 gap-1"
        style={{
          width: 'var(--dock-width)',
          background: 'var(--dock-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid var(--dock-border)',
        }}
      >
        {/* Logo */}
        <Link
          to="/"
          className="w-9 h-9 rounded-xl flex items-center justify-center mb-5 font-bold text-lg"
          style={{
            background: 'linear-gradient(135deg, #7c6fe0, #e06fbc)',
            color: 'white',
            boxShadow: '0 4px 20px rgba(124,111,224,0.4)',
          }}
          title="Nexus"
        >
          N
        </Link>

        {/* Main nav items */}
        {navItems.slice(0, 5).map((item) => {
          const isActive = location.pathname === item.href ||
            (item.href !== '/' && location.pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              to={item.href}
              title={item.name}
              className="relative w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200 group"
              style={{
                background: isActive ? 'rgba(124,111,224,0.18)' : 'transparent',
                color: isActive ? '#9d94f0' : '#6a6a8a',
                boxShadow: isActive ? 'inset 0 0 0 1px rgba(124,111,224,0.35)' : 'none',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(124,111,224,0.1)';
                  (e.currentTarget as HTMLElement).style.color = '#9d94f0';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = '#6a6a8a';
                }
              }}
            >
              <item.icon className="w-5 h-5" />
              {item.badge && unreadMsg > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 min-w-[14px] h-3.5 flex items-center justify-center text-white text-[8px] font-bold rounded-full px-0.5"
                  style={{ background: '#e06fbc', border: '2px solid var(--color-bg)' }}
                >
                  {unreadMsg > 99 ? '99+' : unreadMsg}
                </span>
              )}
              {/* Tooltip */}
              <span
                className="absolute left-full ml-2 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150"
                style={{
                  background: 'var(--tooltip-bg)',
                  border: '1px solid var(--dock-border)',
                  color: 'var(--color-text)',
                  zIndex: 60,
                }}
              >
                {item.name}
              </span>
            </Link>
          );
        })}

        {/* Divider */}
        <div className="w-7 h-px my-1" style={{ background: 'var(--dock-border)' }} />

        {/* Secondary nav */}
        {navItems.slice(5).map((item) => (
          <Link
            key={item.name}
            to={item.href}
            title={item.name}
            className="relative w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200 group"
            style={{ color: '#4a4a6a' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(124,111,224,0.1)';
              (e.currentTarget as HTMLElement).style.color = '#9d94f0';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = '#4a4a6a';
            }}
          >
            <item.icon className="w-5 h-5" />
            <span
              className="absolute left-full ml-2 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
              style={{
                background: 'var(--tooltip-bg)',
                border: '1px solid var(--dock-border)',
                color: 'var(--color-text)',
                zIndex: 60,
              }}
            >
              {item.name}
            </span>
          </Link>
        ))}

        {/* Bottom: settings + avatar */}
        <div className="mt-auto flex flex-col items-center gap-2">
          <Link
            to="/settings"
            title="Settings"
            className="w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200"
            style={{ color: '#4a4a6a' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(124,111,224,0.1)';
              (e.currentTarget as HTMLElement).style.color = '#9d94f0';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = '#4a4a6a';
            }}
          >
            <Settings className="w-5 h-5" />
          </Link>

          {user?.role === 'admin' && (
            <Link
              to="/admin"
              title="Admin"
              className="w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200"
              style={{ color: '#e05555' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(224,85,85,0.1)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <Shield className="w-5 h-5" />
            </Link>
          )}

          {/* User avatar button */}
          <Link
            to={`/profile/${user?.id}`}
            title={user?.fullName ?? 'Profile'}
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, #1e1830, #2a2240)',
              border: '1.5px solid rgba(124,111,224,0.45)',
              color: '#9d94f0',
            }}
          >
            {user?.profilePicture ? (
              <img src={user.profilePicture} alt={initials} className="w-full h-full object-cover rounded-xl" />
            ) : (
              initials
            )}
          </Link>
        </div>
      </nav>

      {/* ── Top Header ── */}
      <header
        className="fixed top-0 right-0 z-40 flex items-center px-5 gap-3"
        style={{
          left: 'var(--dock-width)',
          height: 'var(--header-height)',
          background: 'var(--dock-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--dock-border)',
        }}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold" style={{ color: '#9d94f0', letterSpacing: '-0.3px' }}>
            Nexus
          </span>
          <span style={{ color: 'var(--color-dim)' }}>/</span>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
            {pageLabel}
          </span>
        </div>

        {/* Search */}
        <AnimatePresence>
          {searchOpen ? (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 rounded-xl overflow-hidden ml-auto"
              style={{
                background: 'rgba(19,19,31,0.9)',
                border: '1px solid rgba(124,111,224,0.4)',
                padding: '6px 14px',
              }}
            >
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-muted)' }} />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search people, posts, jobs…"
                className="flex-1 bg-transparent border-none outline-none text-sm"
                style={{ color: 'var(--color-text)', fontFamily: 'inherit' }}
              />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
                <X className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
              </button>
            </motion.div>
          ) : (
            <button
              className="ml-auto w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200"
              style={{
                background: 'rgba(26,26,46,0.6)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'var(--color-muted)',
              }}
              onClick={() => setSearchOpen(true)}
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          )}
        </AnimatePresence>

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Notifications dropdown */}
          <NotificationsDropdown badgeCount={unreadNotif} />

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200"
            style={{
              background: 'rgba(26,26,46,0.6)',
              border: '1px solid rgba(255,255,255,0.07)',
              color: 'var(--color-muted)',
            }}
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Page Content ── */}
      <main
        className="relative z-10 min-h-screen"
        style={{
          marginLeft: 'var(--dock-width)',
          marginTop: 'var(--header-height)',
          padding: '24px',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
