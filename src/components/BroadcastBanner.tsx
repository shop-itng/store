import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle, Info, Bell, Sparkles, X, ShieldAlert } from 'lucide-react';

export const BroadcastBanner: React.FC = () => {
  const { broadcastAnnouncement } = useApp();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!broadcastAnnouncement?.isActive || isDismissed) {
    return null;
  }

  const { title, message, tone, author } = broadcastAnnouncement;

  const toneConfig = {
    emergency: {
      bg: 'bg-red-700',
      border: 'border-red-900',
      text: 'text-white',
      badge: 'bg-black/40 text-red-100',
      icon: ShieldAlert,
      label: 'URGENT SAFETY ADVISORY',
      pulse: true,
    },
    warning: {
      bg: 'bg-amber-500',
      border: 'border-amber-600',
      text: 'text-stone-950',
      badge: 'bg-amber-950/20 text-stone-950',
      icon: AlertTriangle,
      label: 'PLATFORM NOTICE',
      pulse: false,
    },
    info: {
      bg: 'bg-stone-900',
      border: 'border-stone-800',
      text: 'text-white',
      badge: 'bg-[#9FE870] text-stone-950',
      icon: Info,
      label: 'OFFICIAL ANNOUNCEMENT',
      pulse: false,
    },
    promo: {
      bg: 'bg-[#123524]',
      border: 'border-[#1b4330]',
      text: 'text-white',
      badge: 'bg-[#FF6B00] text-white',
      icon: Sparkles,
      label: 'MARKETPLACE UPDATE',
      pulse: false,
    },
  }[tone || 'info'];

  const IconComponent = toneConfig.icon;

  return (
    <div
      role="alert"
      className={`${toneConfig.bg} ${toneConfig.text} border-b ${toneConfig.border} px-4 py-2.5 transition-all text-xs font-medium relative z-50`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0 flex items-center gap-1.5">
            {toneConfig.pulse && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
            )}
            <IconComponent className="w-4 h-4 shrink-0" />
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${toneConfig.badge}`}
            >
              {toneConfig.label}
            </span>
          </div>

          <div className="truncate flex items-center gap-2">
            <span className="font-bold underline decoration-white/40">{title}</span>
            <span className="hidden sm:inline text-white/70">·</span>
            <span className="text-white/90 truncate">{message}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-white/60 hidden md:inline">
            By {author}
          </span>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss banner"
            className="p-1 rounded-md hover:bg-black/20 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
