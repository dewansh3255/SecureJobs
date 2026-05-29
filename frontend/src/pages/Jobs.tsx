import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Briefcase, MapPin, Clock, DollarSign, Search, Filter,
  X, Send, Plus, CheckCircle2, Paperclip, Key, Lock, Bookmark,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiService } from '@services/api';
import { useAuth } from '@stores/authStore';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { encryptBinaryForRecipient } from '@services/crypto';
import { hasResumeKey, decryptResume } from '@services/crypto';

interface Job {
  _id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  requirements: string[];
  type: string;
  experienceLevel: string;
  salary?: { min: number; max: number; currency: string; period: string };
  skills: string[];
  remote: boolean;
  status: string;
  applicationCount: number;
  createdAt: string;
  hasApplied?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  'full-time': 'Full-time', 'part-time': 'Part-time',
  contract: 'Contract', internship: 'Internship', remote: 'Remote',
};
const LEVEL_LABELS: Record<string, string> = {
  entry: 'Entry', mid: 'Mid', senior: 'Senior', lead: 'Lead', executive: 'Executive',
};

function companyInitial(company: string): string {
  return company.charAt(0).toUpperCase();
}

function companyBgColor(company: string): string {
  const palette = ['#0A66C2', '#5E35B1', '#E91E63', '#00897B', '#F4511E', '#0288D1', '#7B1FA2', '#388E3C'];
  let hash = 0;
  for (let i = 0; i < company.length; i++) hash += company.charCodeAt(i);
  return palette[hash % palette.length];
}

function JobSkeleton() {
  return (
    <div
      className="rounded-lg p-4 animate-pulse"
      style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded flex-shrink-0" style={{ background: 'var(--color-shade)' }} />
        <div className="flex-1 space-y-2">
          <div className="h-4 rounded w-2/3" style={{ background: 'var(--color-shade)' }} />
          <div className="h-3 rounded w-1/2" style={{ background: 'var(--color-shade)' }} />
          <div className="h-3 rounded w-3/4" style={{ background: 'var(--color-shade)' }} />
        </div>
        <div className="w-5 h-5 rounded" style={{ background: 'var(--color-shade)' }} />
      </div>
    </div>
  );
}

function PostJobModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none transition";
  const inputStyle = { background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };
  const [form, setForm] = useState({
    title: '', company: '', companyRef: '', location: '', description: '',
    requirements: '', type: 'full-time', experienceLevel: 'mid',
    skills: '', remote: false,
    salaryMin: '', salaryMax: '', currency: 'USD',
  });
  const up = (f: Partial<typeof form>) => setForm(prev => ({ ...prev, ...f }));

  // Fetch user's companies for dropdown
  const { data: myCompaniesRes } = useQuery({
    queryKey: ['my-companies'],
    queryFn: () => apiService.companies.list({ mine: true }),
    enabled: user?.accountType === 'recruiter',
  });
  const myCompanies: { _id: string; name: string }[] = myCompaniesRes?.data?.data ?? [];

  const postMutation = useMutation({
    mutationFn: () => apiService.jobs.create({
      title: form.title, company: form.company, location: form.location,
      description: form.description,
      requirements: form.requirements.split('\n').map(s => s.trim()).filter(Boolean),
      type: form.type, experienceLevel: form.experienceLevel,
      skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      remote: form.remote,
      ...(form.companyRef ? { companyRef: form.companyRef } : {}),
      ...(form.salaryMin && form.salaryMax ? {
        salary: { min: Number(form.salaryMin), max: Number(form.salaryMax), currency: form.currency, period: 'year' }
      } : {}),
    }),
    onSuccess: () => {
      toast.success('Job posted!');
      qc.invalidateQueries({ queryKey: ['jobs'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Could not post job');
    },
  });

  const valid = form.title && form.company && form.location && form.description;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="sp-card rounded-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className="font-bold" style={{ color: 'var(--color-text)' }}>Post a New Job</h2>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Fill in the details below to post your listing</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl transition hover-shade"><X className="w-5 h-5" style={{ color: 'var(--color-muted)' }} /></button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-muted)' }}>Job Title *</label>
              <input className={inputCls} style={inputStyle} value={form.title} onChange={e => up({ title: e.target.value })} placeholder="e.g. Senior Software Engineer" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-muted)' }}>Company *</label>
              {myCompanies.length > 0 ? (
                <select className={inputCls} style={inputStyle} value={form.companyRef}
                  onChange={e => {
                    const selected = myCompanies.find(c => c._id === e.target.value);
                    up({ companyRef: e.target.value, company: selected?.name ?? form.company });
                  }}>
                  <option value="">Type manually…</option>
                  {myCompanies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              ) : (
                <input className={inputCls} style={inputStyle} value={form.company} onChange={e => up({ company: e.target.value })} placeholder="e.g. Nexus Corp" />
              )}
              {myCompanies.length > 0 && !form.companyRef && (
                <input className={`${inputCls} mt-2`} style={inputStyle} value={form.company} onChange={e => up({ company: e.target.value })} placeholder="Or type company name" />
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-muted)' }}>Location *</label>
            <input className={inputCls} style={inputStyle} value={form.location} onChange={e => up({ location: e.target.value })} placeholder="e.g. Mumbai, India or Remote" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-muted)' }}>Job Type</label>
              <select className={inputCls} style={inputStyle} value={form.type} onChange={e => up({ type: e.target.value })}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-muted)' }}>Experience Level</label>
              <select className={inputCls} style={inputStyle} value={form.experienceLevel} onChange={e => up({ experienceLevel: e.target.value })}>
                {Object.entries(LEVEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-muted)' }}>Description *</label>
            <textarea rows={5} className={inputCls} style={inputStyle} value={form.description}
              onChange={e => up({ description: e.target.value })} placeholder="Describe the role, responsibilities, and what you're looking for…" maxLength={5000} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-muted)' }}>Requirements <span style={{ color: 'var(--color-dim)' }}>(one per line)</span></label>
            <textarea rows={3} className={inputCls} style={inputStyle} value={form.requirements}
              onChange={e => up({ requirements: e.target.value })} placeholder="3+ years of experience&#10;Strong communication skills" />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-muted)' }}>Skills <span style={{ color: 'var(--color-dim)' }}>(comma-separated)</span></label>
            <input className={inputCls} style={inputStyle} value={form.skills} onChange={e => up({ skills: e.target.value })} placeholder="React, TypeScript, Node.js" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-muted)' }}>Min Salary</label>
              <input type="number" className={inputCls} style={inputStyle} value={form.salaryMin} onChange={e => up({ salaryMin: e.target.value })} placeholder="50000" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-muted)' }}>Max Salary</label>
              <input type="number" className={inputCls} style={inputStyle} value={form.salaryMax} onChange={e => up({ salaryMax: e.target.value })} placeholder="80000" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-muted)' }}>Currency</label>
              <select className={inputCls} style={inputStyle} value={form.currency} onChange={e => up({ currency: e.target.value })}>
                <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="INR">INR</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => up({ remote: !form.remote })}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{ background: form.remote ? 'var(--color-accent)' : 'var(--color-shade-md)' }}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${form.remote ? 'left-6' : 'left-1'}`} />
            </button>
            <span className="text-sm" style={{ color: 'var(--color-text)' }}>Remote-friendly role</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => postMutation.mutate()} isLoading={postMutation.isPending}
            disabled={!valid} leftIcon={<CheckCircle2 className="w-4 h-4" />}>
            Post Job
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ApplyModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const [coverLetter, setCoverLetter] = useState('');
  const [attachResume, setAttachResume] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const qc = useQueryClient();

  // Fetch user profile to know if they have a resume
  const { data: profileData } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => apiService.users.me(),
    select: (d: { data?: { data?: { resume?: { originalName?: string; mimeType?: string } } } }) =>
      d?.data?.data,
  });
  const hasProfileResume = !!profileData?.resume?.originalName;

  const applyMutation = useMutation({
    mutationFn: (data: {
      coverLetter?: string;
      resumeCiphertext?: string;
      resumeIv?: string;
      resumeOriginalName?: string;
      resumeMimeType?: string;
      applicantPublicKey?: string;
    }) => apiService.jobs.apply(job._id, data),
    onSuccess: () => {
      toast.success('Application submitted!');
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['my-applications'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Could not submit application');
    },
  });

  const handleSubmit = async () => {
    if (!attachResume || !hasProfileResume) {
      applyMutation.mutate({ coverLetter: coverLetter || undefined });
      return;
    }

    // Need to encrypt resume for recruiter — check if ZK key is cached
    if (!hasResumeKey()) {
      setShowPassphraseModal(true);
      return;
    }
    await doEncryptAndApply(null);
  };

  const doEncryptAndApply = async (passphrase: string | null) => {
    setIsEncrypting(true);
    try {
      // 1. Get employer's ECDH public key
      const keyResp = await apiService.jobs.getEmployerKey(job._id);
      const employerPublicKeyJwk = JSON.parse(keyResp.data.data.publicKey) as JsonWebKey;

      // 2. Fetch the ZK resume ciphertext (no TOTP needed — user is authenticated, browser decrypts locally)
      const resumeResp = await fetch('/api/users/me/resume/raw', { credentials: 'include' });
      if (!resumeResp.ok) {
        const d = await resumeResp.json().catch(() => ({}));
        throw new Error((d as { message?: string }).message ?? 'Failed to fetch resume ciphertext');
      }

      const saltHex = resumeResp.headers.get('x-resume-salt') ?? '';
      const ivHex = resumeResp.headers.get('x-resume-iv') ?? '';
      if (!saltHex || !ivHex) throw new Error('Resume encryption metadata missing');

      const ciphertextBuf = await resumeResp.arrayBuffer();
      const plainBuf = await decryptResume(passphrase, saltHex, ivHex, ciphertextBuf);

      // 3. Re-encrypt the plaintext for the employer using ECDH
      const { ciphertext, iv, senderPublicKeyJwk } = await encryptBinaryForRecipient(employerPublicKeyJwk, plainBuf);

      // 4. Submit application with E2EE resume
      await applyMutation.mutateAsync({
        coverLetter: coverLetter || undefined,
        resumeCiphertext: ciphertext,
        resumeIv: iv,
        resumeOriginalName: profileData?.resume?.originalName,
        resumeMimeType: profileData?.resume?.mimeType,
        applicantPublicKey: JSON.stringify(senderPublicKeyJwk),
      });
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? 'Failed to encrypt resume';
      toast.error(msg);
    } finally {
      setIsEncrypting(false);
    }
  };

  const handlePassphraseConfirm = async () => {
    const p = passphraseInput.trim();
    if (!p) { toast.error('Passphrase required'); return; }
    setShowPassphraseModal(false);
    setPassphraseInput('');
    await doEncryptAndApply(p);
  };

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none transition";
  const inputStyle = { background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };

  return (
    <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="sp-card rounded-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className="font-bold" style={{ color: 'var(--color-text)' }}>Apply for {job.title}</h2>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{job.company}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl transition hover-shade">
            <X className="w-5 h-5" style={{ color: 'var(--color-muted)' }} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Profile resume attach toggle */}
          {hasProfileResume && (
            <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition hover-shade"
              style={{ border: `1px solid ${attachResume ? 'var(--color-accent)' : 'var(--color-border)'}` }}>
              <input type="checkbox" checked={attachResume} onChange={e => setAttachResume(e.target.checked)}
                className="w-4 h-4 accent-accent" />
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  <Paperclip className="w-3.5 h-3.5 inline mr-1.5" />
                  Attach profile resume
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-dim)' }}>
                  <Lock className="w-3 h-3 inline mr-1" />
                  {profileData?.resume?.originalName} — will be E2EE encrypted for this recruiter only
                </p>
              </div>
            </label>
          )}
          {!hasProfileResume && (
            <div className="p-3 rounded-xl text-sm" style={{ background: 'var(--color-bg)', color: 'var(--color-dim)' }}>
              Upload a resume to your profile to attach it to applications.
            </div>
          )}

          <div>
            <label className="text-xs font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-muted)' }}>
              Cover Letter <span style={{ color: 'var(--color-dim)' }}>(optional)</span>
            </label>
            <textarea rows={5} value={coverLetter} onChange={e => setCoverLetter(e.target.value)}
              placeholder="Tell the employer why you're a great fit…"
              maxLength={5000} className={inputCls} style={inputStyle} />
          </div>
          <Button className="w-full" onClick={handleSubmit}
            isLoading={applyMutation.isPending || isEncrypting}
            leftIcon={<Send className="w-4 h-4" />}>
            {isEncrypting ? 'Encrypting resume…' : 'Submit Application'}
          </Button>
        </div>
      </motion.div>
    </motion.div>

    {/* Passphrase modal — shown when ZK resume key not cached */}
    <AnimatePresence>
      {showPassphraseModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
            className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
              <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>Resume Passphrase</h3>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
              Enter your resume passphrase to decrypt and re-encrypt it for the recruiter. Neither your passphrase nor the plaintext file leaves your browser.
            </p>
            <input type="password" placeholder="Enter passphrase…" value={passphraseInput}
              onChange={e => setPassphraseInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePassphraseConfirm()}
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-sm mb-4"
              style={{ background: 'var(--color-input-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', outline: 'none' }}
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowPassphraseModal(false); setPassphraseInput(''); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold sp-hover"
                style={{ color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
                Cancel
              </button>
              <button onClick={handlePassphraseConfirm} disabled={!passphraseInput.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition"
                style={{ background: passphraseInput.trim() ? 'var(--color-accent)' : 'var(--color-shade)', color: passphraseInput.trim() ? 'white' : 'var(--color-dim)' }}>
                <Key className="w-4 h-4" /> Encrypt & Apply
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}

export default function JobsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [jobType, setJobType] = useState('');
  const [level, setLevel] = useState('');
  const [remote, setRemote] = useState(false);
  const [minSalary, setMinSalary] = useState('');
  const [maxSalary, setMaxSalary] = useState('');
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [applyJob, setApplyJob] = useState<Job | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const isRecruiter = (user?.accountType ?? 'candidate') === 'recruiter' || user?.role === 'admin' || user?.role === 'moderator';

  const params: Record<string, string | number> = { page, limit: 10 };
  if (searchQuery.trim()) params.q = searchQuery.trim();
  if (jobType) params.type = jobType;
  if (level) params.level = level;
  if (remote) params.remote = 'true';
  if (minSalary) params.minSalary = minSalary;
  if (maxSalary) params.maxSalary = maxSalary;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['jobs', params],
    queryFn: () => apiService.jobs.getJobs(params).then(r => r.data),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  /* AI-powered recommended jobs (shown in sidebar when no filters active) */
  const { data: recData } = useQuery({
    queryKey: ['job-recommendations'],
    queryFn: () => apiService.recommendations.jobs(5).then(r => r.data),
    staleTime: 60_000,
    enabled: !searchQuery && !jobType && !location && !level && !remote,
  });
  const recommendedJobs: Job[] = recData?.data ?? [];

  const jobs: Job[] = data?.data ?? [];
  const totalPages: number = data?.pagination?.pages ?? 1;

  const inputCls = "px-3 py-2 rounded-xl text-sm outline-none";
  const inputStyle = { background: 'var(--color-bg)', border: '1px solid var(--color-shade-md)', color: 'var(--color-text)' };

  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const toggleSave = (id: string) => setSavedJobIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="max-w-[1128px] mx-auto px-4 pt-6 pb-20">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Jobs</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Find your next opportunity or post a listing</p>
        </div>
        {isRecruiter && (
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowPostModal(true)}>
            Post a Job
          </Button>
        )}
        {!isRecruiter && (
          <button
            onClick={() => window.location.href = '/settings'}
            className="text-xs px-3 py-1.5 rounded-lg transition"
            style={{ color: 'var(--color-accent)', border: '1px solid rgba(10,102,194,0.3)' }}
          >
            Switch to Recruiter →
          </button>
        )}
      </div>

      {/* Search + Filters */}
      <div className="sp-card rounded-lg p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-dim)' }} />
            <input type="text" value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search jobs by title, company, or keyword…"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-shade-md)', color: 'var(--color-text)' }} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={jobType} onChange={e => { setJobType(e.target.value); setPage(1); }}
              className={inputCls} style={inputStyle}>
              <option value="">All Types</option>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={level} onChange={e => { setLevel(e.target.value); setPage(1); }}
              className={inputCls} style={inputStyle}>
              <option value="">All Levels</option>
              {Object.entries(LEVEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button
              onClick={() => { setRemote(!remote); setPage(1); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition"
              style={{
                background: remote ? 'rgba(10,102,194,0.1)' : 'var(--color-bg)',
                border: `1px solid ${remote ? 'var(--color-accent)' : 'var(--color-shade-md)'}`,
                color: remote ? 'var(--color-accent)' : 'var(--color-muted)',
              }}
            >
              <Filter className="w-3.5 h-3.5" /> Remote
            </button>
          </div>
        </div>
        <div className="flex gap-3 mt-3 flex-wrap items-center">
          <DollarSign className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-dim)' }} />
          <input type="number" value={minSalary} min="0"
            onChange={e => { setMinSalary(e.target.value); setPage(1); }}
            placeholder="Min salary"
            className="w-28 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-shade-md)', color: 'var(--color-text)' }} />
          <span style={{ color: 'var(--color-muted)' }} className="text-sm">–</span>
          <input type="number" value={maxSalary} min="0"
            onChange={e => { setMaxSalary(e.target.value); setPage(1); }}
            placeholder="Max salary"
            className="w-28 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-shade-md)', color: 'var(--color-text)' }} />
          {(minSalary || maxSalary) && (
            <button onClick={() => { setMinSalary(''); setMaxSalary(''); setPage(1); }}
              className="text-xs px-2 py-1 rounded-md"
              style={{ color: 'var(--color-accent)', background: 'rgba(10,102,194,0.08)' }}>
              Clear salary
            </button>
          )}
        </div>
      </div>

      {/* Two-column layout: 60% list / 40% detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* ── Left: Job list (3/5 = 60%) ── */}
        <div className="lg:col-span-3 space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <JobSkeleton key={i} />)
          ) : isError ? (
            <div className="rounded-lg p-8 text-center" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
              <p className="mb-3">Could not load jobs</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-lg p-10 text-center" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
              <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--color-accent)' }} />
              <p style={{ color: 'var(--color-muted)' }}>No jobs found</p>
            </div>
          ) : (
            <>
              {jobs.map(job => (
                <motion.div
                  key={job._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedJob(job)}
                  className="rounded-lg p-4 cursor-pointer transition-all"
                  style={{
                    background: selectedJob?._id === job._id ? 'rgba(10,102,194,0.03)' : 'var(--color-card)',
                    border: selectedJob?._id === job._id
                      ? '1px solid var(--color-accent)'
                      : '1px solid var(--color-border)',
                    borderLeft: `3px solid ${selectedJob?._id === job._id ? 'var(--color-accent)' : 'transparent'}`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Company logo — colored initial square */}
                    <div
                      className="w-12 h-12 flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
                      style={{ background: companyBgColor(job.company), borderRadius: 4 }}
                    >
                      {companyInitial(job.company)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--color-text)' }}>
                        {job.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{job.company}</p>
                      <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--color-dim)' }}>
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {job.location}
                        {job.remote && (
                          <span className="font-medium" style={{ color: '#2e7d32' }}>· Remote</span>
                        )}
                      </p>
                      {job.salary && (
                        <p className="text-xs mt-1 flex items-center gap-0.5" style={{ color: 'var(--color-muted)' }}>
                          <DollarSign className="w-3 h-3" />
                          {job.salary.min.toLocaleString()}–{job.salary.max.toLocaleString()} {job.salary.currency}
                        </p>
                      )}
                      <div className="flex gap-1 mt-2">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: 'var(--color-shade)', color: 'var(--color-muted)' }}>
                          {TYPE_LABELS[job.type] ?? job.type}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: 'var(--color-shade)', color: 'var(--color-muted)' }}>
                          {LEVEL_LABELS[job.experienceLevel] ?? job.experienceLevel}
                        </span>
                      </div>
                    </div>

                    {/* Bookmark + posted-date */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-1">
                      <button
                        onClick={e => { e.stopPropagation(); toggleSave(job._id); }}
                        className="p-1 rounded transition-colors"
                        style={{ color: savedJobIds.has(job._id) ? 'var(--color-accent)' : 'var(--color-dim)' }}
                      >
                        <Bookmark className="w-4 h-4" fill={savedJobIds.has(job._id) ? 'currentColor' : 'none'} />
                      </button>
                      <span className="text-xs" style={{ color: 'var(--color-dim)' }}>
                        {formatDistanceToNow(new Date(job.createdAt), { addSuffix: false })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                  <span className="text-sm self-center" style={{ color: 'var(--color-muted)' }}>{page}/{totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right: Job detail pane (2/5 = 40%, sticky) ── */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedJob ? (
              <motion.div
                key={selectedJob._id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  className="rounded-lg p-6 sticky top-24 overflow-y-auto"
                  style={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    maxHeight: 'calc(100vh - 7rem)',
                  }}
                >
                  {/* Company logo + title */}
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-14 h-14 flex-shrink-0 flex items-center justify-center text-white font-bold text-xl"
                      style={{ background: companyBgColor(selectedJob.company), borderRadius: 4 }}
                    >
                      {companyInitial(selectedJob.company)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.25 }}>
                        {selectedJob.title}
                      </h2>
                      <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--color-muted)' }}>
                        {selectedJob.company}
                      </p>
                      <p className="text-sm flex items-center gap-1 mt-0.5" style={{ color: 'var(--color-muted)' }}>
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        {selectedJob.location}
                        {selectedJob.remote && (
                          <span className="ml-1 text-xs font-semibold" style={{ color: '#2e7d32' }}>· Remote</span>
                        )}
                      </p>
                    </div>
                    <button onClick={() => setSelectedJob(null)}
                      className="p-1.5 rounded-lg transition lg:hidden flex-shrink-0"
                      style={{ color: 'var(--color-muted)' }}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Apply + Save buttons */}
                  <div className="flex items-center gap-2 mb-4">
                    {selectedJob.hasApplied ? (
                      <div className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full"
                        style={{ background: 'rgba(46,125,50,0.1)', color: '#2e7d32' }}>
                        <Briefcase className="w-4 h-4" /> Applied ✓
                      </div>
                    ) : (
                      <Button size="md" variant="primary"
                        leftIcon={<Send className="w-4 h-4" />}
                        onClick={() => setApplyJob(selectedJob)}>
                        Apply now
                      </Button>
                    )}
                    <Button size="md" variant="outline"
                      leftIcon={
                        <Bookmark className="w-4 h-4"
                          fill={savedJobIds.has(selectedJob._id) ? 'currentColor' : 'none'} />
                      }
                      onClick={() => toggleSave(selectedJob._id)}>
                      {savedJobIds.has(selectedJob._id) ? 'Saved' : 'Save'}
                    </Button>
                  </div>

                  {/* Meta badges + stats */}
                  <div className="flex flex-wrap gap-2 pb-4 mb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <Badge>{TYPE_LABELS[selectedJob.type] ?? selectedJob.type}</Badge>
                    <Badge variant="default">{LEVEL_LABELS[selectedJob.experienceLevel] ?? selectedJob.experienceLevel}</Badge>
                    {selectedJob.salary && (
                      <Badge variant="default" className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {selectedJob.salary.min.toLocaleString()}–{selectedJob.salary.max.toLocaleString()} {selectedJob.salary.currency}/{selectedJob.salary.period}
                      </Badge>
                    )}
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-dim)' }}>
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(selectedJob.createdAt), { addSuffix: true })}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-dim)' }}>
                      {selectedJob.applicationCount} applicants
                    </span>
                  </div>

                  {/* Description */}
                  <div className="mb-4">
                    <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>About the Role</h3>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-muted)' }}>
                      {selectedJob.description}
                    </p>
                  </div>

                  {selectedJob.requirements.length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Requirements</h3>
                      <ul className="space-y-1">
                        {selectedJob.requirements.map((r, i) => (
                          <li key={i} className="text-sm flex gap-2" style={{ color: 'var(--color-muted)' }}>
                            <span style={{ color: 'var(--color-accent)' }} className="mt-0.5">•</span> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedJob.skills.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Skills</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedJob.skills.map(s => (
                          <Badge key={s} variant="default">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {recommendedJobs.length > 0 ? (
                  <div className="rounded-lg p-5" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                      <Briefcase className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
                      Recommended for you
                    </h3>
                    <div className="space-y-2">
                      {recommendedJobs.map(job => (
                        <button key={job._id} onClick={() => setSelectedJob(job)}
                          className="w-full text-left p-3 rounded-lg transition flex items-start gap-3"
                          style={{ border: '1px solid var(--color-border)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-shade)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-white font-bold text-sm rounded"
                            style={{ background: companyBgColor(job.company) }}>
                            {companyInitial(job.company)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{job.title}</p>
                            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-muted)' }}>{job.company} · {job.location}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center">
                      <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: 'var(--color-accent)' }} />
                      <p style={{ color: 'var(--color-muted)' }}>Select a job to view details</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Apply Modal */}
      <AnimatePresence>
        {applyJob && <ApplyModal job={applyJob} onClose={() => setApplyJob(null)} />}
      </AnimatePresence>

      {/* Post Job Modal (recruiters only) */}
      <AnimatePresence>
        {showPostModal && <PostJobModal onClose={() => setShowPostModal(false)} />}
      </AnimatePresence>
    </div>
  );
}
