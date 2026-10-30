import React, { useState } from 'react';
import { Product } from '../types';
import { useApp } from '../context/AppContext';
import { formatNaira } from '../utils/pricing';
import { Heart, Star, MapPin, ImageOff, ShieldCheck } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  index?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, index = 0 }) => {
  const { openProduct, wishlist, toggleWishlist, lowDataMode, openSellerShop, getDeliveryFee } = useApp();
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const isWishlisted = wishlist.includes(product.id);

  const mainImage = product.images[0] || '';
  const areaName = product.locationArea || product.location?.area || 'Local Area';
  const delivery = getDeliveryFee(product.location);

  return (
    <article
      onClick={() => openProduct(product.id)}
      style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
      className="group card-lift card-stagger bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] overflow-hidden cursor-pointer hover:border-[#FF6B00] dark:hover:border-[#FF6B00] flex flex-col h-full"
    >
      {/* Product Image */}
      <div className="relative aspect-4/3 w-full bg-[#F4F4F5] dark:bg-[#1E2028] overflow-hidden">
        {/* Subtle skeleton shimmer shown until image loads */}
        {!lowDataMode && !imageError && mainImage && !imageLoaded && (
          <div className="absolute inset-0 skeleton-shimmer z-0" />
        )}

        {lowDataMode ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-[#F4F4F5] dark:bg-[#1E2028] text-[#71717A] dark:text-[#A1A1AA] text-center">
            <span className="text-xs font-semibold text-[#111111] dark:text-white line-clamp-1">{product.title}</span>
            <span className="text-[11px] text-[#FF6B00] font-bold mt-1">Low-Data Preview</span>
          </div>
        ) : !imageError && mainImage ? (
          <img
            src={mainImage}
            alt={product.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#F4F4F5] dark:bg-[#1E2028] p-4 text-[#A1A1AA]">
            <ImageOff className="w-7 h-7 mb-1 stroke-1" />
            <span className="text-xs font-semibold text-[#71717A] dark:text-[#A1A1AA]">{product.category.toUpperCase()}</span>
          </div>
        )}

        {/* Top Badges & Wishlist */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <div>
            {product.isSoldOut ? (
              <span className="pointer-events-auto bg-[#111111] text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-stone-700">
                Sold Out
              </span>
            ) : product.isNewArrival ? (
              <span className="pointer-events-auto bg-[#FF6B00] text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs">
                New
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              toggleWishlist(product.id);
            }}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            className="pointer-events-auto w-8 h-8 rounded-xl bg-white/95 dark:bg-[#15161C]/90 backdrop-blur-xs flex items-center justify-center text-[#52525B] dark:text-[#A1A1AA] hover:text-[#FF6B00] dark:hover:text-[#FF6B00] border border-[#E4E4E7] dark:border-[#27272A] shadow-xs transition-transform active:scale-95"
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                isWishlisted ? 'fill-[#FF6B00] text-[#FF6B00]' : 'text-[#71717A] dark:text-[#A1A1AA]'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Card Content & Metadata */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-2.5">
        <div>
          {/* Public Area Location ONLY (User Rule: Show only the area publicly) */}
          <div className="flex items-center justify-between gap-1 text-xs mb-1.5">
            <span
              onClick={e => {
                e.stopPropagation();
                openSellerShop(product.sellerId);
              }}
              className="font-semibold text-[#52525B] dark:text-[#A1A1AA] hover:text-[#FF6B00] truncate text-[11px] inline-flex items-center gap-1"
            >
              <span>{product.sellerShopName}</span>
              {product.sellerBadges?.includes('verified') && (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 inline" title="NIMC Verified Seller" />
              )}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-black text-[#111111] shrink-0 bg-[#9FE870] border border-[#111111] dark:border-stone-800 px-2 py-0.5 rounded-lg shadow-2xs">
              <MapPin className="w-3 h-3 text-[#FF6B00]" />
              <span>{areaName}</span>
            </span>
          </div>

          {/* Title */}
          <h3 className="text-sm font-bold text-[#111111] dark:text-white line-clamp-2 leading-snug group-hover:text-[#FF6B00] dark:group-hover:text-[#FF6B00] transition-colors">
            {product.title}
          </h3>
        </div>

        {/* Price & Delivery */}
        <div className="pt-2.5 border-t border-[#F4F4F5] dark:border-[#27272A] flex items-baseline justify-between gap-2">
          <div>
            <div className="text-base font-black text-[#111111] dark:text-white tracking-tight">
              {formatNaira(product.displayPrice)}
            </div>
            <div className="text-[11px] text-[#71717A] dark:text-[#A1A1AA] font-medium">
              Delivery from ₦{delivery.fee.toLocaleString()}
            </div>
          </div>

          {product.reviewCount > 0 ? (
            <div className="flex items-center gap-1 text-xs text-[#111111] dark:text-white font-bold">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              <span>{product.rating.toFixed(1)}</span>
            </div>
          ) : (
            <span className="text-[10px] font-black text-[#9FE870] bg-[#111111] dark:bg-[#1E2028] border border-[#FF6B00] px-2 py-0.5 rounded-md flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#FF6B00]" />
              <span>Escrow</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
};
