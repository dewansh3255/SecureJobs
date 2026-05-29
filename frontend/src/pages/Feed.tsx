import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Image, Send, ThumbsUp, Share2, MoreHorizontal,
  Heart, Star, Lightbulb, Smile, ChevronDown, Loader2, Bookmark, Calendar, FileText,
} from 'lucide-react';
import { useAuth } from '@stores/authStore';
import { apiService } from '@services/api';
import { Button } from '@components/ui/Button';
import { Avatar } from '@components/ui/Avatar';

// ─── Types ────────────────────────────────────────────
interface Reaction {
  like: string[]; celebrate: string[]; support: string[];
  love: string[]; insightful: string[]; curious: string[];
}

interface Comment {
  _id: string;
  content: string;
  author: { _id: string; firstName: string; lastName: string; profilePicture?: string };
  createdAt: string;
}

interface Post {
  _id: string;
  author: { _id: string; firstName: string; lastName: string; profilePicture?: string; headline?: string };
  content: string;
  reactions: Reaction;
  reactionCount: number;
  commentCount: number;
  latestComment?: Comment | null;
  visibility: string;
  isEdited: boolean;
  isDeleted: boolean;
  tags: string[];
  savedBy?: string[];
  createdAt: string;
}

interface FeedPage { data: Post[]; pagination: { page: number; pages: number; total: number } }

// Lucide icons used in the hover reaction popup
const REACTION_ICONS: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  like:       { icon: <ThumbsUp className="w-4 h-4" />,   label: 'Like',       color: 'text-blue-600' },
  celebrate:  { icon: <Star className="w-4 h-4" />,       label: 'Celebrate',  color: 'text-yellow-500' },
  support:    { icon: <Heart className="w-4 h-4" />,       label: 'Support',    color: 'text-green-500' },
  love:       { icon: <Heart className="w-4 h-4" />,       label: 'Love',       color: 'text-red-500' },
  insightful: { icon: <Lightbulb className="w-4 h-4" />,  label: 'Insightful', color: 'text-purple-500' },
  curious:    { icon: <Smile className="w-4 h-4" />,       label: 'Curious',    color: 'text-orange-500' },
};

// Emoji map for stats bar and action button display
const REACTION_EMOJI: Record<string, string> = {
  like: '👍', celebrate: '🎉', support: '🤝', love: '❤️', insightful: '��', curious: '🤔',
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
    <div className="sp-card rounded-lg p-4 space-y-3 animate-pulse">
      <div className="flex gap-3 items-start">
        <div className="w-10 h-10 rounded-lg flex-shrink-0" style={{ background: 'var(--color-shade)' }} />
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="h-3.5 rounded w-1/3" style={{ background: 'var(--color-shade)' }} />
          <div className="h-2.5 rounded w-1/2" style={{ background: 'var(--color-shade)' }} />
          <div className="h-2.5 rounded w-1/4" style={{ background: 'var(--color-shade)' }} />
        </div>
      </div>
      <div className="space-y-2 pt-1">
        <div className="h-2.5 rounded" style={{ background: 'var(--color-shade)' }} />
        <div className="h-2.5 rounded w-5/6" style={{ background: 'var(--color-shade)' }} />
        <div className="h-2.5 rounded w-4/6" style={{ background: 'var(--color-shade)' }} />
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
    <div className="sp-card rounded-lg overflow-hidden">
      {!expanded ? (
        <div className="p-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={`${user.firstName} ${user.lastName}`} src={user.profilePicture} size="sm" />
            <button
              onClick={() => setExpanded(true)}
              className="flex-1 text-left px-4 py-2.5 rounded-full text-sm font-semibold transition-colors"
              style={{ border: '1.5px solid var(--color-border)', color: 'var(--color-muted)', background: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-shade)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              Start a post
            </button>
          </div>
          <div className="flex items-center justify-around mt-2 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
            <button
              onClick={() => setExpanded(true)}
              className="sp-hover flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold"
              style={{ color: '#70b5c4' }}
            >
              <Image className="w-4 h-4" style={{ color: '#70b5c4' }} />
              Photo
            </button>
            <button
              onClick={() => setExpanded(true)}
              className="sp-hover flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold"
              style={{ color: '#e06fbc' }}
            >
              <FileText className="w-4 h-4" style={{ color: '#e06fbc' }} />
              Article
            </button>
            <button
              onClick={() => setExpanded(true)}
              className="sp-hover flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold"
              style={{ color: '#f5a623' }}
            >
              <Calendar className="w-4 h-4" style={{ color: '#f5a623' }} />
              Event
            </button>
          </div>
        </div>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 space-y-3"
          >
            <div className="flex gap-2.5 items-start">
              <Avatar name={`${user.firstName} ${user.lastName}`} src={user.profilePicture} size="sm" />
              <span className="text-sm font-semibold pt-1" style={{ color: 'var(--color-text)' }}>
                {user.firstName} {user.lastName}
              </span>
            </div>
            <textarea
              autoFocus
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Share an update, idea, or article…"
              className="w-full min-h-[100px] p-2 resize-none border-0 outline-none text-sm bg-transparent"
              style={{ color: 'var(--color-text)', fontFamily: 'inherit' }}
              maxLength={3000}
            />
            <div
              className="flex items-center justify-between pt-3"
              style={{ borderTop: '1px solid var(--color-border)' }}
            >
              <button
                className="sp-hover flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded"
                style={{ color: 'var(--color-muted)' }}
              >
                <Image className="w-4 h-4" /> Photo
              </button>
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
  );
}

// ─── Post Card ─────────────────────────────────────────
function PostCard({ post, currentUserId }: { post: Post; currentUserId: string }) {
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showReactions, setShowReactions] = useState(false);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [contentExpanded, setContentExpanded] = useState(false);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qc = useQueryClient();

  const reactMutation = useMutation({
    mutationFn: (type: string) => apiService.posts.react(post._id, type),
    onMutate: async (type: string) => {
      await qc.cancelQueries({ queryKey: ['feed'] });
      const previousData = qc.getQueriesData<FeedPage>({ queryKey: ['feed'] });
      qc.setQueriesData<FeedPage>({ queryKey: ['feed'] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((p) => {
            if (p._id !== post._id) return p;
            const newReactions = { ...p.reactions } as Reaction;
            (Object.keys(newReactions) as (keyof Reaction)[]).forEach((k) => {
              newReactions[k] = newReactions[k].filter((id) => id !== currentUserId);
            });
            const wasActive = (p.reactions[type as keyof Reaction] ?? []).includes(currentUserId);
            if (!wasActive) {
              newReactions[type as keyof Reaction] = [
                ...(newReactions[type as keyof Reaction] || []),
                currentUserId,
              ];
            }
            const newCount = (Object.values(newReactions) as string[][]).reduce((s, ids) => s + ids.length, 0);
            return { ...p, reactions: newReactions, reactionCount: newCount };
          }),
        };
      });
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data));
      }
      toast.error('Could not react');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['feed'] }),
  });

  const [isSaved, setIsSaved] = useState(() => (post.savedBy ?? []).includes(currentUserId));
  const saveMutation = useMutation({
    mutationFn: () => apiService.posts.save(post._id),
    onMutate: () => setIsSaved(prev => !prev),
    onError: () => { setIsSaved(prev => !prev); toast.error('Could not save post'); },
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) => apiService.posts.addComment(post._id, text),
    onSuccess: () => {
      setCommentText('');
      setShowCommentBox(false);
      setCommentsExpanded(true);
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['comments', post._id] });
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

  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', post._id],
    queryFn: () => apiService.posts.getComments(post._id).then(r => (r.data?.data?.comments ?? []) as Comment[]),
    enabled: commentsExpanded,
    staleTime: 30_000,
  });

  const allComments: Comment[] = commentsData ?? [];

  const userReaction = Object.entries(post.reactions).find(([, ids]) =>
    (ids as string[]).includes(currentUserId)
  )?.[0];

  const isOwner = post.author._id === currentUserId;

  // Top emoji from reaction types that have at least 1 reaction
  const topEmojis = Object.entries(post.reactions)
    .filter(([, ids]) => (ids as string[]).length > 0)
    .slice(0, 3)
    .map(([type]) => REACTION_EMOJI[type])
    .filter(Boolean);

  const needsExpand = post.content.length > 200 || (post.content.match(/\n/g) || []).length >= 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="sp-card rounded-lg overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-4 pt-4 pb-3">
          <div className="flex gap-3">
            <Link to={`/profile/${post.author._id}`} className="flex-shrink-0">
              <Avatar
                name={`${post.author.firstName} ${post.author.lastName}`}
                src={post.author.profilePicture}
                size="md"
              />
            </Link>
            <div>
              <Link
                to={`/profile/${post.author._id}`}
                className="font-bold text-sm hover:underline"
                style={{ color: 'var(--color-text)', textDecoration: 'none' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
              >
                {post.author.firstName} {post.author.lastName}
              </Link>
              {post.author.headline && (
                <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--color-muted)' }}>
                  {post.author.headline}
                </p>
              )}
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-dim)' }}>
                {timeAgo(post.createdAt)}{post.isEdited ? ' · Edited' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Save (header) */}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="sp-hover p-1.5 rounded"
              style={{ color: isSaved ? 'var(--color-accent)' : 'var(--color-dim)' }}
              title={isSaved ? 'Unsave post' : 'Save post'}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            </button>

            {/* Owner menu */}
            {isOwner && (
              <div className="relative group">
                <button
                  className="sp-hover p-1.5 rounded"
                  style={{ color: 'var(--color-dim)' }}
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                <div
                  className="absolute right-0 top-8 z-10 hidden group-hover:block min-w-[140px] rounded-lg overflow-hidden"
                  style={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  }}
                >
                  <button
                    onClick={() => deleteMutation.mutate()}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    Delete post
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="px-4 pb-3">
          <p
            className={`text-sm leading-relaxed whitespace-pre-wrap${!contentExpanded ? ' line-clamp-3' : ''}`}
            style={{ color: 'var(--color-text)' }}
          >
            {post.content}
          </p>
          {needsExpand && !contentExpanded && (
            <button
              onClick={() => setContentExpanded(true)}
              className="text-xs font-semibold mt-1 transition-colors"
              style={{ color: 'var(--color-accent)' }}
            >
              …see more
            </button>
          )}
          {contentExpanded && (
            <button
              onClick={() => setContentExpanded(false)}
              className="text-xs font-semibold mt-1 transition-colors"
              style={{ color: 'var(--color-dim)' }}
            >
              see less
            </button>
          )}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {post.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs font-semibold cursor-pointer hover:underline"
                  style={{ color: 'var(--color-accent)' }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Stats bar ── */}
        {(post.reactionCount > 0 || post.commentCount > 0) && (
          <div
            className="px-4 py-1.5 flex items-center justify-between text-xs"
            style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-dim)' }}
          >
            {post.reactionCount > 0 ? (
              <span className="flex items-center gap-1">
                <span className="text-sm leading-none">{topEmojis.join('')}</span>
                <span>{post.reactionCount}</span>
              </span>
            ) : <span />}
            {post.commentCount > 0 && (
              <button
                onClick={() => setCommentsExpanded(prev => !prev)}
                className="hover:underline ml-auto transition-colors"
                style={{ color: 'var(--color-dim)' }}
              >
                {post.commentCount} comment{post.commentCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}

        {/* ── Latest comment preview ── */}
        {!commentsExpanded && post.latestComment && post.commentCount > 0 && (
          <div className="px-4 py-2.5" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div className="flex gap-2.5">
              <Avatar
                name={`${post.latestComment.author.firstName} ${post.latestComment.author.lastName}`}
                src={post.latestComment.author.profilePicture}
                size="xs"
              />
              <div
                className="flex-1 px-3 py-2 rounded-lg text-xs"
                style={{ background: 'var(--color-shade)' }}
              >
                <span className="font-semibold mr-1.5" style={{ color: 'var(--color-text)' }}>
                  {post.latestComment.author.firstName} {post.latestComment.author.lastName}
                </span>
                <span style={{ color: 'var(--color-muted)' }}>{post.latestComment.content}</span>
              </div>
            </div>
            {post.commentCount > 1 && (
              <button
                onClick={() => setCommentsExpanded(true)}
                className="mt-1.5 ml-9 text-xs font-semibold transition-colors hover:underline"
                style={{ color: 'var(--color-accent)' }}
              >
                View all {post.commentCount} comments
              </button>
            )}
          </div>
        )}

        {/* ── Expanded comments ── */}
        <AnimatePresence>
          {commentsExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="px-4 pt-3 pb-2 space-y-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                {commentsLoading ? (
                  [1, 2].map(i => (
                    <div key={i} className="flex gap-2 animate-pulse">
                      <div className="w-7 h-7 rounded-lg flex-shrink-0" style={{ background: 'var(--color-shade)' }} />
                      <div className="flex-1 h-8 rounded-lg" style={{ background: 'var(--color-shade)' }} />
                    </div>
                  ))
                ) : allComments.length === 0 ? (
                  <p className="text-xs py-2" style={{ color: 'var(--color-dim)' }}>No comments yet</p>
                ) : (
                  allComments.map(c => (
                    <div key={c._id} className="flex gap-2.5">
                      <Avatar
                        name={`${c.author.firstName} ${c.author.lastName}`}
                        src={c.author.profilePicture}
                        size="xs"
                      />
                      <div
                        className="flex-1 px-3 py-2 rounded-lg text-xs"
                        style={{ background: 'var(--color-shade)' }}
                      >
                        <span className="font-semibold mr-1.5" style={{ color: 'var(--color-text)' }}>
                          {c.author.firstName} {c.author.lastName}
                        </span>
                        <span style={{ color: 'var(--color-muted)' }}>{c.content}</span>
                        <p className="mt-1" style={{ color: 'var(--color-dim)', fontSize: '10px' }}>
                          {timeAgo(c.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <button
                  onClick={() => setCommentsExpanded(false)}
                  className="text-xs font-semibold pb-1 transition-colors hover:underline"
                  style={{ color: 'var(--color-dim)' }}
                >
                  ↑ Collapse comments
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Action row ── */}
        <div className="flex items-center" style={{ borderTop: '1px solid var(--color-border)' }}>
          {/* Like with hover reaction popup */}
          <div
            className="relative flex-1"
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
              className={`post-action w-full${userReaction ? ' active' : ''}`}
              disabled={reactMutation.isPending}
            >
              <span className="text-base leading-none">
                {userReaction ? REACTION_EMOJI[userReaction] : '👍'}
              </span>
              <span>{userReaction ? REACTION_ICONS[userReaction]?.label : 'Like'}</span>
            </button>

            <AnimatePresence>
              {showReactions && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 8 }}
                  className="absolute bottom-full left-0 mb-2 rounded-2xl px-2 py-1.5 flex gap-1 z-20"
                  style={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                  }}
                >
                  {Object.entries(REACTION_ICONS).map(([type, { icon, label, color }]) => (
                    <button
                      key={type}
                      title={label}
                      onClick={() => { reactMutation.mutate(type); setShowReactions(false); }}
                      className={`p-2 rounded-xl ${color} transition-transform hover:scale-125`}
                      style={{ background: 'var(--color-shade)' }}
                    >
                      {icon}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Comment */}
          <button
            className="post-action"
            onClick={() => { setShowCommentBox(!showCommentBox); if (!showCommentBox) setCommentsExpanded(true); }}
          >
            <span className="text-base leading-none">💬</span>
            <span>Comment</span>
          </button>

          {/* Repost */}
          <button className="post-action">
            <Share2 className="w-4 h-4" />
            <span>Repost</span>
          </button>

          {/* Send */}
          <button className="post-action">
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>

        {/* ── Comment input ── */}
        <AnimatePresence>
          {showCommentBox && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-4"
              style={{ borderTop: '1px solid var(--color-border)' }}
            >
              <div className="flex gap-2 pt-3">
                <textarea
                  autoFocus
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Add a comment…"
                  rows={2}
                  className="flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                  style={{
                    background: 'var(--color-shade)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                />
                <button
                  onClick={() => commentMutation.mutate(commentText)}
                  disabled={!commentText.trim() || commentMutation.isPending}
                  className="self-end p-2.5 rounded-lg disabled:opacity-40 transition-colors"
                  style={{ background: 'var(--color-accent)', color: 'white' }}
                >
                  {commentMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Profile Sidebar ───────────────────────────────────
interface ProfileSidebarProps {
  user: { firstName: string; lastName: string; profilePicture?: string; headline?: string; id: string };
  profile?: { coverImage?: string; connectionCount?: number } | null;
}

function ProfileSidebar({ user, profile }: ProfileSidebarProps) {
  return (
    <div
      className="sp-card rounded-lg overflow-hidden"
      style={{ position: 'sticky', top: 'calc(var(--nav-height) + 16px)' }}
    >
      {/* Cover */}
      <div
        className="h-14"
        style={{
          background: profile?.coverImage
            ? `url(${profile.coverImage}) center/cover no-repeat`
            : 'linear-gradient(135deg, #0A66C2 0%, #004182 100%)',
        }}
      />

      {/* Avatar + info */}
      <div className="px-3 pb-3">
        <div className="-mt-6 mb-2 ring-2 ring-[var(--color-card)] rounded-xl inline-block">
          <Avatar
            name={`${user.firstName} ${user.lastName}`}
            src={user.profilePicture}
            size="lg"
          />
        </div>
        <Link
          to={`/profile/${user.id}`}
          className="font-bold text-sm block hover:underline"
          style={{ color: 'var(--color-text)', textDecoration: 'none' }}
        >
          {user.firstName} {user.lastName}
        </Link>
        {user.headline && (
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--color-muted)' }}>
            {user.headline}
          </p>
        )}
        {typeof profile?.connectionCount === 'number' && (
          <p className="text-xs mt-1.5 font-semibold" style={{ color: 'var(--color-accent)' }}>
            {profile.connectionCount} connections
          </p>
        )}
        <Link
          to={`/profile/${user.id}`}
          className="block mt-3 text-xs font-bold text-center py-1.5 rounded-full border transition-colors"
          style={{ color: 'var(--color-accent)', borderColor: 'var(--color-accent)', textDecoration: 'none' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(10,102,194,0.08)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          View full profile
        </Link>
      </div>

      {/* My Items */}
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <Link
          to="/?tab=saved"
          className="sp-hover flex items-center justify-between px-3 py-2.5 text-sm"
          style={{ color: 'var(--color-text)', textDecoration: 'none' }}
        >
          <span className="font-semibold text-xs">Saved posts</span>
          <Bookmark className="w-3.5 h-3.5" style={{ color: 'var(--color-muted)' }} />
        </Link>
      </div>
    </div>
  );
}

// ─── Add To Feed Widget (right sidebar) ───────────────
function AddToFeedWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['feed-suggestions'],
    queryFn: () => apiService.recommendations.connections(5).then(r => r.data),
    staleTime: 120_000,
  });
  const suggestions: Array<{ _id: string; firstName: string; lastName: string; headline?: string; profilePicture?: string }> =
    data?.data ?? [];

  const TOPICS = ['#javascript', '#webdev', '#hiring', '#react', '#typescript'];
  const NEWS = [
    'Tech layoffs continue in Q1',
    'AI reshapes software engineering roles',
    'Remote work policies tighten at big firms',
    'Open source funding under scrutiny',
  ];

  return (
    <div
      className="space-y-3"
      style={{ position: 'sticky', top: 'calc(var(--nav-height) + 16px)' }}
    >
      {/* People you may know */}
      <div className="sp-card rounded-lg p-4">
        <h3 className="text-xs font-bold mb-3" style={{ color: 'var(--color-text)' }}>
          People you may know
        </h3>
        <div className="space-y-3">
          {isLoading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-2.5 animate-pulse">
                <div className="w-9 h-9 rounded-lg flex-shrink-0" style={{ background: 'var(--color-shade)' }} />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded w-3/4" style={{ background: 'var(--color-shade)' }} />
                  <div className="h-2 rounded w-1/2" style={{ background: 'var(--color-shade)' }} />
                </div>
              </div>
            ))
          ) : suggestions.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-dim)' }}>No suggestions yet</p>
          ) : (
            suggestions.map(s => (
              <Link
                key={s._id}
                to={`/profile/${s._id}`}
                className="sp-hover flex items-center gap-2.5 p-1 rounded"
                style={{ textDecoration: 'none' }}
              >
                <Avatar name={`${s.firstName} ${s.lastName}`} src={s.profilePicture} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                    {s.firstName} {s.lastName}
                  </p>
                  {s.headline && (
                    <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>{s.headline}</p>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
        <Link
          to="/network"
          className="block text-center mt-3 text-xs font-semibold hover:underline"
          style={{ color: 'var(--color-accent)', textDecoration: 'none' }}
        >
          View all suggestions →
        </Link>
      </div>

      {/* Add to your feed */}
      <div className="sp-card rounded-lg p-4">
        <h3 className="text-xs font-bold mb-3" style={{ color: 'var(--color-text)' }}>
          Add to your feed
        </h3>
        <div className="space-y-3">
          {TOPICS.map(topic => (
            <div key={topic} className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>{topic}</p>
                <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Hashtag</p>
              </div>
              <button
                className="text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 transition-colors"
                style={{ color: 'var(--color-muted)', borderColor: 'var(--color-muted)' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--color-text)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-text)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-muted)';
                }}
              >
                + Follow
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Trending news */}
      <div className="sp-card rounded-lg p-4">
        <h3 className="text-xs font-bold mb-3" style={{ color: 'var(--color-text)' }}>
          Nexus News
        </h3>
        <div className="space-y-2.5">
          {NEWS.map((item, i) => (
            <div key={i} className="flex items-start gap-2 cursor-pointer group">
              <span className="mt-0.5 font-bold" style={{ color: 'var(--color-dim)', fontSize: 10 }}>•</span>
              <p
                className="text-xs font-semibold leading-snug"
                style={{ color: 'var(--color-text)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
              >
                {item}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────
export default function FeedPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'feed' | 'saved'>('feed');

  const { data, isLoading, isError, refetch } = useQuery<FeedPage>({
    queryKey: ['feed', page],
    queryFn: () => apiService.posts.getFeed(page, 10).then(r => r.data),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    enabled: tab === 'feed',
  });

  const { data: savedData, isLoading: savedLoading } = useQuery<FeedPage>({
    queryKey: ['posts', 'saved'],
    queryFn: () => apiService.posts.getSaved().then(r => r.data),
    staleTime: 30_000,
    enabled: tab === 'saved',
  });

  const { data: profileRes } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => apiService.users.me().then(r => r.data),
    staleTime: 60_000,
  });
  const myProfile = profileRes?.data as { coverImage?: string; connectionCount?: number } | null | undefined;

  const posts = data?.data ?? [];
  const savedPosts = savedData?.data ?? [];
  const totalPages = data?.pagination?.pages ?? 1;

  return (
    <div className="max-w-[1128px] mx-auto px-4 pt-6 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-[225px_1fr_300px] gap-4">

        {/* Left: profile sidebar */}
        <aside className="hidden lg:block">
          {user && <ProfileSidebar user={user} profile={myProfile} />}
        </aside>

        {/* Center: feed */}
        <div className="min-w-0 space-y-3">
          {/* Tab switcher */}
          <div
            className="flex gap-1 p-1 rounded-lg"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
          >
            {(['feed', 'saved'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setPage(1); }}
                className="flex-1 py-1.5 rounded text-xs font-semibold transition-all"
                style={{
                  background: tab === t ? 'var(--color-accent)' : 'transparent',
                  color: tab === t ? '#fff' : 'var(--color-muted)',
                }}
              >
                {t === 'feed' ? '🏠 Feed' : '🔖 Saved'}
              </button>
            ))}
          </div>

          {tab === 'feed' && user && <CreatePost user={user} />}

          {tab === 'saved' ? (
            savedLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <PostSkeleton key={i} />)}</div>
            ) : savedPosts.length === 0 ? (
              <div className="sp-card rounded-lg p-12 text-center">
                <Bookmark className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--color-accent)' }} />
                <p className="text-base font-bold mb-2" style={{ color: 'var(--color-text)' }}>No saved posts yet</p>
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Save posts to revisit them later.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedPosts.map(post => <PostCard key={post._id} post={post} currentUserId={user?.id ?? ''} />)}
              </div>
            )
          ) : isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <PostSkeleton key={i} />)}</div>
          ) : isError ? (
            <div className="sp-card rounded-lg p-8 text-center">
              <p className="text-sm mb-3" style={{ color: 'var(--color-muted)' }}>Could not load feed</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : posts.length === 0 ? (
            <div className="sp-card rounded-lg p-12 text-center">
              <p className="text-base font-bold mb-2" style={{ color: 'var(--color-text)' }}>Your feed is empty</p>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                Connect with people to see their posts here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map(post => (
                <PostCard key={post._id} post={post} currentUserId={user?.id ?? ''} />
              ))}
            </div>
          )}

          {tab === 'feed' && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <span className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
                {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next <ChevronDown className="w-3 h-3 rotate-[-90deg] ml-1" />
              </Button>
            </div>
          )}
        </div>

        {/* Right: add to feed widget */}
        <aside className="hidden lg:block">
          <AddToFeedWidget />
        </aside>
      </div>
    </div>
  );
}
