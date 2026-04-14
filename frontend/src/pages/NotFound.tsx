import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Search, Users } from 'lucide-react';
import { Button } from '@components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        {/* 404 Illustration */}
        <div className="relative mb-8">
          <div className="text-9xl font-bold text-gray-200 dark:text-dark-700">404</div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-linkedin-500 rounded-full flex items-center justify-center">
              <Search className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Page not found
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8">
          The page you're looking for doesn't exist or has been moved.
          Let's get you back to your professional network.
        </p>

        <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <Link to="/">
            <Button variant="primary" leftIcon={<Home className="w-5 h-5" />}>
              Go Home
            </Button>
          </Link>
          <Link to="/network">
            <Button variant="outline" leftIcon={<Users className="w-5 h-5" />}>
              Browse Network
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
