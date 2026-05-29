import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Pencil, Plus, X, Camera, MapPin, Globe,
  GraduationCap, UserCheck, UserPlus, Loader2,
  Building2, Calendar, FileText, Upload, Trash2, Download, Lock, Key
} from 'lucide-react';
import { apiService } from '@services/api';
import { useAuth } from '@stores/authStore';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { encryptResume, decryptResume, hasResumeKey } from '@services/crypto';

/* ─── Types ─── */
interface Experience {
  _id?: string;
  title: string;
  company: string;
  location?: string;
  from: string;
  to?: string;
  current: boolean;
  description?: string;
}
interface Education {
  _id?: string;
  school: string;
  degree: string;
  field: string;
  from: string;
  to?: string;
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
  resume?: {
    originalName: string;
    mimeType: string;
    uploadedAt: string;
  };
}

/* ─── Skeleton ─── */
function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-40 rounded-2xl bg-shade" />
      <div className="sp-card rounded-2xl p-6 space-y-4">
        <div className="flex gap-4">
          <div className="w-24 h-24 rounded-2xl bg-shade -mt-16" />
          <div className="flex-1 space-y-2 mt-2">
            <div className="h-5 bg-shade rounded w-1/3" />
            <div className="h-3 bg-shade rounded w-1/2" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Section wrapper ─── */
function Section({ title, onAdd, onEdit, children }: {
  title: string;
  onAdd?: () => void;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="sp-card p-6" style={{ borderRadius: 8 }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>{title}</h2>
        <div className="flex gap-1">
          {onEdit && (
            <button onClick={onEdit} className="p-1.5 rounded-lg hover-shade transition">
              <Pencil className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
            </button>
          )}
          {onAdd && (
            <button onClick={onAdd} className="p-1.5 rounded-lg hover-shade transition">
              <Plus className="w-5 h-5" style={{ color: 'var(--color-muted)' }} />
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
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
    phone: (profile as any).phone ?? '',
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
        <LabelInput label="Phone" value={form.phone} onChange={v => setForm(f => ({...f, phone: v}))} />
        <LabelInput label="Website" value={form.website} onChange={v => setForm(f => ({...f, website: v}))} />
        <LabelInput label="Industry" value={form.industry} onChange={v => setForm(f => ({...f, industry: v}))} />
        <div>
          <label className="text-xs font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--color-muted)' }}>About</label>
          <textarea
            rows={4} value={form.about} maxLength={2600}
            onChange={e => setForm(f => ({...f, about: e.target.value}))}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
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
  const [form, setForm] = useState<Experience>(item ?? { title: '', company: '', from: '', current: false });
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
          <LabelInput label="Start Date" type="month" value={form.from} onChange={v => setForm(f => ({...f, from: v}))} />
          {!form.current && <LabelInput label="End Date" type="month" value={form.to ?? ''} onChange={v => setForm(f => ({...f, to: v}))} />}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-muted)' }}>
          <input type="checkbox" checked={form.current} onChange={e => setForm(f => ({...f, current: e.target.checked, to: undefined}))}
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
  const [form, setForm] = useState<Education>(item ?? { school: '', degree: '', field: '', from: '', current: false });
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
        <LabelInput label="Field of Study" value={form.field} onChange={v => setForm(f => ({...f, field: v}))} />
        <div className="grid grid-cols-2 gap-3">
          <LabelInput label="Start Date" type="month" value={form.from} onChange={v => setForm(f => ({...f, from: v}))} />
          {!form.current && <LabelInput label="End Date" type="month" value={form.to ?? ''} onChange={v => setForm(f => ({...f, to: v}))} />}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-muted)' }}>
          <input type="checkbox" checked={form.current} onChange={e => setForm(f => ({...f, current: e.target.checked, to: undefined}))}
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
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        className="sp-card rounded-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="font-bold" style={{ color: 'var(--color-text)' }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover-shade transition">
            <X className="w-5 h-5" style={{ color: 'var(--color-muted)' }} />
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
      <label className="text-xs font-medium uppercase tracking-wider block mb-1" style={{ color: 'var(--color-muted)' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none"
        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
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

  /* Resume mutations */
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [showResumeTotpModal, setShowResumeTotpModal] = useState(false);
  const [resumeTotpCode, setResumeTotpCode] = useState('');
  const [resumeTotpLoading, setResumeTotpLoading] = useState(false);
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [passphraseMode, setPassphraseMode] = useState<'upload' | 'download'>('upload');
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);

  /** Called when user selects a file — shows passphrase modal if key not cached */
  const handleResumeFileSelect = (file: File) => {
    setPendingUploadFile(file);
    setPassphraseMode('upload');
    setPassphraseInput('');
    setShowPassphraseModal(true);
  };

  /** Encrypt file in browser, then upload ciphertext to server */
  const handleResumeEncryptAndUpload = async (passphrase: string, file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const { ciphertext, salt, iv } = await encryptResume(passphrase, buffer);
      const ciphertextAB = new ArrayBuffer(ciphertext.length);
      new Uint8Array(ciphertextAB).set(ciphertext);
      const blob = new Blob([ciphertextAB], { type: 'application/octet-stream' });
      const fd = new FormData();
      fd.append('resume', blob, 'resume.enc');
      fd.append('salt', salt);
      fd.append('iv', iv);
      fd.append('originalName', file.name);
      fd.append('mimeType', file.type);
      await apiService.users.uploadResume(fd);
      qc.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Resume encrypted and uploaded (zero-knowledge)');
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed');
    }
  };

  const handlePassphraseConfirm = async () => {
    const passphrase = passphraseInput.trim();
    if (!passphrase) { toast.error('Passphrase cannot be empty'); return; }
    setShowPassphraseModal(false);
    setPassphraseInput('');
    if (passphraseMode === 'upload' && pendingUploadFile) {
      await handleResumeEncryptAndUpload(passphrase, pendingUploadFile);
      setPendingUploadFile(null);
    } else if (passphraseMode === 'download') {
      await doResumeDownload(passphrase);
    }
  };

  const handleResumeDownload = async () => {
    if (!resumeTotpCode.trim() || resumeTotpCode.length !== 6) {
      toast.error('Enter your 6-digit TOTP code');
      return;
    }
    setShowResumeTotpModal(false);
    // Check whether the derived key is cached — if not, ask for passphrase
    if (!hasResumeKey()) {
      setPassphraseMode('download');
      setPassphraseInput('');
      setShowPassphraseModal(true);
    } else {
      await doResumeDownload(null);
    }
  };

  const doResumeDownload = async (passphrase: string | null) => {
    setResumeTotpLoading(true);
    try {
      const resp = await fetch(
        `/api/users/me/resume?totp=${encodeURIComponent(resumeTotpCode.trim())}`,
        { credentials: 'include' }
      );
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.message ?? `Download failed (${resp.status})`);
      }

      // Read ZK headers before consuming body
      const saltHex = resp.headers.get('x-resume-salt') ?? '';
      const ivHex = resp.headers.get('x-resume-iv') ?? '';
      if (!saltHex || !ivHex) throw new Error('Server did not return encryption metadata');

      const ciphertextBuf = await resp.arrayBuffer();
      const plainBuf = await decryptResume(passphrase, saltHex, ivHex, ciphertextBuf);

      const mimeType = profile?.resume?.mimeType ?? 'application/octet-stream';
      const blob = new Blob([plainBuf], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = profile?.resume?.originalName ?? 'resume';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      setResumeTotpCode('');
      toast.success('Resume decrypted and downloaded');
    } catch (err: any) {
      toast.error(err.message ?? 'Download failed');
    } finally {
      setResumeTotpLoading(false);
    }
  };

  const deleteResumeMut = useMutation({
    mutationFn: () => apiService.users.deleteResume(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Resume deleted'); },
    onError: () => toast.error('Delete failed'),
  });

  if (isLoading) return <ProfileSkeleton />;
  if (isError || !profile) return (
    <div className="sp-card rounded-2xl p-10 text-center">
      <p className="mb-3" style={{ color: 'var(--color-muted)' }}>Profile not found</p>
      <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
    </div>
  );

  return (
    <div className="max-w-[860px] mx-auto px-4 pt-6 pb-20 space-y-3">

      {/* ── Top Card: banner + avatar + info + actions ── */}
      <div className="sp-card overflow-hidden" style={{ borderRadius: 8 }}>
        {/* Banner */}
        <div
          className="relative"
          style={{
            height: 200,
            background: profile.coverImage
              ? undefined
              : 'linear-gradient(135deg, #0073B1 0%, #00A0DC 55%, #00C5D4 100%)',
            backgroundImage: profile.coverImage ? `url(${profile.coverImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {isOwnProfile && (
            <>
              <button
                onClick={() => coverInputRef.current?.click()}
                className="absolute top-3 right-3 p-2 rounded-full transition"
                style={{ background: 'rgba(0,0,0,0.45)', zIndex: 3 }}
                title="Change cover photo"
              >
                {uploadCoverMut.isPending
                  ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                  : <Camera className="w-4 h-4 text-white" />}
              </button>
              <input
                ref={coverInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { uploadCoverMut.mutate(f); e.target.value = ''; } }}
              />
            </>
          )}
        </div>

        {/* Avatar + action buttons row (overlapping banner) */}
        <div className="px-6 pb-5">
          {/* position:relative + zIndex:2 ensures this row stays ABOVE the banner (position:relative, z:auto) */}
          <div className="flex items-end justify-between" style={{ marginTop: -60, position: 'relative', zIndex: 2 }}>
            {/* Avatar */}
            <div className="relative" style={{ zIndex: 1 }}>
              {/* Custom 120px circle — Avatar size props go to <img>, so we render directly */}
              <div style={{
                width: 120, height: 120, borderRadius: '50%', overflow: 'hidden',
                border: '4px solid var(--color-card)',
                background: 'linear-gradient(135deg, var(--color-accent, #0073B1), #00A0DC)',
                flexShrink: 0,
              }}>
                {profile.profilePicture ? (
                  <img
                    src={profile.profilePicture}
                    alt={profile.fullName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 40, fontWeight: 700 }}>
                    {profile.fullName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                )}
              </div>
              {isOwnProfile && (
                <>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-1 right-1 p-1.5 rounded-full shadow-md transition"
                    style={{ background: 'var(--color-accent)', zIndex: 3 }}
                  >
                    {uploadAvatarMut.isPending
                      ? <Loader2 className="w-3 h-3 text-white animate-spin" />
                      : <Camera className="w-3 h-3 text-white" />}
                  </button>
                  <input
                    ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { uploadAvatarMut.mutate(f); e.target.value = ''; } }}
                  />
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pb-1">
              {isOwnProfile ? (
                <Button variant="outline" leftIcon={<Pencil className="w-4 h-4" />} onClick={() => setModal({ type: 'basic' })}>
                  Edit profile
                </Button>
              ) : profile.isConnected ? (
                <Button variant="outline" leftIcon={<UserCheck className="w-4 h-4" />} disabled>Connected</Button>
              ) : profile.isPending ? (
                <Button variant="outline" disabled>Request Sent</Button>
              ) : (
                <Button leftIcon={<UserPlus className="w-4 h-4" />} onClick={() => connectMut.mutate()} isLoading={connectMut.isPending}>
                  Connect
                </Button>
              )}
            </div>
          </div>

          {/* Name · headline · location · stats */}
          <div className="mt-3">
            <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
              {profile.fullName}
            </h1>
            {profile.headline && (
              <p className="mt-0.5 text-base" style={{ color: 'var(--color-muted)' }}>{profile.headline}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm" style={{ color: 'var(--color-dim)' }}>
              {profile.location && (
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{profile.location}</span>
              )}
              {profile.industry && <span>{profile.industry}</span>}
              {profile.website && (
                <a
                  href={profile.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:underline"
                  style={{ color: 'var(--color-accent)' }}
                >
                  <Globe className="w-3.5 h-3.5" />
                  {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="font-semibold cursor-pointer hover:underline" style={{ color: 'var(--color-accent)' }}>
                {profile.connections} connections
              </span>
              <span style={{ color: 'var(--color-muted)' }}>
                <strong style={{ color: 'var(--color-text)' }}>{profile.followers}</strong> followers
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── About ── */}
      {(profile.about || isOwnProfile) && (
        <Section
          title="About"
          onEdit={isOwnProfile ? () => setModal({ type: 'basic' }) : undefined}
        >
          {profile.about ? (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>{profile.about}</p>
          ) : (
            <p className="text-sm italic" style={{ color: 'var(--color-dim)' }}>Add a summary about yourself</p>
          )}
        </Section>
      )}

      {/* ── Experience ── */}
      <Section title="Experience" onAdd={isOwnProfile ? () => setModal({ type: 'exp' }) : undefined}>
        {profile.experience.length === 0 ? (
          <p className="text-sm italic" style={{ color: 'var(--color-dim)' }}>No experience added</p>
        ) : (
          <div className="space-y-5">
            {profile.experience.map((exp, i) => (
              <div key={exp._id ?? i} className="flex gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <Building2 className="w-5 h-5" style={{ color: 'var(--color-dim)' }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{exp.title}</p>
                      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                        {exp.company}{exp.location && ` · ${exp.location}`}
                      </p>
                      <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--color-dim)' }}>
                        <Calendar className="w-3 h-3" />
                        {fmtDate(exp.from)} – {exp.current ? 'Present' : fmtDate(exp.to)}
                      </p>
                    </div>
                    {isOwnProfile && (
                      <button onClick={() => setModal({ type: 'exp', item: exp })} className="p-1 rounded-lg hover-shade ml-2">
                        <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--color-dim)' }} />
                      </button>
                    )}
                  </div>
                  {exp.description && (
                    <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>{exp.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Education ── */}
      <Section title="Education" onAdd={isOwnProfile ? () => setModal({ type: 'edu' }) : undefined}>
        {profile.education.length === 0 ? (
          <p className="text-sm italic" style={{ color: 'var(--color-dim)' }}>No education added</p>
        ) : (
          <div className="space-y-5">
            {profile.education.map((edu, i) => (
              <div key={edu._id ?? i} className="flex gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <GraduationCap className="w-5 h-5" style={{ color: 'var(--color-dim)' }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{edu.school}</p>
                      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                        {edu.degree}{edu.field && `, ${edu.field}`}
                      </p>
                      <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--color-dim)' }}>
                        <Calendar className="w-3 h-3" />
                        {fmtDate(edu.from)} – {edu.current ? 'Present' : fmtDate(edu.to)}
                      </p>
                    </div>
                    {isOwnProfile && (
                      <button onClick={() => setModal({ type: 'edu', item: edu })} className="p-1 rounded-lg hover-shade ml-2">
                        <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--color-dim)' }} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Skills ── */}
      <Section title="Skills" onAdd={isOwnProfile ? () => setModal({ type: 'skills' }) : undefined}>
        {profile.skills.length === 0 ? (
          <p className="text-sm italic" style={{ color: 'var(--color-dim)' }}>No skills added</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {profile.skills.map(skill => (
              <div key={skill} className="flex items-center gap-1">
                <Badge variant="default">{skill}</Badge>
                {isOwnProfile && (
                  <button
                    onClick={() => removeSkillMut.mutate(skill)}
                    className="hover:text-red-400 transition"
                    style={{ color: 'var(--color-dim)' }}
                  >
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
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              autoFocus
            />
            <Button size="sm" onClick={() => { if (newSkill.trim()) addSkillMut.mutate(newSkill.trim()); }} isLoading={addSkillMut.isPending}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => { setModal(null); setNewSkill(''); }}><X className="w-4 h-4" /></Button>
          </div>
        )}
      </Section>

      {/* ── Resume — own profile only (ALL ZK encryption logic preserved) ── */}
      {isOwnProfile && (
        <Section title="Resume">
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
            >
              <FileText className="w-5 h-5" style={{ color: 'var(--color-dim)' }} />
            </div>
            <div className="flex-1">
              {profile.resume?.originalName ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                        {profile.resume.originalName}
                      </p>
                      <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--color-dim)' }}>
                        <Lock className="w-3 h-3" />
                        Zero-knowledge encrypted · Uploaded {new Date(profile.resume.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setResumeTotpCode(''); setShowResumeTotpModal(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover-shade"
                        style={{ color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                      <label
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition hover-shade"
                        style={{ color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                      >
                        <Upload className="w-3.5 h-3.5" /> Replace
                        <input
                          type="file"
                          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleResumeFileSelect(f); e.target.value = ''; }}
                        />
                      </label>
                      <button
                        onClick={() => deleteResumeMut.mutate()}
                        disabled={deleteResumeMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                        style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--color-dim)' }}>
                    <Key className="w-3 h-3 inline mr-1" />
                    Your resume is end-to-end encrypted. The server only stores ciphertext — your passphrase never leaves your browser.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm mb-3" style={{ color: 'var(--color-muted)' }}>
                    No resume uploaded. PDF and DOCX files are accepted (max 10MB).
                    Your resume is encrypted in your browser before upload — only you can decrypt it.
                  </p>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <Button variant="outline" size="sm" leftIcon={<Upload className="w-3.5 h-3.5" />}>
                      Upload Resume
                    </Button>
                    <input
                      ref={resumeInputRef}
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleResumeFileSelect(f); e.target.value = ''; }}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ── Modals ── */}
      <AnimatePresence>
        {modal?.type === 'basic' && <EditBasicModal profile={profile} onClose={() => setModal(null)} />}
        {modal?.type === 'exp' && <ExperienceModal item={modal.item} onClose={() => setModal(null)} />}
        {modal?.type === 'edu' && <EducationModal item={modal.item} onClose={() => setModal(null)} />}
      </AnimatePresence>

      {/* Passphrase Modal — shown before upload or if key not cached before download */}
      <AnimatePresence>
        {showPassphraseModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                  <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>
                    {passphraseMode === 'upload' ? 'Set Resume Passphrase' : 'Enter Resume Passphrase'}
                  </h3>
                </div>
                <button onClick={() => { setShowPassphraseModal(false); setPassphraseInput(''); setPendingUploadFile(null); }}
                  className="p-1 rounded-lg hover-shade">
                  <X className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
                </button>
              </div>
              <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
                {passphraseMode === 'upload'
                  ? 'Choose a passphrase to encrypt your resume. This passphrase never leaves your browser — the server only stores ciphertext. Remember it — you will need it every session to download.'
                  : 'Enter your resume passphrase to decrypt and download your resume. It will be cached for this browser tab.'}
              </p>
              <input
                type="password"
                placeholder="Enter passphrase…"
                value={passphraseInput}
                onChange={e => setPassphraseInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePassphraseConfirm()}
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-sm mb-4"
                style={{
                  background: 'var(--color-input-bg)', color: 'var(--color-text)',
                  border: '1px solid var(--color-border)', outline: 'none',
                }}
              />
              <div className="flex gap-2">
                <button onClick={() => { setShowPassphraseModal(false); setPassphraseInput(''); setPendingUploadFile(null); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold sp-hover"
                  style={{ color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
                  Cancel
                </button>
                <button onClick={handlePassphraseConfirm} disabled={!passphraseInput.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition"
                  style={{
                    background: passphraseInput.trim() ? 'var(--color-accent)' : 'var(--color-shade)',
                    color: passphraseInput.trim() ? 'white' : 'var(--color-dim)',
                  }}>
                  <Key className="w-4 h-4" />
                  {passphraseMode === 'upload' ? 'Encrypt & Upload' : 'Decrypt & Download'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resume TOTP Download Modal */}
      <AnimatePresence>
        {showResumeTotpModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                  <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>Verify Identity</h3>
                </div>
                <button onClick={() => { setShowResumeTotpModal(false); setResumeTotpCode(''); }}
                  className="p-1 rounded-lg hover-shade">
                  <X className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
                </button>
              </div>
              <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
                Enter your 6-digit authenticator code to proceed with the download.
              </p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={resumeTotpCode}
                onChange={e => setResumeTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && handleResumeDownload()}
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-center text-2xl font-mono tracking-widest mb-4"
                style={{
                  background: 'var(--color-input-bg)', color: 'var(--color-text)',
                  border: '1px solid var(--color-border)', outline: 'none',
                }}
              />
              <div className="flex gap-2">
                <button onClick={() => { setShowResumeTotpModal(false); setResumeTotpCode(''); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold sp-hover"
                  style={{ color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
                  Cancel
                </button>
                <button onClick={handleResumeDownload} disabled={resumeTotpCode.length !== 6 || resumeTotpLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition"
                  style={{
                    background: resumeTotpCode.length === 6 ? 'var(--color-accent)' : 'var(--color-shade)',
                    color: resumeTotpCode.length === 6 ? 'white' : 'var(--color-dim)',
                  }}>
                  {resumeTotpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Verify
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
