import React, { useState } from 'react';
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
    userLocation,
    setUserLocation,
    notify,
    theme,
    toggleTheme,
  } = useApp();

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [tempState, setTempState] = useState(userLocation.state || 'Lagos');
  const [tempCity, setTempCity] = useState(userLocation.city || 'Lagos Mainland');
  const [tempArea, setTempArea] = useState(userLocation.area || 'Yaba');

  const totalUnreadMessages = conversations.reduce(
    (sum, c) => sum + (currentUser?.role === 'seller' ? c.unreadSeller : c.unreadBuyer),
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
    <header className="sticky top-0 z-40 bg-white dark:bg-[#0D0E12] border-b border-[#E4E4E7] dark:border-[#27272A] transition-colors duration-200 w-full max-w-full overflow-hidden">
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
        </nav>

        {/* Zone 3: Actions (Responsive for mobile & desktop) */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Quick List Button (Only for registered sellers) or Buy Items Button for Shoppers (Tablet & Desktop) */}
          {currentUser?.role === 'seller' ? (
            <button
              onClick={openQuickListModal}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] dark:border-stone-800 text-xs sm:text-sm font-black rounded-xl shadow-[0_2.5px_0_#111111] dark:shadow-none transition-all active:translate-y-0.5"
              title="List an item in 60 seconds"
            >
              <span className="w-4 h-4 rounded-full bg-[#9FE870] text-[#111111] flex items-center justify-center text-xs font-black">
                +
              </span>
              <span>Sell Product</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setActiveView('catalog');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] border-2 border-[#111111] dark:border-stone-800 text-xs sm:text-sm font-black rounded-xl shadow-[0_2.5px_0_#111111] dark:shadow-none transition-all active:translate-y-0.5"
              title="Browse and buy crafts"
            >
              <ShoppingBag className="w-4 h-4 text-[#111111]" />
              <span>Buy Items</span>
            </button>
          )}

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

          {/* User Button */}
          {currentUser ? (
            currentUser.role === 'admin' ? (
              <button
                onClick={() => setActiveView('admin')}
                className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-black text-[#9FE870] bg-[#111111] border-2 border-[#FF6B00] hover:bg-[#18181B] rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-[#9FE870] animate-pulse" />
                <span className="hidden xs:inline">Moderator</span>
                <span className="xs:hidden">Admin</span>
              </button>
            ) : currentUser.role === 'seller' ? (
              <button
                onClick={() => setActiveView('seller_dashboard')}
                className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-black text-[#111111] bg-[#9FE870] border-2 border-[#111111] dark:border-stone-800 rounded-xl hover:bg-[#AEF083] transition-colors flex items-center gap-1.5 shadow-[0_2px_0_#111111] dark:shadow-none"
              >
                <Store className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span className="hidden sm:inline">My Shop</span>
              </button>
            ) : (
              <button
                onClick={() => openAuthModal('seller_register')}
                className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-black text-[#111111] bg-[#9FE870] hover:bg-[#AEF083] border-2 border-[#111111] dark:border-stone-800 shadow-[0_2px_0_#111111] dark:shadow-none rounded-xl transition-all hidden sm:block"
              >
                Open Shop
              </button>
            )
          ) : (
            <button
              onClick={() => openAuthModal('login')}
              className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold text-[#111111] dark:text-white bg-white dark:bg-[#15161C] border-2 border-[#111111] dark:border-[#27272A] hover:border-[#FF6B00] dark:hover:border-[#FF6B00] hover:bg-[#FFF4EC] dark:hover:bg-[#1E2028] rounded-xl transition-all shadow-xs shrink-0"
            >
              Sign In
            </button>
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
