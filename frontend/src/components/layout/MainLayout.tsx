import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Users, Briefcase, MessageSquare, Settings, LogOut, Shield,
  Search, Bell, ChevronDown, Grid3x3,
} from 'lucide-react';
import { ThemeToggle } from '@stores/themeStore';
import { useAuth } from '@stores/authStore';
import { useState, useRef, useEffect } from 'react';
import { useE2EKeys } from '@hooks/useE2EKeys';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@services/api';

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [meOpen, setMeOpen] = useState(false);
  const meRef = useRef<HTMLDivElement>(null);

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

  const { data: pendingCount } = useQuery({
    queryKey: ['pending-connections-count'],
    queryFn: () =>
      apiService.connections.getPending().then(r => {
        const d = r.data?.data;
        if (Array.isArray(d)) return d.length;
        if (Array.isArray(d?.connections)) return (d.connections as unknown[]).length;
        return 0;
      }),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const unreadNotif = notifCount ?? 0;
  const unreadMsg = msgCount ?? 0;
  const pendingInvites = pendingCount ?? 0;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/network?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  // Close Me dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (meRef.current && !meRef.current.contains(e.target as Node)) {
        setMeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const checkActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : 'U';

  const centerNavItems = [
    { name: 'Home',          href: '/',              icon: Home,          badge: 0 },
    { name: 'My Network',    href: '/network',       icon: Users,         badge: pendingInvites },
    { name: 'Jobs',          href: '/jobs',          icon: Briefcase,     badge: 0 },
    { name: 'Messaging',     href: '/messaging',     icon: MessageSquare, badge: unreadMsg },
    { name: 'Notifications', href: '/notifications', icon: Bell,          badge: unreadNotif },
    { name: 'Work',          href: '/applications',  icon: Grid3x3,       badge: 0 },
  ];

  const mobileNavItems = centerNavItems.slice(0, 5);

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>

      {/* ── Top Navbar ── */}
      <nav
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          zIndex: 100,
          height: 'var(--nav-height)',
          background: 'var(--nav-bg)',
          borderBottom: '1px solid var(--nav-border)',
        }}
      >
        <div className="mx-auto flex items-center h-full px-4 gap-2" style={{ maxWidth: 1128 }}>

          {/* Logo */}
          <Link
            to="/"
            className="flex-shrink-0 flex items-center justify-center font-bold text-white rounded"
            style={{ width: 34, height: 34, background: '#0A66C2', fontSize: '1.1rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}
            title="Nexus"
          >
            N
          </Link>

          {/* Search bar */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex items-center gap-2 rounded-full px-3 py-1 ml-1"
            style={{
              background: 'var(--color-input-bg)',
              border: '1px solid var(--color-border)',
              maxWidth: 280,
              width: '100%',
            }}
          >
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="bg-transparent border-none outline-none text-sm w-full"
              style={{ color: 'var(--color-text)', fontFamily: 'inherit' }}
            />
          </form>

          {/* Center nav items */}
          <div className="hidden md:flex items-center flex-1 justify-center">
            {centerNavItems.map(item => (
              <Link
                key={item.name}
                to={item.href}
                className={`nav-item${checkActive(item.href) ? ' active' : ''}`}
              >
                <span className="relative inline-flex">
                  <item.icon className="w-5 h-5" />
                  {item.badge > 0 && (
                    <span
                      className="absolute -top-1 -right-2 min-w-[16px] h-4 flex items-center justify-center text-white rounded-full"
                      style={{ background: '#cc1016', fontSize: '9px', fontWeight: 700, padding: '0 3px' }}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </span>
                <span>{item.name}</span>
              </Link>
            ))}
          </div>

          {/* Right: Me dropdown + ThemeToggle */}
          <div className="ml-auto md:ml-0 flex items-center flex-shrink-0">
            {/* Vertical divider */}
            <div className="hidden md:block w-px h-6 mx-2" style={{ background: 'var(--color-border)' }} />

            {/* Me dropdown */}
            <div ref={meRef} className="relative">
              <button
                className={`nav-item${meOpen ? ' active' : ''}`}
                onClick={() => setMeOpen(o => !o)}
                style={{ minWidth: 56 }}
              >
                {user?.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={initials}
                    className="rounded-full object-cover flex-shrink-0"
                    style={{ width: 24, height: 24 }}
                  />
                ) : (
                  <span
                    className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ width: 24, height: 24, fontSize: 10, background: '#0A66C2' }}
                  >
                    {initials}
                  </span>
                )}
                <span className="flex items-center gap-0.5">
                  Me <ChevronDown className="w-3 h-3" />
                </span>
              </button>

              {meOpen && (
                <div
                  className="absolute right-0 top-full mt-0.5 rounded-lg overflow-hidden z-50"
                  style={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                    minWidth: 220,
                  }}
                >
                  <div className="px-4 pt-3 pb-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <p className="font-bold text-sm leading-tight" style={{ color: 'var(--color-text)' }}>
                      {user?.firstName} {user?.lastName}
                    </p>
                    {user?.headline && (
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--color-muted)' }}>
                        {user.headline}
                      </p>
                    )}
                    <Link
                      to={`/profile/${user?.id}`}
                      onClick={() => setMeOpen(false)}
                      className="block mt-2.5 text-xs font-semibold text-center py-1.5 rounded-full border transition-colors"
                      style={{ color: 'var(--color-accent)', borderColor: 'var(--color-accent)' }}
                    >
                      View Profile
                    </Link>
                  </div>
                  <div className="py-1">
                    <Link
                      to="/settings"
                      onClick={() => setMeOpen(false)}
                      className="sp-hover flex items-center gap-3 px-4 py-2.5 text-sm"
                      style={{ color: 'var(--color-text)', textDecoration: 'none' }}
                    >
                      <Settings className="w-4 h-4 flex-shrink-0" /> Settings
                    </Link>
                    {user?.role === 'admin' && (
                      <Link
                        to="/admin"
                        onClick={() => setMeOpen(false)}
                        className="sp-hover flex items-center gap-3 px-4 py-2.5 text-sm"
                        style={{ color: '#cc1016', textDecoration: 'none' }}
                      >
                        <Shield className="w-4 h-4 flex-shrink-0" /> Admin
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="sp-hover flex items-center gap-3 px-4 py-2.5 text-sm w-full text-left"
                      style={{ color: 'var(--color-text)' }}
                    >
                      <LogOut className="w-4 h-4 flex-shrink-0" /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Theme toggle */}
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* ── Mobile bottom tab bar ── */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around"
        style={{
          height: 'var(--nav-height)',
          background: 'var(--nav-bg)',
          borderTop: '1px solid var(--nav-border)',
        }}
      >
        {mobileNavItems.map(item => {
          const active = checkActive(item.href);
          return (
            <Link
              key={item.name}
              to={item.href}
              className="flex flex-col items-center justify-center flex-1 gap-0.5 relative"
              style={{
                color: active ? 'var(--color-text)' : 'var(--color-muted)',
                borderTop: active ? '2px solid var(--color-text)' : '2px solid transparent',
                fontSize: 10,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <span className="relative inline-flex">
                <item.icon className="w-5 h-5" />
                {item.badge > 0 && (
                  <span
                    className="absolute -top-1 -right-2 min-w-[14px] h-3.5 flex items-center justify-center text-white rounded-full"
                    style={{ background: '#cc1016', fontSize: '9px', fontWeight: 700, padding: '0 2px' }}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* ── Page Content ── */}
      <main style={{ paddingTop: 'var(--nav-height)' }}>
        <Outlet />
      </main>
    </div>
  );
}
