import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Users, Compass } from 'lucide-react';
import { Button } from '@components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div style={{ position: 'absolute', top: '20%', left: '30%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(124,111,224,0.12)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '30%', width: 250, height: 250, borderRadius: '50%', background: 'rgba(224,111,188,0.08)', filter: 'blur(80px)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10"
      >
        {/* Glowing 404 */}
        <div className="relative mb-8">
          <div
            className="text-[9rem] font-black leading-none select-none"
            style={{
              background: 'linear-gradient(135deg, rgba(124,111,224,0.3) 0%, rgba(224,111,188,0.2) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 40px rgba(124,111,224,0.3))',
            }}
          >
            404
          </div>
          <motion.div
            animate={{ rotate: [0, 10, -10, 0], y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7c6fe0, #e06fbc)', boxShadow: '0 0 40px rgba(124,111,224,0.4)' }}>
              <Compass className="w-10 h-10 text-white" />
            </div>
          </motion.div>
        </div>

        <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>
          Lost in the void
        </h1>
        <p className="max-w-sm mb-8 mx-auto leading-relaxed" style={{ color: 'var(--color-muted)' }}>
          This page doesn't exist or has been moved.<br />
          Let's navigate you back to your network.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/">
            <Button leftIcon={<Home className="w-4 h-4" />}>Go Home</Button>
          </Link>
          <Link to="/network">
            <Button variant="ghost" leftIcon={<Users className="w-4 h-4" />}>Browse Network</Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
