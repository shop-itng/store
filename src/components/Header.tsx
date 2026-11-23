import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { NIGERIAN_STATES } from '../data/nigerianLocations';
import { BRAND_CONFIG } from '../../shared/brandConfig';
import {
  ShoppingBag,
  Heart,
  MessageSquare,
  ShieldCheck,
  MapPin,
  PlusCircle,
  Store,
  Shield,
  ChevronDown,
  X,
  Sun,
  Moon,
  Settings,
  Bell,
  CheckCheck,
  RefreshCw,
  Search,
  User,
  Compass,
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
    openProduct,
    openAccountSettings,
    userLocation,
    setUserLocation,
    notify,
    theme,
    toggleTheme,
    dbNotifications,
    unreadNotificationsCount,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    searchQuery,
    setSearchQuery,
  } = useApp();

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [tempState, setTempState] = useState(userLocation.state || 'Lagos');
  const [tempCity, setTempCity] = useState(userLocation.city || 'Lagos Mainland');
  const [tempArea, setTempArea] = useState(userLocation.area || 'Yaba');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const notifContainerRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (notifContainerRef.current && !notifContainerRef.current.contains(ev.target as Node)) {
        setIsNotifOpen(false);
      }
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
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0D0E12]/95 backdrop-blur-md border-b border-[#E4E4E7] dark:border-[#27272A] transition-all duration-200 w-full max-w-full shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3 min-w-0">
        
        {/* Left: Brand Logo + Area Pill */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveView('catalog')}
            className="flex items-center gap-2 text-left group min-w-0 active:scale-95 transition-transform"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#FF6B00] text-[#111111] font-black flex items-center justify-center shadow-[0_2px_0_#111111] dark:shadow-none transition-transform group-hover:scale-105 shrink-0 text-base">
              SI
            </div>
            <div className="min-w-0">
              <span className="text-lg sm:text-xl font-black tracking-tight text-[#111111] dark:text-white group-hover:text-[#FF6B00] transition-colors leading-none block">
                {BRAND_CONFIG.brandName}
              </span>
              <span className="text-[10px] font-bold text-[#71717A] dark:text-[#A1A1AA] tracking-tight mt-0.5 truncate hidden sm:block">
                Campus &amp; Youth Commerce
              </span>
            </div>
          </button>

          {/* Location Picker Pill */}
          <button
            onClick={() => setIsLocationModalOpen(true)}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF6B00] bg-[#FAFAFA] dark:bg-[#15161C] text-xs font-bold text-[#111111] dark:text-white transition-all shadow-xs"
          >
            <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span className="bg-[#9FE870] text-[#111111] px-1.5 py-0.5 rounded text-[10px] font-black">{userLocation.area}</span>
            <span className="text-[#A1A1AA]">·</span>
            <span className="text-[#71717A] dark:text-[#A1A1AA]">{userLocation.state}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#A1A1AA]" />
          </button>
        </div>

        {/* Center: Option C Prominent Search Bar (Desktop) */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                if (activeView !== 'catalog') setActiveView('catalog');
              }}
              placeholder="Search handcrafted bags, perfumes, thrift, campus tech..."
              className="w-full h-10 pl-10 pr-4 bg-[#F4F4F5] dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl text-xs font-medium text-[#111111] dark:text-white placeholder-[#71717A] focus:outline-none focus:border-[#FF6B00] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#111111]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Actions, Sell Button, Notifications & User Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Sell Button */}
          <button
            onClick={() => {
              if (!currentUser) openAuthModal('seller_register');
              else openQuickListModal();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] dark:border-stone-800 text-xs sm:text-sm font-black rounded-xl shadow-[0_2.5px_0_#111111] dark:shadow-none transition-all active:translate-y-0.5"
          >
            <span className="w-4 h-4 rounded-full bg-[#9FE870] text-[#111111] flex items-center justify-center text-xs font-black">+</span>
            <span>Sell</span>
          </button>

          {/* Chat Icon */}
          <button
            onClick={() => setActiveView('chat')}
            className="relative p-2 rounded-xl bg-[#F4F4F5] dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] text-[#111111] dark:text-white hover:border-[#FF6B00] transition-colors"
            title="Messages"
          >
            <MessageSquare className="w-4 h-4" />
            {totalUnreadMessages > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF6B00] text-white text-[10px] font-black flex items-center justify-center">
                {totalUnreadMessages}
              </span>
            )}
          </button>

          {/* Cart Icon */}
          <button
            onClick={() => setActiveView('cart')}
            className="relative p-2 rounded-xl bg-[#F4F4F5] dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] text-[#111111] dark:text-white hover:border-[#FF6B00] transition-colors"
            title="Shopping Cart"
          >
            <ShoppingBag className="w-4 h-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF6B00] text-[#111111] text-[10px] font-black flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          {/* Logged In Avatar or Login Button */}
          {currentUser ? (
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF6B00] bg-[#FAFAFA] dark:bg-[#15161C] transition-all"
              >
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-7 h-7 rounded-lg object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-[#FF6B00] text-[#111111] font-black flex items-center justify-center text-xs">
                    {currentUser.name?.[0] || 'U'}
                  </div>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-[#71717A]" />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl shadow-xl py-2 z-50 text-xs">
                  <div className="px-4 py-2 border-b border-[#E4E4E7] dark:border-[#27272A]">
                    <p className="font-bold text-[#111111] dark:text-white truncate">{currentUser.name}</p>
                    <p className="text-[10px] text-[#71717A] truncate">@{currentUser.profileSlug || currentUser.id}</p>
                  </div>
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); openProfile(currentUser.profileSlug || currentUser.id); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#F4F4F5] dark:hover:bg-[#1E2028] font-medium text-[#111111] dark:text-white"
                  >
                    My Profile
                  </button>
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); setActiveView('orders'); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#F4F4F5] dark:hover:bg-[#1E2028] font-medium text-[#111111] dark:text-white"
                  >
                    My Orders
                  </button>
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); setActiveView('wishlist'); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#F4F4F5] dark:hover:bg-[#1E2028] font-medium text-[#111111] dark:text-white"
                  >
                    Saved Items
                  </button>
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); openAccountSettings(); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#F4F4F5] dark:hover:bg-[#1E2028] font-medium text-[#111111] dark:text-white border-t border-[#E4E4E7] dark:border-[#27272A]"
                  >
                    Account Settings
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuthModal('login')}
                className="px-3 py-1.5 text-xs font-bold text-[#111111] dark:text-white hover:text-[#FF6B00] transition-colors"
              >
                Log in
              </button>
              <button
                onClick={() => openAuthModal('signup')}
                className="px-3.5 py-1.5 text-xs font-black bg-[#111111] dark:bg-white text-white dark:text-[#111111] rounded-xl hover:opacity-90 transition-opacity"
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Location Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[#111111] dark:text-white">Choose Your Location</h3>
              <button onClick={() => setIsLocationModalOpen(false)} className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800">
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>
            <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
              Select your Nigerian state, campus or city, and local neighbourhood area for accurate delivery pricing.
            </p>
            <form onSubmit={e => {
              e.preventDefault();
              setUserLocation({ state: tempState, city: tempCity, area: tempArea });
              setIsLocationModalOpen(false);
              notify(`Location updated to ${tempArea}, ${tempCity} (${tempState})`, 'success');
            }} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-[#111111] dark:text-white block mb-1">State</label>
                <select
                  value={tempState}
                  onChange={e => {
                    const st = e.target.value;
                    setTempState(st);
                    const found = NIGERIAN_STATES.find(s => s.state === st);
                    if (found && found.cities.length > 0) {
                      setTempCity(found.cities[0].city);
                      setTempArea(found.cities[0].areas[0] || '');
                    }
                  }}
                  className="w-full h-10 px-3 bg-[#F4F4F5] dark:bg-[#1E2028] border border-[#E4E4E7] dark:border-[#27272A] rounded-xl text-xs font-medium text-[#111111] dark:text-white"
                >
                  {NIGERIAN_STATES.map(st => (
                    <option key={st.state} value={st.state}>{st.state}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FF6B00] text-[#111111] font-black text-xs rounded-xl shadow-[0_2px_0_#111111]"
                >
                  Save Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
