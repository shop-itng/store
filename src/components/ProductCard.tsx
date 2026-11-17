import React, { useState } from 'react';
import { Product } from '../types';
import { useApp } from '../context/AppContext';
import { formatNaira } from '../utils/pricing';
import { Heart, Star, MapPin, ImageOff, ShieldCheck, Share2, Check, MessageSquare } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  index?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, index = 0 }) => {
  const {
    openProduct,
    wishlist,
    toggleWishlist,
    lowDataMode,
    openSellerShop,
    getDeliveryFee,
    openChat,
    notify,
    currentUser,
    setActiveView,
  } = useApp();
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const isWishlisted = wishlist.includes(product.id);

  const mainImage = product.images[0] || '';
  const areaName = product.locationArea || product.location?.area || 'Local Area';
  const delivery = getDeliveryFee(product.location);
  const isOwnProduct = Boolean(
    currentUser && (currentUser.id === product.sellerId || currentUser.sellerProfile?.id === product.sellerId)
  );

  const handleShareCard = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://shopitng.vercel.app';
    const shareUrl = `${origin}/?product=${encodeURIComponent(product.id)}`;
    const shareText = `Check out "${product.title}" (${formatNaira(product.displayPrice)}) on Shop It:`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${product.title} · Shop It`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedShare(true);
      notify('Product link copied! Share anywhere.', 'success');
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {
      notify('Unable to copy product link automatically.', 'error');
    }
  };

  const handleAskSeller = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOwnProduct) {
      setActiveView('seller_dashboard');
      return;
    }
    void openChat(undefined, { productId: product.id, sellerId: product.sellerId });
  };

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
          {/* Public Area Location ONLY */}
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
                <span title="NIMC Verified Seller" className="inline-flex">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 inline" />
                </span>
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

        <div className="space-y-2.5">
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
              <span className="text-[10px] font-black text-[#9FE870] bg-[#111111] dark:bg-[#1E2028] border border-[#FF6B00] px-2 py-0.5 rounded-md flex items-center gap-1 whitespace-nowrap shrink-0">
                <ShieldCheck className="w-3 h-3 text-[#FF6B00]" />
                <span>Escrow</span>
              </span>
            )}
          </div>

          {/* Ask Seller & Share Quick Actions */}
          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={handleAskSeller}
              className="flex-1 h-8 px-2.5 rounded-xl bg-[#111111] hover:bg-[#18181B] text-[#9FE870] border border-[#111111] dark:border-[#27272A] text-[11px] font-black transition-all flex items-center justify-center gap-1 whitespace-nowrap shrink-0 active:scale-95"
              title={isOwnProduct ? 'Manage this item in Seller Dashboard' : `Ask ${product.sellerShopName} about this item`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
              <span>{isOwnProduct ? 'Your Item' : 'Ask Seller'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareCard}
              aria-label={`Share ${product.title}`}
              title="Share product link"
              className="h-8 px-2.5 rounded-xl bg-[#FAFAFA] hover:bg-[#FFF4EC] dark:bg-[#1E2028] dark:hover:bg-[#27272A] text-[#111111] dark:text-white border border-[#E4E4E7] dark:border-[#27272A] text-[11px] font-bold transition-all flex items-center justify-center gap-1 whitespace-nowrap shrink-0 active:scale-95"
            >
              {copiedShare ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                  <span>Share</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
