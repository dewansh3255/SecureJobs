import { ImgHTMLAttributes, forwardRef } from 'react';
import { cn } from '@utils/index';

export interface AvatarProps extends ImgHTMLAttributes<HTMLImageElement> {
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  isOnline?: boolean;
  fallback?: React.ReactNode;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
  '2xl': 'w-24 h-24',
};

const Avatar = forwardRef<HTMLImageElement, AvatarProps>(
  ({ className, name, src, size = 'md', isOnline = false, alt, fallback, ...props }, ref) => {
    const initials = name
      ? name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : '?';

    return (
      <div className={cn('relative inline-flex', className)}>
        <div
          className={cn(
            'relative inline-flex items-center justify-center overflow-hidden rounded-full',
            'bg-gradient-to-br from-linkedin-400 to-linkedin-600',
            'text-white font-medium',
            sizeClasses[size]
          )}
        >
          {src ? (
            <img
              ref={ref}
              src={src}
              alt={alt || name || 'Avatar'}
              className="w-full h-full object-cover"
              {...props}
            />
          ) : (
            <span className="text-sm">{fallback || initials}</span>
          )}
        </div>
        {isOnline && (
          <span
            className={cn(
              'absolute bottom-0 right-0 rounded-full bg-green-500 border-2 border-white dark:border-dark-800',
              size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'
            )}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

export { Avatar };
export default Avatar;
