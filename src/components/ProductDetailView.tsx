import React, { useState } from 'react';
import { Product } from '../types';
import { useApp } from '../context/AppContext';
import { formatNaira } from '../utils/pricing';
import {
  ArrowLeft,
  Heart,
  Share2,
  Star,
  ShieldCheck,
  Truck,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle2,
  Send,
  Flag,
  Sparkles,
  ShoppingBag,
  Zap,
  MessageSquare,
} from 'lucide-react';

interface ProductDetailViewProps {
  product: Product;
  onBack: () => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({ product, onBack }) => {
  const {
    getSellerById,
    openSellerShop,
    wishlist,
    toggleWishlist,
    addToCart,
    notify,
    lowDataMode,
    setActiveView,
    openChat,
    getDeliveryFee,
    userLocation,
  } = useApp();

  const seller = getSellerById(product.sellerId);
  const isWishlisted = wishlist.includes(product.id);

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

  // Delivery area preview selector (Mandatory feature: show delivery cost before add to cart)
  const [deliveryArea, setDeliveryArea] = useState<string>('Campus Pickup Point');
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'local_delivery'>('pickup');

  // Quantity
  const [quantity, setQuantity] = useState(1);

  // Notification state for sold out
  const [notifyMeSet, setNotifyMeSet] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');

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

  // Rule from prompt: Warn buyer if delivery plus fee is more than 50% of the item price!
  const overheadPercentage = ((serviceFeeTotal + deliveryFee) / itemTotal) * 100;
  const isHighOverhead = overheadPercentage > 50 && itemTotal < 3000;

  const handleShare = (platform: 'whatsapp' | 'copy') => {
    const shareUrl = window.location.href;
    const shareText = `Check out "${product.title}" by ${product.sellerShopName} for ${formatNaira(
      product.displayPrice
    )} on Shop It Nigeria!`;

    if (platform === 'whatsapp') {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
      window.open(whatsappUrl, '_blank');
      notify('Opened WhatsApp share', 'info');
    } else {
      navigator.clipboard?.writeText?.(`${shareText} ${shareUrl}`);
      notify('Link copied to clipboard!', 'success');
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

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowReportModal(false);
    setReportReason('');
    notify('Report submitted to Trust & Safety moderation team.', 'success');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-8">
      {/* Back button and breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Crafts</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Share Buttons */}
          <button
            onClick={() => handleShare('whatsapp')}
            title="Share to WhatsApp"
            className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors flex items-center gap-1 min-h-[38px]"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>
          <button
            onClick={() => handleShare('copy')}
            title="Copy link"
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50 min-h-[38px] min-w-[38px] flex items-center justify-center"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => toggleWishlist(product.id)}
            aria-label="Wishlist"
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-700"
          >
            <Heart
              className={`w-4 h-4 ${
                isWishlisted ? 'fill-rose-500 text-rose-500' : 'text-slate-600'
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
            {lowDataMode ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-100 text-center">
                <span className="text-4xl mb-2">✨</span>
                <span className="text-base font-semibold text-slate-800">{product.title}</span>
                <span className="text-xs text-amber-700 mt-2 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                  Low-Data Mode active: Image preview reduced
                </span>
              </div>
            ) : (
              <img
                src={product.images[selectedPhotoIndex] || product.images[0]}
                alt={product.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
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
                  onClick={() => setSelectedPhotoIndex(idx)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                    selectedPhotoIndex === idx
                      ? 'border-slate-900 ring-2 ring-slate-900/20'
                      : 'border-slate-200 opacity-70 hover:opacity-100'
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
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <h2 className="text-base font-bold text-slate-900">About this Handmade Item</h2>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Shop It Escrow & Buyer Protection Included</span>
              </div>
              <p>
                Your payment is held safely until you confirm "Item Received" in person or on delivery.
                If the item does not match the description or doesn’t arrive, you get an automatic refund.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Contiguous Purchase Module */}
        <div className="lg:col-span-5 space-y-6 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
          {/* Seller Trust Bar */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openSellerShop(product.sellerId)}
                  className="text-sm font-bold text-slate-900 hover:underline flex items-center gap-1"
                >
                  <span>{product.sellerShopName}</span>
                </button>
                <span className="text-[11px] font-bold text-[#111111] bg-[#9FE870] px-2 py-0.5 rounded-md">
                  Verified
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#71717A] mt-1.5">
                <span className="inline-flex items-center gap-1 font-bold text-[#111111] bg-[#9FE870] px-2.5 py-0.5 rounded-md text-[11px]">
                  <MapPin className="w-3 h-3 text-[#111111]" />
                  <span>📍 {product.locationArea || 'Nigeria'}</span>
                </span>
                <span aria-hidden="true">·</span>
                <Clock className="w-3.5 h-3.5 text-[#71717A]" />
                <span>Fast responder</span>
              </div>
            </div>

            <button
              onClick={() => openSellerShop(product.sellerId)}
              className="text-xs font-bold text-[#FF6B00] hover:underline"
            >
              View Shop
            </button>
          </div>

          {/* Title & Rating */}
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
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

                <button
                  type="button"
                  onClick={() => openChat(undefined, { productId: product.id, sellerId: product.sellerId })}
                  className="w-full h-12 rounded-xl bg-[#111111] hover:bg-[#18181B] text-[#9FE870] border-2 border-[#111111] hover:border-[#FF6B00] font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-[0_2px_0_#111111] active:translate-y-0.5"
                >
                  <MessageSquare className="w-4 h-4 text-[#FF6B00]" />
                  <span>Chat with Seller (Safe Escrow)</span>
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setNotifyMeSet(true);
                    notify('We will notify you when this item is restocked!', 'success');
                  }}
                  disabled={notifyMeSet}
                  className={`w-full h-12 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                    notifyMeSet
                      ? 'bg-[#ecf5f0] text-[#123524] border border-[#bce0cc]'
                      : 'bg-[#0c0d10] text-white hover:bg-stone-800'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{notifyMeSet ? 'Notification set for restock' : 'Sold Out · Notify Me'}</span>
                </button>
                <p className="text-[11px] text-stone-500 text-center">
                  Seller usually restocks within 3–5 days.
                </p>
              </div>
            )}
          </div>

          {/* Report Problem or Counterfeit Link */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-1 text-slate-400 hover:text-rose-600 transition-colors"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Report this item</span>
            </button>
            <span>Anti-Bypass Protected</span>
          </div>
        </div>
      </div>

      {/* Verified Reviews Section (Hides when empty per requirement: "Every section starts empty, fills with real users' content, and hides when empty") */}
      {product.reviews && product.reviews.length > 0 && (
        <section className="pt-8 border-t border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Buyer Reviews</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Only verified completed orders can submit reviews on Shop It.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-mono-numbers text-slate-900">
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
              <div key={rev.id} className="p-4 bg-white rounded-xl border border-slate-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    {rev.buyerMaskedId}
                  </span>
                  <span className="text-[11px] text-slate-500">{rev.date}</span>
                </div>
                <div className="flex text-amber-500 text-xs">
                  {'★'.repeat(rev.rating)}
                </div>
                <p className="text-xs text-slate-700 leading-normal">{rev.comment}</p>
                <div className="text-[11px] text-[#008751] flex items-center gap-1 font-medium pt-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Verified Purchase</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Report this Listing</h3>
            <p className="text-xs text-slate-600">
              Help keep Shop It safe. Reports go directly to our Trust & Safety team.
            </p>
            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Reason for Report
                </label>
                <select
                  required
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-900"
                >
                  <option value="">Select a violation...</option>
                  <option value="fake">Prohibited or counterfeit item</option>
                  <option value="bypass">Seller attempted to take chat/payment off-platform</option>
                  <option value="pricing">Misleading pricing or photo</option>
                  <option value="other">Other trust violation</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
