import React from 'react';
import { useApp } from '../context/AppContext';
import { ProductCard } from './ProductCard';
import {
  MapPin,
  Clock,
  Star,
  ShieldCheck,
  Award,
  Sparkles,
  ArrowLeft,
  Calendar,
  Instagram,
  ShoppingBag,
  Palmtree,
} from 'lucide-react';

interface SellerShopViewProps {
  sellerId: string;
  onBack: () => void;
}

export const SellerShopView: React.FC<SellerShopViewProps> = ({ sellerId, onBack }) => {
  const { getSellerById, products, openProduct } = useApp();
  const seller = getSellerById(sellerId);

  if (!seller) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-slate-600">Artisan shop not found.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
        >
          Back to crafts
        </button>
      </div>
    );
  }

  const sellerProducts = products.filter(p => p.sellerId === seller.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Market</span>
      </button>

      {/* Seller Header Banner & Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {/* Banner */}
        <div className="h-36 sm:h-48 w-full bg-slate-900 relative">
          {seller.bannerUrl && (
            <img
              src={seller.bannerUrl}
              alt={seller.shopName}
              className="w-full h-full object-cover opacity-50"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
        </div>

        {/* Profile Info Row */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-4">
            <div className="flex items-end gap-4">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-white bg-slate-100 overflow-hidden shadow-md shrink-0">
                {seller.logoUrl ? (
                  <img
                    src={seller.logoUrl}
                    alt={seller.shopName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold bg-emerald-100 text-emerald-800">
                    {seller.shopName[0]}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900">{seller.shopName}</h1>
                  {seller.isVerifiedSeller && (seller.verificationStatus === 'verified' || seller.verificationStatus === 'approved') && (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1 shadow-2xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>NIMC Verified Artisan</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1 text-slate-700 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{seller.campus}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Joined {seller.joinedDate}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-amber-600 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    <span>Level {seller.level} Artisan</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Badges / Stats Strip */}
            <div className="flex items-center gap-3">
              {seller.socialLinks?.instagram && (
                <span className="text-xs text-slate-500 flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                  <Instagram className="w-3.5 h-3.5 text-pink-600" />
                  <span>{seller.socialLinks.instagram}</span>
                </span>
              )}
            </div>
          </div>

          {/* Bio */}
          <p className="text-sm text-slate-700 max-w-3xl leading-relaxed">{seller.bio}</p>

          {/* Trust Metrics Pill Strip (Clean unboxed figures) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 text-xs">
            <div>
              <div className="text-slate-500">Student Rating</div>
              <div className="text-lg font-bold text-slate-900 font-mono-numbers flex items-center gap-1 mt-0.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                <span>{seller.rating.toFixed(1)}</span>
                <span className="text-xs text-slate-400 font-normal">({seller.reviewCount})</span>
              </div>
            </div>

            <div>
              <div className="text-slate-500">Completed Campus Sales</div>
              <div className="text-lg font-bold text-slate-900 font-mono-numbers mt-0.5">
                {seller.salesCount}+ items
              </div>
            </div>

            <div>
              <div className="text-slate-500">Avg. Response Time</div>
              <div className="text-lg font-bold text-emerald-700 font-mono-numbers mt-0.5">
                &lt; 15 mins
              </div>
            </div>

            <div>
              <div className="text-slate-500">Supervision Status</div>
              <div className="text-xs font-semibold text-slate-800 mt-1">
                {seller.under18 ? 'Guardian Verified Account' : 'Verified Student ID'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vacation mode notice if active */}
      {seller.vacationMode && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-center gap-3 text-amber-900 text-xs">
          <Palmtree className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong>This shop is currently on vacation mode.</strong> Items are visible for browsing,
            but new orders are temporarily paused while the student artisan completes exams or restocks.
          </div>
        </div>
      )}

      {/* Seller Catalog Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Crafts from {seller.shopName} ({sellerProducts.length})
          </h2>
          <span className="text-xs text-slate-500">All prices in Naira (₦)</span>
        </div>

        {sellerProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {sellerProducts.map((p, idx) => (
              <ProductCard key={p.id} product={p} index={idx} />
            ))}
          </div>
        ) : (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
            <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600">No active products listed yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
