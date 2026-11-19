import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { NIGERIAN_STATES } from '../data/nigerianLocations';
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
  } = useApp();

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [tempState, setTempState] = useState(userLocation.state || 'Lagos');
  const [tempCity, setTempCity] = useState(userLocation.city || 'Lagos Mainland');
  const [tempArea, setTempArea] = useState(userLocation.area || 'Yaba');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isRefreshingNotifs, setIsRefreshingNotifs] = useState(false);
  const notifContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNotifOpen) return;
    const handleClickOutside = (ev: MouseEvent) => {
      if (notifContainerRef.current && !notifContainerRef.current.contains(ev.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    const handleEsc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setIsNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isNotifOpen]);

  const handleNotificationClick = (item: (typeof dbNotifications)[number]) => {
    if (!item.isRead) {
      void markNotificationRead(item.id);
    }
    setIsNotifOpen(false);
    const link = (item.link || '').trim();
    if (!link) return;

    try {
      const parsed = new URL(link, typeof window !== 'undefined' ? window.location.origin : 'https://shopitng.vercel.app');
      const prodParam = parsed.searchParams.get('product');
      const profParam = parsed.searchParams.get('profile');
      if (prodParam) {
        openProduct(prodParam);
        return;
      }
      if (profParam) {
        openProfile(profParam);
        return;
      }
      if (parsed.pathname.startsWith('/chat')) {
        setActiveView('chat');
      } else if (parsed.pathname.startsWith('/orders')) {
        setActiveView('orders');
      } else if (parsed.pathname.startsWith('/seller')) {
        setActiveView('seller_dashboard');
      } else if (parsed.pathname.startsWith('/settings')) {
        openAccountSettings();
      }
    } catch {
      if (link.includes('chat')) setActiveView('chat');
      else if (link.includes('order')) setActiveView('orders');
    }
  };

  const totalUnreadMessages = conversations.reduce(
    (sum, c) => sum + (c.buyerId === currentUser?.id ? c.unreadBuyer : c.unreadSeller),
    0
  );

  const currentStateObj = NIGERIAN_STATES.find(s => s.state === tempState) || NIGERIAN_STATES[0];
  const currentCityObj = currentStateObj.cities.find(c => c.city === tempCity) || currentStateObj.cities[0];

  const handleStateChange = (stateName: string) => {
    setTempState(stateName);
    const foundState = NIGERIAN_STATES.find(s => s.state === stateName) || NIGERIAN_STATES[0];
    const defaultCity = foundState.cities[0]?.city || '';
    setTempCity(defaultCity);
    const defaultArea = foundState.cities[0]?.areas[0] || '';
    setTempArea(defaultArea);
  };

  const handleCityChange = (cityName: string) => {
    setTempCity(cityName);
    const foundCity = currentStateObj.cities.find(c => c.city === cityName);
    setTempArea(foundCity?.areas[0] || '');
  };

  const handleSaveLocation = (e: React.FormEvent) => {
    e.preventDefault();
    setUserLocation({
      state: tempState,
      city: tempCity,
      area: tempArea,
    });
    setIsLocationModalOpen(false);
    notify(`Location set to ${tempArea}, ${tempCity} (${tempState})! Delivery costs updated.`, 'success');
  };

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-[#0D0E12] border-b border-[#E4E4E7] dark:border-[#27272A] transition-colors duration-200 w-full max-w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        {/* Zone 1: Official Logo + Brand Name */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
          <button
            onClick={() => setActiveView('catalog')}
            className="flex items-center gap-2 sm:gap-2.5 text-left group min-w-0"
          >
            {/* The Official Shop It Logo */}
            <img
              src="/shopit-logo.png"
              alt="Shop It"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl object-contain shadow-xs transition-transform group-hover:scale-105 shrink-0"
            />
            <div className="min-w-0">
              <span className="text-lg sm:text-xl font-black tracking-tight text-[#111111] dark:text-white group-hover:text-[#FF6B00] transition-colors leading-none block">
                Shop It
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#71717A] dark:text-[#A1A1AA] tracking-tight mt-0.5 truncate hidden sm:block">
                Teens & Youth Marketplace
              </span>
            </div>
          </button>

          {/* Location Area Pill (Show only Area publicly) */}
          <button
            onClick={() => setIsLocationModalOpen(true)}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#111111] dark:border-[#27272A] hover:border-[#FF6B00] dark:hover:border-[#FF6B00] bg-white dark:bg-[#15161C] text-xs font-bold text-[#111111] dark:text-white transition-all shadow-xs"
            title="Click to change your Nigerian State > City > Area"
          >
            <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span className="bg-[#9FE870] text-[#111111] px-1.5 py-0.5 rounded text-[11px] font-black">{userLocation.area}</span>
            <span className="text-[#A1A1AA]">·</span>
            <span className="text-[#71717A] dark:text-[#A1A1AA] font-medium">{userLocation.state}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#A1A1AA] ml-0.5" />
          </button>
        </div>

        {/* Zone 2: Navigation Links (Desktop) */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-bold text-[#52525B] dark:text-[#A1A1AA]">
          <button
            onClick={() => setActiveView('catalog')}
            className={`transition-colors hover:text-[#FF6B00] dark:hover:text-[#FF6B00] flex items-center gap-1 ${
              activeView === 'catalog' ? 'text-[#111111] dark:text-white font-black' : ''
            }`}
          >
            <span>Marketplace</span>
            {activeView === 'catalog' && <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />}
          </button>

          <button
            onClick={() => setActiveView('chat')}
            className={`flex items-center gap-1.5 transition-colors hover:text-[#FF6B00] dark:hover:text-[#FF6B00] ${
              activeView === 'chat' ? 'text-[#111111] dark:text-white font-black' : ''
            }`}
          >
            <MessageSquare className="w-4 h-4 text-[#FF6B00]" />
            <span>Chat</span>
            {totalUnreadMessages > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#9FE870]" />
            )}
          </button>

          <button
            onClick={() => setActiveView('orders')}
            className={`flex items-center gap-1.5 transition-colors hover:text-[#FF6B00] dark:hover:text-[#FF6B00] ${
              activeView === 'orders' ? 'text-[#111111] dark:text-white font-black' : ''
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#9FE870] stroke-[2.5]" />
            <span>Track Orders</span>
          </button>

          {/* Sell a Product Menu Link */}
          <button
            onClick={() => {
              if (!currentUser) {
                openAuthModal('seller_register');
              } else {
                openQuickListModal();
              }
            }}
            className="flex items-center gap-1.5 transition-colors hover:text-[#FF6B00] dark:hover:text-[#FF6B00] text-sm font-bold text-[#FF6B00]"
            title="List handmade crafts in 60 seconds"
          >
            <PlusCircle className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>Sell a Product</span>
          </button>
        </nav>

        {/* Zone 3: Actions (Responsive for mobile & desktop) */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Universal Sell Product Button */}
          <button
            onClick={() => {
              if (!currentUser) {
                openAuthModal('seller_register');
              } else {
                openQuickListModal();
              }
            }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] dark:border-stone-800 text-xs sm:text-sm font-black rounded-xl shadow-[0_2.5px_0_#111111] dark:shadow-none transition-all active:translate-y-0.5"
            title="List a craft in 60 seconds"
          >
            <span className="w-4 h-4 rounded-full bg-[#9FE870] text-[#111111] flex items-center justify-center text-xs font-black">
              +
            </span>
            <span>Sell Product</span>
          </button>

          {/* Theme Switcher Toggle Button (Tablet & Desktop, mobile has it in top bar) */}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Night'} Mode`}
            className="hidden sm:flex p-2 text-[#111111] dark:text-[#A1A1AA] hover:text-[#FF6B00] dark:hover:text-[#9FE870] rounded-xl hover:bg-[#FFF4EC] dark:hover:bg-[#1E2028] border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#15161C] transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-[#9FE870]" />
            ) : (
              <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF6B00]" />
            )}
          </button>

          {/* Wishlist */}
          <button
            onClick={() => setActiveView('wishlist')}
            aria-label="Wishlist"
            className="relative p-1.5 sm:p-2 text-[#111111] dark:text-white hover:text-[#FF6B00] rounded-xl hover:bg-[#FFF4EC] dark:hover:bg-[#1E2028] border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#15161C] transition-colors"
          >
            <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-[#111111] dark:text-[#F4F4F5]" />
            {wishlist.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#111111] dark:bg-[#FF6B00] text-[#9FE870] dark:text-[#111111] border border-[#9FE870] text-[10px] font-black flex items-center justify-center">
                {wishlist.length}
              </span>
            )}
          </button>

          {/* Cart */}
          <button
            onClick={() => setActiveView('cart')}
            aria-label="Cart"
            className="relative p-1.5 sm:p-2 text-[#111111] dark:text-white hover:text-[#FF6B00] rounded-xl hover:bg-[#FFF4EC] dark:hover:bg-[#1E2028] border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#15161C] transition-colors"
          >
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-[#111111] dark:text-[#F4F4F5]" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF6B00] text-[#111111] border border-[#111111] dark:border-[#27272A] text-[10px] font-black flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          {/* User Profile Pill, Notifications, Settings, & Role Button */}
          {currentUser ? (
            <div className="flex items-center gap-1.5">
              {/* Live Notifications Bell */}
              <div ref={notifContainerRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    const next = !isNotifOpen;
                    setIsNotifOpen(next);
                    if (next) void refreshNotifications();
                  }}
                  aria-label="Notifications"
                  title="Notifications"
                  className="relative p-1.5 sm:p-2 text-[#111111] dark:text-[#A1A1AA] hover:text-[#FF6B00] rounded-xl hover:bg-[#FFF4EC] dark:hover:bg-[#1E2028] border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#15161C] transition-colors"
                >
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#FF6B00] text-[#111111] border border-[#111111] dark:border-[#27272A] text-[10px] font-black flex items-center justify-center font-mono-numbers">
                      {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                    </span>
                  )}
                </button>

                {isNotifOpen && (
                  <div className="fixed sm:absolute right-3 sm:right-0 top-15 sm:top-full sm:mt-2 w-[calc(100vw-1.5rem)] sm:w-96 max-h-[75vh] bg-white dark:bg-[#15161C] border-2 border-[#111111] dark:border-[#27272A] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between gap-2 bg-[#FAFAFA] dark:bg-[#0D0E12]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#111111] dark:text-white">
                          Notifications
                        </span>
                        {unreadNotificationsCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-[#9FE870] text-[#111111] text-[10px] font-black font-mono-numbers">
                            {unreadNotificationsCount} unread
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setIsRefreshingNotifs(true);
                            await refreshNotifications();
                            setIsRefreshingNotifs(false);
                          }}
                          title="Refresh notifications"
                          className="p-1 rounded-lg text-[#71717A] hover:text-[#111111] dark:hover:text-white"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingNotifs ? 'animate-spin text-[#FF6B00]' : ''}`} />
                        </button>
                        {unreadNotificationsCount > 0 && (
                          <button
                            type="button"
                            onClick={() => void markAllNotificationsRead()}
                            className="text-[11px] font-bold text-[#FF6B00] hover:underline flex items-center gap-1 whitespace-nowrap"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Mark all read</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-y-auto divide-y divide-[#F4F4F5] dark:divide-[#27272A] max-h-[55vh]">
                      {dbNotifications.length === 0 ? (
                        <div className="p-8 text-center text-xs text-[#71717A] dark:text-[#A1A1AA] space-y-1.5">
                          <Bell className="w-7 h-7 mx-auto text-[#D4D4D8] dark:text-[#3F3F46]" />
                          <p className="font-bold text-[#111111] dark:text-white">All caught up</p>
                          <p className="text-[11px]">No notifications yet. Activity from followers, orders, and chat appears here.</p>
                        </div>
                      ) : (
                        dbNotifications.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleNotificationClick(item)}
                            className={`w-full text-left px-4 py-3 hover:bg-[#FAFAFA] dark:hover:bg-[#1E2028] transition-colors flex items-start gap-2.5 ${
                              item.isRead ? 'opacity-75' : 'bg-[#FFF4EC]/40 dark:bg-[#1E2028]/70'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                item.isRead ? 'bg-transparent' : 'bg-[#FF6B00]'
                              }`}
                            />
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-black text-[#111111] dark:text-white truncate">
                                  {item.title}
                                </span>
                                <span className="text-[10px] text-[#71717A] dark:text-[#A1A1AA] shrink-0">
                                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#52525B] dark:text-[#D4D4D8] leading-snug line-clamp-2">
                                {item.message}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => openProfile(currentUser.profileSlug || currentUser.id)}
                title="View My Profile"
                className="flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#15161C] hover:border-[#FF6B00] transition-colors"
              >
                <span className="w-6 h-6 rounded-full overflow-hidden border border-[#FF6B00] bg-[#FFF4EC] dark:bg-[#1E2028] text-[#FF6B00] text-[10px] font-black flex items-center justify-center shrink-0">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.displayName || currentUser.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{(currentUser.displayName || currentUser.name || 'M')[0]?.toUpperCase()}</span>
                  )}
                </span>
                <span className="hidden md:inline text-xs font-bold text-[#111111] dark:text-white max-w-[90px] truncate">
                  {currentUser.displayName || currentUser.name?.split(/\s+/)[0] || 'Profile'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => openAccountSettings()}
                aria-label="Account Settings"
                title="Account Settings"
                className="p-1.5 sm:p-2 text-[#111111] dark:text-[#A1A1AA] hover:text-[#FF6B00] rounded-xl hover:bg-[#FFF4EC] dark:hover:bg-[#1E2028] border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#15161C] transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>

              {currentUser.role === 'admin' ? (
                <button
                  onClick={() => setActiveView('admin')}
                  className="px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-black text-[#9FE870] bg-[#111111] border-2 border-[#FF6B00] hover:bg-[#18181B] rounded-xl transition-colors shadow-xs flex items-center gap-1"
                >
                  <Shield className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span className="hidden xs:inline">Mod</span>
                </button>
              ) : currentUser.role === 'seller' ? (
                <button
                  onClick={() => setActiveView('seller_dashboard')}
                  className="px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-black text-[#111111] bg-[#9FE870] border-2 border-[#111111] dark:border-stone-800 rounded-xl hover:bg-[#AEF083] transition-colors flex items-center gap-1 shadow-[0_2px_0_#111111] dark:shadow-none"
                >
                  <Store className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span className="hidden sm:inline">Dashboard</span>
                </button>
              ) : (
                <button
                  onClick={() => openAuthModal('seller_register')}
                  className="px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-black text-[#111111] bg-[#9FE870] hover:bg-[#AEF083] border-2 border-[#111111] dark:border-stone-800 shadow-[0_2px_0_#111111] dark:shadow-none rounded-xl transition-all hidden sm:block"
                >
                  Open Shop
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                title="Log in to view your profile"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#52525B] dark:text-[#A1A1AA] hover:text-[#FF6B00] bg-[#FAFAFA] dark:bg-[#1E2028] border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF6B00] rounded-xl transition-colors"
              >
                <span>Log in to view your profile</span>
              </button>
              <button
                onClick={() => openAuthModal('login')}
                className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold text-[#111111] dark:text-white bg-white dark:bg-[#15161C] border-2 border-[#111111] dark:border-[#27272A] hover:border-[#FF6B00] dark:hover:border-[#FF6B00] hover:bg-[#FFF4EC] dark:hover:bg-[#1E2028] rounded-xl transition-all shadow-xs shrink-0"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Location Picker Modal (State > City > Area) */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-backdrop">
          <div className="bg-white dark:bg-[#15161C] rounded-2xl max-w-md w-full p-5 shadow-2xl border border-neutral-200 dark:border-[#27272A] space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-[#27272A] pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#FF6B00]" />
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">Choose Your Location</h3>
              </div>
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 dark:text-[#A1A1AA] leading-relaxed">
              Pick your Nigerian State, City, and Area. Only your <strong>Area</strong> will be shown publicly to sellers and buyers for safe delivery.
            </p>

            <form onSubmit={handleSaveLocation} className="space-y-3.5">
              {/* Step 1: State */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  1. Nigerian State
                </label>
                <select
                  value={tempState}
                  onChange={e => handleStateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E4E4E7] dark:border-[#27272A] dark:bg-[#1E2028] dark:text-white rounded-xl text-xs font-semibold focus:border-[#FF6B00] focus:outline-none"
                >
                  {NIGERIAN_STATES.map(s => (
                    <option key={s.state} value={s.state} className="dark:bg-[#1E2028] dark:text-white">
                      {s.state} State
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: City */}
              <div>
                <label className="block text-xs font-bold text-[#111111] dark:text-neutral-300 mb-1">
                  2. City / Major District
                </label>
                <select
                  value={tempCity}
                  onChange={e => handleCityChange(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E4E4E7] dark:border-[#27272A] dark:bg-[#1E2028] dark:text-white rounded-xl text-xs font-semibold focus:border-[#FF6B00] focus:outline-none"
                >
                  {currentStateObj.cities.map(c => (
                    <option key={c.city} value={c.city} className="dark:bg-[#1E2028] dark:text-white">
                      {c.city}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 3: Area */}
              <div>
                <label className="block text-xs font-bold text-[#111111] dark:text-neutral-300 mb-1">
                  3. Local Area (Publicly Shown)
                </label>
                <select
                  value={tempArea}
                  onChange={e => setTempArea(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E4E4E7] dark:border-[#27272A] dark:bg-[#1E2028] rounded-xl text-xs font-bold text-[#FF6B00] focus:border-[#FF6B00] focus:outline-none"
                >
                  {currentCityObj?.areas.map(a => (
                    <option key={a} value={a} className="dark:bg-[#1E2028] dark:text-white">
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-[#71717A] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white border border-[#E4E4E7] dark:border-[#27272A] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#FF6B00] hover:bg-[#E55E00] rounded-xl transition-all shadow-xs"
                >
                  Set My Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
