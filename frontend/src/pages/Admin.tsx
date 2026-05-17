/**
 * Admin Panel Page
 * Full dashboard for admins: stats, user management, posts, jobs, audit log.
 * Redirects non-admins to the feed.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Users, FileText, Briefcase, ShieldAlert,
  BarChart3, Ban, Trash2, Shield,
  ChevronLeft, ChevronRight, RefreshCw,
  AlertTriangle, CheckCircle2, XCircle, Info,
  Search,
} from 'lucide-react';
import { apiService } from '@services/api';
import { useAuth } from '@stores/authStore';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { Input } from '@components/ui/Input';

type AdminTab = 'stats' | 'users' | 'posts' | 'jobs' | 'audit';

/* ── API helpers (using existing apiService.admin) ──────────── */
const adminApi = (apiService as any).admin ?? {
  stats: () => (apiService as any).api.get('/admin/stats'),
  users: (p: object) => (apiService as any).api.get('/admin/users', { params: p }),
  banUser: (id: string, banned: boolean, reason?: string) =>
    (apiService as any).api.patch(`/admin/users/${id}/ban`, { banned, reason }),
  deleteUser: (id: string) => (apiService as any).api.delete(`/admin/users/${id}`),
  posts: (p: object) => (apiService as any).api.get('/admin/posts', { params: p }),
  deletePost: (id: string) => (apiService as any).api.delete(`/admin/posts/${id}`),
  jobs: (p: object) => (apiService as any).api.get('/admin/jobs', { params: p }),
  deleteJob: (id: string) => (apiService as any).api.delete(`/admin/jobs/${id}`),
  auditLogs: (p: object) => (apiService as any).api.get('/admin/audit-logs', { params: p }),
};

/* ── Stat card ──────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: number | string;
  sub?: string; color: string;
}) {
  return (
    <div className="sp-card rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>{label}</p>
          <p className="text-3xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>{value}</p>
          {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-dim)' }}>{sub}</p>}
        </div>
        <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

/* ── Severity badge ─────────────────────────────────────────── */
function SeverityBadge({ severity }: { severity: string }) {
  if (severity === 'error')
    return <Badge variant="error" className="gap-1"><XCircle className="w-3 h-3" />Error</Badge>;
  if (severity === 'warn')
    return <Badge variant="warning" className="gap-1"><AlertTriangle className="w-3 h-3" />Warn</Badge>;
  return <Badge variant="success" className="gap-1"><Info className="w-3 h-3" />Info</Badge>;
}

/* ── Pagination bar ─────────────────────────────────────────── */
function Pagination({ page, pages, onPrev, onNext }: {
  page: number; pages: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-4 mt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
      <span className="text-sm" style={{ color: 'var(--color-muted)' }}>Page {page} of {pages}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onPrev} disabled={page <= 1}
          leftIcon={<ChevronLeft className="w-4 h-4" />}>Prev</Button>
        <Button size="sm" variant="ghost" onClick={onNext} disabled={page >= pages}
          rightIcon={<ChevronRight className="w-4 h-4" />}>Next</Button>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [tab, setTab] = useState<AdminTab>('stats');
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [postPage, setPostPage] = useState(1);
  const [jobPage, setJobPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [auditSeverity, setAuditSeverity] = useState('');

  // Redirect non-admins
  if (user && user.role !== 'admin') {
    navigate('/', { replace: true });
    return null;
  }

  /* ── Queries ────────────────────────────────────────────── */

  const statsQ = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.stats(),
    enabled: tab === 'stats',
    staleTime: 30_000,
  });

  const usersQ = useQuery({
    queryKey: ['admin-users', userPage, userSearch],
    queryFn: () => adminApi.users({ page: userPage, limit: 15, search: userSearch }),
    enabled: tab === 'users',
    placeholderData: (prev: any) => prev,
  });

  const postsQ = useQuery({
    queryKey: ['admin-posts', postPage],
    queryFn: () => adminApi.posts({ page: postPage, limit: 15 }),
    enabled: tab === 'posts',
    placeholderData: (prev: any) => prev,
  });

  const jobsQ = useQuery({
    queryKey: ['admin-jobs', jobPage],
    queryFn: () => adminApi.jobs({ page: jobPage, limit: 15 }),
    enabled: tab === 'jobs',
    placeholderData: (prev: any) => prev,
  });

  const auditQ = useQuery({
    queryKey: ['admin-audit', auditPage, auditSeverity],
    queryFn: () => adminApi.auditLogs({ page: auditPage, limit: 20, severity: auditSeverity }),
    enabled: tab === 'audit',
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

  const tabs: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'stats', label: 'Dashboard', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'posts', label: 'Posts', icon: FileText },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'audit', label: 'Audit Log', icon: ShieldAlert },
  ];

  const stats = statsQ.data?.data?.data;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Admin Panel</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Platform management & security</p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--color-bg)' }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition"
            style={{
              background: tab === id ? 'var(--color-card)' : 'transparent',
              color: tab === id ? 'var(--color-text)' : 'var(--color-muted)',
              border: tab === id ? '1px solid var(--color-border)' : '1px solid transparent',
            }}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── Stats Tab ─────────────────────────────────── */}
        {tab === 'stats' && (
          <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {statsQ.isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-28 rounded-2xl animate-pulse bg-shade" />
                ))}
              </div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard icon={Users} label="Total Users" value={stats.users.total} sub={`+${stats.users.newToday} today`} color="bg-blue-500" />
                  <StatCard icon={Ban} label="Banned Users" value={stats.users.banned} color="bg-red-500" />
                  <StatCard icon={FileText} label="Posts" value={stats.posts.total} sub={`${stats.posts.today} today`} color="bg-green-500" />
                  <StatCard icon={Briefcase} label="Active Jobs" value={stats.jobs.total} color="bg-purple-500" />
                  <StatCard icon={AlertTriangle} label="Security Errors Today" value={stats.security.errorsToday} color="bg-red-600" />
                  <StatCard icon={ShieldAlert} label="Security Warnings Today" value={stats.security.warningsToday} color="bg-amber-500" />
                </div>
              </>
            ) : (
              <div className="sp-card rounded-2xl py-12 text-center" style={{ color: 'var(--color-dim)' }}>Failed to load stats</div>
            )}
          </motion.div>
        )}

        {/* ── Users Tab ─────────────────────────────────── */}
        {tab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="sp-card rounded-2xl overflow-hidden">
              <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex-1">
                  <Input
                    placeholder="Search users by name or email…"
                    value={userSearch}
                    onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
                    leftIcon={<Search className="w-4 h-4" />}
                    className="max-w-xs"
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ['admin-users'] })}
                  leftIcon={<RefreshCw className="w-4 h-4" />}>Refresh</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-shade)' }}>
                      <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>User</th>
                      <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Role</th>
                      <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>2FA</th>
                      <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Status</th>
                      <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Joined</th>
                      <th className="text-right px-6 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersQ.data?.data?.data?.users?.map((u: any) => (
                      <tr key={u._id} className="transition hover-shade"
                        style={{ borderBottom: '1px solid var(--color-shade)' }}>
                        <td className="px-6 py-3">
                          <p className="font-medium" style={{ color: 'var(--color-text)' }}>{u.firstName} {u.lastName}</p>
                          <p className="text-xs" style={{ color: 'var(--color-dim)' }}>{u.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={u.role === 'admin' ? 'primary' : u.role === 'moderator' ? 'warning' : 'default'}>
                            {u.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {u.twoFactorEnabled
                            ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                            : <XCircle className="w-4 h-4" style={{ color: 'var(--color-dim)' }} />}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={u.active !== false ? 'success' : 'error'}>
                            {u.active !== false ? 'Active' : 'Banned'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-dim)' }}>
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant={u.active !== false ? 'ghost' : 'secondary'}
                              onClick={() => banMut.mutate({ id: u._id, banned: u.active !== false })}
                              isLoading={banMut.isPending}
                              leftIcon={<Ban className="w-3.5 h-3.5" />} className="text-xs">
                              {u.active !== false ? 'Ban' : 'Unban'}
                            </Button>
                            <Button size="sm" variant="ghost"
                              onClick={() => { if (confirm(`Delete ${u.firstName} ${u.lastName} permanently?`)) { deleteUserMut.mutate(u._id); } }}
                              leftIcon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
                              className="text-xs text-red-400">Delete</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {usersQ.isLoading && (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
                  </div>
                )}
              </div>
              {usersQ.data?.data?.data?.pagination && (
                <div className="px-6">
                  <Pagination page={userPage} pages={usersQ.data.data.data.pagination.pages}
                    onPrev={() => setUserPage(p => p - 1)} onNext={() => setUserPage(p => p + 1)} />
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Posts Tab ─────────────────────────────────── */}
        {tab === 'posts' && (
          <motion.div key="posts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="sp-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-shade)' }}>
                      <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Author</th>
                      <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Content</th>
                      <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Created</th>
                      <th className="text-right px-6 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {postsQ.data?.data?.data?.posts?.map((p: any) => (
                      <tr key={p._id} className="transition hover-shade"
                        style={{ borderBottom: '1px solid var(--color-shade)' }}>
                        <td className="px-6 py-3">
                          <p className="font-medium text-xs" style={{ color: 'var(--color-text)' }}>{p.author?.firstName} {p.author?.lastName}</p>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="truncate" style={{ color: 'var(--color-muted)' }}>{p.content}</p>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-dim)' }}>
                          {new Date(p.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <Button size="sm" variant="ghost"
                            onClick={() => { if (confirm('Remove this post?')) deletePostMut.mutate(p._id); }}
                            leftIcon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
                            className="text-xs text-red-400">Remove</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {postsQ.isLoading && (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
                  </div>
                )}
              </div>
              {postsQ.data?.data?.data?.pagination && (
                <div className="px-6">
                  <Pagination page={postPage} pages={postsQ.data.data.data.pagination.pages}
                    onPrev={() => setPostPage(p => p - 1)} onNext={() => setPostPage(p => p + 1)} />
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Jobs Tab ──────────────────────────────────── */}
        {tab === 'jobs' && (
          <motion.div key="jobs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="sp-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-shade)' }}>
                      <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Title</th>
                      <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Company</th>
                      <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Posted By</th>
                      <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Date</th>
                      <th className="text-right px-6 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobsQ.data?.data?.data?.jobs?.map((j: any) => (
                      <tr key={j._id} className="transition hover-shade"
                        style={{ borderBottom: '1px solid var(--color-shade)' }}>
                        <td className="px-6 py-3 font-medium" style={{ color: 'var(--color-text)' }}>{j.title}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-muted)' }}>{j.company}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-dim)' }}>{j.postedBy?.firstName} {j.postedBy?.lastName}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-dim)' }}>{new Date(j.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-3 text-right">
                          <Button size="sm" variant="ghost"
                            onClick={() => { if (confirm('Remove this job?')) deleteJobMut.mutate(j._id); }}
                            leftIcon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
                            className="text-xs text-red-400">Remove</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {jobsQ.isLoading && (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
                  </div>
                )}
              </div>
              {jobsQ.data?.data?.data?.pagination && (
                <div className="px-6">
                  <Pagination page={jobPage} pages={jobsQ.data.data.data.pagination.pages}
                    onPrev={() => setJobPage(p => p - 1)} onNext={() => setJobPage(p => p + 1)} />
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Audit Log Tab ─────────────────────────────── */}
        {tab === 'audit' && (
          <motion.div key="audit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="sp-card rounded-2xl overflow-hidden">
              <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <select
                  value={auditSeverity}
                  onChange={e => { setAuditSeverity(e.target.value); setAuditPage(1); }}
                  className="px-3 py-1.5 text-sm rounded-xl outline-none"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                >
                  <option value="">All severities</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
                <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ['admin-audit'] })}
                  leftIcon={<RefreshCw className="w-4 h-4" />}>Refresh</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-shade)' }}>
                      <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Event</th>
                      <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Severity</th>
                      <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>User</th>
                      <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>IP</th>
                      <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditQ.data?.data?.data?.logs?.map((log: any) => (
                      <tr key={log._id} className="transition hover-shade"
                        style={{ borderBottom: '1px solid var(--color-shade)' }}>
                        <td className="px-6 py-3">
                          <p className="font-mono text-xs" style={{ color: 'var(--color-text)' }}>{log.event}</p>
                        </td>
                        <td className="px-4 py-3"><SeverityBadge severity={log.severity} /></td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                          {log.userId ? `${log.userId.firstName} ${log.userId.lastName}` : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-dim)' }}>{log.ip ?? '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-dim)' }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {auditQ.isLoading && (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
                  </div>
                )}
              </div>
              {auditQ.data?.data?.data?.pagination && (
                <div className="px-6">
                  <Pagination page={auditPage} pages={auditQ.data.data.data.pagination.pages}
                    onPrev={() => setAuditPage(p => p - 1)} onNext={() => setAuditPage(p => p + 1)} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
