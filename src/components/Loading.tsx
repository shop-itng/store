import React from 'react';

interface LoadingProps {
  fullPage?: boolean;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  fullPage = false,
  text,
  size = 'md',
  className = '',
}) => {
  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5 sm:w-3 sm:h-3',
    lg: 'w-3.5 h-3.5 sm:w-4 sm:h-4',
  };

  const dotClass = `${dotSizes[size]} rounded-full bg-[#FF6B00] animate-bounce-dot`;

  const loaderContent = (
    <div className={`flex flex-col items-center justify-center gap-2.5 ${className}`}>
      {/* 3 Bouncing Dots in Brand Color (#FF6B00) */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className={dotClass} style={{ animationDelay: '0s' }} />
        <span className={dotClass} style={{ animationDelay: '0.16s' }} />
        <span className={dotClass} style={{ animationDelay: '0.32s' }} />
      </div>

      {text && (
        <p className="text-xs font-bold text-[#71717A] dark:text-[#A1A1AA] tracking-wide animate-pulse">
          {text}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FBFBFC] dark:bg-[#0D0E12] animate-backdrop transition-opacity duration-300">
        <div className="flex flex-col items-center gap-3.5 p-6 text-center animate-modal-enter">
          <img
            src="/shopit-logo.png"
            alt="Shop It"
            className="w-12 h-12 rounded-2xl shadow-sm object-contain"
          />
          <span className="text-base font-black text-[#111111] dark:text-white tracking-tight">
            Shop It
          </span>
          {loaderContent}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-10 flex items-center justify-center">
      {loaderContent}
    </div>
  );
};
