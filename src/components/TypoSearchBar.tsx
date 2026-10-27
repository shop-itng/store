import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { NIGERIAN_STATES } from '../data/nigerianLocations';
import { ProductCategory } from '../types';
import { Search, MapPin, SlidersHorizontal, X, Clock } from 'lucide-react';

const CATEGORIES: { id: ProductCategory; label: string }[] = [
  { id: 'all', label: 'All Items' },
  { id: 'beads', label: 'Waist Beads & Jewelry' },
  { id: 'fragrance', label: 'Perfume Oils & Scents' },
  { id: 'bags', label: 'Crochet & Tote Bags' },
  { id: 'fashion', label: 'Fashion & Wear' },
  { id: 'decor', label: 'Art & Room Decor' },
];

export const TypoSearchBar: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedState,
    setSelectedState,
    selectedCity,
    setSelectedCity,
    selectedArea,
    setSelectedArea,
    priceFilter,
    setPriceFilter,
    sortBy,
    setSortBy,
    resetFilters,
  } = useApp();

  const [showFilters, setShowFilters] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Recent Searches state: Stores the last 5 searches in localStorage
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('shopit_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addRecentSearch = (term: string) => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;

    setRecentSearches(prev => {
      const filtered = prev.filter(t => t.toLowerCase() !== clean.toLowerCase());
      const updated = [clean, ...filtered].slice(0, 5);
      try {
        localStorage.setItem('shopit_recent_searches', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save recent search', err);
      }
      return updated;
    });
  };

  const removeRecentSearch = (termToRemove: string) => {
    setRecentSearches(prev => {
      const updated = prev.filter(t => t.toLowerCase() !== termToRemove.toLowerCase());
      try {
        localStorage.setItem('shopit_recent_searches', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to update recent searches', err);
      }
      return updated;
    });
  };

  const clearAllRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('shopit_recent_searches');
    } catch (err) {
      console.error('Failed to clear recent searches', err);
    }
  };

  const handleSelectRecent = (term: string) => {
    setSearchQuery(term);
    addRecentSearch(term);
    setIsSearchFocused(false);
  };

  // Cascading dropdown options
  const activeStateObj = NIGERIAN_STATES.find(s => s.state === selectedState);
  const citiesList = activeStateObj ? activeStateObj.cities : [];
  const activeCityObj = citiesList.find(c => c.city === selectedCity);
  const areasList = activeCityObj ? activeCityObj.areas : [];

  const handleStateChange = (stateName: string) => {
    setSelectedState(stateName);
    setSelectedCity('all');
    setSelectedArea('all');
  };

  const handleCityChange = (cityName: string) => {
    setSelectedCity(cityName);
    setSelectedArea('all');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'all' ||
    selectedState !== 'all' ||
    selectedCity !== 'all' ||
    selectedArea !== 'all' ||
    priceFilter !== 'all' ||
    sortBy !== 'newest';

  return (
    <div className="space-y-3.5">
      {/* Search Input & Location Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3">
        {/* Search input with Recent Searches Dropdown */}
        <div className="relative sm:col-span-7">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A1A1AA] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => {
              // Delay blur slightly so clicks on recent search items register
              setTimeout(() => setIsSearchFocused(false), 200);
              if (searchQuery.trim().length >= 2) {
                addRecentSearch(searchQuery);
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (searchQuery.trim().length >= 2) {
                  addRecentSearch(searchQuery);
                }
                setIsSearchFocused(false);
                (e.target as HTMLElement).blur();
              }
            }}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search waist beads, perfume oils, crochet tote bags, fashion in your area..."
            className="w-full h-11 pl-10 pr-9 rounded-xl bg-white dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] text-xs sm:text-sm text-[#111111] dark:text-white placeholder:text-[#A1A1AA] focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Recent Searches Floating Dropdown (Last 5 searches) */}
          {isSearchFocused && recentSearches.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-white dark:bg-[#15161C] border-2 border-[#111111] dark:border-[#27272A] rounded-2xl shadow-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs pb-1.5 border-b border-[#E4E4E7] dark:border-[#27272A]">
                <div className="flex items-center gap-1.5 font-black text-[#111111] dark:text-white">
                  <Clock className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>Recent Searches</span>
                </div>
                <button
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    clearAllRecentSearches();
                  }}
                  className="text-[11px] font-bold text-[#71717A] dark:text-[#A1A1AA] hover:text-[#FF6B00] transition-colors"
                >
                  Clear all
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {recentSearches.map(term => (
                  <div
                    key={term}
                    onMouseDown={e => {
                      e.preventDefault();
                      handleSelectRecent(term);
                    }}
                    className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F4F4F5] dark:bg-[#1E2028] hover:bg-[#111111] dark:hover:bg-[#27272A] hover:text-[#9FE870] rounded-xl text-xs font-bold text-[#111111] dark:text-white transition-all cursor-pointer border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#111111]"
                  >
                    <Clock className="w-3 h-3 text-[#71717A] dark:text-[#A1A1AA] group-hover:text-[#9FE870]" />
                    <span>{term}</span>
                    <button
                      type="button"
                      onMouseDown={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeRecentSearch(term);
                      }}
                      className="text-[#A1A1AA] hover:text-red-500 ml-1 p-0.5 rounded-full hover:bg-black/10 group-hover:hover:bg-white/20"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* State Dropdown */}
        <div className="sm:col-span-3">
          <div className="relative">
            <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#FF6B00] pointer-events-none" />
            <select
              value={selectedState}
              onChange={e => handleStateChange(e.target.value)}
              className="w-full h-11 pl-9 pr-6 rounded-xl bg-white dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] text-xs sm:text-sm font-semibold text-[#111111] dark:text-white focus:outline-none focus:border-[#FF6B00] cursor-pointer"
            >
              <option value="all" className="dark:bg-[#15161C] dark:text-white">All States (Nigeria)</option>
              {NIGERIAN_STATES.map(s => (
                <option key={s.state} value={s.state} className="dark:bg-[#15161C] dark:text-white">
                  {s.state} State
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="sm:col-span-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`w-full h-11 px-3.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all shadow-xs ${
              showFilters || selectedCity !== 'all' || selectedArea !== 'all' || priceFilter !== 'all' || sortBy !== 'newest'
                ? 'bg-[#111111] dark:bg-stone-800 text-white border-[#111111] dark:border-stone-700'
                : 'bg-white dark:bg-[#15161C] text-[#111111] dark:text-white border-[#E4E4E7] dark:border-[#27272A] hover:border-[#111111] dark:hover:border-stone-600'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-[#FF6B00]" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Expanded City > Area & Price/Sort Filter Drawer */}
      {showFilters && (
        <div className="p-4 bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] space-y-4 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* City Dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-[#111111] dark:text-white uppercase tracking-wider mb-1">
                City / District
              </label>
              <select
                disabled={selectedState === 'all'}
                value={selectedCity}
                onChange={e => handleCityChange(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-xs font-semibold text-[#111111] dark:text-white focus:outline-none focus:border-[#FF6B00] disabled:bg-[#F4F4F5] dark:disabled:bg-[#15161C] disabled:text-[#A1A1AA]"
              >
                <option value="all">
                  {selectedState === 'all' ? 'Select State first' : 'All Cities'}
                </option>
                {citiesList.map(c => (
                  <option key={c.city} value={c.city}>
                    {c.city}
                  </option>
                ))}
              </select>
            </div>

            {/* Area Dropdown (Public Area Filter) */}
            <div>
              <label className="block text-[11px] font-bold text-[#111111] dark:text-white uppercase tracking-wider mb-1">
                Area (Local Delivery)
              </label>
              <select
                disabled={selectedCity === 'all'}
                value={selectedArea}
                onChange={e => setSelectedArea(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-xs font-bold text-[#FF6B00] focus:outline-none focus:border-[#FF6B00] disabled:bg-[#F4F4F5] dark:disabled:bg-[#15161C] disabled:text-[#A1A1AA]"
              >
                <option value="all">
                  {selectedCity === 'all' ? 'Select City first' : 'All Areas'}
                </option>
                {areasList.map(a => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Filter */}
            <div>
              <label className="block text-[11px] font-bold text-[#111111] dark:text-white uppercase tracking-wider mb-1">
                Price Range
              </label>
              <select
                value={priceFilter}
                onChange={e => setPriceFilter(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-xs font-semibold text-[#111111] dark:text-white focus:outline-none focus:border-[#FF6B00]"
              >
                <option value="all">All Prices</option>
                <option value="under2k">Under ₦2,000</option>
                <option value="2k-5k">₦2,000 – ₦5,000</option>
                <option value="5k-10k">₦5,000 – ₦10,000</option>
                <option value="above10k">Above ₦10,000</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-[11px] font-bold text-[#111111] dark:text-white uppercase tracking-wider mb-1">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-xs font-semibold text-[#111111] dark:text-white focus:outline-none focus:border-[#FF6B00]"
              >
                <option value="newest">Newest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="top_rated">Top Rated</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Quick Recent Searches Chips Row (Last 5 searches in localStorage) */}
      {recentSearches.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
          <span className="text-[11px] font-bold text-[#71717A] dark:text-[#A1A1AA] flex items-center gap-1 shrink-0 mr-1">
            <Clock className="w-3 h-3 text-[#FF6B00]" />
            <span>Recent:</span>
          </span>
          {recentSearches.map(term => (
            <div
              key={term}
              onClick={() => handleSelectRecent(term)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-[#15161C] hover:bg-[#111111] dark:hover:bg-[#27272A] hover:text-[#9FE870] border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#111111] rounded-lg text-[11px] font-bold text-[#3F3F46] dark:text-[#F4F4F5] transition-all cursor-pointer shrink-0 shadow-2xs group"
            >
              <span>{term}</span>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  removeRecentSearch(term);
                }}
                className="text-[#A1A1AA] hover:text-red-500 ml-1 p-0.5 rounded-full"
                title="Remove"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          <button
            onClick={clearAllRecentSearches}
            className="text-[10px] text-[#A1A1AA] hover:text-[#FF6B00] font-bold shrink-0 ml-1 underline cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* Category Pills with Mixture of Green, Orange, and Black */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        {CATEGORIES.map(cat => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`h-9 px-3.5 rounded-xl whitespace-nowrap shrink-0 font-black transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#111111] text-[#9FE870] border-2 border-[#FF6B00] shadow-[0_2px_0_#111111] dark:shadow-none'
                  : 'bg-white dark:bg-[#15161C] text-[#111111] dark:text-white border-2 border-[#E4E4E7] dark:border-[#27272A] hover:border-[#111111] dark:hover:border-stone-600'
              }`}
            >
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active filters summary */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between text-xs text-[#71717A] dark:text-[#A1A1AA] pt-1 px-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">Filtering:</span>
            {selectedState !== 'all' && (
              <span className="font-bold text-[#111111] dark:text-white">State: {selectedState}</span>
            )}
            {selectedCity !== 'all' && (
              <span className="font-bold text-[#111111] dark:text-white">· City: {selectedCity}</span>
            )}
            {selectedArea !== 'all' && (
              <span className="font-black text-[#FF6B00]">· Area: 📍 {selectedArea}</span>
            )}
            {selectedCategory !== 'all' && (
              <span className="font-bold text-[#111111] dark:text-white">
                · {CATEGORIES.find(c => c.id === selectedCategory)?.label}
              </span>
            )}
          </div>
          <button
            onClick={resetFilters}
            className="text-xs text-[#FF6B00] hover:underline font-bold"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
