import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Image,
  Video,
  FileText,
  Send,
  ThumbsUp,
  MessageCircle,
  Repeat,
  Share2,
  MoreHorizontal,
} from 'lucide-react';
import { useAuth } from '@stores/authStore';
import { Card, CardContent } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Avatar } from '@components/ui/Avatar';
import { Badge } from '@components/ui/Badge';

// Mock data for demonstration
const mockPosts = [
  {
    id: '1',
    author: {
      name: 'John Doe',
      headline: 'Software Engineer at Tech Corp',
      avatar: null,
    },
    content: `Excited to share that I just completed a major project on building a secure professional networking platform! 🚀

This project has taught me so much about:
• Full-stack development with MERN
• Security best practices (OWASP Top 10)
• Real-time communication with Socket.IO
• Containerization with Docker

Huge thanks to my team for the amazing collaboration!

#WebDevelopment #CyberSecurity #MERN #Docker`,
    image: null,
    reactions: { like: 24, celebrate: 8, support: 5, love: 3, insightful: 2, curious: 1 },
    comments: 12,
    shares: 3,
    timeAgo: '2h',
  },
  {
    id: '2',
    author: {
      name: 'Sarah Chen',
      headline: 'Security Researcher | CISSP',
      avatar: null,
    },
    content: `🔒 Security Tip of the Day:

Always validate and sanitize user input on BOTH client and server side. Client-side validation improves UX, but server-side validation is what keeps your application secure.

Remember: Never trust user input!

#CyberSecurity #WebSecurity #BestPractices`,
    image: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800',
    reactions: { like: 156, celebrate: 12, support: 8, love: 15, insightful: 45, curious: 3 },
    comments: 28,
    shares: 67,
    timeAgo: '5h',
  },
];

const reactionEmojis = {
  like: '👍',
  celebrate: '🎉',
  support: '❤️',
  love: '😍',
  insightful: '💡',
  curious: '🤔',
};

export default function FeedPage() {
  const { user } = useAuth();
  const [postContent, setPostContent] = useState('');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Left Sidebar - Profile Summary */}
      <div className="hidden lg:block lg:col-span-1">
        <Card className="sticky top-20">
          <div className="h-20 bg-gradient-to-r from-linkedin-500 to-linkedin-700 rounded-t-xl"></div>
          <CardContent className="pt-0 pb-4 px-4">
            <div className="text-center -mt-12 mb-3">
              <Avatar name={user?.fullName || ''} src={user?.profilePicture} size="xl" />
            </div>
            <h2 className="text-lg font-semibold text-center text-gray-900 dark:text-white">
              {user?.fullName}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
              {user?.headline || 'Professional'}
            </p>
            <div className="border-t border-gray-200 dark:border-dark-700 pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Connections</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {user?.connections || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Followers</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {user?.followers || 0}
                </span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-4">
              View Profile
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Feed */}
      <div className="lg:col-span-2 space-y-4">
        {/* Create Post */}
        <Card>
          <CardContent className="p-4">
            <div className="flex space-x-3">
              <Avatar name={user?.fullName || ''} src={user?.profilePicture} />
              <div className="flex-1">
                <textarea
                  placeholder="Start a post..."
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  className="w-full resize-none border-0 bg-gray-100 dark:bg-dark-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-linkedin-500/20"
                  rows={3}
                />
                <div className="flex items-center justify-between mt-3">
                  <div className="flex space-x-2">
                    <button className="p-2 text-gray-500 hover:text-linkedin-600 dark:text-gray-400 dark:hover:text-linkedin-400 hover:bg-linkedin-50 dark:hover:bg-linkedin-900/20 rounded-lg transition-colors">
                      <Image className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-500 hover:text-linkedin-600 dark:text-gray-400 dark:hover:text-linkedin-400 hover:bg-linkedin-50 dark:hover:bg-linkedin-900/20 rounded-lg transition-colors">
                      <Video className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-500 hover:text-linkedin-600 dark:text-gray-400 dark:hover:text-linkedin-400 hover:bg-linkedin-50 dark:hover:bg-linkedin-900/20 rounded-lg transition-colors">
                      <FileText className="w-5 h-5" />
                    </button>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!postContent.trim()}
                    leftIcon={<Send className="w-4 h-4" />}
                  >
                    Post
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Posts */}
        {mockPosts.map((post, index) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-4">
                {/* Post Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <Avatar name={post.author.name} src={post.author.avatar} />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white hover:text-linkedin-600 dark:hover:text-linkedin-400 cursor-pointer">
                        {post.author.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {post.author.headline}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">{post.timeAgo}</p>
                    </div>
                  </div>
                  <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>

                {/* Post Content */}
                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap mb-3">
                  {post.content}
                </p>

                {/* Post Image */}
                {post.image && (
                  <div className="-mx-4 mb-3">
                    <img
                      src={post.image}
                      alt="Post content"
                      className="w-full h-auto object-cover"
                    />
                  </div>
                )}

                {/* Reaction Stats */}
                <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-dark-700">
                  <div className="flex items-center space-x-2">
                    <div className="flex -space-x-1">
                      {Object.entries(reactionEmojis).map(([key, emoji]) => (
                        <span
                          key={key}
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white dark:bg-dark-800 text-xs shadow-sm"
                        >
                          {emoji}
                        </span>
                      ))}
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {Object.values(post.reactions).reduce((a, b) => a + b, 0)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>{post.comments} comments</span>
                    <span>{post.shares} reposts</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors">
                    <ThumbsUp className="w-5 h-5" />
                    <span className="text-sm font-medium">Like</span>
                  </button>
                  <button className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors">
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">Comment</span>
                  </button>
                  <button className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors">
                    <Repeat className="w-5 h-5" />
                    <span className="text-sm font-medium">Repost</span>
                  </button>
                  <button className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors">
                    <Share2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Send</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Right Sidebar - Suggestions */}
      <div className="hidden lg:block lg:col-span-1">
        <Card className="sticky top-20">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              People you may know
            </h3>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar name={`User ${i}`} size="md" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        User {i}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Software Engineer
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Connect
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="w-full mt-4">
              Show more
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
