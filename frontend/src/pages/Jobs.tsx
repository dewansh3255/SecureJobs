import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Briefcase, MapPin, Clock, DollarSign, Search, Filter,
  ChevronRight, X, Send, Building2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiService } from '@services/api';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';

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

function JobSkeleton() {
  return (
    <div className="sp-card rounded-2xl p-4 space-y-3 animate-pulse">
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded-xl bg-white/5" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-white/5 rounded w-2/3" />
          <div className="h-3 bg-white/5 rounded w-1/2" />
        </div>
      </div>
      <div className="h-3 bg-white/5 rounded w-3/4" />
      <div className="flex gap-2">
        <div className="h-5 w-16 bg-white/5 rounded-full" />
        <div className="h-5 w-20 bg-white/5 rounded-full" />
      </div>
    </div>
  );
}

function ApplyModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const qc = useQueryClient();

  const applyMutation = useMutation({
    mutationFn: () => apiService.jobs.apply(job._id, { coverLetter, resumeUrl: resumeUrl || undefined }),
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

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none transition";
  const inputStyle = { background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };

  return (
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
          <button onClick={onClose} className="p-2 rounded-xl transition hover:bg-white/5">
            <X className="w-5 h-5" style={{ color: 'var(--color-muted)' }} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-muted)' }}>
              Resume URL <span style={{ color: 'var(--color-dim)' }}>(optional)</span>
            </label>
            <input type="url" value={resumeUrl} onChange={e => setResumeUrl(e.target.value)}
              placeholder="https://your-resume.com/resume.pdf"
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-muted)' }}>
              Cover Letter <span style={{ color: 'var(--color-dim)' }}>(optional)</span>
            </label>
            <textarea rows={5} value={coverLetter} onChange={e => setCoverLetter(e.target.value)}
              placeholder="Tell the employer why you're a great fit…"
              maxLength={5000} className={inputCls} style={inputStyle} />
          </div>
          <Button className="w-full" onClick={() => applyMutation.mutate()} isLoading={applyMutation.isPending}
            leftIcon={<Send className="w-4 h-4" />}>
            Submit Application
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function JobsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [jobType, setJobType] = useState('');
  const [level, setLevel] = useState('');
  const [remote, setRemote] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [applyJob, setApplyJob] = useState<Job | null>(null);

  const params: Record<string, string | number> = { page, limit: 10 };
  if (searchQuery.trim()) params.q = searchQuery.trim();
  if (jobType) params.type = jobType;
  if (level) params.level = level;
  if (remote) params.remote = 'true';

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

  return (
    <div className="max-w-6xl mx-auto pb-10">
      {/* Search + Filters */}
      <div className="sp-card rounded-2xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-dim)' }} />
            <input type="text" value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search jobs by title, company, or keyword…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition"
              style={{
                background: remote ? 'rgba(124,111,224,0.2)' : 'var(--color-bg)',
                border: `1px solid ${remote ? 'rgba(124,111,224,0.5)' : 'var(--color-shade-md)'}`,
                color: remote ? 'var(--color-accent)' : 'var(--color-muted)',
              }}
            >
              <Filter className="w-3.5 h-3.5" /> Remote
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Job List */}
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <JobSkeleton key={i} />)
          ) : isError ? (
            <div className="sp-card rounded-2xl p-8 text-center" style={{ color: 'var(--color-muted)' }}>
              <p className="mb-3">Could not load jobs</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : jobs.length === 0 ? (
            <div className="sp-card rounded-2xl p-10 text-center">
              <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--color-accent)' }} />
              <p style={{ color: 'var(--color-muted)' }}>No jobs found</p>
            </div>
          ) : (
            <>
              {jobs.map(job => (
                <motion.div
                  key={job._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedJob(job)}
                  className="sp-card-lift rounded-2xl p-4 cursor-pointer transition-all"
                  style={selectedJob?._id === job._id ? {
                    borderColor: 'rgba(124,111,224,0.6)',
                    boxShadow: '0 0 0 2px rgba(124,111,224,0.2)',
                  } : {}}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'var(--color-bg)' }}>
                      <Building2 className="w-6 h-6" style={{ color: 'var(--color-dim)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>{job.title}</p>
                      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{job.company}</p>
                      <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--color-dim)' }}>
                        <MapPin className="w-3 h-3" />{job.location} {job.remote && '· Remote'}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="default" className="text-xs">{TYPE_LABELS[job.type] ?? job.type}</Badge>
                        <Badge variant="default" className="text-xs">{LEVEL_LABELS[job.experienceLevel] ?? job.experienceLevel}</Badge>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0 mt-1" style={{ color: 'var(--color-dim)' }} />
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

        {/* Job Detail */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {selectedJob ? (
              <motion.div
                key={selectedJob._id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="sp-card rounded-2xl p-6 sticky top-24 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{selectedJob.title}</h2>
                      <p className="font-medium mt-0.5" style={{ color: 'var(--color-muted)' }}>{selectedJob.company}</p>
                      <p className="text-sm flex items-center gap-1.5 mt-1" style={{ color: 'var(--color-dim)' }}>
                        <MapPin className="w-4 h-4" />{selectedJob.location}
                        {selectedJob.remote && <Badge variant="default" className="ml-1">Remote</Badge>}
                      </p>
                    </div>
                    <button onClick={() => setSelectedJob(null)}
                      className="p-1.5 rounded-xl hover:bg-white/5 transition lg:hidden"
                      style={{ color: 'var(--color-muted)' }}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge>{TYPE_LABELS[selectedJob.type] ?? selectedJob.type}</Badge>
                    <Badge variant="default">{LEVEL_LABELS[selectedJob.experienceLevel] ?? selectedJob.experienceLevel}</Badge>
                    {selectedJob.salary && (
                      <Badge variant="default" className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {selectedJob.salary.min.toLocaleString()}–{selectedJob.salary.max.toLocaleString()} {selectedJob.salary.currency}/{selectedJob.salary.period}
                      </Badge>
                    )}
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-dim)' }}>
                      <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(selectedJob.createdAt), { addSuffix: true })}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-dim)' }}>{selectedJob.applicationCount} applicants</span>
                  </div>

                  {selectedJob.hasApplied ? (
                    <div className="flex items-center gap-2 text-sm font-medium rounded-xl px-4 py-2.5"
                      style={{ background: 'rgba(111,224,160,0.1)', color: '#6fe0a0' }}>
                      <Briefcase className="w-4 h-4" /> Applied ✓
                    </div>
                  ) : (
                    <Button className="w-full sm:w-auto" leftIcon={<Send className="w-4 h-4" />}
                      onClick={() => setApplyJob(selectedJob)}>
                      Apply Now
                    </Button>
                  )}

                  <div className="pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>About the Role</h3>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-muted)' }}>
                      {selectedJob.description}
                    </p>
                  </div>

                  {selectedJob.requirements.length > 0 && (
                    <div>
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
                  <div className="sp-card rounded-2xl p-5">
                    <h3 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                      <Briefcase className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
                      Recommended for you
                    </h3>
                    <div className="space-y-3">
                      {recommendedJobs.map(job => (
                        <button key={job._id} onClick={() => setSelectedJob(job)}
                          className="w-full text-left p-3 rounded-xl transition hover:bg-white/5 sp-card-lift"
                          style={{ border: '1px solid var(--color-shade)' }}>
                          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{job.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{job.company} · {job.location}</p>
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
    </div>
  );
}
