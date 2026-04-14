import { useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, MapPin, DollarSign, Clock, Building2, Search, Filter } from 'lucide-react';
import { Card, CardContent } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Badge } from '@components/ui/Badge';

// Mock job data
const mockJobs = [
  {
    id: '1',
    title: 'Senior Software Engineer',
    company: 'Tech Corp',
    location: 'San Francisco, CA',
    type: 'full-time',
    salary: { min: 150000, max: 200000, currency: 'USD', period: 'yearly' },
    experience: 'senior',
    posted: '2 days ago',
    description: 'We are looking for a Senior Software Engineer to join our growing team...',
    skills: ['React', 'Node.js', 'TypeScript', 'AWS'],
    remote: true,
  },
  {
    id: '2',
    title: 'Security Engineer',
    company: 'CyberDefense Inc',
    location: 'Remote',
    type: 'full-time',
    salary: { min: 130000, max: 180000, currency: 'USD', period: 'yearly' },
    experience: 'mid',
    posted: '1 day ago',
    description: 'Join our security team to help protect our infrastructure...',
    skills: ['Security', 'Penetration Testing', 'OWASP', 'Python'],
    remote: true,
  },
  {
    id: '3',
    title: 'Frontend Developer',
    company: 'Creative Agency',
    location: 'New York, NY',
    type: 'contract',
    salary: { min: 80, max: 120, currency: 'USD', period: 'hourly' },
    experience: 'mid',
    posted: '5 days ago',
    description: 'We need a talented Frontend Developer for a 6-month project...',
    skills: ['React', 'Tailwind CSS', 'Framer Motion'],
    remote: false,
  },
];

export default function JobsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  const formatSalary = (job: typeof mockJobs[0]) => {
    const { min, max, currency, period } = job.salary;
    const symbol = currency === 'USD' ? '$' : currency;
    const range = period === 'hourly'
      ? `${symbol}${min} - ${symbol}${max}/hr`
      : `${symbol}${(min / 1000).toFixed(0)}K - ${symbol}${(max / 1000).toFixed(0)}K`;
    return range;
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Job Opportunities
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Discover your next career move
        </p>
      </div>

      {/* Search & Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Search by title, company, or skills"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-5 h-5" />}
              />
            </div>
            <div>
              <Input
                placeholder="Location"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                leftIcon={<MapPin className="w-5 h-5" />}
              />
            </div>
            <div className="flex">
              <Button variant="primary" className="w-full" leftIcon={<Filter className="w-5 h-5" />}>
                Filters
              </Button>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2 mt-4">
            {['all', 'full-time', 'part-time', 'contract', 'remote'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                  selectedType === type
                    ? 'bg-linkedin-500 text-white'
                    : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                }`}
              >
                {type === 'all' ? 'All Jobs' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Job Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{mockJobs.length}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {mockJobs.filter((j) => j.remote).length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Remote</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {mockJobs.filter((j) => j.type === 'full-time').length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Full-time</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {mockJobs.filter((j) => j.type === 'contract').length}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Contract</p>
          </CardContent>
        </Card>
      </div>

      {/* Job Listings */}
      <div className="space-y-4">
        {mockJobs.map((job, index) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card variant="hover">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-linkedin-500 rounded-lg flex items-center justify-center text-white font-bold">
                        {job.company[0]}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white hover:text-linkedin-600 dark:hover:text-linkedin-400 cursor-pointer">
                          {job.title}
                        </h3>
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                          <Building2 className="w-4 h-4" />
                          <span>{job.company}</span>
                        </div>
                        <div className="flex items-center flex-wrap gap-2 mt-3">
                          <Badge variant="primary" size="sm">
                            <Briefcase className="w-3 h-3 mr-1" />
                            {job.type}
                          </Badge>
                          <Badge variant="success" size="sm">
                            <DollarSign className="w-3 h-3 mr-1" />
                            {formatSalary(job)}
                          </Badge>
                          {job.remote && (
                            <Badge variant="info" size="sm">
                              Remote
                            </Badge>
                          )}
                          <span className="text-xs text-gray-500 dark:text-gray-500 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {job.posted}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {job.skills.map((skill) => (
                            <span
                              key={skill}
                              className="px-2 py-1 text-xs bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <Button variant="primary" size="sm">
                      Easy Apply
                    </Button>
                    <Button variant="ghost" size="sm">
                      Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
