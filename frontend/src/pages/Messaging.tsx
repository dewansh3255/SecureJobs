import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Search,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  ArrowLeft,
} from 'lucide-react';
import { Card } from '@components/ui/Card';
import { Avatar } from '@components/ui/Avatar';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { useAuth } from '@stores/authStore';
import { cn } from '@utils/index';

// Mock conversations
const mockConversations = [
  {
    id: '1',
    participant: {
      name: 'Sarah Chen',
      avatar: null,
      isOnline: true,
    },
    lastMessage: 'Thanks for the update! Let me review the code.',
    time: '2m',
    unread: 2,
  },
  {
    id: '2',
    participant: {
      name: 'John Doe',
      avatar: null,
      isOnline: false,
    },
    lastMessage: 'Sure, we can schedule a call tomorrow.',
    time: '1h',
    unread: 0,
  },
  {
    id: '3',
    participant: {
      name: 'Maria Garcia',
      avatar: null,
      isOnline: true,
    },
    lastMessage: 'The project looks great! Nice work.',
    time: '3h',
    unread: 0,
  },
];

// Mock messages
const mockMessages = [
  {
    id: '1',
    senderId: 'other',
    content: 'Hey! How is the FCS-26 project going?',
    time: '10:30 AM',
    read: true,
  },
  {
    id: '2',
    senderId: 'me',
    content: 'Going great! Just finished implementing the real-time messaging with Socket.IO.',
    time: '10:32 AM',
    read: true,
  },
  {
    id: '3',
    senderId: 'other',
    content: 'That sounds awesome! How is the security implementation?',
    time: '10:33 AM',
    read: true,
  },
  {
    id: '4',
    senderId: 'me',
    content: 'We have implemented:\n• JWT authentication with refresh tokens\n• Rate limiting\n• XSS and CSRF protection\n• Input validation\n• MongoDB injection prevention',
    time: '10:35 AM',
    read: true,
  },
  {
    id: '5',
    senderId: 'other',
    content: 'Impressive! Make sure to also test for OWASP Top 10 vulnerabilities.',
    time: '10:36 AM',
    read: false,
  },
  {
    id: '6',
    senderId: 'other',
    content: 'Thanks for the update! Let me review the code.',
    time: '10:37 AM',
    read: false,
  },
];

export default function MessagingPage() {
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mockMessages]);

  const selectedConv = mockConversations.find((c) => c.id === selectedConversation);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    // Add message logic here
    setMessageInput('');
  };

  const handleSelectConversation = (id: string) => {
    setSelectedConversation(id);
    setMobileView('chat');
  };

  const handleBackToList = () => {
    setMobileView('list');
  };

  return (
    <Card className="h-[calc(100vh-8rem)] overflow-hidden">
      <div className="flex h-full">
        {/* Conversations List */}
        <div
          className={cn(
            'w-full md:w-80 lg:w-96 border-r border-gray-200 dark:border-dark-700 flex flex-col',
            mobileView === 'chat' && 'hidden md:flex'
          )}
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-dark-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Messages
            </h2>
            <Input
              placeholder="Search messages"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-5 h-5" />}
              size="sm"
            />
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {mockConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={cn(
                  'w-full p-4 flex items-center space-x-3 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors border-b border-gray-100 dark:border-dark-800',
                  selectedConversation === conv.id &&
                    'bg-linkedin-50 dark:bg-linkedin-900/20'
                )}
              >
                <Avatar
                  name={conv.participant.name}
                  src={conv.participant.avatar}
                  isOnline={conv.participant.isOnline}
                />
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {conv.participant.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-500">{conv.time}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p
                      className={cn(
                        'text-sm truncate',
                        conv.unread > 0
                          ? 'font-semibold text-gray-900 dark:text-white'
                          : 'text-gray-600 dark:text-gray-400'
                      )}
                    >
                      {conv.lastMessage}
                    </p>
                    {conv.unread > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-linkedin-500 text-white rounded-full">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div
          className={cn(
            'flex-1 flex flex-col',
            mobileView === 'list' && 'hidden md:flex'
          )}
        >
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleBackToList}
                    className="md:hidden p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <Avatar
                    name={selectedConv?.participant.name || ''}
                    src={selectedConv?.participant.avatar}
                    isOnline={selectedConv?.participant.isOnline}
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {selectedConv?.participant.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {selectedConv?.participant.isOnline ? 'Active now' : 'Offline'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                    <Phone className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                    <Video className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-dark-900">
                {mockMessages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'flex',
                      message.senderId === 'me' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] px-4 py-2 rounded-2xl',
                        message.senderId === 'me'
                          ? 'bg-linkedin-500 text-white rounded-br-sm'
                          : 'bg-white dark:bg-dark-800 text-gray-900 dark:text-white rounded-bl-sm'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <div
                        className={cn(
                          'flex items-center justify-end space-x-1 mt-1 text-xs',
                          message.senderId === 'me' ? 'text-linkedin-100' : 'text-gray-500'
                        )}
                      >
                        <span>{message.time}</span>
                        {message.senderId === 'me' && (
                          message.read ? (
                            <CheckCheck className="w-3 h-3" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800">
                <div className="flex items-center space-x-3">
                  <button className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <Input
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1"
                  />
                  <button className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg">
                    <Smile className="w-5 h-5" />
                  </button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim()}
                    className="px-4"
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <div className="w-20 h-20 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Your Messages
                </h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-sm">
                  Send private messages to your connections. Select a conversation from the list to start chatting.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
