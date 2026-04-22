import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  MessageCircle, Send, Search, ArrowLeft, Loader2, UserPlus
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { apiService } from '@services/api';
import { useAuth } from '@stores/authStore';
import { Avatar } from '@components/ui/Avatar';
import { Button } from '@components/ui/Button';
import { Card } from '@components/ui/Card';

/* ─── Types ─── */
interface Participant {
  _id: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  headline?: string;
}
interface Conversation {
  _id: string;
  participants: Participant[];
  lastMessage?: { content: string; createdAt: string };
  unreadCount?: number;
  updatedAt: string;
}
interface Message {
  _id: string;
  sender: { _id: string; firstName: string; lastName: string; profilePicture?: string };
  content: string;
  createdAt: string;
  readBy?: string[];
}

/* ─── Helpers ─── */
function getOther(conv: Conversation, myId: string): Participant {
  return conv.participants.find(p => p._id !== myId) ?? conv.participants[0];
}
function fmtMsgDate(d: string) {
  const dt = new Date(d);
  if (isToday(dt)) return format(dt, 'p');
  if (isYesterday(dt)) return 'Yesterday';
  return format(dt, 'MMM d');
}

/* ─── Skeletons ─── */
function ConvSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-dark-700 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-200 dark:bg-dark-700 rounded w-2/3" />
        <div className="h-2 bg-gray-200 dark:bg-dark-700 rounded w-1/2" />
      </div>
    </div>
  );
}

/* ─── New Conversation Search ─── */
function NewConversationPanel({ onCreated }: { onCreated: (convId: string) => void }) {
  const [q, setQ] = useState('');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['user-search', q],
    queryFn: () => apiService.users.search(q).then(r => r.data),
    enabled: q.trim().length > 1,
    staleTime: 10_000,
  });
  const startConvMut = useMutation({
    mutationFn: (userId: string) => apiService.messages.createConversation(userId).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      onCreated(data.data._id);
    },
    onError: () => toast.error('Could not start conversation'),
  });
  const users: Participant[] = data?.data ?? [];

  return (
    <div className="p-4 border-b border-gray-100 dark:border-dark-700">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search people to message…"
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-linkedin-500"
          autoFocus
        />
      </div>
      {isLoading && <div className="flex justify-center mt-3"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>}
      {users.length > 0 && (
        <div className="mt-2 space-y-1">
          {users.map(u => (
            <button
              key={u._id}
              onClick={() => startConvMut.mutate(u._id)}
              disabled={startConvMut.isPending}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-700 transition text-left"
            >
              <Avatar name={`${u.firstName} ${u.lastName}`} src={u.profilePicture} size="sm" />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{u.firstName} {u.lastName}</p>
                {u.headline && <p className="text-xs text-gray-400 truncate">{u.headline}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─── */
export default function MessagingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [message, setMessage] = useState('');
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* Conversations list */
  const { data: convsData, isLoading: convsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiService.messages.getConversations().then(r => r.data),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
  const conversations: Conversation[] = convsData?.data ?? [];

  /* Messages in selected conversation */
  const { data: msgsData, isLoading: msgsLoading } = useQuery({
    queryKey: ['messages', selectedConv],
    queryFn: () => apiService.messages.getConversation(selectedConv!).then(r => r.data),
    enabled: !!selectedConv,
    refetchInterval: 5_000,
    staleTime: 2_000,
  });
  const messages: Message[] = msgsData?.data ?? [];

  /* Auto-scroll to bottom */
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  /* Mark as read when opening */
  useEffect(() => {
    if (selectedConv) {
      apiService.messages.markRead(selectedConv).catch(() => {});
      qc.invalidateQueries({ queryKey: ['conversations'] });
    }
  }, [selectedConv, qc]);

  /* Send message */
  const sendMut = useMutation({
    mutationFn: (content: string) =>
      apiService.messages.send(selectedConv!, content).then(r => r.data),
    onSuccess: () => {
      setMessage('');
      qc.invalidateQueries({ queryKey: ['messages', selectedConv] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: () => toast.error('Failed to send message'),
  });

  const handleSend = () => {
    if (!message.trim() || !selectedConv) return;
    sendMut.mutate(message.trim());
  };

  const handleSelectConv = (convId: string) => {
    setSelectedConv(convId);
    setShowNew(false);
    setMobileShowThread(true);
  };

  const currentConv = conversations.find(c => c._id === selectedConv);
  const otherPerson = currentConv && user ? getOther(currentConv, user.id) : null;

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-8rem)]">
      <Card className="h-full flex overflow-hidden">

        {/* Left panel: conversation list */}
        <div className={`${mobileShowThread ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 xl:w-96 border-r border-gray-100 dark:border-dark-700 shrink-0`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-dark-700">
            <h2 className="font-bold text-gray-900 dark:text-gray-100 text-lg">Messages</h2>
            <button
              onClick={() => setShowNew(!showNew)}
              className={`p-2 rounded-full transition ${showNew ? 'bg-linkedin-100 dark:bg-linkedin-900/30 text-linkedin-600' : 'hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 dark:text-gray-400'}`}
            >
              <UserPlus className="w-5 h-5" />
            </button>
          </div>

          {/* New conversation search */}
          <AnimatePresence>
            {showNew && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                <NewConversationPanel onCreated={handleSelectConv} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {convsLoading ? (
              Array.from({ length: 5 }).map((_, i) => <ConvSkeleton key={i} />)
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No conversations yet</p>
                <button
                  onClick={() => setShowNew(true)}
                  className="text-sm text-linkedin-600 hover:underline mt-1"
                >
                  Start one
                </button>
              </div>
            ) : (
              conversations.map(conv => {
                const other = getOther(conv, user?.id ?? '');
                const isActive = conv._id === selectedConv;
                return (
                  <button
                    key={conv._id}
                    onClick={() => handleSelectConv(conv._id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition text-left ${isActive ? 'bg-linkedin-50 dark:bg-linkedin-900/20 border-r-2 border-linkedin-600' : 'hover:bg-gray-50 dark:hover:bg-dark-700'}`}
                  >
                    <div className="relative shrink-0">
                      <Avatar name={`${other.firstName} ${other.lastName}`} src={other.profilePicture} size="md" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <p className={`text-sm truncate ${isActive ? 'font-bold text-linkedin-700 dark:text-linkedin-300' : 'font-semibold text-gray-900 dark:text-gray-100'}`}>
                          {other.firstName} {other.lastName}
                        </p>
                        <span className="text-xs text-gray-400 shrink-0 ml-2">
                          {conv.lastMessage ? fmtMsgDate(conv.lastMessage.createdAt) : ''}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        {conv.lastMessage?.content ?? 'No messages yet'}
                      </p>
                    </div>
                    {(conv.unreadCount ?? 0) > 0 && (
                      <span className="bg-linkedin-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel: message thread */}
        <div className={`${!mobileShowThread ? 'hidden lg:flex' : 'flex'} flex-1 flex-col overflow-hidden`}>
          {!selectedConv ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400 dark:text-gray-500">
                <MessageCircle className="w-14 h-14 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm mt-1">Choose from the list or start a new one</p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-dark-700 bg-white dark:bg-dark-800">
                <button
                  onClick={() => setMobileShowThread(false)}
                  className="lg:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-full"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-500" />
                </button>
                {otherPerson && (
                  <>
                    <Avatar name={`${otherPerson.firstName} ${otherPerson.lastName}`} src={otherPerson.profilePicture} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{otherPerson.firstName} {otherPerson.lastName}</p>
                      {otherPerson.headline && <p className="text-xs text-gray-400 truncate">{otherPerson.headline}</p>}
                    </div>
                  </>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgsLoading ? (
                  <div className="flex justify-center pt-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                    <p>Say hello! 👋</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, i) => {
                      const isMe = msg.sender._id === user?.id;
                      const showDate = i === 0 || fmtMsgDate(messages[i - 1].createdAt) !== fmtMsgDate(msg.createdAt);
                      return (
                        <div key={msg._id}>
                          {showDate && (
                            <div className="text-center my-3">
                              <span className="text-xs text-gray-400 bg-gray-100 dark:bg-dark-700 px-3 py-0.5 rounded-full">
                                {fmtMsgDate(msg.createdAt)}
                              </span>
                            </div>
                          )}
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                          >
                            {!isMe && (
                              <Avatar
                                name={`${msg.sender.firstName} ${msg.sender.lastName}`}
                                src={msg.sender.profilePicture}
                                size="sm"
                                className="shrink-0 mb-1"
                              />
                            )}
                            <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                isMe
                                  ? 'bg-linkedin-600 text-white rounded-br-md'
                                  : 'bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-gray-100 rounded-bl-md'
                              }`}>
                                {msg.content}
                              </div>
                              <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 px-1">
                                {format(new Date(msg.createdAt), 'p')}
                              </span>
                            </div>
                          </motion.div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-gray-100 dark:border-dark-700 bg-white dark:bg-dark-800">
                <div className="flex items-end gap-2">
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                    placeholder="Type a message… (Enter to send)"
                    rows={1}
                    maxLength={2000}
                    className="flex-1 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-linkedin-500 resize-none"
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                    onInput={e => {
                      const el = e.currentTarget;
                      el.style.height = 'auto';
                      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                    }}
                  />
                  <Button
                    className="shrink-0 h-11 w-11 p-0"
                    onClick={handleSend}
                    disabled={!message.trim() || sendMut.isPending}
                    isLoading={sendMut.isPending}
                    leftIcon={sendMut.isPending ? undefined : <Send className="w-4 h-4" />}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
