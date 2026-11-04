import React from 'react';
import { ShoppingBag, ArrowLeft, Search, HelpCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface NotFoundViewProps {
  title?: string;
  message?: string;
  onAction?: () => void;
  actionText?: string;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  title = 'Page or Item Not Found',
  message = "We couldn't find what you were looking for. The item may have been sold out, deleted, or the address might be incorrect.",
  onAction,
  actionText = 'Back to Marketplace',
}) => {
  const { setActiveView } = useApp();

  return (
    <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center space-y-6">
      <div className="w-16 h-16 rounded-3xl bg-[#FF6B00]/10 border-2 border-[#111111] dark:border-[#27272A] flex items-center justify-center mx-auto shadow-[0_4px_0_#111111] dark:shadow-none">
        <ShoppingBag className="w-8 h-8 text-[#FF6B00]" />
      </div>

      <div className="space-y-2">
        <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
          404 · Nothing Found Here
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
          {title}
        </h1>
        <p className="text-xs sm:text-sm text-neutral-600 dark:text-[#A1A1AA] max-w-md mx-auto leading-relaxed">
          {message}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            if (onAction) {
              onAction();
            } else {
              setActiveView('catalog');
            }
          }}
          className="w-full sm:w-auto px-6 py-3 bg-[#9FE870] hover:bg-[#8fd860] text-[#111111] font-black text-xs sm:text-sm rounded-xl border-2 border-[#111111] shadow-[0_3px_0_#111111] dark:shadow-none active:translate-y-0.5 transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{actionText}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('faq')}
          className="w-full sm:w-auto px-6 py-3 bg-white dark:bg-stone-900 hover:bg-stone-50 text-stone-700 dark:text-stone-200 font-bold text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-800 transition-colors flex items-center justify-center gap-2"
        >
          <HelpCircle className="w-4 h-4 text-stone-400" />
          <span>Help & FAQs</span>
        </button>
      </div>
    </div>
  );
};
