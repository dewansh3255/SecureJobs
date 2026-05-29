/**
 * Company Page
 * LinkedIn-style company profile page with follow, job listings, members, and creation flow
 */

import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Building2, MapPin, Globe, Users, Briefcase, Plus, Edit2, X,
  CheckCircle, Camera, ChevronRight, Star, Calendar,
  UserPlus, Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiService } from '@services/api';
import { useAuth } from '@stores/authStore';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface CompanyMember {
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    headline?: string;
  };
  role: 'admin' | 'recruiter';
  addedAt: string;
}

interface Company {
  _id: string;
  name: string;
  description?: string;
  industry?: string;
  website?: string;
  location?: string;
  logo?: string;
  coverImage?: string;
  size?: string;
  founded?: number;
  admin: { _id: string; firstName: string; lastName: string; profilePicture?: string };
  members: CompanyMember[];
  followers: string[];
  specialties: string[];
  isVerified: boolean;
  isFollowing?: boolean;
  isMember?: boolean;
  memberRole?: string | null;
  createdAt: string;
}

interface Job {
  _id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  experienceLevel: string;
  createdAt: string;
  applicationCount: number;
  status: string;
}

const SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001+'] as const;

const inputCls = 'w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none transition';
const inputStyle = {
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text)',
};
const labelCls = 'text-xs font-medium uppercase tracking-wider block mb-1.5';

// ──────────────────────────────────────────────
// Create / Edit Company Modal
// ──────────────────────────────────────────────
function CompanyFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Partial<Company>;
  onClose: () => void;
  onSaved: (company: Company) => void;
}) {
  const isEdit = !!initial?._id;
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    industry: initial?.industry ?? '',
    website: initial?.website ?? '',
    location: initial?.location ?? '',
    size: initial?.size ?? '',
    founded: initial?.founded ? String(initial.founded) : '',
    specialties: initial?.specialties?.join(', ') ?? '',
  });
  const up = (f: Partial<typeof form>) => setForm((p) => ({ ...p, ...f }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        industry: form.industry.trim() || undefined,
        website: form.website.trim() || undefined,
        location: form.location.trim() || undefined,
        size: form.size || undefined,
        founded: form.founded ? Number(form.founded) : undefined,
        specialties: form.specialties
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      return isEdit && initial?._id
        ? apiService.companies.update(initial._id, payload)
        : apiService.companies.create(payload);
    },
    onSuccess: (res) => {
      toast.success(isEdit ? 'Company updated!' : 'Company created!');
      onSaved(res.data.data);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Could not save company');
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="sp-card rounded-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <h2 className="font-bold" style={{ color: 'var(--color-text)' }}>
            {isEdit ? 'Edit Company' : 'Create Company Page'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl transition hover-shade">
            <X className="w-5 h-5" style={{ color: 'var(--color-muted)' }} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-4">
          <div>
            <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Company Name *</label>
            <input className={inputCls} style={inputStyle} value={form.name} onChange={(e) => up({ name: e.target.value })} placeholder="e.g. Nexus Technologies" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Industry</label>
              <input className={inputCls} style={inputStyle} value={form.industry} onChange={(e) => up({ industry: e.target.value })} placeholder="Technology" />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Company Size</label>
              <select className={inputCls} style={inputStyle} value={form.size} onChange={(e) => up({ size: e.target.value })}>
                <option value="">Select size</option>
                {SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Location</label>
              <input className={inputCls} style={inputStyle} value={form.location} onChange={(e) => up({ location: e.target.value })} placeholder="San Francisco, CA" />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Founded Year</label>
              <input type="number" className={inputCls} style={inputStyle} value={form.founded} onChange={(e) => up({ founded: e.target.value })} placeholder="2015" min="1800" max={new Date().getFullYear()} />
            </div>
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Website</label>
            <input className={inputCls} style={inputStyle} value={form.website} onChange={(e) => up({ website: e.target.value })} placeholder="https://company.com" />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Description</label>
            <textarea rows={4} className={inputCls} style={inputStyle} value={form.description} onChange={(e) => up({ description: e.target.value })} placeholder="Tell people about your company…" maxLength={2000} />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--color-muted)' }}>Specialties <span style={{ color: 'var(--color-dim)' }}>(comma-separated)</span></label>
            <input className={inputCls} style={inputStyle} value={form.specialties} onChange={(e) => up({ specialties: e.target.value })} placeholder="Cloud Computing, AI, DevOps" />
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => mutation.mutate()}
            isLoading={mutation.isPending}
            disabled={!form.name.trim()}
          >
            {isEdit ? 'Save Changes' : 'Create Company'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────
// Job Card (compact)
// ──────────────────────────────────────────────
function JobCard({ job }: { job: Job }) {
  const navigate = useNavigate();
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate('/jobs')}
      className="w-full text-left sp-card rounded-xl p-4 flex items-center gap-4 hover-shade transition"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--color-accent-muted, rgba(99,102,241,0.12))' }}>
        <Briefcase className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate" style={{ color: 'var(--color-text)' }}>{job.title}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
          {job.location} · {job.type} · {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-dim)' }} />
    </motion.button>
  );
}

// ──────────────────────────────────────────────
// Main Company Page
// ──────────────────────────────────────────────
export default function CompanyPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // If no id, show "My Companies" dashboard
  const isCreate = !id;

  // Fetch company data
  const { data: companyRes, isLoading, error } = useQuery({
    queryKey: ['company', id],
    queryFn: () => apiService.companies.get(id!),
    enabled: !!id,
  });

  // Fetch company jobs
  const { data: jobsRes } = useQuery({
    queryKey: ['company-jobs', id],
    queryFn: () => apiService.companies.getJobs(id!),
    enabled: !!id,
  });

  // Fetch user's companies (for "My Companies" list)
  const { data: myCompaniesRes } = useQuery({
    queryKey: ['my-companies'],
    queryFn: () => apiService.companies.list({ mine: true }),
    enabled: isCreate && !!user,
  });

  const company: Company | undefined = companyRes?.data?.data;
  const jobs: Job[] = jobsRes?.data?.data ?? [];
  const myCompanies: Company[] = myCompaniesRes?.data?.data ?? [];

  const isAdmin =
    user && company &&
    (String((company.admin as { _id: string })?._id ?? company.admin) === String(user.id) ||
      company.members.some(
        (m) => String(m.user._id) === String(user.id) && m.role === 'admin'
      ));

  const isMember = user && company && company.members.some(
    (m) => String(m.user._id) === String(user.id)
  );

  // Follow toggle
  const followMutation = useMutation({
    mutationFn: () => apiService.companies.follow(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', id] }),
    onError: () => toast.error('Could not update follow status'),
  });

  // Logo upload
  const logoMutation = useMutation({
    mutationFn: (file: File) => apiService.companies.uploadLogo(id!, file),
    onSuccess: () => {
      toast.success('Logo updated!');
      qc.invalidateQueries({ queryKey: ['company', id] });
    },
    onError: () => toast.error('Logo upload failed'),
  });

  // Delete company
  const deleteMutation = useMutation({
    mutationFn: () => apiService.companies.delete(id!),
    onSuccess: () => {
      toast.success('Company deleted');
      navigate('/');
    },
    onError: () => toast.error('Could not delete company'),
  });

  // ── "My Companies" / Create view ──
  if (isCreate) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Company Pages</h1>
          {user?.accountType === 'recruiter' && (
            <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
              Create Company
            </Button>
          )}
        </div>

        {user?.accountType !== 'recruiter' && (
          <div className="sp-card rounded-2xl p-6 text-center">
            <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              Switch to a <strong>Recruiter</strong> account in Settings to create and manage company pages.
            </p>
          </div>
        )}

        {myCompanies.length === 0 && user?.accountType === 'recruiter' ? (
          <div className="sp-card rounded-2xl p-6 text-center">
            <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-muted)' }} />
            <p className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>No company pages yet</p>
            <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>Create a company page to post jobs and build your brand.</p>
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>Create Your First Company</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {myCompanies.map((c) => (
              <motion.div
                key={c._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="sp-card rounded-xl p-4 flex items-center gap-4 cursor-pointer hover-shade transition"
                onClick={() => navigate(`/company/${c._id}`)}
              >
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                  style={{ background: 'var(--color-shade-md)' }}>
                  {c.logo ? (
                    <img src={c.logo} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-6 h-6" style={{ color: 'var(--color-muted)' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{c.name}</p>
                    {c.isVerified && <CheckCircle className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                    {c.industry ?? 'Company'} · {c.followers.length} followers
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-dim)' }} />
              </motion.div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {showCreateModal && (
            <CompanyFormModal
              onClose={() => setShowCreateModal(false)}
              onSaved={(c) => {
                setShowCreateModal(false);
                qc.invalidateQueries({ queryKey: ['my-companies'] });
                navigate(`/company/${c._id}`);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Loading / Error states ──
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-4 animate-pulse">
        <div className="sp-card rounded-2xl overflow-hidden">
          <div className="h-36 bg-shade" />
          <div className="px-6 pb-6 pt-0">
            <div className="w-20 h-20 rounded-2xl bg-shade -mt-10 mb-4 border-4" style={{ borderColor: 'var(--color-card)' }} />
            <div className="h-5 bg-shade rounded w-1/3 mb-2" />
            <div className="h-3 bg-shade rounded w-1/4" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-muted)' }} />
        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Company not found</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>This company page doesn't exist or has been removed.</p>
        <Button variant="ghost" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const followerCount = company.followers.length;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* ── Header Card ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sp-card rounded-2xl overflow-hidden">
        {/* Cover */}
        <div className="relative h-40" style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #7c3aed 100%)' }}>
          {company.coverImage && (
            <img src={company.coverImage} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
          )}
        </div>

        {/* Logo + Info */}
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-10 mb-4">
            {/* Logo */}
            <div className="relative group">
              <div
                className="w-20 h-20 rounded-2xl overflow-hidden border-4 flex items-center justify-center"
                style={{ borderColor: 'var(--color-card)', background: 'var(--color-shade-md)' }}
              >
                {company.logo ? (
                  <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-8 h-8" style={{ color: 'var(--color-muted)' }} />
                )}
              </div>
              {isAdmin && (
                <>
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    style={{ background: 'rgba(0,0,0,0.5)' }}
                  >
                    <Camera className="w-5 h-5 text-white" />
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) logoMutation.mutate(file);
                    }}
                  />
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-12">
              {user && !isAdmin && (
                <Button
                  variant={company.isFollowing ? 'ghost' : 'primary'}
                  size="sm"
                  onClick={() => followMutation.mutate()}
                  isLoading={followMutation.isPending}
                  leftIcon={<UserPlus className="w-4 h-4" />}
                >
                  {company.isFollowing ? 'Following' : 'Follow'}
                </Button>
              )}
              {isAdmin && (
                <Button variant="ghost" size="sm" leftIcon={<Edit2 className="w-4 h-4" />} onClick={() => setShowEditModal(true)}>
                  Edit
                </Button>
              )}
              {company.website && (
                <a href={company.website} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" leftIcon={<Globe className="w-4 h-4" />}>
                    Website
                  </Button>
                </a>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Trash2 className="w-4 h-4" />}
                  onClick={() => {
                    if (window.confirm('Delete this company page? This cannot be undone.')) {
                      deleteMutation.mutate();
                    }
                  }}
                  style={{ color: 'var(--color-error, #ef4444)' }}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>

          {/* Company name & meta */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{company.name}</h1>
              {company.isVerified && (
                <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--color-accent-muted, rgba(99,102,241,0.12))', color: 'var(--color-accent)' }}>
                  <CheckCircle className="w-3 h-3" /> Verified
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm" style={{ color: 'var(--color-muted)' }}>
              {company.industry && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> {company.industry}
                </span>
              )}
              {company.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {company.location}
                </span>
              )}
              {company.size && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {company.size} employees
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {followerCount} follower{followerCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          {(company.description || company.specialties.length > 0 || company.founded) && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="sp-card rounded-2xl p-6">
              <h2 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>About</h2>
              {company.description && (
                <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-muted)' }}>
                  {company.description}
                </p>
              )}
              {company.founded && (
                <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--color-muted)' }}>
                  <Calendar className="w-4 h-4" />
                  <span>Founded {company.founded}</span>
                </div>
              )}
              {company.specialties.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--color-dim)' }}>Specialties</p>
                  <div className="flex flex-wrap gap-2">
                    {company.specialties.map((s) => (
                      <Badge key={s} variant="info">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Jobs */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="sp-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                Open Positions
                {jobs.length > 0 && (
                  <span className="ml-2 text-sm font-normal" style={{ color: 'var(--color-muted)' }}>({jobs.length})</span>
                )}
              </h2>
              {(isAdmin || isMember) && (
                <Link to="/jobs">
                  <Button variant="ghost" size="sm" leftIcon={<Plus className="w-4 h-4" />}>Post Job</Button>
                </Link>
              )}
            </div>
            {jobs.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-dim)' }} />
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No open positions right now</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => <JobCard key={job._id} job={job} />)}
              </div>
            )}
          </motion.div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Members */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="sp-card rounded-2xl p-5">
            <h2 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Team</h2>
            <div className="space-y-3">
              {company.members
                .filter((m) => m.role === 'admin' || m.role === 'recruiter')
                .slice(0, 8)
                .map((m) => (
                  <div key={m.user._id} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
                      style={{ background: 'var(--color-shade-md)' }}>
                      {m.user.profilePicture ? (
                        <img src={m.user.profilePicture} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm font-semibold"
                          style={{ color: 'var(--color-accent)' }}>
                          {m.user.firstName[0]}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {m.user.firstName} {m.user.lastName}
                      </p>
                      <p className="text-xs capitalize" style={{ color: 'var(--color-muted)' }}>{m.role}</p>
                    </div>
                    {m.role === 'admin' && <Star className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />}
                  </div>
                ))}
            </div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="sp-card rounded-2xl p-5 space-y-3">
            <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Overview</h2>
            {[
              { label: 'Followers', value: followerCount },
              { label: 'Open Jobs', value: jobs.filter((j) => j.status === 'active').length },
              { label: 'Team Size', value: company.members.length },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--color-muted)' }}>{label}</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{value}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showEditModal && (
          <CompanyFormModal
            initial={company}
            onClose={() => setShowEditModal(false)}
            onSaved={() => {
              setShowEditModal(false);
              qc.invalidateQueries({ queryKey: ['company', id] });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
