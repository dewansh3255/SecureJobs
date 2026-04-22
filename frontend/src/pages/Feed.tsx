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
    <div className="bg-white dark:bg-dark-800 rounded-xl shadow-soft p-4 space-y-3 animate-pulse">
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-dark-700" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-1/3" />
          <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded" />
        <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded w-5/6" />
        <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded w-4/6" />
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
    <Card className="p-4">
      <div className="flex gap-3 items-start">
        <Avatar name={`${user.firstName} ${user.lastName}`} src={user.profilePicture} size="md" />
        <div className="flex-1">
          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-left px-4 py-2.5 rounded-full border border-gray-300 dark:border-dark-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-700 transition text-sm"
            >
              Start a post…
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
                  placeholder="What do you want to talk about?"
                  className="w-full min-h-[120px] p-3 resize-none border-0 outline-none text-sm text-gray-800 dark:text-gray-100 bg-transparent placeholder-gray-400"
                  maxLength={3000}
                />
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-dark-700">
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1.5 text-gray-500 hover:text-linkedin-600 text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-dark-700 transition">
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
          <div className="flex items-start justify-between p-4">
            <div className="flex gap-3">
              <Avatar
                name={`${post.author.firstName} ${post.author.lastName}`}
                src={post.author.profilePicture}
                size="md"
              />
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                  {post.author.firstName} {post.author.lastName}
                </p>
                {post.author.headline && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{post.author.headline}</p>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {timeAgo(post.createdAt)} {post.isEdited && '· Edited'}
                </p>
              </div>
            </div>
            {isOwner && (
              <div className="relative group">
                <button className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-400">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                <div className="absolute right-0 top-8 z-10 bg-white dark:bg-dark-800 shadow-lg rounded-lg border border-gray-100 dark:border-dark-700 hidden group-hover:block min-w-[120px]">
                  <button
                    onClick={() => deleteMutation.mutate()}
                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    Delete post
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-4 pb-3">
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{post.content}</p>
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {post.tags.map(tag => (
                  <span key={tag} className="text-xs text-linkedin-600 dark:text-linkedin-400 hover:underline cursor-pointer">#{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Reaction / comment counts */}
          {(post.reactionCount > 0 || post.commentCount > 0) && (
            <div className="px-4 pb-2 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-dark-700">
              <span>{post.reactionCount > 0 ? `${post.reactionCount} reactions` : ''}</span>
              <span>{post.commentCount > 0 ? `${post.commentCount} comments` : ''}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="px-2 py-1 flex items-center gap-1">
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
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition hover:bg-gray-100 dark:hover:bg-dark-700 ${userReaction ? REACTION_ICONS[userReaction]?.color : 'text-gray-500 dark:text-gray-400'}`}
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
                    className="absolute bottom-full left-0 mb-2 bg-white dark:bg-dark-800 shadow-xl border border-gray-100 dark:border-dark-700 rounded-full px-2 py-1.5 flex gap-1 z-20"
                  >
                    {Object.entries(REACTION_ICONS).map(([type, { icon, label, color }]) => (
                      <button
                        key={type}
                        title={label}
                        onClick={() => { reactMutation.mutate(type); setShowReactions(false); }}
                        className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700 ${color} transition-transform hover:scale-125`}
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 transition"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Comment</span>
            </button>

            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 transition">
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
                className="px-4 pb-3 border-t border-gray-100 dark:border-dark-700"
              >
                <div className="flex gap-2 pt-3">
                  <textarea
                    autoFocus
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Add a comment…"
                    rows={2}
                    className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-linkedin-500 transition"
                  />
                  <button
                    onClick={() => commentMutation.mutate(commentText)}
                    disabled={!commentText.trim() || commentMutation.isPending}
                    className="self-end p-2 rounded-full bg-linkedin-600 text-white disabled:opacity-40 hover:bg-linkedin-700 transition"
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
    <div className="max-w-2xl mx-auto space-y-4 pb-8">
      {/* Create Post */}
      {user && <CreatePost user={user} />}

      {/* Feed */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <PostSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-3">Could not load feed</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </Card>
      ) : posts.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Your feed is empty</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Connect with people to see their posts here.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard key={post._id} post={post} currentUserId={user?.id ?? ''} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-gray-500 dark:text-gray-400">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next <ChevronDown className="w-3 h-3 rotate-[-90deg] ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
