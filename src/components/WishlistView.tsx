import React from 'react';
import { useApp } from '../context/AppContext';
import { ProductCard } from './ProductCard';
import { Heart, ArrowLeft, ShoppingBag } from 'lucide-react';

export const WishlistView: React.FC = () => {
  const { wishlist, products, setActiveView } = useApp();

  const savedProducts = products.filter(p => wishlist.includes(p.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setActiveView('catalog')}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-white transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </button>

        <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Heart className="w-4 h-4 text-[#FF6B00] fill-[#FF6B00]" />
          <span>My Saved Crafts ({savedProducts.length})</span>
        </h1>
      </div>

      {savedProducts.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {savedProducts.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-slate-200 dark:border-[#27272A] p-12 text-center max-w-md mx-auto space-y-4">
          <Heart className="w-12 h-12 text-slate-300 dark:text-stone-600 mx-auto" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Your wishlist is empty</h2>
          <p className="text-xs text-slate-500 dark:text-[#A1A1AA]">
            Tap the heart icon on any handmade waist beads, scent oil, or crochet bag to save it for later.
          </p>
          <button
            onClick={() => setActiveView('catalog')}
            className="px-5 py-2.5 bg-[#111111] dark:bg-stone-800 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
          >
            Explore Campus Crafts
          </button>
        </div>
      )}
    </div>
  );
};
