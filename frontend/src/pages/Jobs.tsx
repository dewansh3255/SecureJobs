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
import { Card } from '@components/ui/Card';
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
    <div className="bg-white dark:bg-dark-800 rounded-xl shadow-soft p-4 space-y-3 animate-pulse">
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-dark-700" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-2/3" />
          <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded w-1/2" />
        </div>
      </div>
      <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded w-3/4" />
      <div className="flex gap-2">
        <div className="h-5 w-16 bg-gray-200 dark:bg-dark-700 rounded-full" />
        <div className="h-5 w-20 bg-gray-200 dark:bg-dark-700 rounded-full" />
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-dark-700">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-gray-100">Apply for {job.title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{job.company}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-full">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
              Resume URL <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="url"
              value={resumeUrl}
              onChange={e => setResumeUrl(e.target.value)}
              placeholder="https://your-resume.com/resume.pdf"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-linkedin-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
              Cover Letter <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              rows={5}
              value={coverLetter}
              onChange={e => setCoverLetter(e.target.value)}
              placeholder="Tell the employer why you're a great fit…"
              maxLength={5000}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-linkedin-500 resize-none"
            />
          </div>
          <Button
            className="w-full"
            onClick={() => applyMutation.mutate()}
            isLoading={applyMutation.isPending}
            leftIcon={<Send className="w-4 h-4" />}
          >
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

  const jobs: Job[] = data?.data ?? [];
  const totalPages: number = data?.pagination?.pages ?? 1;

  return (
    <div className="max-w-6xl mx-auto pb-10">
      {/* Search + Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search jobs by title, company, or keyword…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-linkedin-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={jobType}
              onChange={e => { setJobType(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-linkedin-500"
            >
              <option value="">All Types</option>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select
              value={level}
              onChange={e => { setLevel(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-linkedin-500"
            >
              <option value="">All Levels</option>
              {Object.entries(LEVEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button
              onClick={() => { setRemote(!remote); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition ${remote ? 'border-linkedin-600 bg-linkedin-50 dark:bg-linkedin-900/20 text-linkedin-600' : 'border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-dark-700'}`}
            >
              <Filter className="w-3.5 h-3.5" /> Remote
            </button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Job List */}
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <JobSkeleton key={i} />)
          ) : isError ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-3">Could not load jobs</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </Card>
          ) : jobs.length === 0 ? (
            <Card className="p-10 text-center">
              <Briefcase className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 font-medium">No jobs found</p>
            </Card>
          ) : (
            <>
              {jobs.map(job => (
                <motion.div
                  key={job._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedJob(job)}
                  className={`cursor-pointer rounded-xl border transition-all ${selectedJob?._id === job._id ? 'border-linkedin-500 ring-2 ring-linkedin-200 dark:ring-linkedin-800' : 'border-transparent'}`}
                >
                  <Card variant="hover" className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center shrink-0">
                        <Building2 className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{job.title}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{job.company}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />{job.location} {job.remote && '· Remote'}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          <Badge variant="default" className="text-xs">{TYPE_LABELS[job.type] ?? job.type}</Badge>
                          <Badge variant="default" className="text-xs">{LEVEL_LABELS[job.experienceLevel] ?? job.experienceLevel}</Badge>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
                    </div>
                  </Card>
                </motion.div>
              ))}
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                  <span className="text-sm text-gray-500 dark:text-gray-400 self-center">{page}/{totalPages}</span>
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
                <Card className="p-6 sticky top-24 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedJob.title}</h2>
                      <p className="text-gray-600 dark:text-gray-400 font-medium mt-0.5">{selectedJob.company}</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500 flex items-center gap-1.5 mt-1">
                        <MapPin className="w-4 h-4" />{selectedJob.location}
                        {selectedJob.remote && <Badge variant="default" className="ml-1">Remote</Badge>}
                      </p>
                    </div>
                    <button onClick={() => setSelectedJob(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-full text-gray-400 lg:hidden">
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
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(selectedJob.createdAt), { addSuffix: true })}
                    </span>
                    <span className="text-xs text-gray-400">{selectedJob.applicationCount} applicants</span>
                  </div>

                  {/* Apply button */}
                  {selectedJob.hasApplied ? (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium bg-green-50 dark:bg-green-900/20 rounded-xl px-4 py-2.5">
                      <Briefcase className="w-4 h-4" /> Applied ✓
                    </div>
                  ) : (
                    <Button
                      className="w-full sm:w-auto"
                      leftIcon={<Send className="w-4 h-4" />}
                      onClick={() => setApplyJob(selectedJob)}
                    >
                      Apply Now
                    </Button>
                  )}

                  <div className="border-t border-gray-100 dark:border-dark-700 pt-4">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">About the Role</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {selectedJob.description}
                    </p>
                  </div>

                  {selectedJob.requirements.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Requirements</h3>
                      <ul className="space-y-1">
                        {selectedJob.requirements.map((r, i) => (
                          <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
                            <span className="text-linkedin-600 mt-0.5">•</span> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedJob.skills.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Skills</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedJob.skills.map(s => (
                          <Badge key={s} variant="default">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-64 flex items-center justify-center"
              >
                <div className="text-center text-gray-400 dark:text-gray-500">
                  <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>Select a job to view details</p>
                </div>
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
