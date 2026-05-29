import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { UserPlus, Users, Check, Search, MapPin, Clock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiService } from '@services/api';
import { Avatar } from '@components/ui/Avatar';
import { Badge } from '@components/ui/Badge';

interface NetworkUser {
  _id: string;
  firstName: string;
  lastName: string;
  headline?: string;
  location?: string;
  profilePicture?: string;
  industry?: string;
  mutualConnections?: number;
}

interface PendingConnection {
  _id: string;
  requester: NetworkUser;
  createdAt: string;
}

function PersonCard({ person, onConnect, connecting, isPending }: {
  person: NetworkUser;
  onConnect: (id: string) => void;
  connecting: boolean;
  isPending: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="rounded-lg flex flex-col h-full"
      style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
    >
      {/* Cover gradient */}
      <div
        className="rounded-t-lg flex-shrink-0"
        style={{ height: 80, background: 'linear-gradient(135deg, #dce6f1 0%, #b0c4de 100%)' }}
      />

      {/* Body */}
      <div className="flex flex-col items-center text-center px-4 pb-4 flex-1">
        {/* Avatar with white ring, pulled up into cover */}
        <div
          className="-mt-7 flex-shrink-0 rounded-full"
          style={{ padding: 3, background: 'var(--color-card)', borderRadius: '50%' }}
        >
          <Avatar
            name={`${person.firstName} ${person.lastName}`}
            src={person.profilePicture}
            size="xl"
          />
        </div>

        <p className="font-semibold text-sm mt-2 leading-tight" style={{ color: 'var(--color-text)' }}>
          {person.firstName} {person.lastName}
        </p>

        {person.headline && (
          <p className="text-xs line-clamp-2 mt-1" style={{ color: 'var(--color-muted)' }}>
            {person.headline}
          </p>
        )}

        {person.location && (
          <p className="text-xs flex items-center justify-center gap-1 mt-1" style={{ color: 'var(--color-dim)' }}>
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {person.location}
          </p>
        )}

        {!!person.mutualConnections && (
          <p className="text-xs mt-1.5 flex items-center justify-center gap-1" style={{ color: 'var(--color-dim)' }}>
            <Users className="w-3 h-3 flex-shrink-0" />
            {person.mutualConnections} mutual connection{person.mutualConnections !== 1 ? 's' : ''}
          </p>
        )}

        {/* Connect / Pending button — pushed to bottom */}
        <div className="mt-auto pt-3 w-full">
          {isPending ? (
            <button
              disabled
              className="w-full rounded-full text-xs font-semibold py-1.5 px-4 flex items-center justify-center gap-1.5"
              style={{
                border: '1px solid var(--color-border)',
                color: 'var(--color-muted)',
                cursor: 'default',
                opacity: 0.7,
              }}
            >
              <Clock className="w-3 h-3" />
              Pending
            </button>
          ) : (
            <button
              onClick={() => onConnect(person._id)}
              disabled={connecting}
              className="w-full rounded-full text-xs font-semibold py-1.5 px-4 flex items-center justify-center gap-1.5 transition-colors"
              style={{
                border: `1px solid ${connecting ? 'var(--color-border)' : 'var(--color-accent)'}`,
                color: connecting ? 'var(--color-muted)' : 'var(--color-accent)',
                background: 'transparent',
                cursor: connecting ? 'not-allowed' : 'pointer',
              }}
            >
              {connecting ? (
                <span className="animate-pulse">Sending…</span>
              ) : (
                <>
                  <UserPlus className="w-3 h-3" />
                  Connect
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="rounded-lg flex flex-col animate-pulse"
      style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="rounded-t-lg flex-shrink-0" style={{ height: 80, background: 'var(--color-shade)' }} />
      <div className="flex flex-col items-center px-4 pb-4">
        <div
          className="-mt-7 rounded-full flex-shrink-0"
          style={{ width: 56, height: 56, background: 'var(--color-shade-md)' }}
        />
        <div className="mt-3 w-24 h-3.5 rounded" style={{ background: 'var(--color-shade)' }} />
        <div className="mt-2 w-32 h-2.5 rounded" style={{ background: 'var(--color-shade)' }} />
        <div className="mt-2 w-20 h-2.5 rounded" style={{ background: 'var(--color-shade)' }} />
        <div className="mt-3 w-full h-7 rounded-full" style={{ background: 'var(--color-shade)' }} />
      </div>
    </div>
  );
}

export default function NetworkPage() {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [showAllPending, setShowAllPending] = useState(false);
  const qc = useQueryClient();

  // Sync search bar when URL param changes (e.g. navigating from header search)
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    setSearchQuery(q);
  }, [searchParams]);

  // AI-powered connection suggestions (skill overlap + mutual connections)
  const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['suggestions'],
    queryFn: () =>
      apiService.recommendations.connections(12).then(r => r.data).catch(() =>
        // Fall back to basic suggestions if recommendations fail
        apiService.connections.getSuggestions().then(r => r.data)
      ),
    staleTime: 60_000,
  });

  // Pending received requests
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-connections'],
    queryFn: () => apiService.connections.getPending().then(r => r.data),
    staleTime: 30_000,
  });

  // Search
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['user-search', searchQuery],
    queryFn: () => apiService.users.search(searchQuery).then(r => r.data),
    enabled: searchQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  // Track IDs of users we've sent requests to this session (persists through query invalidations)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  // Connect mutation
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const connectMutation = useMutation({
    mutationFn: (userId: string) => {
      setConnectingId(userId);
      return apiService.connections.send(userId);
    },
    onSuccess: (_data, userId) => {
      setSentIds(prev => new Set([...prev, userId]));
      qc.invalidateQueries({ queryKey: ['suggestions'] });
      toast.success('Connection request sent!');
    },
    onError: () => toast.error('Could not send request'),
    onSettled: () => setConnectingId(null),
  });

  // Accept mutation
  const acceptMutation = useMutation({
    mutationFn: (id: string) => apiService.connections.accept(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-connections'] });
      toast.success('Connection accepted!');
    },
    onError: () => toast.error('Could not accept request'),
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiService.connections.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-connections'] }),
    onError: () => toast.error('Could not reject request'),
  });

  const suggestions: NetworkUser[] = suggestionsData?.data ?? [];
  const pending: PendingConnection[] = pendingData?.data ?? [];
  const searchResults: NetworkUser[] = searchData?.data ?? [];
  const visiblePending = showAllPending ? pending : pending.slice(0, 3);

  return (
    <div className="max-w-[1128px] mx-auto px-4 pt-6 pb-20 space-y-6">
      {/* Search bar */}
      <div className="sp-card rounded-lg p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-dim)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search for people by name, headline, or industry…"
            className="w-full pl-9 pr-4 py-2 rounded-md text-sm outline-none transition"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-shade-md)',
              color: 'var(--color-text)',
            }}
          />
        </div>
      </div>

      {/* Search Results */}
      {searchQuery.trim().length >= 2 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <Search className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
              Search Results
              {searchData && <Badge>{searchResults.length}</Badge>}
            </h2>
          </div>
          {searchLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="sp-card rounded-lg p-8 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
              No users found for &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {searchResults.map(person => (
                <PersonCard
                  key={person._id}
                  person={person}
                  onConnect={id => connectMutation.mutate(id)}
                  connecting={connectingId === person._id && connectMutation.isPending}
                  isPending={sentIds.has(person._id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Invitations */}
      {(pendingLoading || pending.length > 0) && (
        <section>
          <div className="sp-card rounded-lg overflow-hidden">
            {/* Section header */}
            <div
              className="px-4 py-3 flex items-center gap-2"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <Users className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
              <h2 className="font-bold text-sm flex-1" style={{ color: 'var(--color-text)' }}>
                Invitations
              </h2>
              {!pendingLoading && pending.length > 0 && (
                <Badge variant="error">{pending.length}</Badge>
              )}
            </div>

            {pendingLoading ? (
              <>
                {[1, 2].map(i => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 animate-pulse"
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                  >
                    <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: 'var(--color-shade)' }} />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 rounded w-1/3" style={{ background: 'var(--color-shade)' }} />
                      <div className="h-2.5 rounded w-1/2" style={{ background: 'var(--color-shade)' }} />
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <div className="w-16 h-7 rounded-full" style={{ background: 'var(--color-shade)' }} />
                      <div className="w-14 h-7 rounded-full" style={{ background: 'var(--color-shade)' }} />
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {visiblePending.map(conn => (
                  <motion.div
                    key={conn._id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors"
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-shade)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={`${conn.requester.firstName} ${conn.requester.lastName}`}
                        src={conn.requester.profilePicture}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>
                          {conn.requester.firstName} {conn.requester.lastName}
                        </p>
                        {conn.requester.headline && (
                          <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>
                            {conn.requester.headline}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => acceptMutation.mutate(conn._id)}
                        disabled={acceptMutation.isPending}
                        className="text-xs font-semibold px-4 py-1.5 rounded-full transition-colors"
                        style={{
                          border: '2px solid var(--color-accent)',
                          color: 'var(--color-accent)',
                          background: 'transparent',
                        }}
                      >
                        <Check className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                        Accept
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate(conn._id)}
                        disabled={rejectMutation.isPending}
                        className="text-xs font-semibold px-4 py-1.5 rounded-full transition-colors"
                        style={{
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-muted)',
                          background: 'transparent',
                        }}
                      >
                        Ignore
                      </button>
                    </div>
                  </motion.div>
                ))}

                {pending.length > 3 && (
                  <button
                    className="w-full py-3 text-sm font-semibold text-center transition-colors"
                    style={{ color: 'var(--color-accent)' }}
                    onClick={() => setShowAllPending(v => !v)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-shade)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {showAllPending
                      ? 'Show fewer invitations'
                      : `Manage all ${pending.length} invitations →`}
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* People You May Know */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>
            People you may know
          </h2>
          {suggestions.length > 0 && (
            <button
              className="text-sm font-semibold transition-colors"
              style={{ color: 'var(--color-accent)' }}
            >
              See all
            </button>
          )}
        </div>

        {suggestionsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="sp-card rounded-lg p-10 text-center">
            <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--color-accent)' }} />
            <p style={{ color: 'var(--color-muted)' }}>
              No suggestions yet. Fill in your profile to get better suggestions.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {suggestions.map(person => (
              <PersonCard
                key={person._id}
                person={person}
                onConnect={id => connectMutation.mutate(id)}
                connecting={connectingId === person._id && connectMutation.isPending}
                isPending={sentIds.has(person._id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
