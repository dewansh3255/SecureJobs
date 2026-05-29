/**
 * Admin Panel — Sexy sidebar-based dashboard with real-time stats.
 * Accessible only to users with role === 'admin'.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Users, FileText, Briefcase, ShieldAlert,
  BarChart3, Trash2, Shield,
  ChevronLeft, ChevronRight, RefreshCw,
  AlertTriangle, CheckCircle2, XCircle, Info,
  Search, Activity, Globe,
  UserCheck, Zap, Eye,
  ArrowUpRight, ArrowDownRight, Lock, Unlock,
  Clock, UserX, Link2, X as XIcon, Database,
} from 'lucide-react';
import { apiService } from '@services/api';
import { useAuth } from '@stores/authStore';
import { ThemeToggle } from '@stores/themeStore';
import { Button } from '@components/ui/Button';

type AdminSection = 'dashboard' | 'users' | 'posts' | 'jobs' | 'audit' | 'blockchain' | 'records';

const adminApi = apiService.admin;

/* ── Spinner ────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 rounded-full animate-spin" style={{
        border: '3px solid var(--color-shade-md)',
        borderTopColor: 'var(--color-accent)',
      }} />
    </div>
  );
}

/* ── Trend Stat Card ────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, accent, trend }: {
  icon: React.ElementType; label: string;
  value: number | string; sub?: string;
  accent: string; trend?: 'up' | 'down' | null;
}) {
  return (
    <motion.div whileHover={{ y: -2 }} className="sp-card rounded-2xl p-5 relative overflow-hidden group">
      {/* glow blob */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(ellipse at 60% 20%, ${accent}18 0%, transparent 65%)` }} />
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>{label}</p>
          <p className="text-3xl font-extrabold mt-1.5 tabular-nums" style={{ color: 'var(--color-text)' }}>{value}</p>
          {sub && (
            <p className="flex items-center gap-1 text-xs mt-1 font-medium" style={{ color: trend === 'down' ? '#f87171' : trend === 'up' ? '#34d399' : 'var(--color-dim)' }}>
              {trend === 'up' && <ArrowUpRight className="w-3 h-3" />}
              {trend === 'down' && <ArrowDownRight className="w-3 h-3" />}
              {sub}
            </p>
          )}
        </div>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}22`, border: `1px solid ${accent}40` }}>
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
      </div>
    </motion.div>
  );
}

/* ── Severity badge ─────────────────────────────────────────── */
function SeverityBadge({ severity }: { severity: string }) {
  if (severity === 'error')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: '#f8717120', color: '#f87171' }}>
        <XCircle className="w-3 h-3" /> Error
      </span>
    );
  if (severity === 'warn')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: '#fbbf2420', color: '#fbbf24' }}>
        <AlertTriangle className="w-3 h-3" /> Warn
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: '#60a5fa20', color: '#60a5fa' }}>
      <Info className="w-3 h-3" /> Info
    </span>
  );
}

/* ── Pagination bar ─────────────────────────────────────────── */
function Pagination({ page, pages, onPrev, onNext }: {
  page: number; pages: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-4 mt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
      <span className="text-sm" style={{ color: 'var(--color-muted)' }}>Page {page} of {pages || 1}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onPrev} disabled={page <= 1}
          leftIcon={<ChevronLeft className="w-4 h-4" />}>Prev</Button>
        <Button size="sm" variant="ghost" onClick={onNext} disabled={page >= (pages || 1)}
          rightIcon={<ChevronRight className="w-4 h-4" />}>Next</Button>
      </div>
    </div>
  );
}

/* ── Table wrapper ──────────────────────────────────────────── */
function TableWrap({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
      {loading && <Spinner />}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap"
      style={{ color: 'var(--color-muted)', background: 'var(--color-shade)', borderBottom: '1px solid var(--color-border)' }}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-5 py-3 ${className ?? ''}`} style={{ borderBottom: '1px solid var(--color-shade)', color: 'var(--color-text)' }}>
      {children}
    </td>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [section, setSection] = useState<AdminSection>('dashboard');
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [postPage, setPostPage] = useState(1);
  const [jobPage, setJobPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [auditSeverity, setAuditSeverity] = useState('');
  const [blockchainPage, setBlockchainPage] = useState(1);
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Records inspector state
  const [recordsCollection, setRecordsCollection] = useState<'users' | 'posts' | 'jobs'>('users');
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsSearch, setRecordsSearch] = useState('');

  if (user && user.role !== 'admin') {
    navigate('/', { replace: true });
    return null;
  }

  /* ── Queries ────────────────────────────────────────────── */
  const statsQ = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.stats(),
    staleTime: 30_000,
  });

  const usersQ = useQuery({
    queryKey: ['admin-users', userPage, userSearch],
    queryFn: () => adminApi.users({ page: userPage, limit: 15, search: userSearch }),
    enabled: section === 'users',
    placeholderData: (prev: any) => prev,
  });

  const postsQ = useQuery({
    queryKey: ['admin-posts', postPage],
    queryFn: () => adminApi.posts({ page: postPage, limit: 15 }),
    enabled: section === 'posts',
    placeholderData: (prev: any) => prev,
  });

  const jobsQ = useQuery({
    queryKey: ['admin-jobs', jobPage],
    queryFn: () => adminApi.jobs({ page: jobPage, limit: 15 }),
    enabled: section === 'jobs',
    placeholderData: (prev: any) => prev,
  });

  const auditQ = useQuery({
    queryKey: ['admin-audit', auditPage, auditSeverity],
    queryFn: () => adminApi.auditLogs({ page: auditPage, limit: 20, severity: auditSeverity }),
    enabled: section === 'audit',
    placeholderData: (prev: any) => prev,
  });

  const blocksQ = useQuery({
    queryKey: ['admin-blockchain', blockchainPage],
    queryFn: () => adminApi.blockchainBlocks({ page: blockchainPage, limit: 15 }),
    enabled: section === 'blockchain',
    placeholderData: (prev: any) => prev,
  });

  const blockchainVerifyQ = useQuery({
    queryKey: ['admin-blockchain-verify'],
    queryFn: () => adminApi.blockchainVerify(),
    enabled: false,
  });

  // Records inspector — reuses existing users/posts/jobs admin endpoints
  const recordsQ = useQuery({
    queryKey: ['admin-records', recordsCollection, recordsPage, recordsSearch],
    queryFn: () => {
      if (recordsCollection === 'users') return adminApi.users({ page: recordsPage, limit: 20, search: recordsSearch });
      if (recordsCollection === 'posts') return adminApi.posts({ page: recordsPage, limit: 20 });
      return adminApi.jobs({ page: recordsPage, limit: 20 });
    },
    enabled: section === 'records',
    placeholderData: (prev: any) => prev,
  });

  /* ── Mutations ──────────────────────────────────────────── */
  const banMut = useMutation({
    mutationFn: ({ id, banned }: { id: string; banned: boolean }) => adminApi.banUser(id, banned),
    onSuccess: (_, { banned }) => {
      toast.success(`User ${banned ? 'banned' : 'unbanned'}`);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => toast.error('Action failed'),
  });

  const deleteUserMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => { toast.success('User deleted'); qc.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: () => toast.error('Delete failed'),
  });

  const deletePostMut = useMutation({
    mutationFn: (id: string) => adminApi.deletePost(id),
    onSuccess: () => { toast.success('Post removed'); qc.invalidateQueries({ queryKey: ['admin-posts'] }); },
    onError: () => toast.error('Delete failed'),
  });

  const deleteJobMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteJob(id),
    onSuccess: () => { toast.success('Job removed'); qc.invalidateQueries({ queryKey: ['admin-jobs'] }); },
    onError: () => toast.error('Delete failed'),
  });

  const stats = statsQ.data?.data?.data;

  /* ── Nav items ──────────────────────────────────────────── */
  const navItems: { id: AdminSection; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users, badge: stats?.users?.total },
    { id: 'posts', label: 'Posts', icon: FileText, badge: stats?.posts?.total },
    { id: 'jobs', label: 'Jobs', icon: Briefcase, badge: stats?.jobs?.total },
    { id: 'audit', label: 'Audit Log', icon: ShieldAlert, badge: (stats?.security?.errorsToday ?? 0) || undefined },
    { id: 'blockchain', label: 'Blockchain', icon: Link2 },
    { id: 'records', label: 'Records', icon: Database },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>

      {/* ── Top Navigation Bar ────────────────────────────── */}
      <header className="flex items-center justify-between px-6 flex-shrink-0 z-20"
        style={{ height: '70px', background: 'var(--color-card)', borderBottom: '1px solid var(--color-border)' }}>
        {/* Left: logo */}
        <div className="flex items-center gap-2.5 min-w-[180px]">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c6fe0, #5b8ef5)' }}>
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold text-base tracking-tight"
            style={{ background: 'linear-gradient(135deg, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Nexus Admin
          </span>
        </div>

        {/* Center: section name */}
        <div className="flex-1 flex justify-center">
          <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted)' }}>
            {navItems.find(n => n.id === section)?.label ?? 'Admin'}
          </span>
        </div>

        {/* Right: avatar, theme toggle, exit */}
        <div className="flex items-center gap-3 min-w-[180px] justify-end">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #7c6fe0, #5b8ef5)', color: '#fff' }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <span className="text-sm font-medium hidden sm:block" style={{ color: 'var(--color-text)' }}>
              {user?.firstName}
            </span>
          </div>
          <ThemeToggle />
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
            style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
            <XIcon className="w-3.5 h-3.5" />
            Exit Admin
          </button>
        </div>
      </header>

      {/* ── Body: Sidebar + Content ───────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 240 : 64 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex-shrink-0 flex flex-col overflow-hidden z-10"
        style={{ background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}
      >
        {/* Sidebar header */}
        <div className="px-4 py-5 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7c6fe0, #5b8ef5)' }}>
            <Shield className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>Admin Panel</p>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Nexus Control Center</p>
            </motion.div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map(({ id, label, icon: Icon, badge }) => {
            const active = section === id;
            return (
              <button key={id} onClick={() => setSection(id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: active ? 'linear-gradient(135deg, rgba(124,111,224,0.25), rgba(91,142,245,0.15))' : 'transparent',
                  color: active ? 'var(--color-accent)' : 'var(--color-muted)',
                  border: active ? '1px solid rgba(124,111,224,0.3)' : '1px solid transparent',
                }}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 text-left whitespace-nowrap overflow-hidden">
                    {label}
                  </motion.span>
                )}
                {sidebarOpen && badge !== undefined && badge > 0 && (
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-bold"
                    style={{
                      background: id === 'audit' ? '#f8717130' : 'rgba(124,111,224,0.2)',
                      color: id === 'audit' ? '#f87171' : 'var(--color-accent)',
                    }}>
                    {badge > 999 ? '999+' : badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="px-2 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button onClick={() => setSidebarOpen(p => !p)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm transition hover-shade"
            style={{ color: 'var(--color-muted)' }}>
            {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {sidebarOpen && <span>Collapse</span>}
          </button>
        </div>
      </motion.aside>

      {/* ── Main content area ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Gradient banner header */}
        <div className="px-8 py-6 flex-shrink-0 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(124,111,224,0.15) 0%, rgba(91,142,245,0.08) 100%)', borderBottom: '1px solid var(--color-border)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse at 80% 50%, rgba(124,111,224,0.12) 0%, transparent 60%)',
          }} />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-extrabold" style={{ color: 'var(--color-text)' }}>
                  {navItems.find(n => n.id === section)?.label}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
                  style={{ background: 'rgba(124,111,224,0.2)', color: 'var(--color-accent)', border: '1px solid rgba(124,111,224,0.3)' }}>
                  Admin
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                {user?.firstName} {user?.lastName} · Platform Management
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => qc.invalidateQueries()}
                className="p-2 rounded-xl transition hover-shade" title="Refresh all data">
                <RefreshCw className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">

            {/* ═══════════════════════════════════════════════
                DASHBOARD SECTION
            ═══════════════════════════════════════════════ */}
            {section === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="space-y-8">

                {statsQ.isLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-28 rounded-2xl animate-pulse bg-shade" />
                    ))}
                  </div>
                ) : stats ? (
                  <>
                    {/* Primary stats row */}
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-muted)' }}>
                        Platform Overview
                      </h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        <StatCard icon={Users} label="Total Users" value={stats.users.total}
                          sub={`+${stats.users.newThisWeek ?? 0} this week`} accent="#60a5fa" trend="up" />
                        <StatCard icon={UserCheck} label="Recruiters" value={stats.users.recruiters ?? 0}
                          sub="Active hiring" accent="#a78bfa" />
                        <StatCard icon={FileText} label="Posts" value={stats.posts.total}
                          sub={`+${stats.posts.today} today`} accent="#34d399" trend={stats.posts.today > 0 ? 'up' : null} />
                        <StatCard icon={Briefcase} label="Active Jobs" value={stats.jobs.active ?? stats.jobs.total}
                          sub={`${stats.jobs.total} total`} accent="#f59e0b" />
                        <StatCard icon={Globe} label="Connections" value={stats.connections?.total ?? '—'}
                          sub="Total network links" accent="#818cf8" />
                        <StatCard icon={UserX} label="Banned Users" value={stats.users.banned}
                          accent="#f87171" />
                        <StatCard icon={Zap} label="Security Errors" value={stats.security.errorsToday}
                          sub="Today" accent="#f87171" trend={stats.security.errorsToday > 0 ? 'down' : null} />
                        <StatCard icon={AlertTriangle} label="Warnings" value={stats.security.warningsToday}
                          sub="Today" accent="#fbbf24" />
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-muted)' }}>
                        Quick Actions
                      </h2>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Manage Users', icon: Users, sec: 'users' as AdminSection, color: '#60a5fa' },
                          { label: 'Review Posts', icon: Eye, sec: 'posts' as AdminSection, color: '#34d399' },
                          { label: 'Review Jobs', icon: Briefcase, sec: 'jobs' as AdminSection, color: '#f59e0b' },
                          { label: 'Audit Log', icon: ShieldAlert, sec: 'audit' as AdminSection, color: '#f87171' },
                        ].map(({ label, icon: Icon, sec, color }) => (
                          <button key={sec} onClick={() => setSection(sec)}
                            className="sp-card rounded-2xl p-4 flex flex-col items-center gap-3 text-center transition group hover-shade"
                            style={{ border: '1px solid var(--color-border)' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center transition"
                              style={{ background: `${color}18` }}>
                              <Icon className="w-5 h-5 transition" style={{ color }} />
                            </div>
                            <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Security health strip */}
                    <div className="sp-card rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Security Health</h3>
                        <Activity className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: 'CSRF Protection', ok: true },
                          { label: 'Rate Limiting', ok: true },
                          { label: 'JWT Auth', ok: true },
                          { label: '2FA Required', ok: true },
                        ].map(({ label, ok }) => (
                          <div key={label} className="flex items-center gap-2 text-sm">
                            {ok
                              ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                              : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                            <span style={{ color: 'var(--color-muted)' }}>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="sp-card rounded-2xl py-16 text-center" style={{ color: 'var(--color-dim)' }}>
                    Failed to load stats
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════
                USERS SECTION
            ═══════════════════════════════════════════════ */}
            {section === 'users' && (
              <motion.div key="users" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="sp-card rounded-2xl overflow-hidden">
                  {/* Toolbar */}
                  <div className="px-6 py-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div className="relative flex-1 min-w-48">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-dim)' }} />
                      <input
                        placeholder="Search by name or email…"
                        value={userSearch}
                        onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
                        className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                      />
                    </div>
                    <Button size="sm" variant="ghost"
                      onClick={() => qc.invalidateQueries({ queryKey: ['admin-users'] })}
                      leftIcon={<RefreshCw className="w-4 h-4" />}>Refresh</Button>
                  </div>

                  <TableWrap loading={usersQ.isLoading}>
                    <thead>
                      <tr>
                        <Th>User</Th>
                        <Th>Role</Th>
                        <Th>Account</Th>
                        <Th>2FA</Th>
                        <Th>Status</Th>
                        <Th>Joined</Th>
                        <Th>Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersQ.data?.data?.data?.users?.map((u: any) => (
                        <tr key={u._id} className="transition hover-shade group">
                          <Td>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                                style={{ background: 'var(--color-shade-md)', color: 'var(--color-accent)' }}>
                                {u.firstName?.[0]}{u.lastName?.[0]}
                              </div>
                              <div>
                                <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{u.firstName} {u.lastName}</p>
                                <p className="text-xs" style={{ color: 'var(--color-dim)' }}>{u.email}</p>
                              </div>
                            </div>
                          </Td>
                          <Td>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{
                                background: u.role === 'admin' ? '#7c6fe020' : u.role === 'moderator' ? '#fbbf2420' : '#60a5fa15',
                                color: u.role === 'admin' ? '#a78bfa' : u.role === 'moderator' ? '#fbbf24' : '#60a5fa',
                              }}>
                              {u.role}
                            </span>
                          </Td>
                          <Td>
                            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                              {u.accountType === 'recruiter' ? '🏢 Recruiter' : '👤 Candidate'}
                            </span>
                          </Td>
                          <Td>
                            {u.twoFactorEnabled
                              ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                              : <XCircle className="w-4 h-4" style={{ color: 'var(--color-dim)' }} />}
                          </Td>
                          <Td>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{
                                background: u.active !== false ? '#34d39920' : '#f8717120',
                                color: u.active !== false ? '#34d399' : '#f87171',
                              }}>
                              {u.active !== false ? 'Active' : 'Banned'}
                            </span>
                          </Td>
                          <Td>
                            <span className="text-xs" style={{ color: 'var(--color-dim)' }}>
                              {new Date(u.createdAt).toLocaleDateString()}
                            </span>
                          </Td>
                          <Td>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => banMut.mutate({ id: u._id, banned: u.active !== false })}
                                disabled={banMut.isPending || u.role === 'admin'}
                                className="p-1.5 rounded-lg transition hover-shade disabled:opacity-30"
                                title={u.active !== false ? 'Ban user' : 'Unban user'}>
                                {u.active !== false
                                  ? <Lock className="w-3.5 h-3.5 text-amber-400" />
                                  : <Unlock className="w-3.5 h-3.5 text-green-400" />}
                              </button>
                              <button
                                onClick={() => { if (confirm(`Permanently delete ${u.firstName} ${u.lastName}?`)) deleteUserMut.mutate(u._id); }}
                                disabled={deleteUserMut.isPending || u.role === 'admin'}
                                className="p-1.5 rounded-lg transition hover-shade disabled:opacity-30"
                                title="Delete user">
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>

                  {usersQ.data?.data?.data?.pagination && (
                    <div className="px-6 pb-4">
                      <Pagination page={userPage} pages={usersQ.data.data.data.pagination.pages}
                        onPrev={() => setUserPage(p => p - 1)} onNext={() => setUserPage(p => p + 1)} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════
                POSTS SECTION
            ═══════════════════════════════════════════════ */}
            {section === 'posts' && (
              <motion.div key="posts" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="sp-card rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>All Posts</h3>
                    <Button size="sm" variant="ghost"
                      onClick={() => qc.invalidateQueries({ queryKey: ['admin-posts'] })}
                      leftIcon={<RefreshCw className="w-4 h-4" />}>Refresh</Button>
                  </div>
                  <TableWrap loading={postsQ.isLoading}>
                    <thead>
                      <tr>
                        <Th>Author</Th>
                        <Th>Content Preview</Th>
                        <Th>Likes</Th>
                        <Th>Comments</Th>
                        <Th>Posted</Th>
                        <Th>Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {postsQ.data?.data?.data?.posts?.map((p: any) => (
                        <tr key={p._id} className="transition hover-shade">
                          <Td>
                            <div>
                              <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{p.author?.firstName} {p.author?.lastName}</p>
                              <p className="text-xs" style={{ color: 'var(--color-dim)' }}>{p.author?.email}</p>
                            </div>
                          </Td>
                          <Td className="max-w-sm">
                            <p className="truncate text-sm" style={{ color: 'var(--color-muted)' }}>{p.content}</p>
                          </Td>
                          <Td>
                            <span className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
                              {p.likesCount ?? p.likes?.length ?? 0}
                            </span>
                          </Td>
                          <Td>
                            <span className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
                              {p.commentsCount ?? p.comments?.length ?? 0}
                            </span>
                          </Td>
                          <Td>
                            <span className="text-xs" style={{ color: 'var(--color-dim)' }}>
                              {new Date(p.createdAt).toLocaleDateString()}
                            </span>
                          </Td>
                          <Td>
                            <button
                              onClick={() => { if (confirm('Remove this post?')) deletePostMut.mutate(p._id); }}
                              className="p-1.5 rounded-lg transition hover-shade"
                              title="Remove post">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                  {postsQ.data?.data?.data?.pagination && (
                    <div className="px-6 pb-4">
                      <Pagination page={postPage} pages={postsQ.data.data.data.pagination.pages}
                        onPrev={() => setPostPage(p => p - 1)} onNext={() => setPostPage(p => p + 1)} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════
                JOBS SECTION
            ═══════════════════════════════════════════════ */}
            {section === 'jobs' && (
              <motion.div key="jobs" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="sp-card rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>All Job Listings</h3>
                    <Button size="sm" variant="ghost"
                      onClick={() => qc.invalidateQueries({ queryKey: ['admin-jobs'] })}
                      leftIcon={<RefreshCw className="w-4 h-4" />}>Refresh</Button>
                  </div>
                  <TableWrap loading={jobsQ.isLoading}>
                    <thead>
                      <tr>
                        <Th>Title</Th>
                        <Th>Company</Th>
                        <Th>Posted By</Th>
                        <Th>Type</Th>
                        <Th>Date</Th>
                        <Th>Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobsQ.data?.data?.data?.jobs?.map((j: any) => (
                        <tr key={j._id} className="transition hover-shade">
                          <Td>
                            <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{j.title}</p>
                          </Td>
                          <Td>
                            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{j.company}</p>
                          </Td>
                          <Td>
                            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{j.postedBy?.firstName} {j.postedBy?.lastName}</p>
                            <p className="text-xs" style={{ color: 'var(--color-dim)' }}>{j.postedBy?.email}</p>
                          </Td>
                          <Td>
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(124,111,224,0.15)', color: 'var(--color-accent)' }}>
                              {j.type}
                            </span>
                          </Td>
                          <Td>
                            <span className="text-xs" style={{ color: 'var(--color-dim)' }}>
                              {new Date(j.createdAt).toLocaleDateString()}
                            </span>
                          </Td>
                          <Td>
                            <button
                              onClick={() => { if (confirm('Remove this job listing?')) deleteJobMut.mutate(j._id); }}
                              className="p-1.5 rounded-lg transition hover-shade"
                              title="Remove job">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                  {jobsQ.data?.data?.data?.pagination && (
                    <div className="px-6 pb-4">
                      <Pagination page={jobPage} pages={jobsQ.data.data.data.pagination.pages}
                        onPrev={() => setJobPage(p => p - 1)} onNext={() => setJobPage(p => p + 1)} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════
                AUDIT LOG SECTION
            ═══════════════════════════════════════════════ */}
            {section === 'audit' && (
              <motion.div key="audit" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="sp-card rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <h3 className="font-semibold flex-1" style={{ color: 'var(--color-text)' }}>Security Audit Trail</h3>
                    <select
                      value={auditSeverity}
                      onChange={e => { setAuditSeverity(e.target.value); setAuditPage(1); }}
                      className="px-3 py-1.5 text-sm rounded-xl outline-none"
                      style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                      <option value="">All severities</option>
                      <option value="info">Info</option>
                      <option value="warn">Warning</option>
                      <option value="error">Error</option>
                    </select>
                    <Button size="sm" variant="ghost"
                      onClick={() => qc.invalidateQueries({ queryKey: ['admin-audit'] })}
                      leftIcon={<RefreshCw className="w-4 h-4" />}>Refresh</Button>
                  </div>
                  <TableWrap loading={auditQ.isLoading}>
                    <thead>
                      <tr>
                        <Th>Event</Th>
                        <Th>Severity</Th>
                        <Th>User</Th>
                        <Th>IP Address</Th>
                        <Th>Timestamp</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditQ.data?.data?.data?.logs?.map((log: any) => (
                        <tr key={log._id} className="transition hover-shade">
                          <Td>
                            <code className="text-xs font-mono px-2 py-0.5 rounded"
                              style={{ background: 'var(--color-shade-md)', color: 'var(--color-text)' }}>
                              {log.event}
                            </code>
                          </Td>
                          <Td><SeverityBadge severity={log.severity} /></Td>
                          <Td>
                            {log.userId
                              ? <span className="text-sm" style={{ color: 'var(--color-muted)' }}>{log.userId.firstName} {log.userId.lastName}</span>
                              : <span style={{ color: 'var(--color-dim)' }}>—</span>}
                          </Td>
                          <Td>
                            <code className="text-xs font-mono" style={{ color: 'var(--color-dim)' }}>{log.ip ?? '—'}</code>
                          </Td>
                          <Td>
                            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-dim)' }}>
                              <Clock className="w-3 h-3" />
                              {new Date(log.createdAt).toLocaleString()}
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                  {auditQ.data?.data?.data?.pagination && (
                    <div className="px-6 pb-4">
                      <Pagination page={auditPage} pages={auditQ.data.data.data.pagination.pages}
                        onPrev={() => setAuditPage(p => p - 1)} onNext={() => setAuditPage(p => p + 1)} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════
                BLOCKCHAIN SECTION
            ═══════════════════════════════════════════════ */}
            {section === 'blockchain' && (
              <motion.div key="blockchain" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="space-y-6">

                {/* Chain Status Card */}
                <div className="sp-card rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)' }}>
                        <Link2 className="w-5 h-5" style={{ color: '#a78bfa' }} />
                      </div>
                      <div>
                        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Chain Integrity</h3>
                        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                          SHA-256 tamper-evident audit trail
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => blockchainVerifyQ.refetch()}
                      isLoading={blockchainVerifyQ.isFetching}
                      leftIcon={<Shield className="w-4 h-4" />}>
                      Verify Chain
                    </Button>
                  </div>

                  {blockchainVerifyQ.data && (
                    <div className="flex items-center gap-3 p-3 rounded-xl"
                      style={{
                        background: blockchainVerifyQ.data.data?.data?.valid ? '#34d39915' : '#f8717115',
                        border: `1px solid ${blockchainVerifyQ.data.data?.data?.valid ? '#34d39930' : '#f8717130'}`,
                      }}>
                      {blockchainVerifyQ.data.data?.data?.valid
                        ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-green-400" />
                        : <XCircle className="w-5 h-5 flex-shrink-0 text-red-400" />}
                      <div>
                        <p className="font-semibold text-sm"
                          style={{ color: blockchainVerifyQ.data.data?.data?.valid ? '#34d399' : '#f87171' }}>
                          {blockchainVerifyQ.data.data?.data?.valid
                            ? 'Chain Valid — all blocks verified'
                            : `Chain Broken at Block #${blockchainVerifyQ.data.data?.data?.brokenAt}`}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                          {blockchainVerifyQ.data.data?.data?.totalBlocks} block{blockchainVerifyQ.data.data?.data?.totalBlocks !== 1 ? 's' : ''} verified
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Blocks Table */}
                <div className="sp-card rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Audit Blocks</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
                        Immutable
                      </span>
                    </div>
                    <Button size="sm" variant="ghost"
                      onClick={() => { qc.invalidateQueries({ queryKey: ['admin-blockchain'] }); setExpandedBlock(null); }}
                      leftIcon={<RefreshCw className="w-4 h-4" />}>Refresh</Button>
                  </div>

                  <TableWrap loading={blocksQ.isLoading}>
                    <thead>
                      <tr>
                        <Th>Block #</Th>
                        <Th>Timestamp</Th>
                        <Th>Events</Th>
                        <Th>Prev Hash</Th>
                        <Th>Block Hash</Th>
                        <Th>Nonce</Th>
                        <Th>Details</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {blocksQ.data?.data?.data?.blocks?.map((blk: any) => (
                        <>
                          <tr key={blk.blockNumber} className="transition hover-shade cursor-pointer"
                            onClick={() => setExpandedBlock(expandedBlock === blk.blockNumber ? null : blk.blockNumber)}>
                            <Td>
                              <span className="font-mono text-sm font-bold" style={{ color: '#a78bfa' }}>
                                #{blk.blockNumber}
                              </span>
                            </Td>
                            <Td>
                              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-dim)' }}>
                                <Clock className="w-3 h-3" />
                                {new Date(blk.timestamp).toLocaleString()}
                              </div>
                            </Td>
                            <Td>
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                style={{ background: 'rgba(124,111,224,0.15)', color: 'var(--color-accent)' }}>
                                {blk.events?.length ?? 0}
                              </span>
                            </Td>
                            <Td>
                              <code className="text-xs font-mono" style={{ color: '#22d3ee' }}>
                                {blk.previousHash?.slice(0, 12)}…
                              </code>
                            </Td>
                            <Td>
                              <code className="text-xs font-mono" style={{ color: '#a78bfa' }}>
                                {blk.hash?.slice(0, 12)}…
                              </code>
                            </Td>
                            <Td>
                              <span className="text-xs font-mono" style={{ color: 'var(--color-muted)' }}>
                                {blk.nonce}
                              </span>
                            </Td>
                            <Td>
                              <button
                                className="p-1.5 rounded-lg transition hover-shade"
                                title={expandedBlock === blk.blockNumber ? 'Collapse' : 'View events'}>
                                <Eye className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
                              </button>
                            </Td>
                          </tr>

                          {/* Expanded events row */}
                          {expandedBlock === blk.blockNumber && (
                            <tr key={`${blk.blockNumber}-events`}>
                              <td colSpan={7} style={{ borderBottom: '1px solid var(--color-shade)', padding: 0 }}>
                                <div className="p-4 space-y-2" style={{ background: 'var(--color-shade)' }}>
                                  <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                                    style={{ color: 'var(--color-muted)' }}>
                                    Block #{blk.blockNumber} Events ({blk.events?.length ?? 0})
                                  </p>
                                  {blk.events?.length === 0 ? (
                                    <p className="text-xs" style={{ color: 'var(--color-dim)' }}>
                                      Genesis block — no events
                                    </p>
                                  ) : (
                                    blk.events?.map((ev: any, i: number) => (
                                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                                        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
                                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                                          style={{ background: '#a78bfa' }} />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <code className="text-xs font-mono font-semibold"
                                              style={{ color: '#a78bfa' }}>{ev.action}</code>
                                            {ev.ip && (
                                              <code className="text-xs font-mono"
                                                style={{ color: 'var(--color-dim)' }}>{ev.ip}</code>
                                            )}
                                          </div>
                                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-dim)' }}>
                                            {new Date(ev.timestamp).toLocaleString()}
                                            {ev.userId && ` · User: ${ev.userId}`}
                                          </p>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                  <div className="pt-2 space-y-1">
                                    <p className="text-xs font-mono" style={{ color: 'var(--color-dim)' }}>
                                      <span style={{ color: 'var(--color-muted)' }}>prev:</span>{' '}
                                      <span style={{ color: '#22d3ee' }}>{blk.previousHash}</span>
                                    </p>
                                    <p className="text-xs font-mono" style={{ color: 'var(--color-dim)' }}>
                                      <span style={{ color: 'var(--color-muted)' }}>hash:</span>{' '}
                                      <span style={{ color: '#a78bfa' }}>{blk.hash}</span>
                                    </p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </TableWrap>

                  {blocksQ.data?.data?.data?.pagination && (
                    <div className="px-6 pb-4">
                      <Pagination page={blockchainPage} pages={blocksQ.data.data.data.pagination.pages}
                        onPrev={() => setBlockchainPage(p => p - 1)}
                        onNext={() => setBlockchainPage(p => p + 1)} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════
                RECORDS INSPECTOR SECTION
            ═══════════════════════════════════════════════ */}
            {section === 'records' && (
              <motion.div key="records" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="space-y-6">

                <div className="sp-card rounded-2xl overflow-hidden">
                  {/* Header + controls */}
                  <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3"
                    style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)' }}>
                        <Database className="w-5 h-5" style={{ color: '#60a5fa' }} />
                      </div>
                      <div>
                        <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>Records Inspector</h3>
                        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Browse and inspect raw collection data</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Collection picker */}
                      {(['users', 'posts', 'jobs'] as const).map(c => (
                        <button key={c} onClick={() => { setRecordsCollection(c); setRecordsPage(1); setRecordsSearch(''); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition"
                          style={{
                            background: recordsCollection === c ? 'rgba(96,165,250,0.2)' : 'var(--color-shade)',
                            color: recordsCollection === c ? '#60a5fa' : 'var(--color-dim)',
                            border: `1px solid ${recordsCollection === c ? 'rgba(96,165,250,0.4)' : 'var(--color-border)'}`,
                          }}>
                          {c}
                        </button>
                      ))}
                      {/* Search (users only) */}
                      {recordsCollection === 'users' && (
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted)' }} />
                          <input value={recordsSearch} onChange={e => { setRecordsSearch(e.target.value); setRecordsPage(1); }}
                            placeholder="Search…" className="pl-7 pr-3 py-1.5 text-xs rounded-lg w-40"
                            style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                        </div>
                      )}
                      <Button size="sm" variant="ghost"
                        onClick={() => qc.invalidateQueries({ queryKey: ['admin-records'] })}
                        leftIcon={<RefreshCw className="w-4 h-4" />}>Refresh</Button>
                    </div>
                  </div>

                  {/* Table */}
                  <TableWrap loading={recordsQ.isLoading}>
                    {recordsCollection === 'users' && (
                      <><thead><tr>
                        <Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Account</Th><Th>Verified</Th><Th>Active</Th><Th>Joined</Th>
                      </tr></thead><tbody>
                        {(recordsQ.data?.data?.data?.users ?? []).map((u: any) => (
                          <tr key={u._id} className="transition hover-shade">
                            <Td><span className="font-medium" style={{ color: 'var(--color-text)' }}>{u.firstName} {u.lastName}</span></Td>
                            <Td><span className="text-xs font-mono" style={{ color: 'var(--color-dim)' }}>{u.email}</span></Td>
                            <Td><span className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize"
                              style={{ background: u.role === 'admin' ? '#f8717115' : 'rgba(96,165,250,0.1)', color: u.role === 'admin' ? '#f87171' : '#60a5fa' }}>
                              {u.role}
                            </span></Td>
                            <Td><span className="text-xs capitalize" style={{ color: 'var(--color-dim)' }}>{u.accountType}</span></Td>
                            <Td>{u.isVerified ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}</Td>
                            <Td>{u.isActive !== false ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}</Td>
                            <Td><span className="text-xs" style={{ color: 'var(--color-muted)' }}>{new Date(u.createdAt).toLocaleDateString()}</span></Td>
                          </tr>
                        ))}
                      </tbody></>
                    )}
                    {recordsCollection === 'posts' && (
                      <><thead><tr><Th>Author</Th><Th>Content</Th><Th>Likes</Th><Th>Comments</Th><Th>Created</Th></tr></thead><tbody>
                        {(recordsQ.data?.data?.data?.posts ?? []).map((p: any) => (
                          <tr key={p._id} className="transition hover-shade">
                            <Td><span className="text-sm" style={{ color: 'var(--color-text)' }}>{p.author?.firstName} {p.author?.lastName}</span></Td>
                            <Td><span className="text-xs line-clamp-2 max-w-xs" style={{ color: 'var(--color-dim)' }}>{p.content}</span></Td>
                            <Td><span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{p.likes?.length ?? 0}</span></Td>
                            <Td><span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{p.comments?.length ?? 0}</span></Td>
                            <Td><span className="text-xs" style={{ color: 'var(--color-muted)' }}>{new Date(p.createdAt).toLocaleDateString()}</span></Td>
                          </tr>
                        ))}
                      </tbody></>
                    )}
                    {recordsCollection === 'jobs' && (
                      <><thead><tr><Th>Title</Th><Th>Company</Th><Th>Type</Th><Th>Status</Th><Th>Applications</Th><Th>Posted</Th></tr></thead><tbody>
                        {(recordsQ.data?.data?.data?.jobs ?? []).map((j: any) => (
                          <tr key={j._id} className="transition hover-shade">
                            <Td><span className="font-medium" style={{ color: 'var(--color-text)' }}>{j.title}</span></Td>
                            <Td><span className="text-xs" style={{ color: 'var(--color-dim)' }}>{j.company?.name ?? j.companyName}</span></Td>
                            <Td><span className="text-xs capitalize" style={{ color: 'var(--color-dim)' }}>{j.type}</span></Td>
                            <Td><span className="text-xs capitalize px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: j.status === 'active' ? '#34d39915' : '#f8717115', color: j.status === 'active' ? '#34d399' : '#f87171' }}>
                              {j.status}
                            </span></Td>
                            <Td><span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{j.applicationCount ?? 0}</span></Td>
                            <Td><span className="text-xs" style={{ color: 'var(--color-muted)' }}>{new Date(j.createdAt).toLocaleDateString()}</span></Td>
                          </tr>
                        ))}
                      </tbody></>
                    )}
                  </TableWrap>

                  {/* Pagination */}
                  {(() => {
                    const pag = recordsQ.data?.data?.data?.pagination;
                    return pag ? (
                      <div className="px-6 pb-4">
                        <Pagination page={recordsPage} pages={pag.pages}
                          onPrev={() => setRecordsPage(p => p - 1)}
                          onNext={() => setRecordsPage(p => p + 1)} />
                      </div>
                    ) : null;
                  })()}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
      </div>
    </div>
  );
}
