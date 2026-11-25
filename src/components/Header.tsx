import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { BRAND_CONFIG } from '../../shared/brandConfig';
import {
  ShoppingBag,
  Heart,
  MessageSquare,
  PlusCircle,
  Search,
  User,
  ChevronDown,
  X,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentUser,
    openAuthModal,
    activeView,
    setActiveView,
    cartCount,
    wishlist,
    conversations,
    openQuickListModal,
    openProfile,
    openAccountSettings,
    searchQuery,
    setSearchQuery,
  } = useApp();

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(ev.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalUnreadMessages = conversations.reduce(
    (sum, c) => sum + (c.buyerId === currentUser?.id ? c.unreadBuyer : c.unreadSeller),
    0
  );

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-[#111217]/95 backdrop-blur-md border-b border-[#E4E4E7] dark:border-[#27272A] transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* 1. Brand Logo */}
        <button
          onClick={() => setActiveView('catalog')}
          className="flex items-center gap-2.5 group text-left shrink-0 active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#FF6B00] text-[#111111] font-black flex items-center justify-center text-base shadow-sm border-2 border-[#111111]">
            SI
          </div>
          <div className="hidden sm:block">
            <span className="text-lg font-black tracking-tight text-[#111111] dark:text-white group-hover:text-[#FF6B00] transition-colors leading-none block">
              {BRAND_CONFIG.brandName}
            </span>
            <span className="text-[10px] font-bold text-[#71717A] dark:text-[#A1A1AA] block mt-0.5">
              Youth Marketplace
            </span>
          </div>
        </button>

        {/* 2. Search Bar Only */}
        <div className="flex-1 max-w-xl mx-2 sm:mx-6">
          <div className="relative flex items-center h-11 rounded-2xl overflow-hidden border-2 border-[#E4E4E7] dark:border-[#27272A] focus-within:border-[#FF6B00] bg-[#F4F4F5] dark:bg-[#1E2028] transition-all shadow-xs">
            <span className="pl-4 text-[#71717A] dark:text-[#A1A1AA]">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                if (activeView !== 'catalog') setActiveView('catalog');
              }}
              placeholder="Search handmade products, fashion, thrift..."
              className="w-full h-full px-3 bg-transparent text-xs sm:text-sm text-[#111111] dark:text-white placeholder-[#71717A] dark:placeholder-[#A1A1AA] focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="pr-3 text-[#71717A] hover:text-[#111111] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 3. Actions & Utilities */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Start Selling Button */}
          <button
            onClick={() => {
              if (!currentUser) openAuthModal('seller_register');
              else openQuickListModal();
            }}
            className="hidden md:flex items-center gap-1.5 px-3.5 py-2 bg-[#FF6B00] hover:bg-[#E55E00] text-[#111111] font-black text-xs rounded-xl border-2 border-[#111111] shadow-[0_2px_0_#111111] transition-transform active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Sell</span>
          </button>

          {/* Messages */}
          {currentUser && (
            <button
              onClick={() => setActiveView('chat')}
              className="relative p-2.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] hover:bg-[#F4F4F5] dark:hover:bg-[#1E2028] text-[#111111] dark:text-white transition-colors"
              title="Messages"
            >
              <MessageSquare className="w-5 h-5 text-[#FF6B00]" />
              {totalUnreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center">
                  {totalUnreadMessages}
                </span>
              )}
            </button>
          )}

          {/* Wishlist */}
          <button
            onClick={() => setActiveView('wishlist')}
            className="relative p-2.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] hover:bg-[#F4F4F5] dark:hover:bg-[#1E2028] text-[#111111] dark:text-white transition-colors hidden sm:flex"
            title="Wishlist"
          >
            <Heart className="w-5 h-5 text-rose-500" />
            {wishlist.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF6B00] text-[#111111] text-[10px] font-black flex items-center justify-center">
                {wishlist.length}
              </span>
            )}
          </button>

          {/* Cart */}
          <button
            onClick={() => setActiveView('cart')}
            className="relative p-2.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] hover:bg-[#F4F4F5] dark:hover:bg-[#1E2028] text-[#111111] dark:text-white transition-colors"
            title="Cart"
          >
            <ShoppingBag className="w-5 h-5 text-[#FF6B00]" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF6B00] text-[#111111] text-[10px] font-black flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          {/* Account / User Menu */}
          {currentUser ? (
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] hover:bg-[#F4F4F5] dark:hover:bg-[#1E2028] transition-all"
              >
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-[#FFF4EC] text-[#FF6B00] font-black flex items-center justify-center text-xs shrink-0">
                  {currentUser.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{(currentUser.name?.[0] || 'U').toUpperCase()}</span>
                  )}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#71717A] hidden sm:block" />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl shadow-xl py-2 z-50 text-xs text-[#111111] dark:text-white animate-modal-enter">
                  <div className="px-4 py-2 border-b border-[#E4E4E7] dark:border-[#27272A]">
                    <p className="font-black truncate">{currentUser.name}</p>
                    <p className="text-[10px] text-[#71717A] truncate">@{currentUser.profileSlug || currentUser.id}</p>
                  </div>
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); openProfile(currentUser.profileSlug || currentUser.id); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#F4F4F5] dark:hover:bg-[#1E2028] font-medium"
                  >
                    My Profile
                  </button>
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); setActiveView('orders'); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#F4F4F5] dark:hover:bg-[#1E2028] font-medium"
                  >
                    Your Orders
                  </button>
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); setActiveView('wishlist'); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#F4F4F5] dark:hover:bg-[#1E2028] font-medium"
                  >
                    Saved Items
                  </button>
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); openAccountSettings(); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#F4F4F5] dark:hover:bg-[#1E2028] font-medium border-t border-[#E4E4E7] dark:border-[#27272A]"
                  >
                    Account Settings
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('login')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#111111] text-white dark:bg-white dark:text-[#111111] font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95"
            >
              <User className="w-3.5 h-3.5" />
              <span>Log in</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
