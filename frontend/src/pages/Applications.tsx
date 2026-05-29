/**
 * Applications page — candidates see their applications + status timeline.
 * Recruiters see applicants for each of their jobs.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Clock, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, MessageSquare, User, Calendar,
  ArrowRight, RefreshCw, FileText, Download, Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { apiService } from '@services/api';
import { useAuth } from '@stores/authStore';
import { Button } from '@components/ui/Button';
import { Avatar } from '@components/ui/Avatar';
import { decryptBinaryFromSender } from '@services/crypto';

/* ── Status config ──────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  pending:      { label: 'Applied',       color: '#60a5fa', bg: '#60a5fa20', Icon: Clock },
  reviewed:     { label: 'Reviewed',      color: '#a78bfa', bg: '#a78bfa20', Icon: RefreshCw },
  interviewing: { label: 'Interviewing',  color: '#fbbf24', bg: '#fbbf2420', Icon: MessageSquare },
  offered:      { label: 'Offer Received',color: '#34d399', bg: '#34d39920', Icon: CheckCircle2 },
  accepted:     { label: 'Accepted',      color: '#10b981', bg: '#10b98120', Icon: CheckCircle2 },
  rejected:     { label: 'Not Selected',  color: '#f87171', bg: '#f8717120', Icon: XCircle },
  withdrawn:    { label: 'Withdrawn',     color: '#9ca3af', bg: '#9ca3af20', Icon: XCircle },
};

const RECRUITER_STATUSES = ['pending', 'reviewed', 'interviewing', 'offered', 'rejected'];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const { Icon, label, color, bg } = cfg;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ color, background: bg }}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

/* ── Candidate: Application card ────────────────────────────── */
function AppCard({ app }: { app: any }) {
  const [expanded, setExpanded] = useState(false);
  const job = app.job ?? {};
  const history: any[] = app.statusHistory ?? [];

  return (
    <motion.div layout className="sp-card rounded-2xl overflow-hidden">
      <div className="p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--color-shade)', border: '1px solid var(--color-border)' }}>
          <Briefcase className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>{job.title ?? 'Unknown Job'}</h3>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
                {job.company ?? ''}{job.location ? ` · ${job.location}` : ''}{job.type ? ` · ${job.type}` : ''}
              </p>
            </div>
            <StatusBadge status={app.status} />
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--color-dim)' }}>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />
              Applied {format(new Date(app.createdAt), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
        <button onClick={() => setExpanded(v => !v)} className="flex-shrink-0 p-1 rounded-lg sp-hover">
          {expanded ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
            : <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden">
            <div className="px-5 pb-5" style={{ borderTop: '1px solid var(--color-border)' }}>
              {/* Status timeline */}
              <p className="text-xs font-semibold uppercase tracking-wider mt-4 mb-3"
                style={{ color: 'var(--color-muted)' }}>Status Timeline</p>
              <div className="space-y-2">
                {history.map((h: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: STATUS_CONFIG[h.status]?.color ?? '#9ca3af' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      {STATUS_CONFIG[h.status]?.label ?? h.status}
                    </span>
                    <span className="text-xs ml-auto" style={{ color: 'var(--color-dim)' }}>
                      {format(new Date(h.changedAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                ))}
              </div>
              {app.notes && (
                <div className="mt-3 p-3 rounded-xl text-sm" style={{ background: 'var(--color-shade)', color: 'var(--color-text)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-muted)' }}>Recruiter Notes</p>
                  {app.notes}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Recruiter: Applicant row ────────────────────────────────── */
function ApplicantRow({ app, onStatusChange }: { app: any; onStatusChange: (appId: string, status: string) => void }) {
  const [showActions, setShowActions] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const applicant = app.applicant ?? {};

  const hasResume = !!(app.resumeCiphertext && app.applicantPublicKey);

  async function viewResume() {
    setDecrypting(true);
    try {
      const res = await apiService.jobs.getApplicationResume(app._id);
      const { resumeCiphertext, resumeIv, applicantPublicKey, resumeOriginalName, resumeMimeType } = res.data.data;
      const plainBuf = await decryptBinaryFromSender(applicantPublicKey, resumeCiphertext, resumeIv);
      const blob = new Blob([plainBuf], { type: resumeMimeType ?? 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resumeOriginalName ?? 'resume.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 90_000);
      toast.success('Resume decrypted and downloaded');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to decrypt resume');
    } finally {
      setDecrypting(false);
    }
  }

  return (
    <motion.div layout className="sp-card rounded-xl p-4 flex items-center gap-4">
      <Avatar src={applicant.profilePicture} name={`${applicant.firstName} ${applicant.lastName}`} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-medium" style={{ color: 'var(--color-text)' }}>
          {applicant.firstName} {applicant.lastName}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{applicant.headline}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-dim)' }}>
          Applied {format(new Date(app.createdAt), 'MMM d, yyyy')}
        </p>
        {hasResume && (
          <span className="inline-flex items-center gap-1 text-xs mt-1" style={{ color: '#a78bfa' }}>
            <Lock className="w-3 h-3" /> E2EE Resume attached
          </span>
        )}
      </div>
      <StatusBadge status={app.status} />
      {hasResume && (
        <button onClick={viewResume} disabled={decrypting}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold sp-hover flex items-center gap-1 disabled:opacity-50"
          style={{ color: '#a78bfa', border: '1px solid #a78bfa40' }}
          title="Decrypt and download applicant's resume">
          {decrypting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          {decrypting ? 'Decrypting…' : 'Resume'}
        </button>
      )}
      <div className="relative">
        <button onClick={() => setShowActions(v => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold sp-hover flex items-center gap-1"
          style={{ color: 'var(--color-accent)', border: '1px solid var(--color-accent)40' }}>
          Update <ChevronDown className="w-3 h-3" />
        </button>
        <AnimatePresence>
          {showActions && (
            <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden shadow-2xl min-w-[160px]"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
              {RECRUITER_STATUSES.map(s => (
                <button key={s} onClick={() => { onStatusChange(app._id, s); setShowActions(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm sp-hover flex items-center gap-2"
                  style={{ color: STATUS_CONFIG[s]?.color ?? 'var(--color-text)' }}>
                  {STATUS_CONFIG[s]?.label ?? s}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
export default function ApplicationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isRecruiter = user?.accountType === 'recruiter';
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Candidate: my applications
  const myAppsQ = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => apiService.jobs.getMyApplications().then(r => r.data),
    enabled: !isRecruiter,
  });

  // Recruiter: my job postings
  const myJobsQ = useQuery({
    queryKey: ['my-jobs'],
    queryFn: () => apiService.jobs.getJobs({ employer: 'me', limit: 50 }).then(r => r.data),
    enabled: isRecruiter,
  });

  // Recruiter: applicants for selected job
  const jobAppsQ = useQuery({
    queryKey: ['job-applications', selectedJobId, statusFilter],
    queryFn: () => apiService.jobs.getJobApplications(selectedJobId!, { status: statusFilter }).then(r => r.data),
    enabled: isRecruiter && !!selectedJobId,
  });

  const statusMut = useMutation({
    mutationFn: ({ appId, status }: { appId: string; status: string }) =>
      apiService.jobs.updateApplicationStatus(appId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-applications', selectedJobId] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const myApps: any[] = myAppsQ.data?.data ?? [];
  const myJobs: any[] = myJobsQ.data?.data ?? [];
  const jobApps: any[] = jobAppsQ.data?.data ?? [];

  /* ── Stats for candidate ── */
  const stats = {
    total: myApps.length,
    active: myApps.filter(a => !['rejected', 'withdrawn'].includes(a.status)).length,
    interviewing: myApps.filter(a => a.status === 'interviewing').length,
    offered: myApps.filter(a => a.status === 'offered').length,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
        {isRecruiter ? 'Manage Applications' : 'My Applications'}
      </h1>

      {/* ── CANDIDATE VIEW ── */}
      {!isRecruiter && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Applied', value: stats.total, color: '#60a5fa' },
              { label: 'In Progress', value: stats.active, color: '#a78bfa' },
              { label: 'Interviewing', value: stats.interviewing, color: '#fbbf24' },
              { label: 'Offers', value: stats.offered, color: '#34d399' },
            ].map(s => (
              <div key={s.label} className="sp-card rounded-2xl p-4 text-center">
                <p className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Application list */}
          {myAppsQ.isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full animate-spin"
                style={{ border: '3px solid var(--color-shade-md)', borderTopColor: 'var(--color-accent)' }} />
            </div>
          ) : myApps.length === 0 ? (
            <div className="sp-card rounded-2xl p-12 text-center">
              <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-dim)' }} />
              <p className="font-medium" style={{ color: 'var(--color-text)' }}>No applications yet</p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
                Start applying to jobs to track your progress here.
              </p>
              <Button size="sm" className="mt-4" onClick={() => window.location.href = '/jobs'}
                rightIcon={<ArrowRight className="w-4 h-4" />}>
                Browse Jobs
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {myApps.map(app => <AppCard key={app._id} app={app} />)}
            </div>
          )}
        </>
      )}

      {/* ── RECRUITER VIEW ── */}
      {isRecruiter && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Job selector */}
          <div className="lg:col-span-1 space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
              Your Job Postings
            </p>
            {myJobsQ.isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 rounded-full animate-spin"
                  style={{ border: '2px solid var(--color-shade-md)', borderTopColor: 'var(--color-accent)' }} />
              </div>
            ) : myJobs.length === 0 ? (
              <div className="sp-card rounded-xl p-6 text-center">
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No active job postings</p>
              </div>
            ) : (
              myJobs.map((job: any) => (
                <button key={job._id} onClick={() => setSelectedJobId(job._id)}
                  className="w-full text-left sp-card rounded-xl p-3.5 transition-all"
                  style={{ border: selectedJobId === job._id ? '1px solid var(--color-accent)' : '1px solid transparent' }}>
                  <p className="font-medium text-sm truncate" style={{ color: 'var(--color-text)' }}>{job.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                    {job.applicationCount ?? 0} applicant{job.applicationCount !== 1 ? 's' : ''}
                  </p>
                </button>
              ))
            )}
          </div>

          {/* Applicants panel */}
          <div className="lg:col-span-2 space-y-3">
            {!selectedJobId ? (
              <div className="sp-card rounded-2xl p-12 text-center">
                <User className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-dim)' }} />
                <p style={{ color: 'var(--color-muted)' }}>Select a job to see applicants</p>
              </div>
            ) : (
              <>
                {/* Status filter */}
                <div className="flex gap-2 flex-wrap">
                  {['', ...RECRUITER_STATUSES].map(s => (
                    <button key={s || 'all'} onClick={() => setStatusFilter(s)}
                      className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                      style={{
                        background: statusFilter === s ? 'var(--color-accent)' : 'var(--color-shade)',
                        color: statusFilter === s ? 'white' : 'var(--color-muted)',
                      }}>
                      {s ? (STATUS_CONFIG[s]?.label ?? s) : 'All'}
                    </button>
                  ))}
                </div>

                {jobAppsQ.isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 rounded-full animate-spin"
                      style={{ border: '2px solid var(--color-shade-md)', borderTopColor: 'var(--color-accent)' }} />
                  </div>
                ) : jobApps.length === 0 ? (
                  <div className="sp-card rounded-2xl p-10 text-center">
                    <p style={{ color: 'var(--color-muted)' }}>No applications for this job yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {jobApps.map(app => (
                      <ApplicantRow key={app._id} app={app}
                        onStatusChange={(appId, status) => statusMut.mutate({ appId, status })} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
