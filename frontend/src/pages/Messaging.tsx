import { useState, useRef, useEffect, Component, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  MessageCircle, Send, Search, ArrowLeft, Loader2, UserPlus, Lock, ShieldCheck
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { apiService } from '@services/api';
import { useAuth } from '@stores/authStore';
import { Avatar } from '@components/ui/Avatar';
import { Button } from '@components/ui/Button';
import { encryptMessage, decryptMessage, isEncrypted, type EncryptedMessage, ensureSigningKeyPair, signContent, loadSigningPublicKeyJwk } from '@services/crypto';

/* ─── Types ─── */
interface Participant {
  _id: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  headline?: string;
  lastSeen?: string;
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
  signature?: string;
  signerPublicKey?: string;
}

/* ─── Message area Error Boundary ─── */
class MessageErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
              Could not display messages
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="text-xs hover:underline"
              style={{ color: 'var(--color-accent)' }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
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
      <div className="w-10 h-10 rounded-xl bg-shade shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-shade rounded w-2/3" />
        <div className="h-2 bg-shade rounded w-1/2" />
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
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not start conversation'),
  });
  const users: Participant[] = data?.data ?? [];

  return (
    <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-dim)' }} />
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search people to message…"
          className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-shade-md)', color: 'var(--color-text)' }}
          autoFocus
        />
      </div>
      {isLoading && <div className="flex justify-center mt-3"><Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--color-muted)' }} /></div>}
      {users.length > 0 && (
        <div className="mt-2 space-y-1">
          {users.map(u => (
            <button
              key={u._id}
              onClick={() => startConvMut.mutate(u._id)}
              disabled={startConvMut.isPending}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover-shade transition text-left"
            >
              <Avatar name={`${u.firstName} ${u.lastName}`} src={u.profilePicture} size="sm" />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{u.firstName} {u.lastName}</p>
                {u.headline && <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>{u.headline}</p>}
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
  const [recipientPublicKey, setRecipientPublicKey] = useState<JsonWebKey | null>(null);
  const [decryptedCache, setDecryptedCache] = useState<Record<string, string>>({});
  const [mySigningPublicJwk, setMySigningPublicJwk] = useState<JsonWebKey | null>(null);

  /* Ensure ECDSA signing key pair exists on mount */
  useEffect(() => {
    ensureSigningKeyPair()
      .then(jwk => setMySigningPublicJwk(jwk))
      .catch(() => {}); // silently ignore — signing is optional
  }, []);

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

  /* Derived: identify the other person in the selected conversation */
  const currentConv = conversations.find(c => c._id === selectedConv);
  const otherPerson = currentConv && user ? getOther(currentConv, user.id) : null;

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

  /* Fetch recipient's public key when conversation changes */
  useEffect(() => {
    setRecipientPublicKey(null);
    if (!otherPerson) return;
    apiService.users.getPublicKey(otherPerson._id)
      .then(r => {
        const pk = r.data?.data?.publicKey;
        if (pk) setRecipientPublicKey(JSON.parse(pk) as JsonWebKey);
      })
      .catch(() => {}); // silently ignore — messages fall back to plaintext
  }, [otherPerson?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Decrypt encrypted messages whenever messages or the public key changes */
  useEffect(() => {
    if (!recipientPublicKey || messages.length === 0) return;
    const encMsgs = messages.filter(m => {
      try { return isEncrypted(JSON.parse(m.content)); } catch { return false; }
    });
    if (encMsgs.length === 0) return;

    Promise.all(encMsgs.map(async m => {
      try {
        const parsed = JSON.parse(m.content) as EncryptedMessage;
        const plaintext = await decryptMessage(recipientPublicKey, parsed);
        return [m._id, plaintext] as const;
      } catch {
        return [m._id, '[Encrypted — unable to decrypt]'] as const;
      }
    })).then(results => {
      setDecryptedCache(prev => {
        const next = { ...prev };
        results.forEach(([id, text]) => { next[id] = text; });
        return next;
      });
    });
  }, [messages, recipientPublicKey]);

  /* Send message (encrypts if recipient public key is available) */
  const sendMut = useMutation({
    mutationFn: ({ content, signature, signerPublicKey }: { content: string; signature?: string; signerPublicKey?: string }) =>
      apiService.messages.send(selectedConv!, content, { signature, signerPublicKey }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', selectedConv] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: () => toast.error('Failed to send message'),
  });

  const markAllReadMut = useMutation({
    mutationFn: () => apiService.messages.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
    onError: () => toast.error('Could not mark all as read'),
  });

  const handleSend = async () => {
    if (!message.trim() || !selectedConv) return;
    const plaintext = message.trim();
    setMessage('');
    let content = plaintext;
    if (recipientPublicKey) {
      try {
        const encrypted = await encryptMessage(recipientPublicKey, plaintext);
        content = JSON.stringify(encrypted);
      } catch {
        // Encryption failed — send as plaintext
      }
    }

    // Sign the (possibly encrypted) content
    let signature: string | undefined;
    let signerPublicKey: string | undefined;
    try {
      const sig = await signContent(content);
      if (sig) {
        signature = sig;
        const pubJwk = mySigningPublicJwk ?? await loadSigningPublicKeyJwk();
        if (pubJwk) signerPublicKey = JSON.stringify(pubJwk);
      }
    } catch {
      // Signing failed — send without signature
    }

    sendMut.mutate({ content, signature, signerPublicKey });
  };

  const handleSelectConv = (convId: string) => {
    setSelectedConv(convId);
    setShowNew(false);
    setMobileShowThread(true);
  };

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-8rem)]">
      <div className="h-full flex overflow-hidden sp-card rounded-2xl">

        {/* Left panel: conversation list */}
        <div className={`${mobileShowThread ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 xl:w-96 shrink-0`}
          style={{ borderRight: '1px solid var(--color-border)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--color-border)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>Messages</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => markAllReadMut.mutate()}
                disabled={markAllReadMut.isPending}
                title="Mark all as read"
                className="p-2 rounded-xl transition text-xs"
                style={{ color: 'var(--color-muted)' }}
              >
                ✓✓
              </button>
              <button
                onClick={() => setShowNew(!showNew)}
                className="p-2 rounded-xl transition"
                style={{
                  background: showNew ? 'rgba(124,111,224,0.2)' : 'transparent',
                  color: showNew ? 'var(--color-accent)' : 'var(--color-muted)',
                }}
              >
                <UserPlus className="w-5 h-5" />
              </button>
            </div>
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
                <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-20" style={{ color: 'var(--color-accent)' }} />
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No conversations yet</p>
                <button
                  onClick={() => setShowNew(true)}
                  className="text-sm mt-1 hover:underline"
                  style={{ color: 'var(--color-accent)' }}
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
                    className="w-full flex items-center gap-3 px-4 py-3 transition text-left"
                    style={isActive ? {
                      background: 'rgba(124,111,224,0.12)',
                      borderRight: '2px solid var(--color-accent)',
                    } : {}}
                  >
                    <div className="relative shrink-0">
                      <Avatar name={`${other.firstName} ${other.lastName}`} src={other.profilePicture} size="md" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <p className="text-sm truncate" style={{
                          color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                          fontWeight: isActive ? 700 : 600,
                        }}>
                          {other.firstName} {other.lastName}
                        </p>
                        <span className="text-xs shrink-0 ml-2" style={{ color: 'var(--color-dim)' }}>
                          {conv.lastMessage ? fmtMsgDate(conv.lastMessage.createdAt) : ''}
                        </span>
                      </div>
                      <p className="text-xs truncate" style={{ color: 'var(--color-dim)' }}>
                        {(() => {
                          const raw = conv.lastMessage?.content;
                          if (!raw) return 'No messages yet';
                          try {
                            const p = JSON.parse(raw);
                            if (isEncrypted(p)) return '🔒 Encrypted message';
                          } catch { /* plain text */ }
                          return raw;
                        })()}
                      </p>
                      {other.lastSeen && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-dim)' }}>
                          Last seen {fmtMsgDate(other.lastSeen)}
                        </p>
                      )}
                    </div>
                    {(conv.unreadCount ?? 0) > 0 && (
                      <span className="text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0"
                        style={{ background: 'var(--color-accent)' }}>
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
              <div className="text-center">
                <MessageCircle className="w-14 h-14 mx-auto mb-3 opacity-20" style={{ color: 'var(--color-accent)' }} />
                <p className="text-lg font-medium" style={{ color: 'var(--color-muted)' }}>Select a conversation</p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-dim)' }}>Choose from the list or start a new one</p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                <button
                  onClick={() => setMobileShowThread(false)}
                  className="lg:hidden p-1.5 rounded-xl hover-shade transition"
                >
                  <ArrowLeft className="w-5 h-5" style={{ color: 'var(--color-muted)' }} />
                </button>
                {otherPerson && (
                  <>
                    <Avatar name={`${otherPerson.firstName} ${otherPerson.lastName}`} src={otherPerson.profilePicture} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{otherPerson.firstName} {otherPerson.lastName}</p>
                      {otherPerson.headline && <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>{otherPerson.headline}</p>}
                    </div>
                    {recipientPublicKey ? (
                      <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                        title="Messages are end-to-end encrypted — only you and the recipient can read them"
                        style={{ background: 'rgba(111,224,160,0.1)', color: '#6fe0a0', cursor: 'help' }}>
                        <Lock className="w-3 h-3" />
                        <span className="hidden sm:inline">E2E encrypted</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                        title="Encryption unavailable — recipient hasn't set up their encryption keys yet"
                        style={{ background: 'rgba(224,175,111,0.1)', color: '#e0af6f', cursor: 'help' }}>
                        <Lock className="w-3 h-3 opacity-50" />
                        <span className="hidden sm:inline">Unencrypted</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Messages */}
              <MessageErrorBoundary>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgsLoading ? (
                  <div className="flex justify-center pt-8"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-muted)' }} /></div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12" style={{ color: 'var(--color-dim)' }}>
                    <p>Say hello! 👋</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, i) => {
                      const isMe = msg.sender?._id === user?.id;
                      const showDate = i === 0 || fmtMsgDate(messages[i - 1].createdAt) !== fmtMsgDate(msg.createdAt);
                      const content = msg.content ?? '';
                      return (
                        <div key={msg._id}>
                          {showDate && (
                            <div className="text-center my-3">
                              <span className="text-xs px-3 py-0.5 rounded-full"
                                style={{ background: 'var(--color-shade)', color: 'var(--color-muted)' }}>
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
                                name={`${msg.sender?.firstName ?? ''} ${msg.sender?.lastName ?? ''}`}
                                src={msg.sender?.profilePicture}
                                size="sm"
                                className="shrink-0 mb-1"
                              />
                            )}
                            <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                              <div className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                                style={isMe ? {
                                  background: 'linear-gradient(135deg, #7c6fe0, #9a8fec)',
                                  color: '#fff',
                                  borderBottomRightRadius: '4px',
                                } : {
                                  background: 'var(--color-shade-md)',
                                  color: 'var(--color-text)',
                                  borderBottomLeftRadius: '4px',
                                }}>
                                {(() => {
                                  try {
                                    const parsed = JSON.parse(content);
                                    if (isEncrypted(parsed)) {
                                      const decrypted = decryptedCache[msg._id];
                                      return (
                                        <span>
                                          <Lock className="inline w-3 h-3 mr-1 opacity-70 -mt-0.5" />
                                          {decrypted ?? <span className="opacity-50 italic text-xs">Decrypting…</span>}
                                        </span>
                                      );
                                    }
                                  } catch { /* not JSON */ }
                                  return content;
                                })()}
                              </div>
                              <span className="text-xs mt-0.5 px-1 flex items-center gap-1" style={{ color: 'var(--color-dim)' }}>
                                {msg.createdAt ? (() => { try { return format(new Date(msg.createdAt), 'p'); } catch { return ''; } })() : ''}
                                {msg.signature && (
                                  <span title="Message signed &amp; verified">
                                    <ShieldCheck className="w-3 h-3 text-green-400 shrink-0" />
                                  </span>
                                )}
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
              </MessageErrorBoundary>

              {/* Input */}
              <div className="px-4 py-3" style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
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
                    className="flex-1 px-4 py-2.5 rounded-2xl text-sm outline-none resize-none"
                    style={{
                      minHeight: '44px', maxHeight: '120px',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }}
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
      </div>
    </div>
  );
}
