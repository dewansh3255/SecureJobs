import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Pencil, Plus, X, Camera, MapPin, Globe,
  GraduationCap, UserCheck, UserPlus, Loader2,
  Building2, Calendar
} from 'lucide-react';
import { apiService } from '@services/api';
import { useAuth } from '@stores/authStore';
import { Card } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Avatar } from '@components/ui/Avatar';
import { Badge } from '@components/ui/Badge';

/* ─── Types ─── */
interface Experience {
  _id?: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: string;
}
interface Education {
  _id?: string;
  school: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: string;
}
interface ProfileData {
  _id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  headline?: string;
  about?: string;
  location?: string;
  website?: string;
  industry?: string;
  profilePicture?: string;
  coverImage?: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  connections: number;
  followers: number;
  following: number;
  isConnected?: boolean;
  isPending?: boolean;
}

/* ─── Skeleton ─── */
function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-40 bg-gray-200 dark:bg-dark-700 rounded-xl" />
      <Card className="p-6 space-y-4">
        <div className="flex gap-4">
          <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-dark-700 -mt-16 ring-4 ring-white dark:ring-dark-800" />
          <div className="flex-1 space-y-2 mt-2">
            <div className="h-5 bg-gray-200 dark:bg-dark-700 rounded w-1/3" />
            <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded w-1/2" />
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ─── Section wrapper ─── */
function Section({ title, onAdd, children }: { title: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        {onAdd && (
          <button onClick={onAdd} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-full transition">
            <Plus className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        )}
      </div>
      {children}
    </Card>
  );
}

/* ─── Date helpers ─── */
function fmtDate(d?: string) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/* ─── Edit Headline / About modal ─── */
function EditBasicModal({ profile, onClose }: { profile: ProfileData; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    headline: profile.headline ?? '',
    location: profile.location ?? '',
    website: profile.website ?? '',
    industry: profile.industry ?? '',
    about: profile.about ?? '',
  });
  const mut = useMutation({
    mutationFn: () => apiService.users.update(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Profile updated'); onClose(); },
    onError: () => toast.error('Update failed'),
  });
  return (
    <ModalShell title="Edit Basic Info" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <LabelInput label="First Name" value={form.firstName} onChange={v => setForm(f => ({...f, firstName: v}))} />
          <LabelInput label="Last Name" value={form.lastName} onChange={v => setForm(f => ({...f, lastName: v}))} />
        </div>
        <LabelInput label="Headline" value={form.headline} onChange={v => setForm(f => ({...f, headline: v}))} />
        <LabelInput label="Location" value={form.location} onChange={v => setForm(f => ({...f, location: v}))} />
        <LabelInput label="Website" value={form.website} onChange={v => setForm(f => ({...f, website: v}))} />
        <LabelInput label="Industry" value={form.industry} onChange={v => setForm(f => ({...f, industry: v}))} />
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">About</label>
          <textarea
            rows={4} value={form.about} maxLength={2600}
            onChange={e => setForm(f => ({...f, about: e.target.value}))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-linkedin-500 resize-none"
          />
        </div>
        <Button className="w-full" onClick={() => mut.mutate()} isLoading={mut.isPending}>Save</Button>
      </div>
    </ModalShell>
  );
}

/* ─── Experience modal ─── */
function ExperienceModal({ item, onClose }: { item?: Experience; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Experience>(item ?? { title: '', company: '', startDate: '', current: false });
  const mut = useMutation({
    mutationFn: async () => {
      const { data: me } = await apiService.users.me();
      const exp: Experience[] = me.data.experience ?? [];
      let next: Experience[];
      if (item?._id) {
        next = exp.map(e => e._id === item._id ? { ...form } : e);
      } else {
        next = [...exp, form];
      }
      return apiService.users.update({ experience: next });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Saved'); onClose(); },
    onError: () => toast.error('Save failed'),
  });
  return (
    <ModalShell title={item ? 'Edit Experience' : 'Add Experience'} onClose={onClose}>
      <div className="space-y-3">
        <LabelInput label="Title *" value={form.title} onChange={v => setForm(f => ({...f, title: v}))} />
        <LabelInput label="Company *" value={form.company} onChange={v => setForm(f => ({...f, company: v}))} />
        <LabelInput label="Location" value={form.location ?? ''} onChange={v => setForm(f => ({...f, location: v}))} />
        <div className="grid grid-cols-2 gap-3">
          <LabelInput label="Start Date" type="month" value={form.startDate} onChange={v => setForm(f => ({...f, startDate: v}))} />
          {!form.current && <LabelInput label="End Date" type="month" value={form.endDate ?? ''} onChange={v => setForm(f => ({...f, endDate: v}))} />}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={form.current} onChange={e => setForm(f => ({...f, current: e.target.checked, endDate: undefined}))}
            className="w-4 h-4 accent-linkedin-600" />
          I currently work here
        </label>
        <Button className="w-full" onClick={() => mut.mutate()} isLoading={mut.isPending} disabled={!form.title || !form.company}>Save</Button>
      </div>
    </ModalShell>
  );
}

/* ─── Education modal ─── */
function EducationModal({ item, onClose }: { item?: Education; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Education>(item ?? { school: '', degree: '', fieldOfStudy: '', startDate: '', current: false });
  const mut = useMutation({
    mutationFn: async () => {
      const { data: me } = await apiService.users.me();
      const edu: Education[] = me.data.education ?? [];
      let next: Education[];
      if (item?._id) next = edu.map(e => e._id === item._id ? { ...form } : e);
      else next = [...edu, form];
      return apiService.users.update({ education: next });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Saved'); onClose(); },
    onError: () => toast.error('Save failed'),
  });
  return (
    <ModalShell title={item ? 'Edit Education' : 'Add Education'} onClose={onClose}>
      <div className="space-y-3">
        <LabelInput label="School *" value={form.school} onChange={v => setForm(f => ({...f, school: v}))} />
        <LabelInput label="Degree *" value={form.degree} onChange={v => setForm(f => ({...f, degree: v}))} />
        <LabelInput label="Field of Study" value={form.fieldOfStudy} onChange={v => setForm(f => ({...f, fieldOfStudy: v}))} />
        <div className="grid grid-cols-2 gap-3">
          <LabelInput label="Start Date" type="month" value={form.startDate} onChange={v => setForm(f => ({...f, startDate: v}))} />
          {!form.current && <LabelInput label="End Date" type="month" value={form.endDate ?? ''} onChange={v => setForm(f => ({...f, endDate: v}))} />}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input type="checkbox" checked={form.current} onChange={e => setForm(f => ({...f, current: e.target.checked, endDate: undefined}))}
            className="w-4 h-4 accent-linkedin-600" />
          Currently enrolled
        </label>
        <Button className="w-full" onClick={() => mut.mutate()} isLoading={mut.isPending} disabled={!form.school || !form.degree}>Save</Button>
      </div>
    </ModalShell>
  );
}

/* ─── Shared helpers ─── */
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-dark-700">
          <h2 className="font-bold text-gray-900 dark:text-gray-100">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-full">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function LabelInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-linkedin-500" />
    </div>
  );
}

/* ─── Main Page ─── */
export default function ProfilePage() {
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = !id || id === user?.id;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['profile', id ?? 'me'],
    queryFn: () =>
      isOwnProfile
        ? apiService.users.me().then(r => r.data)
        : apiService.users.get(id!).then(r => r.data),
    staleTime: 30_000,
  });

  const profile: ProfileData | undefined = data?.data;

  /* Upload mutations */
  const uploadAvatarMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData(); fd.append('photo', file);
      return apiService.users.uploadPhoto(fd);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Photo updated'); },
    onError: () => toast.error('Upload failed'),
  });
  const uploadCoverMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData(); fd.append('cover', file);
      return apiService.users.uploadCover(fd);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Cover updated'); },
    onError: () => toast.error('Upload failed'),
  });

  /* Connection mutations */
  const connectMut = useMutation({
    mutationFn: () => apiService.connections.send(id!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile', id] }); toast.success('Connection request sent'); },
    onError: () => toast.error('Could not send request'),
  });

  /* Modals state */
  const [modal, setModal] = useState<
    | null
    | { type: 'basic' }
    | { type: 'skills' }
    | { type: 'exp'; item?: Experience }
    | { type: 'edu'; item?: Education }
  >(null);
  const [newSkill, setNewSkill] = useState('');

  const addSkillMut = useMutation({
    mutationFn: (skill: string) => apiService.users.update({ skills: [...(profile?.skills ?? []), skill] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setNewSkill(''); },
  });
  const removeSkillMut = useMutation({
    mutationFn: (skill: string) => apiService.users.update({ skills: (profile?.skills ?? []).filter(s => s !== skill) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });

  if (isLoading) return <ProfileSkeleton />;
  if (isError || !profile) return (
    <Card className="p-10 text-center">
      <p className="text-gray-500 dark:text-gray-400 mb-3">Profile not found</p>
      <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
    </Card>
  );

  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-4">
      {/* Cover + Avatar */}
      <div>
        <div className="relative h-44 rounded-t-2xl overflow-hidden bg-gradient-to-br from-linkedin-600 to-blue-700">
          {profile.coverImage && (
            <img src={profile.coverImage} alt="cover" className="w-full h-full object-cover" />
          )}
          {isOwnProfile && (
            <>
              <button
                onClick={() => coverInputRef.current?.click()}
                className="absolute bottom-3 right-3 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={coverInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadCoverMut.mutate(f); }}
              />
            </>
          )}
        </div>

        <Card className="rounded-t-none p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* Avatar */}
            <div className="relative -mt-20 shrink-0">
              <Avatar
                name={profile.fullName}
                src={profile.profilePicture}
                size="xl"
                className="ring-4 ring-white dark:ring-dark-800 w-24 h-24 text-2xl"
              />
              {isOwnProfile && (
                <>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-0 right-0 bg-linkedin-600 hover:bg-linkedin-700 text-white p-1.5 rounded-full shadow transition"
                  >
                    {uploadAvatarMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                  </button>
                  <input
                    ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatarMut.mutate(f); }}
                  />
                </>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 sm:mt-0 mt-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{profile.fullName}</h1>
              {profile.headline && (
                <p className="text-gray-600 dark:text-gray-400 mt-0.5">{profile.headline}</p>
              )}
              {profile.location && (
                <p className="text-sm text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5" /> {profile.location}
                </p>
              )}
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-linkedin-600 hover:underline flex items-center gap-1 mt-0.5">
                  <Globe className="w-3.5 h-3.5" /> {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400"><strong className="text-gray-900 dark:text-gray-100">{profile.connections}</strong> connections</span>
                <span className="text-gray-600 dark:text-gray-400"><strong className="text-gray-900 dark:text-gray-100">{profile.followers}</strong> followers</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 shrink-0">
              {isOwnProfile ? (
                <Button variant="outline" leftIcon={<Pencil className="w-4 h-4" />} onClick={() => setModal({ type: 'basic' })}>Edit</Button>
              ) : profile.isConnected ? (
                <Button variant="outline" leftIcon={<UserCheck className="w-4 h-4" />} disabled>Connected</Button>
              ) : profile.isPending ? (
                <Button variant="outline" disabled>Request Sent</Button>
              ) : (
                <Button leftIcon={<UserPlus className="w-4 h-4" />} onClick={() => connectMut.mutate()} isLoading={connectMut.isPending}>Connect</Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* About */}
      {(profile.about || isOwnProfile) && (
        <Section title="About" onAdd={isOwnProfile ? () => setModal({ type: 'basic' }) : undefined}>
          {profile.about ? (
            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{profile.about}</p>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 text-sm italic">Add a summary about yourself</p>
          )}
        </Section>
      )}

      {/* Experience */}
      <Section title="Experience" onAdd={isOwnProfile ? () => setModal({ type: 'exp' }) : undefined}>
        {profile.experience.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-sm italic">No experience added</p>
        ) : (
          <div className="space-y-5">
            {profile.experience.map((exp, i) => (
              <div key={exp._id ?? i} className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{exp.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{exp.company}{exp.location && ` · ${exp.location}`}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {fmtDate(exp.startDate)} – {exp.current ? 'Present' : fmtDate(exp.endDate)}
                      </p>
                    </div>
                    {isOwnProfile && (
                      <button onClick={() => setModal({ type: 'exp', item: exp })} className="p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-full ml-2">
                        <Pencil className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    )}
                  </div>
                  {exp.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{exp.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Education */}
      <Section title="Education" onAdd={isOwnProfile ? () => setModal({ type: 'edu' }) : undefined}>
        {profile.education.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-sm italic">No education added</p>
        ) : (
          <div className="space-y-5">
            {profile.education.map((edu, i) => (
              <div key={edu._id ?? i} className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{edu.school}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{edu.degree}{edu.fieldOfStudy && `, ${edu.fieldOfStudy}`}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {fmtDate(edu.startDate)} – {edu.current ? 'Present' : fmtDate(edu.endDate)}
                      </p>
                    </div>
                    {isOwnProfile && (
                      <button onClick={() => setModal({ type: 'edu', item: edu })} className="p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-full ml-2">
                        <Pencil className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Skills */}
      <Section title="Skills" onAdd={isOwnProfile ? () => setModal({ type: 'skills' }) : undefined}>
        {profile.skills.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-sm italic">No skills added</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {profile.skills.map(skill => (
              <div key={skill} className="flex items-center gap-1">
                <Badge variant="default">{skill}</Badge>
                {isOwnProfile && (
                  <button onClick={() => removeSkillMut.mutate(skill)} className="text-gray-300 hover:text-red-400 transition">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {modal?.type === 'skills' && isOwnProfile && (
          <div className="flex gap-2 mt-4">
            <input
              type="text"
              value={newSkill}
              onChange={e => setNewSkill(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newSkill.trim()) { addSkillMut.mutate(newSkill.trim()); } }}
              placeholder="Type a skill and press Enter"
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-linkedin-500"
              autoFocus
            />
            <Button size="sm" onClick={() => { if (newSkill.trim()) addSkillMut.mutate(newSkill.trim()); }} isLoading={addSkillMut.isPending}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => { setModal(null); setNewSkill(''); }}><X className="w-4 h-4" /></Button>
          </div>
        )}
      </Section>

      {/* Modals */}
      <AnimatePresence>
        {modal?.type === 'basic' && <EditBasicModal profile={profile} onClose={() => setModal(null)} />}
        {modal?.type === 'exp' && <ExperienceModal item={modal.item} onClose={() => setModal(null)} />}
        {modal?.type === 'edu' && <EducationModal item={modal.item} onClose={() => setModal(null)} />}
      </AnimatePresence>
    </div>
  );
}
