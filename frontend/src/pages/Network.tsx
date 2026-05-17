import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { UserPlus, Users, Check, X, Search, MapPin, Briefcase, Sparkles } from 'lucide-react';
import { apiService } from '@services/api';
import { Button } from '@components/ui/Button';
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
}

interface PendingConnection {
  _id: string;
  requester: NetworkUser;
  createdAt: string;
}

function PersonCard({ person, onConnect, connecting }: {
  person: NetworkUser;
  onConnect: (id: string) => void;
  connecting: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="sp-card-lift rounded-2xl p-4 flex flex-col items-center text-center gap-3 h-full"
    >
      <Avatar
        name={`${person.firstName} ${person.lastName}`}
        src={person.profilePicture}
        size="xl"
      />
      <div className="flex-1 min-w-0 w-full">
        <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>
          {person.firstName} {person.lastName}
        </p>
        {person.headline && (
          <p className="text-xs line-clamp-2 mt-0.5" style={{ color: 'var(--color-muted)' }}>{person.headline}</p>
        )}
        {person.location && (
          <p className="text-xs flex items-center justify-center gap-1 mt-1" style={{ color: 'var(--color-dim)' }}>
            <MapPin className="w-3 h-3" /> {person.location}
          </p>
        )}
        {person.industry && (
          <p className="text-xs flex items-center justify-center gap-1 mt-0.5" style={{ color: 'var(--color-dim)' }}>
            <Briefcase className="w-3 h-3" /> {person.industry}
          </p>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        leftIcon={<UserPlus className="w-3.5 h-3.5" />}
        onClick={() => onConnect(person._id)}
        isLoading={connecting}
        className="w-full"
      >
        Connect
      </Button>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="sp-card rounded-2xl p-4 flex flex-col items-center gap-3 animate-pulse">
      <div className="w-16 h-16 rounded-xl bg-white/5" />
      <div className="w-24 h-3 bg-white/5 rounded" />
      <div className="w-32 h-2 bg-white/5 rounded" />
      <div className="w-full h-8 bg-white/5 rounded-xl" />
    </div>
  );
}

export default function NetworkPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const qc = useQueryClient();

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

  // Connect mutation
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const connectMutation = useMutation({
    mutationFn: (userId: string) => {
      setConnectingId(userId);
      return apiService.connections.send(userId);
    },
    onSuccess: () => {
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

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      {/* Search */}
      <div className="sp-card rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-dim)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search for people by name, headline, or industry…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition"
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
          <h2 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <Search className="w-4 h-4 text-linkedin-500" />
            Search Results
            {searchData && <Badge>{searchResults.length}</Badge>}
          </h2>
          {searchLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="sp-card rounded-2xl p-8 text-center" style={{ color: 'var(--color-muted)' }}>
              No users found for "{searchQuery}"
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {searchResults.map(person => (
                <PersonCard
                  key={person._id}
                  person={person}
                  onConnect={id => connectMutation.mutate(id)}
                  connecting={connectingId === person._id && connectMutation.isPending}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Pending Invitations */}
      {(pendingLoading || pending.length > 0) && (
        <section>
          <h2 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <Users className="w-4 h-4 text-linkedin-500" />
            Pending Invitations
            {!pendingLoading && <Badge variant="error">{pending.length}</Badge>}
          </h2>
          {pendingLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="sp-card rounded-2xl p-4 flex items-center gap-3 animate-pulse">
                  <div className="w-12 h-12 rounded-xl bg-white/5 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/5 rounded w-1/3" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((conn) => (
                <motion.div key={conn._id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
                  <div className="sp-card rounded-2xl p-4 flex items-center justify-between gap-3">
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
                          <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>{conn.requester.headline}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                        onClick={() => acceptMutation.mutate(conn._id)}
                        isLoading={acceptMutation.isPending}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rejectMutation.mutate(conn._id)}
                        isLoading={rejectMutation.isPending}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Suggestions */}
      <section>
        <h2 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <Sparkles className="w-4 h-4 text-linkedin-500" />
          People You May Know
        </h2>
        {suggestionsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="sp-card rounded-2xl p-10 text-center">
            <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--color-accent)' }} />
            <p style={{ color: 'var(--color-muted)' }}>No suggestions yet. Fill in your profile to get better suggestions.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {suggestions.map(person => (
              <PersonCard
                key={person._id}
                person={person}
                onConnect={id => connectMutation.mutate(id)}
                connecting={connectingId === person._id && connectMutation.isPending}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
