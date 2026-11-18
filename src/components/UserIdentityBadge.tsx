import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface UserIdentityBadgeProps {
  userId?: string;
  profileSlug?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  subtitle?: string;
  isVerified?: boolean;
  size?: 'xs' | 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  stopPropagation?: boolean;
}

export const UserIdentityBadge: React.FC<UserIdentityBadgeProps> = ({
  userId,
  profileSlug,
  displayName,
  avatarUrl,
  subtitle,
  isVerified = false,
  size = 'sm',
  disabled = false,
  className = '',
  stopPropagation = true,
}) => {
  const { openProfile } = useApp();
  const [imgError, setImgError] = useState(false);

  const label = (displayName || 'Member').trim() || 'Member';
  const targetSlug = profileSlug || userId;
  const isDeleted = label === 'Deleted User' || !targetSlug;
  const clickable = !disabled && !isDeleted;

  const sizeClasses =
    size === 'xs'
      ? { box: 'w-5 h-5 text-[10px]', text: 'text-[11px]', sub: 'text-[10px]' }
      : size === 'md'
      ? { box: 'w-9 h-9 text-sm', text: 'text-xs sm:text-sm', sub: 'text-[11px]' }
      : { box: 'w-6 h-6 text-[11px]', text: 'text-xs', sub: 'text-[10px]' };

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    if (clickable && targetSlug) {
      openProfile(targetSlug);
    }
  };

  const content = (
    <>
      <span
        className={`${sizeClasses.box} rounded-full overflow-hidden shrink-0 border border-[#E4E4E7] dark:border-[#27272A] bg-[#FFF4EC] dark:bg-[#1E2028] text-[#FF6B00] font-black flex items-center justify-center`}
      >
        {avatarUrl && !imgError ? (
          <img
            src={avatarUrl}
            alt={label}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{label[0]?.toUpperCase() || 'M'}</span>
        )}
      </span>
      <span className="min-w-0 text-left">
        <span className={`${sizeClasses.text} font-bold text-[#111111] dark:text-white truncate inline-flex items-center gap-1 max-w-full`}>
          <span className="truncate">{label}</span>
          {isVerified && (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-[#9FE870] shrink-0" aria-label="Verified Seller" />
          )}
        </span>
        {subtitle && (
          <span className={`${sizeClasses.sub} text-[#71717A] dark:text-[#A1A1AA] block truncate leading-tight`}>
            {subtitle}
          </span>
        )}
      </span>
    </>
  );

  if (!clickable) {
    return (
      <span className={`inline-flex items-center gap-2 min-w-0 ${className}`}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 min-w-0 rounded-lg hover:text-[#FF6B00] transition-colors cursor-pointer group ${className}`}
      title={`View ${label}'s profile`}
    >
      {content}
    </button>
  );
};
