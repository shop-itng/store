import React from 'react';
import { useApp } from '../context/AppContext';
import { NIGERIAN_STATES } from '../data/nigerianLocations';
import { ProductCategory } from '../types';
import { Search, MapPin, SlidersHorizontal, X } from 'lucide-react';

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

  const [showFilters, setShowFilters] = React.useState(false);

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
        {/* Search input */}
        <div className="relative sm:col-span-7">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A1A1AA] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search waist beads, perfume oils, crochet tote bags, fashion in your area..."
            className="w-full h-11 pl-10 pr-9 rounded-xl bg-white border border-[#E4E4E7] text-xs sm:text-sm text-[#111111] placeholder:text-[#A1A1AA] focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#111111] p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* State Dropdown */}
        <div className="sm:col-span-3">
          <div className="relative">
            <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#FF6B00] pointer-events-none" />
            <select
              value={selectedState}
              onChange={e => handleStateChange(e.target.value)}
              className="w-full h-11 pl-9 pr-6 rounded-xl bg-white border border-[#E4E4E7] text-xs sm:text-sm font-semibold text-[#111111] focus:outline-none focus:border-[#FF6B00] cursor-pointer"
            >
              <option value="all">All States (Nigeria)</option>
              {NIGERIAN_STATES.map(s => (
                <option key={s.state} value={s.state}>
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
                ? 'bg-[#111111] text-white border-[#111111]'
                : 'bg-white text-[#111111] border-[#E4E4E7] hover:border-[#111111]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-[#FF6B00]" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Expanded City > Area & Price/Sort Filter Drawer */}
      {showFilters && (
        <div className="p-4 bg-white rounded-2xl border border-[#E4E4E7] space-y-4 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* City Dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-[#111111] uppercase tracking-wider mb-1">
                City / District
              </label>
              <select
                disabled={selectedState === 'all'}
                value={selectedCity}
                onChange={e => handleCityChange(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E4E4E7] bg-white text-xs font-semibold text-[#111111] focus:outline-none focus:border-[#FF6B00] disabled:bg-[#F4F4F5] disabled:text-[#A1A1AA]"
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
              <label className="block text-[11px] font-bold text-[#111111] uppercase tracking-wider mb-1">
                Area (Local Delivery)
              </label>
              <select
                disabled={selectedCity === 'all'}
                value={selectedArea}
                onChange={e => setSelectedArea(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E4E4E7] bg-white text-xs font-bold text-[#FF6B00] focus:outline-none focus:border-[#FF6B00] disabled:bg-[#F4F4F5] disabled:text-[#A1A1AA]"
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
              <label className="block text-[11px] font-bold text-[#111111] uppercase tracking-wider mb-1">
                Price Range
              </label>
              <select
                value={priceFilter}
                onChange={e => setPriceFilter(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl border border-[#E4E4E7] bg-white text-xs font-semibold text-[#111111] focus:outline-none focus:border-[#FF6B00]"
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
              <label className="block text-[11px] font-bold text-[#111111] uppercase tracking-wider mb-1">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl border border-[#E4E4E7] bg-white text-xs font-semibold text-[#111111] focus:outline-none focus:border-[#FF6B00]"
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
                  ? 'bg-[#111111] text-[#9FE870] border-2 border-[#FF6B00] shadow-[0_2px_0_#111111]'
                  : 'bg-white text-[#111111] border-2 border-[#E4E4E7] hover:border-[#111111]'
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
        <div className="flex items-center justify-between text-xs text-[#71717A] pt-1 px-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">Filtering:</span>
            {selectedState !== 'all' && (
              <span className="font-bold text-[#111111]">State: {selectedState}</span>
            )}
            {selectedCity !== 'all' && (
              <span className="font-bold text-[#111111]">· City: {selectedCity}</span>
            )}
            {selectedArea !== 'all' && (
              <span className="font-black text-[#FF6B00]">· Area: 📍 {selectedArea}</span>
            )}
            {selectedCategory !== 'all' && (
              <span className="font-bold text-[#111111]">
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
