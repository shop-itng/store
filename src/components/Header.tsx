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
  Menu,
  Package,
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
    searchQuery,
    setSearchQuery,
    setSelectedCategory,
  } = useApp();

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [tempState, setTempState] = useState(userLocation.state || 'Lagos');
  const [tempCity, setTempCity] = useState(userLocation.city || 'Lagos Mainland');
  const [tempArea, setTempArea] = useState(userLocation.area || 'Yaba');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [selectedSearchCat, setSelectedSearchCat] = useState('All');
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
    <header className="sticky top-0 z-40 w-full transition-all duration-200 shadow-md">
      {/* Top Amazon-Style Navigation Row (#131921) */}
      <div className="bg-[#131921] text-white px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 min-h-[60px]">
        
        {/* 1. Brand Logo */}
        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={() => setActiveView('catalog')}
            className="flex items-center gap-2 group text-left active:scale-95 transition-transform"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FF6B00] text-[#111111] font-black flex items-center justify-center text-base shadow-sm">
              SI
            </div>
            <div>
              <span className="text-lg sm:text-xl font-black tracking-tight text-white group-hover:text-[#FF6B00] transition-colors leading-none block">
                {BRAND_CONFIG.brandName}
              </span>
              <span className="text-[10px] text-stone-400 font-semibold block mt-0.5">
                Youth Marketplace
              </span>
            </div>
          </button>

          {/* Deliver to Location Picker */}
          <button
            onClick={() => setIsLocationModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:border hover:border-white/40 text-xs text-stone-300 transition-all"
          >
            <MapPin className="w-4 h-4 text-[#FF6B00]" />
            <div className="text-left leading-tight">
              <span className="text-[10px] text-stone-400 block">Deliver to</span>
              <span className="font-bold text-white truncate max-w-[120px] block">{userLocation.area}, {userLocation.state}</span>
            </div>
          </button>
        </div>

        {/* 2. Massive Search Bar (Amazon Style) */}
        <div className="flex-1 max-w-2xl mx-2 sm:mx-4">
          <div className="flex items-center h-10 sm:h-11 rounded-xl overflow-hidden border-2 border-transparent focus-within:border-[#FF6B00] transition-all bg-white">
            <select
              value={selectedSearchCat}
              onChange={e => setSelectedSearchCat(e.target.value)}
              className="hidden md:block h-full px-3 bg-stone-100 text-stone-800 text-xs font-semibold border-r border-stone-200 focus:outline-none cursor-pointer"
            >
              <option value="All">All Departments</option>
              <option value="beads">Waist Beads</option>
              <option value="fragrance">Perfume Oils</option>
              <option value="bags">Crochet Bags</option>
              <option value="fashion">Fashion</option>
              <option value="decor">Room Decor</option>
            </select>
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                if (activeView !== 'catalog') setActiveView('catalog');
              }}
              placeholder="Search handcrafted campus products, fashion, thrift..."
              className="flex-1 h-full px-4 text-xs sm:text-sm text-stone-900 placeholder-stone-500 focus:outline-none"
            />
            <button
              onClick={() => {
                if (activeView !== 'catalog') setActiveView('catalog');
              }}
              className="h-full px-4 sm:px-6 bg-[#FEBD69] hover:bg-[#F3A847] text-stone-900 flex items-center justify-center transition-colors font-bold"
            >
              <Search className="w-4 h-4 text-stone-900" />
            </button>
          </div>
        </div>

        {/* 3. Right Utilities: Account, Orders, Cart */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          
          {/* Sell Button */}
          <button
            onClick={() => {
              if (!currentUser) openAuthModal('seller_register');
              else openQuickListModal();
            }}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] font-black text-xs rounded-xl shadow-xs transition-transform active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Start Selling</span>
          </button>

          {/* Account / Lists Dropdown */}
          {currentUser ? (
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex flex-col text-left px-2 py-1 rounded hover:border hover:border-white/40 transition-all"
              >
                <span className="text-[10px] text-stone-400">Hello, {currentUser.name?.split(' ')[0]}</span>
                <span className="text-xs font-bold text-white flex items-center gap-1">
                  Account &amp; Lists <ChevronDown className="w-3 h-3" />
                </span>
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl shadow-xl py-2 z-50 text-xs text-stone-900 dark:text-white">
                  <div className="px-4 py-2 border-b border-[#E4E4E7] dark:border-[#27272A]">
                    <p className="font-bold truncate">{currentUser.name}</p>
                    <p className="text-[10px] text-stone-500 truncate">@{currentUser.profileSlug || currentUser.id}</p>
                  </div>
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); openProfile(currentUser.profileSlug || currentUser.id); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-stone-100 dark:hover:bg-stone-800 font-medium"
                  >
                    My Profile
                  </button>
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); setActiveView('orders'); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-stone-100 dark:hover:bg-stone-800 font-medium"
                  >
                    Your Orders
                  </button>
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); setActiveView('wishlist'); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-stone-100 dark:hover:bg-stone-800 font-medium"
                  >
                    Saved Items
                  </button>
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); openAccountSettings(); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-stone-100 dark:hover:bg-stone-800 font-medium border-t border-stone-200 dark:border-stone-800"
                  >
                    Account Settings
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('login')}
              className="flex flex-col text-left px-2 py-1 rounded hover:border hover:border-white/40 transition-all"
            >
              <span className="text-[10px] text-stone-400">Hello, sign in</span>
              <span className="text-xs font-bold text-white flex items-center gap-1">
                Account &amp; Lists <ChevronDown className="w-3 h-3" />
              </span>
            </button>
          )}

          {/* Returns & Orders */}
          <button
            onClick={() => setActiveView('orders')}
            className="hidden sm:flex flex-col text-left px-2 py-1 rounded hover:border hover:border-white/40 transition-all"
          >
            <span className="text-[10px] text-stone-400">Returns</span>
            <span className="text-xs font-bold text-white">&amp; Orders</span>
          </button>

          {/* Cart Icon */}
          <button
            onClick={() => setActiveView('cart')}
            className="relative flex items-center gap-1 px-2.5 py-1.5 rounded hover:border hover:border-white/40 transition-all font-bold text-white"
            title="Cart"
          >
            <div className="relative">
              <ShoppingBag className="w-6 h-6 text-[#FF6B00]" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-[#FF6B00] text-stone-900 text-[10px] font-black flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </div>
            <span className="hidden lg:inline text-xs mt-1">Cart</span>
          </button>
        </div>
      </div>

      {/* Second Row: Department / Category Navigation Bar (#232F3E) */}
      <div className="bg-[#232F3E] text-stone-200 px-3 sm:px-6 py-2 flex items-center gap-4 overflow-x-auto text-xs font-semibold whitespace-nowrap scrollbar-none">
        <button
          onClick={() => { setSelectedCategory('All' as any); setActiveView('catalog'); }}
          className="flex items-center gap-1.5 px-2 py-1 hover:text-white hover:bg-white/10 rounded transition-colors font-bold text-white"
        >
          <Menu className="w-4 h-4 text-[#FF6B00]" />
          <span>All Departments</span>
        </button>
        <span className="text-stone-600">|</span>
        {[
          { label: 'Waist Beads', cat: 'beads' },
          { label: 'Perfume Oils', cat: 'fragrance' },
          { label: 'Crochet Bags', cat: 'bags' },
          { label: 'Fashion & Wearables', cat: 'fashion' },
          { label: 'Room Decor', cat: 'decor' },
          { label: 'Art & Crafts', cat: 'crafts' },
          { label: 'Campus Tech', cat: 'tech' },
        ].map(item => (
          <button
            key={item.cat}
            onClick={() => {
              setSelectedCategory(item.cat as any);
              setActiveView('catalog');
            }}
            className="px-2.5 py-1 hover:text-[#FF6B00] hover:bg-white/10 rounded transition-colors"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Location Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-modal-enter">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[#111111] dark:text-white">Choose Your Delivery Location</h3>
              <button onClick={() => setIsLocationModalOpen(false)} className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800">
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>
            <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
              Select your Nigerian state, city or campus, and local neighbourhood area for accurate delivery pricing.
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
