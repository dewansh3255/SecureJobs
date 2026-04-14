import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin,
  Briefcase,
  GraduationCap,
  Award,
  Link as LinkIcon,
  Calendar,
  MoreHorizontal,
  MessageSquare,
  UserPlus,
  Check,
} from 'lucide-react';
import { useAuth } from '@stores/authStore';
import { Card, CardContent } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Avatar } from '@components/ui/Avatar';
import { Badge } from '@components/ui/Badge';

// Mock profile data
const mockProfile = {
  name: 'John Doe',
  headline: 'Software Engineer at Tech Corp',
  location: 'San Francisco Bay Area',
  avatar: null,
  coverImage: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200',
  about: `Passionate software engineer with 5+ years of experience building scalable web applications.
  Currently working on developing secure and user-friendly professional networking platforms.

  Specializations:
  • Full-stack development (MERN, TypeScript)
  • Cloud infrastructure (AWS, GCP)
  • Security best practices (OWASP)
  • Real-time applications (Socket.IO)`,
  experience: [
    {
      title: 'Senior Software Engineer',
      company: 'Tech Corp',
      location: 'San Francisco, CA',
      period: '2022 - Present',
      description: 'Leading development of cloud-native applications.',
    },
    {
      title: 'Software Engineer',
      company: 'StartupXYZ',
      location: 'San Francisco, CA',
      period: '2020 - 2022',
      description: 'Built and scaled the core product infrastructure.',
    },
  ],
  education: [
    {
      degree: 'B.S. Computer Science',
      school: 'University of California, Berkeley',
      period: '2016 - 2020',
    },
  ],
  skills: [
    'React',
    'Node.js',
    'TypeScript',
    'Python',
    'AWS',
    'Docker',
    'MongoDB',
    'PostgreSQL',
    'GraphQL',
    'Security',
  ],
  connections: 500,
  followers: 1200,
};

export default function ProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const isOwnProfile = !id || id === user?.id;

  const profile = mockProfile;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Profile Header */}
      <Card className="overflow-hidden mb-6">
        {/* Cover Image */}
        <div className="h-48 bg-gradient-to-r from-linkedin-500 to-linkedin-700 relative">
          <img
            src={profile.coverImage}
            alt="Cover"
            className="w-full h-full object-cover opacity-50"
          />
        </div>

        <CardContent className="relative pt-0 pb-6 px-6">
          {/* Avatar and Basic Info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end -mt-16 sm:-mt-20">
            <Avatar
              name={profile.name}
              src={profile.avatar}
              size="2xl"
              className="border-4 border-white dark:border-dark-800 shadow-lg"
            />
            <div className="flex-1 sm:ml-6 mt-4 sm:mt-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {profile.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {profile.headline}
              </p>
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-500 mt-2">
                <MapPin className="w-4 h-4 mr-1" />
                {profile.location}
              </div>
              <div className="flex items-center space-x-4 mt-3 text-sm text-gray-600 dark:text-gray-400">
                <span>
                  <strong className="text-gray-900 dark:text-white">{profile.connections}+</strong> connections
                </span>
                <span>
                  <strong className="text-gray-900 dark:text-white">{profile.followers}</strong> followers
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2 mt-4 sm:mt-0">
              {isOwnProfile ? (
                <>
                  <Button variant="outline" size="sm">
                    View as
                  </Button>
                  <Button variant="primary" size="sm">
                    Edit profile
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<MessageSquare className="w-4 h-4" />}
                  >
                    Message
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<UserPlus className="w-4 h-4" />}
                  >
                    Connect
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                About
              </h2>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {profile.about}
              </p>
            </CardContent>
          </Card>

          {/* Experience */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Experience
              </h2>
              <div className="space-y-6">
                {profile.experience.map((exp, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex space-x-4"
                  >
                    <div className="w-12 h-12 bg-linkedin-500 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                      {exp.company[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {exp.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">{exp.company}</p>
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-500 mt-1 space-x-3">
                        <span>{exp.period}</span>
                        <span>•</span>
                        <span className="flex items-center">
                          <MapPin className="w-3 h-3 mr-1" />
                          {exp.location}
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                        {exp.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Education */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Education
              </h2>
              <div className="space-y-4">
                {profile.education.map((edu, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex space-x-4"
                  >
                    <div className="w-12 h-12 bg-linkedin-500 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {edu.school}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">{edu.degree}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">{edu.period}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Skills */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <Badge key={skill} variant="primary" size="sm">
                    {skill}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Languages (placeholder) */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Languages
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300">English</span>
                  <span className="text-sm text-gray-500 dark:text-gray-500">Native</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
