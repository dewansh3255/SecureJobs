import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { UserPlus, Users, Check, X, Search, MapPin, Briefcase } from 'lucide-react';
import { apiService } from '@services/api';
import { Card } from '@components/ui/Card';
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
    >
      <Card variant="hover" className="p-4 flex flex-col items-center text-center gap-3 h-full">
        <Avatar
          name={`${person.firstName} ${person.lastName}`}
          src={person.profilePicture}
          size="xl"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {person.firstName} {person.lastName}
          </p>
          {person.headline && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{person.headline}</p>
          )}
          {person.location && (
            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1 mt-1">
              <MapPin className="w-3 h-3" /> {person.location}
            </p>
          )}
          {person.industry && (
            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1 mt-0.5">
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
      </Card>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl shadow-soft p-4 flex flex-col items-center gap-3 animate-pulse">
      <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-dark-700" />
      <div className="w-24 h-3 bg-gray-200 dark:bg-dark-700 rounded" />
      <div className="w-32 h-2 bg-gray-200 dark:bg-dark-700 rounded" />
      <div className="w-full h-8 bg-gray-200 dark:bg-dark-700 rounded-lg" />
    </div>
  );
}

export default function NetworkPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const qc = useQueryClient();

  // Suggestions
  const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['suggestions'],
    queryFn: () => apiService.connections.getSuggestions().then(r => r.data),
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
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search for people by name, headline, or industry…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-linkedin-500"
          />
        </div>
      </Card>

      {/* Search Results */}
      {searchQuery.trim().length >= 2 && (
        <section>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-linkedin-600" />
            Search Results
            {searchData && <Badge>{searchResults.length}</Badge>}
          </h2>
          {searchLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : searchResults.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">No users found for "{searchQuery}"</p>
            </Card>
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
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-linkedin-600" />
            Pending Invitations
            {!pendingLoading && <Badge variant="error">{pending.length}</Badge>}
          </h2>
          {pendingLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="bg-white dark:bg-dark-800 rounded-xl shadow-soft p-4 flex items-center gap-3 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-dark-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((conn) => (
                <motion.div key={conn._id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
                  <Card className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={`${conn.requester.firstName} ${conn.requester.lastName}`}
                        src={conn.requester.profilePicture}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                          {conn.requester.firstName} {conn.requester.lastName}
                        </p>
                        {conn.requester.headline && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{conn.requester.headline}</p>
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
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Suggestions */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-linkedin-600" />
          People You May Know
        </h2>
        {suggestionsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : suggestions.length === 0 ? (
          <Card className="p-10 text-center">
            <UserPlus className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No suggestions yet. Fill in your profile to get better suggestions.</p>
          </Card>
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
