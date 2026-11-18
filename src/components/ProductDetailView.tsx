import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { useApp } from '../context/AppContext';
import { formatNaira } from '../utils/pricing';
import {
  ArrowLeft,
  Heart,
  Share2,
  Copy,
  Check,
  Star,
  ShieldCheck,
  Truck,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Flag,
  ShoppingBag,
  MessageSquare,
  MessageCircle,
  ImageOff,
  UserPlus,
  UserCheck,
  Clock,
} from 'lucide-react';
import { ShareButtons } from './ShareButtons';
import { ReportModal, ReportTarget } from './ReportModal';
import { UserIdentityBadge } from './UserIdentityBadge';

interface ProductDetailViewProps {
  product: Product;
  onBack: () => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({ product, onBack }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const {
    currentUser,
    getSellerById,
    openProfile,
    wishlist,
    toggleWishlist,
    addToCart,
    notify,
    lowDataMode,
    setActiveView,
    openChat,
    getDeliveryFee,
    userLocation,
    subscribeRestockAlert,
    checkRestockAlert,
    followUser,
    unfollowUser,
    openAuthModal,
  } = useApp();

  const seller = getSellerById(product.sellerId);
  const isWishlisted = wishlist.includes(product.id);
  const isOwnProduct = Boolean(
    currentUser && (currentUser.id === product.sellerId || currentUser.sellerProfile?.id === product.sellerId)
  );

  const canonicalProductUrl =
    (typeof window !== 'undefined' ? window.location.origin : 'https://shopitng.vercel.app') +
    `/?product=${encodeURIComponent(product.id)}`;

  // Gallery
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Customization selections
  const [selectedColor, setSelectedColor] = useState(
    product.customization?.availableColors?.[0] || ''
  );
  const [selectedSize, setSelectedSize] = useState(
    product.customization?.availableSizes?.[0] || ''
  );
  const [customNameInput, setCustomNameInput] = useState('');

  const [deliveryType, setDeliveryType] = useState<'pickup' | 'local_delivery'>('pickup');
  const [quantity, setQuantity] = useState(1);

  // Notification state for sold out (hydrated from PostgreSQL)
  const [notifyMeSet, setNotifyMeSet] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [followStatus, setFollowStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    setSelectedPhotoIndex(0);
    setImageLoaded(false);
    setImageError(false);
  }, [product.id]);

  useEffect(() => {
    let cancelled = false;
    if (!currentUser?.id || isOwnProduct) {
      setFollowStatus('none');
      return;
    }
    const targetSlug = product.sellerProfileSlug || seller?.profileSlug || product.sellerId;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('shopit_session_token') : null;
    fetch(`/api/profiles/${encodeURIComponent(targetSlug)}`, {
      headers: token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {},
      credentials: 'include',
    })
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data.status && data.profile?.followStatus) {
          setFollowStatus(data.profile.followStatus);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [product.sellerId, product.sellerProfileSlug, seller?.profileSlug, currentUser?.id, isOwnProduct]);

  useEffect(() => {
    let cancelled = false;
    if (product.isSoldOut && currentUser) {
      checkRestockAlert(product.id).then(active => {
        if (!cancelled) setNotifyMeSet(active);
      });
    } else {
      setNotifyMeSet(false);
    }
    return () => {
      cancelled = true;
    };
  }, [product.id, product.isSoldOut, currentUser?.id]);

  // Calculate dynamic delivery fee based on buyer vs seller location
  const dynamicDelivery = getDeliveryFee(product.location);
  const deliveryFee =
    deliveryType === 'pickup'
      ? product.delivery.pickupFee
      : (dynamicDelivery.fee || product.delivery.localDeliveryFee);

  // Breakdown
  const itemTotal = product.sellerPrice * quantity;
  const serviceFeeTotal = product.serviceFee * quantity;
  const grandTotal = itemTotal + serviceFeeTotal + deliveryFee;

  // Warn buyer if delivery plus fee is more than 50% of the item price
  const overheadPercentage = itemTotal > 0 ? ((serviceFeeTotal + deliveryFee) / itemTotal) * 100 : 0;
  const isHighOverhead = overheadPercentage > 50 && itemTotal < 3000;

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleShare = async (platform: 'native' | 'whatsapp' | 'copy') => {
    const shareText = `Check out "${product.title}" by ${product.sellerShopName} for ${formatNaira(
      product.displayPrice
    )} on Shop It!`;

    if (platform === 'native' && canNativeShare) {
      try {
        await navigator.share({
          title: `${product.title} · Shop It`,
          text: shareText,
          url: canonicalProductUrl,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    if (platform === 'whatsapp') {
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${canonicalProductUrl}`)}`;
      const link = document.createElement('a');
      link.href = whatsappUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
      notify('Opened WhatsApp share', 'info');
    } else {
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(canonicalProductUrl);
        } else {
          const input = document.createElement('input');
          input.value = canonicalProductUrl;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          document.body.removeChild(input);
        }
        setCopiedLink(true);
        notify('Product link copied to clipboard!', 'success');
        setTimeout(() => setCopiedLink(false), 2000);
      } catch {
        notify('Could not copy link automatically.', 'error');
      }
    }
  };

  const handleAddToCart = () => {
    if (product.isSoldOut) return;
    addToCart({
      id: `cart_${Date.now()}`,
      product,
      quantity,
      selectedColor,
      selectedSize,
      customNameText: customNameInput,
      deliveryMethod: deliveryType,
    });
  };

  const handleBuyNow = () => {
    if (product.isSoldOut) return;
    handleAddToCart();
    setActiveView('cart');
  };

  const handleRestockSubscribe = async () => {
    setNotifyLoading(true);
    const res = await subscribeRestockAlert(product.id);
    setNotifyLoading(false);
    if (res.subscribed) {
      setNotifyMeSet(true);
    }
  };

  const handleSellerFollowToggle = async () => {
    if (followBusy) return;
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    setFollowBusy(true);
    if (followStatus === 'none') {
      const res = await followUser(product.sellerId);
      if (res.status) {
        setFollowStatus(res.followStatus || 'accepted');
      }
    } else {
      const res = await unfollowUser(product.sellerId);
      if (res.status) {
        setFollowStatus('none');
      }
    }
    setFollowBusy(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-8">
      {/* Back button and top bar actions */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-white transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Crafts</span>
        </button>

        <div className="flex items-center gap-2">
          {canNativeShare && (
            <button
              type="button"
              onClick={() => handleShare('native')}
              title="Share product"
              className="px-2.5 py-1.5 text-xs font-bold text-[#9FE870] bg-[#111111] hover:bg-stone-800 rounded-lg border border-[#111111] transition-colors flex items-center gap-1 min-h-[38px] whitespace-nowrap shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => handleShare('whatsapp')}
            title="Share to WhatsApp"
            className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center gap-1 min-h-[38px] whitespace-nowrap shrink-0"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={() => handleShare('copy')}
            title="Copy product link"
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-[#27272A] hover:bg-slate-50 dark:hover:bg-[#1E2028] min-h-[38px] min-w-[38px] flex items-center justify-center"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => toggleWishlist(product.id)}
            aria-label="Wishlist"
            className="p-2 rounded-lg border border-slate-200 dark:border-[#27272A] hover:bg-slate-50 dark:hover:bg-[#1E2028] min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-700 dark:text-slate-200"
          >
            <Heart
              className={`w-4 h-4 ${
                isWishlisted ? 'fill-rose-500 text-rose-500' : 'text-slate-600 dark:text-slate-300'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Main PDP Grid: Gallery Left + Contiguous Purchase Module Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Photo Gallery */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-4/3 w-full bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
              {!lowDataMode && !imageLoaded && (
                <div className="absolute inset-0 skeleton-shimmer z-0" />
              )}

              {lowDataMode ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-100 dark:bg-[#1E2028] text-center">
                  <span className="text-base font-semibold text-slate-800 dark:text-white">{product.title}</span>
                  <span className="text-xs text-amber-700 dark:text-amber-300 mt-2 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                    Low-Data Mode active: Image preview reduced
                  </span>
                </div>
              ) : !imageError && (product.images[selectedPhotoIndex] || product.images[0]) ? (
                <img
                  src={product.images[selectedPhotoIndex] || product.images[0]}
                  alt={product.title}
                  referrerPolicy="no-referrer"
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-[#1E2028] text-slate-400">
                  <ImageOff className="w-10 h-10 mb-2 stroke-1" />
                  <span className="text-xs font-semibold">{product.title}</span>
                </div>
              )}

              {product.isSoldOut && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center">
                  <span className="px-4 py-2 bg-white text-slate-900 font-bold rounded-xl text-sm">
                    Temporarily Sold Out
                  </span>
                </div>
              )}
            </div>

          {/* Thumbnail switcher if multiple photos */}
          {product.images.length > 1 && !lowDataMode && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedPhotoIndex(idx);
                    setImageError(false);
                  }}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                    selectedPhotoIndex === idx
                      ? 'border-slate-900 dark:border-[#FF6B00] ring-2 ring-slate-900/20'
                      : 'border-slate-200 dark:border-[#27272A] opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img}
                    alt={`${product.title} view ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Product Story / Description */}
          <div className="pt-6 border-t border-slate-200 dark:border-[#27272A] space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">About this Handmade Item</h2>
            <p className="text-sm text-slate-700 dark:text-[#D4D4D8] leading-relaxed whitespace-pre-line">
              {product.description}
            </p>

            <div className="bg-slate-50 dark:bg-[#15161C] rounded-xl p-4 border border-slate-200/80 dark:border-[#27272A] space-y-2 text-xs text-slate-600 dark:text-[#A1A1AA]">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-[#9FE870]" />
                <span>Shop It Escrow &amp; Buyer Protection Included</span>
              </div>
              <p>
                Your payment is held safely until you confirm "Item Received" in person or on delivery.
                If the item does not match the description or doesn’t arrive, you get an automatic refund.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Contiguous Purchase Module */}
        <div className="lg:col-span-5 space-y-6 bg-white dark:bg-[#15161C] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-[#27272A] shadow-xs">
          {/* Seller Trust Bar */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-[#27272A]">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <UserIdentityBadge
                  userId={product.sellerId}
                  profileSlug={product.sellerProfileSlug || seller?.profileSlug}
                  displayName={product.sellerShopName || product.sellerDisplayName}
                  avatarUrl={product.sellerAvatarUrl || seller?.logoUrl}
                  isVerified={Boolean((seller?.isVerifiedSeller && (seller?.verificationStatus === 'verified' || seller?.verificationStatus === 'approved')) || product.sellerBadges?.includes('verified'))}
                  size="sm"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-[#71717A] dark:text-[#A1A1AA] mt-1.5">
                <span className="inline-flex items-center gap-1 font-bold text-[#111111] bg-[#9FE870] px-2.5 py-0.5 rounded-md text-[11px]">
                  <MapPin className="w-3 h-3 text-[#111111]" />
                  <span>{product.locationArea || 'Nigeria'}</span>
                </span>
                <span aria-hidden="true">·</span>
                <span>{seller ? `${seller.salesCount} completed sales` : 'Escrow Protected'}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {!isOwnProduct && (
                <button
                  type="button"
                  disabled={followBusy}
                  onClick={() => void handleSellerFollowToggle()}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-black flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                    followStatus === 'accepted'
                      ? 'bg-[#9FE870] text-[#111111] border-[#111111]'
                      : followStatus === 'pending'
                      ? 'bg-[#FFF4EC] text-[#C2410C] border-[#FF6B00]'
                      : 'bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF6B00]'
                  }`}
                >
                  {followStatus === 'accepted' ? (
                    <>
                      <UserCheck className="w-3 h-3" />
                      <span>Following</span>
                    </>
                  ) : followStatus === 'pending' ? (
                    <>
                      <Clock className="w-3 h-3" />
                      <span>Requested</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3 h-3 text-[#FF6B00]" />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => openProfile(product.sellerProfileSlug || seller?.profileSlug || product.sellerId)}
                className="text-xs font-bold text-[#FF6B00] hover:underline whitespace-nowrap shrink-0"
              >
                View Profile
              </button>
            </div>
          </div>

          {/* Title & Rating */}
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-snug">
              {product.title}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
              <div className="flex items-center gap-1 font-semibold text-slate-900">
                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                <span className="font-mono-numbers">{product.rating.toFixed(1)}</span>
              </div>
              <span aria-hidden="true">·</span>
              <span>{product.reviewCount} verified campus reviews</span>
              <span aria-hidden="true">·</span>
              <span className={product.stock > 0 ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                {product.stock > 0 ? `${product.stock} available in stock` : 'Out of stock'}
              </span>
            </div>
          </div>

          {/* Pricing Box (Strict breakdown: Seller Price + Shop It Fee = Display Price) */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500 font-medium">Display Price</span>
              <span className="text-2xl font-black text-slate-900 font-mono-numbers tracking-tight">
                {formatNaira(product.displayPrice)}
              </span>
            </div>

            <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-200/70">
              <div className="flex justify-between">
                <span>Artisan Maker Price</span>
                <span className="font-mono-numbers">{formatNaira(product.sellerPrice)}</span>
              </div>
              <div className="flex justify-between text-emerald-800 font-medium">
                <span>Shop It Buyer Protection Fee</span>
                <span className="font-mono-numbers">+{formatNaira(product.serviceFee)}</span>
              </div>
            </div>
          </div>

          {/* Customization Options (if applicable) */}
          {product.customization && (
            <div className="space-y-4 pt-2">
              {/* Color options */}
              {product.customization.availableColors && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Select Color / Pattern
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {product.customization.availableColors.map(c => (
                      <button
                        key={c}
                        onClick={() => setSelectedColor(c)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          selectedColor === c
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size options */}
              {product.customization.availableSizes && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Select Size
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {product.customization.availableSizes.map(s => (
                      <button
                        key={s}
                        onClick={() => setSelectedSize(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          selectedSize === s
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom name / message form */}
              {product.customization.allowsCustomName && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Custom Name or Initials to Bead
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={customNameInput}
                    onChange={e => setCustomNameInput(e.target.value)}
                    placeholder="e.g. 'CHIDINMA' or 'T&K'"
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    {product.customization.notesPrompt || 'Spelled directly with acrylic alphabet beads'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Delivery Cost Preview (Mandatory Requirement from Prompt: "Show delivery cost on PDP based on buyer area before adding to cart") */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-slate-600" />
                <span>Delivery / Pickup Options</span>
              </span>
              <span className="text-xs font-semibold text-slate-800 font-mono-numbers">
                {formatNaira(deliveryFee)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeliveryType('pickup')}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  deliveryType === 'pickup'
                    ? 'bg-white border-slate-900 ring-1 ring-slate-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="font-semibold text-slate-900">Campus Pickup Point</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{product.delivery.pickupLocation}</div>
                <div className="text-xs font-bold text-emerald-700 mt-1 font-mono-numbers">
                  {formatNaira(product.delivery.pickupFee)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryType('local_delivery')}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  deliveryType === 'local_delivery'
                    ? 'bg-white border-[#008751] ring-1 ring-[#008751]'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="font-semibold text-slate-900">Direct Delivery</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  To {userLocation.area || 'your area'} ({dynamicDelivery.method})
                </div>
                <div className="text-xs font-bold text-[#008751] mt-1 font-mono-numbers">
                  {formatNaira(dynamicDelivery.fee || product.delivery.localDeliveryFee)}
                </div>
              </button>
            </div>

            {/* Warning if delivery plus fee is > 50% of item price */}
            {isHighOverhead && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Smart Student Tip: </span>
                  Delivery + protection fee is {overheadPercentage.toFixed(0)}% of this single piece.
                  Consider picking up at the campus hub ({product.delivery.pickupLocation}) or adding more items from {product.sellerShopName} to combine delivery!
                </div>
              </div>
            )}
          </div>

          {/* Quantity & CTA Buttons */}
          <div className="space-y-3 pt-2">
            {!product.isSoldOut ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-700">Quantity</span>
                  <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold"
                    >
                      -
                    </button>
                    <span className="w-10 text-center text-xs font-bold font-mono-numbers text-slate-900">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-slate-500">
                    Est. Total: <strong className="text-slate-900 font-mono-numbers">{formatNaira(grandTotal)}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleAddToCart}
                    className="h-12 rounded-xl bg-white border-2 border-[#111111] text-[#111111] font-black text-xs sm:text-sm hover:border-[#FF6B00] hover:bg-[#FFF4EC] active:translate-y-0.5 transition-all flex items-center justify-center gap-2 shadow-[0_2px_0_#111111]"
                  >
                    <ShoppingBag className="w-4 h-4 text-[#FF6B00]" />
                    <span>Add to Bag</span>
                  </button>
                  <button
                    onClick={handleBuyNow}
                    className="h-12 rounded-xl bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] font-black text-xs sm:text-sm active:translate-y-0.5 transition-all flex items-center justify-center shadow-[0_2px_0_#111111]"
                  >
                    <span>Buy Now · {formatNaira(grandTotal)}</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleRestockSubscribe}
                  disabled={notifyMeSet || notifyLoading}
                  className={`w-full h-12 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                    notifyMeSet
                      ? 'bg-[#ecf5f0] text-[#123524] border border-[#bce0cc]'
                      : 'bg-[#0c0d10] text-white hover:bg-stone-800'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {notifyLoading
                      ? 'Saving Restock Alert...'
                      : notifyMeSet
                      ? 'Restock Alert Active'
                      : 'Sold Out · Notify Me When Restocked'}
                  </span>
                </button>
                <p className="text-[11px] text-stone-500 text-center">
                  We will send you an in-app &amp; email alert as soon as the seller adds stock.
                </p>
              </div>
            )}

            {/* Ask Seller Button (Available for both in-stock and sold-out products!) */}
            {!isOwnProduct ? (
              <button
                type="button"
                onClick={() => void openChat(undefined, { productId: product.id, sellerId: product.sellerId })}
                className="w-full h-12 rounded-xl bg-[#111111] hover:bg-[#18181B] text-[#9FE870] border-2 border-[#111111] hover:border-[#FF6B00] font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-[0_2px_0_#111111] active:translate-y-0.5 whitespace-nowrap"
              >
                <MessageSquare className="w-4 h-4 text-[#FF6B00]" />
                <span>Ask Seller (Safe Escrow Chat)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveView('seller_dashboard')}
                className="w-full h-12 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-900 border border-stone-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all"
              >
                <span>Manage Your Listing in Seller Dashboard</span>
              </button>
            )}
          </div>

          {/* Share Buttons (Native Share, WhatsApp, Copy Link, Status Preview) */}
          <div className="pt-4 border-t border-slate-100 dark:border-stone-800 space-y-2">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wide block">
              Share Item:
            </span>
            <ShareButtons
              title={product.title}
              price={product.displayPrice}
              sellerShopName={product.sellerShopName}
              campus={product.sellerCampus}
              imageUrl={product.images[0]}
              url={canonicalProductUrl}
            />
          </div>

          {/* Report Problem or Counterfeit Link */}
          <div className="pt-3 border-t border-slate-100 dark:border-stone-800 flex items-center justify-between text-xs text-slate-500">
            <button
              onClick={() =>
                setReportTarget({
                  targetType: 'product',
                  targetId: product.id,
                  targetTitle: product.title,
                })
              }
              className="flex items-center gap-1 text-slate-400 hover:text-rose-600 transition-colors"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Report this item</span>
            </button>
            <span>Anti-Bypass Protected</span>
          </div>
        </div>
      </div>

      {/* Verified Reviews Section */}
      {product.reviews && product.reviews.length > 0 && (
        <section className="pt-8 border-t border-slate-200 dark:border-stone-800 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Buyer Reviews</h3>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-0.5">
                Only verified completed orders can submit reviews on Shop It.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-mono-numbers text-slate-900 dark:text-white">
                {product.rating.toFixed(1)}
              </span>
              <div className="flex text-amber-500">
                {'★★★★★'.split('').map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {product.reviews.map(rev => (
              <div key={rev.id} className="p-4 bg-white dark:bg-stone-900 rounded-xl border border-slate-200/90 dark:border-stone-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <UserIdentityBadge
                    userId={rev.reviewerId}
                    profileSlug={rev.reviewerProfileSlug}
                    displayName={rev.reviewerName}
                    avatarUrl={rev.reviewerAvatarUrl}
                    size="sm"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">{rev.date}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setReportTarget({
                          targetType: 'review',
                          targetId: rev.id,
                          targetTitle: `Review by ${rev.reviewerName} on ${product.title}`,
                        })
                      }
                      title="Report Review"
                      className="text-stone-400 hover:text-rose-600 transition-colors"
                    >
                      <Flag className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex text-amber-500 text-xs">
                  {'★'.repeat(rev.rating)}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-normal">{rev.comment}</p>
                <div className="text-[11px] text-[#008751] flex items-center gap-1 font-medium pt-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Verified Purchase</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Global Safety & Operations Report Modal (Part 2 Item 4) */}
      <ReportModal
        target={reportTarget}
        isOpen={!!reportTarget}
        onClose={() => setReportTarget(null)}
      />
    </div>
  );
};
