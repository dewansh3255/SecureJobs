import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Image, Send, ThumbsUp, MessageCircle, Share2, MoreHorizontal,
  Heart, Star, Lightbulb, Smile, ChevronDown, Loader2
} from 'lucide-react';
import { useAuth } from '@stores/authStore';
import { apiService } from '@services/api';
import { Card, CardContent } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Avatar } from '@components/ui/Avatar';

// ─── Types ────────────────────────────────────────────
interface Reaction {
  like: string[]; celebrate: string[]; support: string[];
  love: string[]; insightful: string[]; curious: string[];
}

interface Post {
  _id: string;
  author: { _id: string; firstName: string; lastName: string; profilePicture?: string; headline?: string };
  content: string;
  reactions: Reaction;
  reactionCount: number;
  commentCount: number;
  visibility: string;
  isEdited: boolean;
  isDeleted: boolean;
  tags: string[];
  createdAt: string;
}

interface FeedPage { data: Post[]; pagination: { page: number; pages: number; total: number } }

const REACTION_ICONS: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  like: { icon: <ThumbsUp className="w-4 h-4" />, label: 'Like', color: 'text-blue-600' },
  celebrate: { icon: <Star className="w-4 h-4" />, label: 'Celebrate', color: 'text-yellow-500' },
  support: { icon: <Heart className="w-4 h-4" />, label: 'Support', color: 'text-green-500' },
  love: { icon: <Heart className="w-4 h-4" />, label: 'Love', color: 'text-red-500' },
  insightful: { icon: <Lightbulb className="w-4 h-4" />, label: 'Insightful', color: 'text-purple-500' },
  curious: { icon: <Smile className="w-4 h-4" />, label: 'Curious', color: 'text-orange-500' },
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Skeleton ─────────────────────────────────────────
function PostSkeleton() {
  return (
    <div className="sp-card rounded-2xl p-5 space-y-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-11 h-11 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3.5 rounded-lg w-1/3" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="h-2.5 rounded-lg w-1/2" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <div className="h-2.5 rounded-lg w-5/6" style={{ background: 'rgba(255,255,255,0.04)' }} />
        <div className="h-2.5 rounded-lg w-4/6" style={{ background: 'rgba(255,255,255,0.03)' }} />
      </div>
    </div>
  );
}

// ─── Create Post Box ───────────────────────────────────
function CreatePost({ user }: { user: { firstName: string; lastName: string; profilePicture?: string } }) {
  const [content, setContent] = useState('');
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (text: string) => apiService.posts.create({ content: text }),
    onSuccess: () => {
      setContent('');
      setExpanded(false);
      qc.invalidateQueries({ queryKey: ['feed'] });
      toast.success('Post shared!');
    },
    onError: () => toast.error('Could not share post'),
  });

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Compose trigger */}
        <div className="flex gap-3 items-start p-5">
          <Avatar name={`${user.firstName} ${user.lastName}`} src={user.profilePicture} size="md" />
          <div className="flex-1">
            {!expanded ? (
              <button
                onClick={() => setExpanded(true)}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--color-dim)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,111,224,0.35)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                }}
              >
                What's on your mind?
              </button>
            ) : (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <textarea
                    autoFocus
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Share an update, idea, or article…"
                    className="w-full min-h-[110px] p-3 resize-none border-0 outline-none text-sm bg-transparent"
                    style={{ color: 'var(--color-text)', fontFamily: 'inherit' }}
                    maxLength={3000}
                  />
                  <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex gap-2">
                      <button
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all duration-200"
                        style={{ color: 'var(--color-muted)', background: 'rgba(255,255,255,0.04)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#9d94f0'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'}
                      >
                        <Image className="w-4 h-4" /> Photo
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setExpanded(false); setContent(''); }}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => createMutation.mutate(content)}
                        disabled={!content.trim() || createMutation.isPending}
                        isLoading={createMutation.isPending}
                      >
                        Post
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Post Card ─────────────────────────────────────────
function PostCard({ post, currentUserId }: { post: Post; currentUserId: string }) {
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showReactions, setShowReactions] = useState(false);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qc = useQueryClient();

  const reactMutation = useMutation({
    mutationFn: (type: string) => apiService.posts.react(post._id, type),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed'] }),
    onError: () => toast.error('Could not react'),
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) => apiService.posts.addComment(post._id, text),
    onSuccess: () => {
      setCommentText('');
      setShowCommentBox(false);
      qc.invalidateQueries({ queryKey: ['feed'] });
      toast.success('Comment added');
    },
    onError: () => toast.error('Could not add comment'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiService.posts.delete(post._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      toast.success('Post deleted');
    },
    onError: () => toast.error('Could not delete post'),
  });

  const userReaction = Object.entries(post.reactions).find(([, ids]) =>
    (ids as string[]).includes(currentUserId)
  )?.[0];

  const isOwner = post.author._id === currentUserId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-start justify-between p-5">
            <div className="flex gap-3">
              <Avatar
                name={`${post.author.firstName} ${post.author.lastName}`}
                src={post.author.profilePicture}
                size="md"
              />
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                  {post.author.firstName} {post.author.lastName}
                </p>
                {post.author.headline && (
                  <p className="text-xs line-clamp-1" style={{ color: 'var(--color-muted)' }}>{post.author.headline}</p>
                )}
                <p className="text-xs" style={{ color: 'var(--color-dim)' }}>
                  {timeAgo(post.createdAt)} {post.isEdited && '· Edited'}
                </p>
              </div>
            </div>
            {isOwner && (
              <div className="relative group">
                <button
                  className="p-1.5 rounded-lg transition-all duration-200"
                  style={{ color: 'var(--color-dim)' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--color-dim)';
                  }}
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                <div
                  className="absolute right-0 top-8 z-10 hidden group-hover:block min-w-[140px] rounded-xl overflow-hidden"
                  style={{
                    background: 'rgba(19,19,31,0.98)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }}
                >
                  <button
                    onClick={() => deleteMutation.mutate()}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition"
                  >
                    Delete post
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-5 pb-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>
              {post.content}
            </p>
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {post.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-xs font-semibold px-2 py-0.5 rounded-lg cursor-pointer transition-all duration-200 hover:underline"
                    style={{ color: '#9d94f0', background: 'rgba(124,111,224,0.12)' }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          {(post.reactionCount > 0 || post.commentCount > 0) && (
            <div
              className="px-5 pb-2 flex items-center justify-between text-xs"
              style={{ color: 'var(--color-dim)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span>{post.reactionCount > 0 ? `${post.reactionCount} reactions` : ''}</span>
              <span>{post.commentCount > 0 ? `${post.commentCount} comments` : ''}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="px-3 py-1 flex items-center gap-1">
            {/* Like with hover reactions */}
            <div
              className="relative"
              onMouseEnter={() => {
                if (reactionTimer.current) clearTimeout(reactionTimer.current);
                reactionTimer.current = setTimeout(() => setShowReactions(true), 400);
              }}
              onMouseLeave={() => {
                if (reactionTimer.current) clearTimeout(reactionTimer.current);
                reactionTimer.current = setTimeout(() => setShowReactions(false), 300);
              }}
            >
              <button
                onClick={() => reactMutation.mutate(userReaction || 'like')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${userReaction ? REACTION_ICONS[userReaction]?.color : ''}`}
                style={!userReaction ? { color: 'var(--color-muted)' } : {}}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
                disabled={reactMutation.isPending}
              >
                {userReaction ? REACTION_ICONS[userReaction]?.icon : <ThumbsUp className="w-4 h-4" />}
                <span className="hidden sm:inline">{userReaction ? REACTION_ICONS[userReaction]?.label : 'Like'}</span>
              </button>

              <AnimatePresence>
                {showReactions && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 8 }}
                    className="absolute bottom-full left-0 mb-2 rounded-2xl px-2 py-1.5 flex gap-1 z-20"
                    style={{
                      background: 'rgba(19,19,31,0.98)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}
                  >
                    {Object.entries(REACTION_ICONS).map(([type, { icon, label, color }]) => (
                      <button
                        key={type}
                        title={label}
                        onClick={() => { reactMutation.mutate(type); setShowReactions(false); }}
                        className={`p-2 rounded-xl ${color} transition-transform hover:scale-125`}
                        style={{ background: 'rgba(255,255,255,0.04)' }}
                      >
                        {icon}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setShowCommentBox(!showCommentBox)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
              style={{ color: 'var(--color-muted)' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Comment</span>
            </button>

            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
              style={{ color: 'var(--color-muted)' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>

          {/* Comment box */}
          <AnimatePresence>
            {showCommentBox && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-5 pb-4"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex gap-2 pt-4">
                  <textarea
                    autoFocus
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Add a comment…"
                    rows={2}
                    className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'var(--color-text)',
                      fontFamily: 'inherit',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(124,111,224,0.5)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                  />
                  <button
                    onClick={() => commentMutation.mutate(commentText)}
                    disabled={!commentText.trim() || commentMutation.isPending}
                    className="self-end p-2.5 rounded-xl disabled:opacity-40 transition-all duration-200"
                    style={{
                      background: 'linear-gradient(135deg, #7c6fe0, #e06fbc)',
                      color: 'white',
                    }}
                  >
                    {commentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Left Profile Card ─────────────────────────────────
function ProfileSideCard({ user }: { user: { firstName: string; lastName: string; profilePicture?: string; headline?: string; id: string } }) {
  return (
    <div className="sp-card rounded-2xl overflow-hidden sticky top-4">
      {/* Banner */}
      <div
        className="h-16"
        style={{ background: 'linear-gradient(135deg, rgba(124,111,224,0.35), rgba(224,111,188,0.25))' }}
      />
      {/* Avatar */}
      <div className="px-4 pb-4">
        <div className="-mt-7 mb-3">
          <Avatar
            name={`${user.firstName} ${user.lastName}`}
            src={user.profilePicture}
            size="lg"
            isOnline
          />
        </div>
        <a href={`/profile/${user.id}`} className="font-bold text-sm hover:underline block" style={{ color: 'var(--color-text)' }}>
          {user.firstName} {user.lastName}
        </a>
        {user.headline && (
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--color-muted)' }}>{user.headline}</p>
        )}
        <div
          className="mt-3 pt-3 text-xs"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)', color: 'var(--color-dim)' }}
        >
          <div className="flex justify-between py-1">
            <span>Profile views</span>
            <span className="font-semibold" style={{ color: '#9d94f0' }}>—</span>
          </div>
          <div className="flex justify-between py-1">
            <span>Post impressions</span>
            <span className="font-semibold" style={{ color: '#9d94f0' }}>—</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Right Suggestions Panel ───────────────────────────
function SuggestionsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['feed-suggestions'],
    queryFn: () => apiService.recommendations.connections(5).then(r => r.data),
    staleTime: 120_000,
  });
  const suggestions: Array<{ _id: string; firstName: string; lastName: string; headline?: string; profilePicture?: string }> =
    data?.data ?? [];

  return (
    <div className="space-y-4 sticky top-4">
      <div className="sp-card rounded-2xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-muted)' }}>
          People you may know
        </h3>
        <div className="space-y-3">
          {isLoading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-9 h-9 rounded-xl flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded-lg w-3/4" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  <div className="h-2 rounded-lg w-1/2" style={{ background: 'rgba(255,255,255,0.04)' }} />
                </div>
              </div>
            ))
          ) : suggestions.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-dim)' }}>No suggestions yet — build your network!</p>
          ) : (
            suggestions.map(s => (
              <a key={s._id} href={`/profile/${s._id}`} className="flex items-center gap-3 p-1 rounded-xl hover:bg-white/5 transition">
                <Avatar name={`${s.firstName} ${s.lastName}`} src={s.profilePicture} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{s.firstName} {s.lastName}</p>
                  {s.headline && <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>{s.headline}</p>}
                </div>
              </a>
            ))
          )}
        </div>
        <a href="/network" className="block text-center mt-4 text-xs font-semibold" style={{ color: '#9d94f0' }}>
          View all suggestions →
        </a>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────
export default function FeedPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery<FeedPage>({
    queryKey: ['feed', page],
    queryFn: () => apiService.posts.getFeed(page, 10).then(r => r.data),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const posts = data?.data ?? [];
  const totalPages = data?.pagination?.pages ?? 1;

  return (
    <div
      className="grid gap-5 max-w-[1200px] mx-auto"
      style={{ gridTemplateColumns: '260px 1fr 280px' }}
    >
      {/* Left: profile card */}
      <aside>
        {user && (
          <ProfileSideCard user={user} />
        )}
      </aside>

      {/* Center: feed */}
      <main className="min-w-0 space-y-4 pb-8">
        {user && <CreatePost user={user} />}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <PostSkeleton key={i} />)}
          </div>
        ) : isError ? (
          <Card className="p-8 text-center">
            <p className="text-sm mb-3" style={{ color: 'var(--color-muted)' }}>Could not load feed</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </Card>
        ) : posts.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-base font-bold mb-2" style={{ color: 'var(--color-text)' }}>Your feed is empty</p>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Connect with people to see their posts here.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard key={post._id} post={post} currentUserId={user?.id ?? ''} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <span className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next <ChevronDown className="w-3 h-3 rotate-[-90deg] ml-1" />
            </Button>
          </div>
        )}
      </main>

      {/* Right: suggestions */}
      <aside>
        <SuggestionsPanel />
      </aside>
    </div>
  );
}
