import React from 'react';
import { useApp } from '../context/AppContext';
import { Zap, X } from 'lucide-react';

export const LowDataBanner: React.FC = () => {
  const { lowDataMode, toggleLowDataMode } = useApp();

  if (!lowDataMode) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs flex items-center justify-between">
      <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
        <Zap className="w-4 h-4 text-amber-600 shrink-0 fill-amber-500" />
        <span className="font-medium">
          Low-Data Mode active: Media is cached & optimized to save your mobile data on campus networks.
        </span>
        <button
          onClick={toggleLowDataMode}
          className="ml-auto underline font-semibold text-amber-800 hover:text-amber-950 shrink-0 pl-2"
        >
          Disable
        </button>
      </div>
    </div>
  );
};
