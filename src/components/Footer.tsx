import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { NIGERIAN_STATES } from '../data/nigerianLocations';
import {
  ShieldCheck,
  MapPin,
  Lock,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const Footer: React.FC = () => {
  const { setSelectedState, setSelectedCategory, setActiveView, openAuthModal, currentUser } = useApp();
  const [showAllStates, setShowAllStates] = useState(false);

  // Group Nigerian states by zones
  const zones = Array.from(new Set(NIGERIAN_STATES.map(s => s.zone || 'Other')));

  const handleStateClick = (stateName: string) => {
    setSelectedState(stateName);
    setActiveView('catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-white dark:bg-[#0D0E12] border-t border-[#E4E4E7] dark:border-[#27272A] mt-16 pt-12 pb-28 md:pb-14 text-xs text-[#52525B] dark:text-[#A1A1AA] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
        {/* Main Footer Links & Info */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Col 1: Brand & Logo */}
          <div className="md:col-span-4 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <img
                src="/shopit-logo.png"
                alt="Shop It"
                className="w-9 h-9 rounded-xl object-contain shadow-xs"
              />
              <div>
                <span className="text-xl font-black text-[#111111] dark:text-white tracking-tight block leading-none">
                  Shop It
                </span>
                <span className="text-[11px] font-semibold text-[#71717A] dark:text-[#A1A1AA] block mt-0.5">
                  Nigerian Teens & Youth Marketplace
                </span>
              </div>
            </div>

            <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed max-w-sm">
              The dedicated safe marketplace built for Nigerian teens and youth to buy and sell handmade beads, fashion, fragrance oils, crochet wear, and crafts with full escrow protection.
            </p>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FAFAFA] dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] text-[11px] text-[#111111] dark:text-white font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#9FE870] border border-[#111111]" />
              <span>Direct Peer-to-Peer Youth Commerce</span>
            </div>
          </div>

          {/* Col 2: Categories */}
          <div className="md:col-span-3 space-y-3">
            <span className="font-bold text-[#111111] dark:text-white uppercase tracking-wider text-[11px] block">
              Popular Categories
            </span>
            <ul className="space-y-2 text-[#52525B] dark:text-[#A1A1AA]">
              {[
                { label: 'Waist Beads & Jewelry', cat: 'beads' },
                { label: 'Perfume Oils & Scent Mists', cat: 'fragrance' },
                { label: 'Crochet Bags & Totes', cat: 'bags' },
                { label: 'Fashion & Wearables', cat: 'fashion' },
                { label: 'Room Decor & Candles', cat: 'decor' },
                { label: 'Bespoke Crafts & Art', cat: 'crafts' },
              ].map(item => (
                <li key={item.cat}>
                  <button
                    onClick={() => {
                      setSelectedCategory(item.cat as any);
                      setActiveView('catalog');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-[#FF6B00] dark:hover:text-[#FF6B00] transition-colors font-medium text-left"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Safe Spots & Quick Links */}
          <div className="md:col-span-2 space-y-3">
            <span className="font-bold text-[#111111] dark:text-white uppercase tracking-wider text-[11px] block">
              Quick Links
            </span>
            <ul className="space-y-2 text-[#52525B] dark:text-[#A1A1AA]">
              <li>
                <button
                  onClick={() => {
                    setActiveView('catalog');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:text-[#FF6B00] dark:hover:text-[#FF6B00] font-medium"
                >
                  Marketplace Feed
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveView('campus_logistics')}
                  className="hover:text-[#FF6B00] dark:hover:text-[#FF6B00] font-medium"
                >
                  Safe Pickup Spots
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveView('orders')}
                  className="hover:text-[#FF6B00] dark:hover:text-[#FF6B00] font-medium"
                >
                  Track Escrow Orders
                </button>
              </li>
              <li>
                <button
                  onClick={() => openAuthModal('seller_register')}
                  className="hover:text-[#FF6B00] dark:hover:text-[#FF6B00] font-medium"
                >
                  Open Youth Shop
                </button>
              </li>
              <li>
                <button
                  onClick={() => openAuthModal('login')}
                  className="hover:text-[#FF6B00] dark:hover:text-[#FF6B00] font-medium"
                >
                  Member Sign In
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Safety Notice */}
          <div className="md:col-span-3 space-y-3">
            <span className="font-bold text-[#111111] dark:text-white uppercase tracking-wider text-[11px] block">
              Youth Safety Rules
            </span>
            <p className="text-[11px] text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
              Never accept payments outside Shop It. Digits and number words are blocked in in-app chat to protect teen buyers and sellers from off-platform fraud.
            </p>
            <div className="p-3 bg-[#FAFAFA] dark:bg-[#15161C] rounded-xl border border-[#E4E4E7] dark:border-[#27272A] text-[11px] space-y-1">
              <span className="font-bold text-[#111111] dark:text-white flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>All 36 States + FCT Supported</span>
              </span>
              <p className="text-[#71717A] dark:text-[#A1A1AA]">
                Shop locally within your area or arrange safe interstate courier delivery.
              </p>
            </div>
          </div>
        </div>

        {/* All 36 Nigerian States + FCT Directory */}
        <div className="pt-6 border-t border-[#E4E4E7] dark:border-[#27272A] space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#111111] dark:text-white uppercase tracking-wider text-[11px]">
              Browse Marketplace by Nigerian State ({NIGERIAN_STATES.length} States &amp; FCT)
            </span>
            <button
              onClick={() => setShowAllStates(!showAllStates)}
              className="text-[#FF6B00] hover:underline font-bold text-xs flex items-center gap-1"
            >
              <span>{showAllStates ? 'Collapse State Directory' : 'View All 36 States & FCT'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllStates ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Quick Major States Strip */}
          {!showAllStates ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {['Lagos', 'Abuja (FCT)', 'Oyo', 'Rivers', 'Ogun', 'Enugu', 'Kwara', 'Anambra', 'Edo', 'Delta', 'Kano', 'Kaduna'].map(st => (
                <button
                  key={st}
                  onClick={() => handleStateClick(st)}
                  className="px-2.5 py-1 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#15161C] hover:border-[#FF6B00] dark:hover:border-[#FF6B00] hover:text-[#FF6B00] dark:hover:text-[#FF6B00] text-[#111111] dark:text-[#F4F4F5] transition-colors font-medium"
                >
                  📍 {st}
                </button>
              ))}
            </div>
          ) : (
            /* Full Categorized Geopolitical Zones Directory */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-2">
              {zones.map(zone => {
                const zoneStates = NIGERIAN_STATES.filter(s => s.zone === zone);
                return (
                  <div key={zone} className="space-y-1.5">
                    <span className="font-bold text-[#111111] dark:text-white text-[10px] uppercase tracking-wider block">
                      {zone}
                    </span>
                    <ul className="space-y-1">
                      {zoneStates.map(st => (
                        <li key={st.state}>
                          <button
                            onClick={() => handleStateClick(st.state)}
                            className="text-[11px] text-[#52525B] dark:text-[#A1A1AA] hover:text-[#FF6B00] dark:hover:text-[#FF6B00] transition-colors truncate block text-left"
                          >
                            {st.state}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom copyright - strictly as requested: "copyright 2026 shop it made by teeds" */}
        <div className="pt-6 border-t border-[#E4E4E7] dark:border-[#27272A] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#71717A] dark:text-[#A1A1AA]">
          <div className="font-semibold text-[#111111] dark:text-white">
            © 2026 Shop It. Made by TEEDS.
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Currency: Nigerian Naira (₦)</span>
            <span>·</span>
            <span className="text-[#166534] dark:text-[#9FE870] font-bold bg-[#DCFCE7] dark:bg-[#1E2028] border dark:border-[#27272A] px-2 py-0.5 rounded">
              Escrow Secured
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
