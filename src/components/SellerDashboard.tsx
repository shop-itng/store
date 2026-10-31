import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Product, ProductCategory, Campus, Order } from '../types';
import { CAMPUSES } from '../data/mockData';
import { getPricingBreakdown, formatNaira } from '../utils/pricing';
import {
  Store,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Palmtree,
  ShieldCheck,
  TrendingUp,
  Package,
  AlertTriangle,
  Upload,
  CheckCircle2,
  X,
  Layers,
  Sparkles,
  Truck,
  Camera,
  Clock,
  ArrowRight,
  Inbox,
  Wallet,
} from 'lucide-react';
import { SellerWalletView } from './SellerWalletView';
import { SellerVerificationModal } from './SellerVerificationModal';

export const SellerDashboard: React.FC = () => {
  const {
    currentSeller,
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProductStock,
    toggleVacationMode,
    openProduct,
    orders,
    wallets,
    verificationRequests,
    submitVerificationRequest,
    isVerificationModalOpen,
    openVerificationModal,
    closeVerificationModal,
    updateOrderStatus,
    notify,
  } = useApp();

  const [dashboardTab, setDashboardTab] = useState<'inventory' | 'orders' | 'wallet'>('inventory');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Verification modal state
  const [isVerifModalOpen, setIsVerifModalOpen] = useState(false);

  // Packing proof modal
  const [packingOrder, setPackingOrder] = useState<Order | null>(null);
  const [packPhotoUrl, setPackPhotoUrl] = useState<string>('');
  const [isUploadingPackPhoto, setIsUploadingPackPhoto] = useState(false);

  // Product form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<ProductCategory>('beads');
  const [formSellerPrice, setFormSellerPrice] = useState<number>(3500);
  const [formStock, setFormStock] = useState<number>(5);
  const [formImage, setFormImage] = useState<string>('');
  const [allowsCustomName, setAllowsCustomName] = useState(false);
  const [availableColors, setAvailableColors] = useState('Pink, Gold, Crystal, Green');
  const [pickupFee, setPickupFee] = useState<number>(200);
  const [pickupLocation, setPickupLocation] = useState('Campus Student Quad');
  const [localDeliveryFee, setLocalDeliveryFee] = useState<number>(500);
  const [minOrderForDelivery, setMinOrderForDelivery] = useState<number>(2500);

  // Image upload compression simulation
  const [isCompressing, setIsCompressing] = useState(false);

  if (!currentSeller) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Store className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Seller Account Required</h2>
        <p className="text-sm text-slate-600 mt-1">
          Switch to Seller mode using the top role bar or sign up as a student seller.
        </p>
      </div>
    );
  }

  const sellerProducts = products.filter(p => p.sellerId === currentSeller.id);
  const lowStockCount = sellerProducts.filter(p => p.stock > 0 && p.stock <= 2).length;
  const soldOutCount = sellerProducts.filter(p => p.stock === 0).length;

  // Filter orders containing items from this seller
  const sellerOrders = orders.filter(o =>
    o.items.some(i => i.sellerId === currentSeller.id)
  );

  // Real wallet balances derived from append-only ledger
  const sellerWallet = wallets[currentSeller.id];
  const pendingEscrowEarnings = sellerWallet?.pendingBalance ?? 0;
  const availableEarnings = sellerWallet?.availableBalance ?? 0;

  // Verification request state
  // Real Verification request state
  const existingVerifReq = verificationRequests.find(r => r.sellerId === currentSeller.id);
  const rawStatus = currentSeller.verificationStatus || 'not_started';
  const isVerified = currentSeller.isVerifiedSeller && (rawStatus === 'verified' || rawStatus === 'approved');
  const isVerifPending = !isVerified && (rawStatus === 'pending' || (rawStatus as string) === 'pending_approval' || existingVerifReq?.status === 'pending');
  const isVerifRejected = rawStatus === 'rejected' || existingVerifReq?.status === 'rejected';
  const isVerifNeedsResubmit = rawStatus === 'needs_resubmission' || existingVerifReq?.status === 'needs_resubmission';
  const rejectionReason = currentSeller.verificationRejectionReason || existingVerifReq?.rejectionReason || existingVerifReq?.adminNotes;

  const pricingBreakdown = getPricingBreakdown(formSellerPrice);

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormCategory('beads');
    setFormSellerPrice(3500);
    setFormStock(5);
    setFormImage('');
    setAllowsCustomName(false);
    setAvailableColors('Pink, Gold, Crystal, Green');
    setPickupFee(200);
    setPickupLocation(`${currentSeller.campus} Quad / Hub`);
    setLocalDeliveryFee(500);
    setMinOrderForDelivery(2500);
    setEditingProductId(null);
  };

  const openEditModal = (product: Product) => {
    setEditingProductId(product.id);
    setFormTitle(product.title);
    setFormDescription(product.description);
    setFormCategory(product.category);
    setFormSellerPrice(product.sellerPrice);
    setFormStock(product.stock);
    setFormImage(product.images[0] || '');
    setAllowsCustomName(!!product.customization?.allowsCustomName);
    setAvailableColors(product.customization?.availableColors?.join(', ') || '');
    setPickupFee(product.delivery.pickupFee);
    setPickupLocation(product.delivery.pickupLocation);
    setLocalDeliveryFee(product.delivery.localDeliveryFee);
    setMinOrderForDelivery(product.delivery.minOrderForDelivery || 2000);
    setIsAddModalOpen(true);
  };

  const handleSimulatedImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      setTimeout(() => {
        setIsCompressing(false);
        const objectUrl = URL.createObjectURL(file);
        setFormImage(objectUrl);
        notify('Photo auto-compressed for slow campus 2G/3G networks!', 'success');
      }, 700);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const colorsArray = availableColors
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    const deliverySetting = {
      allowsPickup: true,
      pickupLocation,
      pickupFee: Number(pickupFee),
      allowsLocalDelivery: true,
      localDeliveryFee: Number(localDeliveryFee),
      minOrderForDelivery: Number(minOrderForDelivery),
    };

    if (editingProductId) {
      updateProduct(editingProductId, {
        title: formTitle,
        description: formDescription,
        category: formCategory,
        sellerPrice: Number(formSellerPrice),
        stock: Number(formStock),
        images: [formImage],
        customization: {
          allowsCustomName,
          availableColors: colorsArray,
        },
        delivery: deliverySetting,
      });
    } else {
      addProduct({
        sellerId: currentSeller.id,
        sellerShopName: currentSeller.shopName,
        sellerCampus: currentSeller.campus,
        sellerBadges: currentSeller.badges,
        title: formTitle,
        description: formDescription,
        category: formCategory,
        sellerPrice: Number(formSellerPrice),
        serviceFee: pricingBreakdown.serviceFee,
        displayPrice: pricingBreakdown.displayPrice,
        images: [formImage],
        stock: Number(formStock),
        customization: {
          allowsCustomName,
          availableColors: colorsArray,
        },
        delivery: deliverySetting,
        isSoldOut: Number(formStock) <= 0,
        isNewArrival: true,
      });
    }

    setIsAddModalOpen(false);
    resetForm();
  };



  const handlePackPhotoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!packingOrder) return;
    updateOrderStatus(packingOrder.id, 'packed', { packedPhotoUrl: packPhotoUrl });
    setPackingOrder(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Top Welcome & Shop Status Header */}
      <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-slate-200 dark:border-[#27272A] p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">{currentSeller.shopName}</h1>
            <span className="text-xs font-semibold text-emerald-800 dark:text-[#9FE870] bg-emerald-50 dark:bg-[#1E2028] px-2 py-0.5 rounded border border-emerald-200 dark:border-[#27272A]">
              Level {currentSeller.level} Seller
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#A1A1AA] mt-1">
            Campus: <strong className="text-slate-800 dark:text-white">{currentSeller.campus}</strong> · Payouts: Verified Account ·{' '}
            {currentSeller.under18 ? 'Guardian Consent Active' : 'NIN Slip Verified'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Vacation Mode Toggle */}
          <button
            onClick={() => toggleVacationMode(currentSeller.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 min-h-[44px] ${
              currentSeller.vacationMode
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                : 'bg-slate-100 dark:bg-[#1E2028] text-slate-700 dark:text-[#A1A1AA] hover:bg-slate-200 dark:hover:bg-[#27272A]'
            }`}
          >
            <Palmtree className="w-4 h-4 text-amber-600" />
            <span>{currentSeller.vacationMode ? 'Vacation Mode ON' : 'Pause Shop (Vacation)'}</span>
          </button>

          {/* Add Product Button */}
          <button
            onClick={() => {
              if (!isVerified) {
                notify('Identity Verification Required: Sellers must complete NIN & live selfie verification before listing crafts.', 'error');
                setIsVerifModalOpen(true);
                return;
              }
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2.5 bg-[#FF6B00] hover:bg-[#ff7a1a] text-[#111111] rounded-xl text-xs sm:text-sm font-black border-2 border-[#111111] dark:border-stone-800 shadow-[0_3px_0_#111111] dark:shadow-none active:translate-y-0.5 flex items-center gap-1.5 transition-all min-h-[44px]"
          >
            <div className="w-5 h-5 rounded-md bg-[#9FE870] border border-[#111111] flex items-center justify-center text-[#111111]">
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <span>List New Craft</span>
          </button>
        </div>
      </div>

      {/* 'Get Verified' Badge & Trust Component with Real Identity Check */}
      <div
        className={`p-5 rounded-2xl border-2 transition-all ${
          isVerified
            ? 'bg-emerald-50/80 dark:bg-[#15161C] border-emerald-400 dark:border-emerald-600/50 text-emerald-950 dark:text-emerald-100 shadow-xs'
            : isVerifPending
            ? 'bg-amber-50/80 dark:bg-[#15161C] border-amber-300 dark:border-amber-600/50 text-amber-950 dark:text-amber-100 shadow-xs'
            : isVerifRejected
            ? 'bg-red-50/80 dark:bg-[#15161C] border-red-300 dark:border-red-600/50 text-red-950 dark:text-red-100 shadow-xs'
            : isVerifNeedsResubmit
            ? 'bg-orange-50/80 dark:bg-[#15161C] border-orange-300 dark:border-orange-600/50 text-orange-950 dark:text-orange-100 shadow-xs'
            : 'bg-white dark:bg-[#15161C] border-[#111111] dark:border-[#27272A] shadow-[0_3px_0_#111111] dark:shadow-none'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                isVerified
                  ? 'bg-emerald-500 text-white border-emerald-600'
                  : isVerifPending
                  ? 'bg-amber-500 text-white border-amber-600'
                  : isVerifRejected
                  ? 'bg-red-500 text-white border-red-600'
                  : isVerifNeedsResubmit
                  ? 'bg-orange-500 text-white border-orange-600'
                  : 'bg-[#9FE870] text-[#111111] border-[#111111]'
              }`}
            >
              {isVerified ? (
                <ShieldCheck className="w-6 h-6" />
              ) : isVerifPending ? (
                <Clock className="w-6 h-6" />
              ) : isVerifRejected ? (
                <AlertTriangle className="w-6 h-6 text-white" />
              ) : isVerifNeedsResubmit ? (
                <Camera className="w-6 h-6 text-white" />
              ) : (
                <ShieldCheck className="w-6 h-6 text-[#111111]" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-[#111111] dark:text-white">
                  {isVerified
                    ? 'Verified Artisan Store (NIMC Identity Verified)'
                    : isVerifPending
                    ? 'NIN & Live Selfie Verification Under Review'
                    : isVerifRejected
                    ? 'Identity Verification Rejected'
                    : isVerifNeedsResubmit
                    ? 'Action Required: Resubmit ID or Selfie'
                    : 'Verify Your Seller Identity (NIN & Live Selfie)'}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    isVerified
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                      : isVerifPending
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700 animate-pulse'
                      : isVerifRejected
                      ? 'bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-300 border-red-300 dark:border-red-700'
                      : isVerifNeedsResubmit
                      ? 'bg-orange-100 dark:bg-orange-950 text-orange-900 dark:text-orange-300 border-orange-300 dark:border-orange-700'
                      : 'bg-[#FF6B00] text-[#111111] border-[#111111]'
                  }`}
                >
                  {isVerified
                    ? 'NIN VERIFIED'
                    : isVerifPending
                    ? 'IN REVIEW'
                    : isVerifRejected
                    ? 'REJECTED'
                    : isVerifNeedsResubmit
                    ? 'RESUBMIT'
                    : 'UNVERIFIED'}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-[#A1A1AA] max-w-2xl leading-relaxed">
                {isVerified
                  ? `Your store is verified under NIMC records (${currentSeller.verifiedLegalName || 'Legal Name'}). The official Verified Maker badge is displayed on your listings and profile.`
                  : isVerifPending
                  ? 'Your 11-digit NIN, document photo, and live camera selfie are currently being verified by our compliance team. Expected turnaround is within 24 hours.'
                  : isVerifRejected
                  ? `Your verification was rejected: ${rejectionReason || 'Document or selfie did not match official identity requirements.'} Please review the issues and resubmit.`
                  : isVerifNeedsResubmit
                  ? `Resubmission requested: ${rejectionReason || 'Please upload a clearer document photo or retake the live camera selfie.'}`
                  : 'In compliance with NDPA 2023 regulations and to prevent counterfeit goods, sellers must complete NIN and live selfie verification before listing crafts or withdrawing funds.'}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center">
            {isVerified ? (
              <div className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 rounded-xl text-xs font-black border border-emerald-300 dark:border-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>Verified Seller</span>
              </div>
            ) : isVerifPending ? (
              <div className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 rounded-xl text-xs font-bold border border-amber-300 dark:border-amber-700">
                <Clock className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <span>Pending Review (24h)</span>
              </div>
            ) : isVerifRejected || isVerifNeedsResubmit ? (
              <button
                type="button"
                onClick={() => setIsVerifModalOpen(true)}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-black border-2 border-[#111111] dark:border-stone-800 shadow-[0_2.5px_0_#111111] dark:shadow-none active:translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Resubmit Verification</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsVerifModalOpen(true)}
                className="px-4 py-2.5 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] rounded-xl text-xs sm:text-sm font-black border-2 border-[#111111] dark:border-stone-800 shadow-[0_2.5px_0_#111111] dark:shadow-none active:translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-[#111111]" />
                <span>Verify with NIN &amp; Selfie</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Escrow & Earnings Wallet Preview Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#15161C] p-4 rounded-xl border border-slate-200 dark:border-[#27272A]">
          <div className="text-xs text-slate-500 dark:text-[#A1A1AA] font-medium">Pending in Escrow</div>
          <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 font-mono-numbers mt-1">
            {formatNaira(pendingEscrowEarnings)}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-[#71717A] mt-0.5">
            Releases when buyer confirms
          </div>
        </div>

        <div className="bg-white dark:bg-[#15161C] p-4 rounded-xl border border-slate-200 dark:border-[#27272A]">
          <div className="text-xs text-slate-500 dark:text-[#A1A1AA] font-medium">Available to Withdraw</div>
          <div className="text-2xl font-extrabold text-emerald-700 dark:text-[#9FE870] font-mono-numbers mt-1">
            {formatNaira(availableEarnings)}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-[#71717A] mt-0.5">
            Opay / Bank transfer ready
          </div>
        </div>

        <div className="bg-white dark:bg-[#15161C] p-4 rounded-xl border border-slate-200 dark:border-[#27272A]">
          <div className="text-xs text-slate-500 dark:text-[#A1A1AA] font-medium">Active Orders</div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono-numbers mt-1">
            {sellerOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-[#71717A] mt-0.5">
            Fulfillment in progress
          </div>
        </div>

        <div className="bg-white dark:bg-[#15161C] p-4 rounded-xl border border-slate-200 dark:border-[#27272A]">
          <div className="text-xs text-slate-500 dark:text-[#A1A1AA] font-medium">Artisan Rating</div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono-numbers mt-1">
            ★ {currentSeller.rating.toFixed(1)}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-[#71717A] mt-0.5">
            {currentSeller.reviewCount} verified campus reviews
          </div>
        </div>
      </div>

      {/* Dashboard Section Switcher (Inventory vs Orders vs Wallet) */}
      <div className="flex border-b border-slate-200 dark:border-[#27272A] gap-2 sm:gap-6 text-xs sm:text-sm overflow-x-auto">
        <button
          onClick={() => setDashboardTab('inventory')}
          className={`pb-3 font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            dashboardTab === 'inventory'
              ? 'border-[#FF6B00] text-slate-900 dark:text-white'
              : 'border-transparent text-slate-500 dark:text-[#A1A1AA] hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Crafts Catalog ({sellerProducts.length})</span>
        </button>

        <button
          onClick={() => setDashboardTab('orders')}
          className={`pb-3 font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            dashboardTab === 'orders'
              ? 'border-[#FF6B00] text-slate-900 dark:text-white'
              : 'border-transparent text-slate-500 dark:text-[#A1A1AA] hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Fulfillment ({sellerOrders.length})</span>
          {sellerOrders.filter(o => o.status === 'paid').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />
          )}
        </button>

        <button
          onClick={() => setDashboardTab('wallet')}
          className={`pb-3 font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            dashboardTab === 'wallet'
              ? 'border-[#FF6B00] text-slate-900 dark:text-white'
              : 'border-transparent text-slate-500 dark:text-[#A1A1AA] hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Wallet & Payouts</span>
        </button>
      </div>

      {/* TAB 3: WALLET */}
      {dashboardTab === 'wallet' && <SellerWalletView />}

      {/* TAB 1: INVENTORY */}
      {dashboardTab === 'inventory' && (
        <div className="space-y-6">
          {/* Stock Alerts Warning (if any) */}
          {(lowStockCount > 0 || soldOutCount > 0) && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Inventory Notice: </strong>
                  {soldOutCount > 0 && `${soldOutCount} item(s) sold out. `}
                  {lowStockCount > 0 && `${lowStockCount} item(s) have low stock (2 or less).`}
                </span>
              </div>
              <span className="text-[11px] text-amber-800 font-medium">
                Sold out items are hidden from search automatically.
              </span>
            </div>
          )}

          {/* Products Inventory List */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Active Crafts</h2>
              <span className="text-xs text-slate-500 font-mono-numbers">
                {sellerProducts.length} items
              </span>
            </div>

            {sellerProducts.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {sellerProducts.map(product => (
                  <div
                    key={product.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                        <img
                          src={product.images[0]}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h3
                          onClick={() => openProduct(product.id)}
                          className="text-sm font-bold text-slate-900 hover:underline cursor-pointer"
                        >
                          {product.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <span className="capitalize">{product.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-slate-800 font-mono-numbers">
                            You earn: {formatNaira(product.sellerPrice)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-500 font-mono-numbers">
                            Display: {formatNaira(product.displayPrice)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center">
                      <button
                        onClick={() => toggleProductStock(product.id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                          product.stock > 0
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                        title="Click to toggle quick in-stock / out-of-stock"
                      >
                        {product.stock > 0 ? `${product.stock} in stock` : 'Sold out (Hidden)'}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg min-h-[38px] min-w-[38px] flex items-center justify-center"
                          title="Edit craft"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteProduct(product.id)}
                          className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg min-h-[38px] min-w-[38px] flex items-center justify-center"
                          title="Delete craft"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm">You haven't listed any crafts yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ORDERS & ESCROW FULFILLMENT */}
      {dashboardTab === 'orders' && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Anti-Bypass Privacy Active: </strong>
              You see only the buyer's <strong>Masked ID</strong>, delivery area, and custom choices.
              Before dispatching, upload a quick photo of the packed order to verify fulfillment.
            </span>
          </div>

          {sellerOrders.length > 0 ? (
            <div className="space-y-4">
              {sellerOrders.map(order => {
                const myItems = order.items.filter(i => i.sellerId === currentSeller.id);
                const myEarnings = myItems.reduce((sum, item) => sum + item.sellerPrice * item.quantity, 0);

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900 font-mono">{order.id}</strong>
                        <span className="text-slate-400">·</span>
                        <span className="font-semibold text-slate-700">{order.buyerMaskedId}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{order.deliveryArea}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono-numbers">
                          Your Earnings: {formatNaira(myEarnings)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            order.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-900'
                              : order.status === 'paid'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {order.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Items requested */}
                    <div className="space-y-2">
                      {myItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                              <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{item.title}</div>
                              {(item.selectedColor || item.customNameText) && (
                                <div className="text-[11px] text-emerald-800 font-medium">
                                  {item.selectedColor && `Color: ${item.selectedColor} `}
                                  {item.customNameText && `· Name: "${item.customNameText}"`}
                                </div>
                              )}
                              <div className="text-[11px] text-slate-500 font-mono-numbers">
                                Quantity: {item.quantity} · Delivery: {item.deliveryMethod}
                              </div>
                            </div>
                          </div>

                          <div className="text-right font-mono-numbers font-bold text-slate-800">
                            {formatNaira(item.sellerPrice * item.quantity)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Packaging Proof if uploaded */}
                    {order.packedPhotoUrl && (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 text-xs">
                        <img
                          src={order.packedPhotoUrl}
                          alt="Packaging proof"
                          className="w-10 h-10 object-cover rounded-md border"
                        />
                        <span className="text-slate-600 text-[11px]">
                          Packaging verified and attached to order receipt.
                        </span>
                      </div>
                    )}

                    {/* Fulfillment Buttons for Seller */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
                      {order.status === 'paid' && (
                        <button
                          onClick={() => setPackingOrder(order)}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Upload Packing Photo & Mark as Packed</span>
                        </button>
                      )}

                      {order.status === 'packed' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'shipped')}
                          className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Dispatch to Campus Rider</span>
                        </button>
                      )}

                      {order.status === 'shipped' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'delivered')}
                          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark as Delivered at Hub</span>
                        </button>
                      )}

                      {order.status === 'delivered' && (
                        <span className="text-xs text-amber-800 font-medium">
                          Awaiting buyer confirmation (or 5-day auto-release)
                        </span>
                      )}

                      {order.status === 'completed' && (
                        <span className="text-xs text-emerald-800 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Funds Released to Your Available Balance</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
              <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm">No incoming orders yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Packing Photo Upload Modal */}
      {packingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">
              Packaging Verification for #{packingOrder.id}
            </h3>
            <p className="text-xs text-slate-600">
              Per Shop It trust guidelines, upload a quick photo of the packed handmade item before dispatch to protect yourself against disputes.
            </p>
            <form onSubmit={handlePackPhotoSubmit} className="space-y-4 text-xs">
              <div className="w-full h-36 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                <img src={packPhotoUrl} alt="Packed proof" className="w-full h-full object-cover" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPackingOrder(null)}
                  className="px-4 py-2 font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800"
                >
                  Confirm & Mark as Packed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 my-8 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">
                {editingProductId ? 'Edit Craft' : 'List a New Handmade Craft'}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Craft Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Handmade Royal Crystal Waist Beads (Set of 2)"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as ProductCategory)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-900"
                  >
                    <option value="beads">Waist Beads & Jewelry</option>
                    <option value="fragrance">Fragrance & Scents</option>
                    <option value="bags">Crochet & Beaded Bags</option>
                    <option value="fashion">Fashion & Wearables</option>
                    <option value="decor">Room Decor & Candles</option>
                    <option value="crafts">Art & Bespoke Crafts</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Stock Quantity *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formStock}
                    onChange={e => setFormStock(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 font-mono-numbers"
                  />
                  <span className="text-[10px] text-slate-500">Auto-hides if 0</span>
                </div>
              </div>

              {/* Pricing Breakdown: Strict rule from Prompt */}
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                <label className="font-bold text-emerald-950 block">
                  Your Price (What You Earn in Naira ₦) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                    ₦
                  </span>
                  <input
                    type="number"
                    step={100}
                    min={500}
                    required
                    value={formSellerPrice}
                    onChange={e => setFormSellerPrice(Number(e.target.value))}
                    className="w-full h-10 pl-8 pr-3 rounded-lg border border-emerald-300 bg-white text-xs sm:text-sm font-bold font-mono-numbers text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div className="pt-2 text-[11px] text-emerald-900 space-y-1">
                  <div className="flex justify-between">
                    <span>Your artisan earnings:</span>
                    <strong className="font-mono-numbers">{formatNaira(pricingBreakdown.sellerPrice)}</strong>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Shop It protection fee (tiered):</span>
                    <span className="font-mono-numbers">+{formatNaira(pricingBreakdown.serviceFee)}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-1 border-t border-emerald-200/80 text-emerald-950">
                    <span>Buyer sees this display price:</span>
                    <span className="font-mono-numbers">{formatNaira(pricingBreakdown.displayPrice)}</span>
                  </div>
                </div>
              </div>

              {/* Photo Upload with auto-compress */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Product Photo (Auto-compressed for 2G/3G campus networks)
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                    <img src={formImage} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <label className="flex-1 cursor-pointer border border-dashed border-slate-300 rounded-lg p-2.5 text-center hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-center gap-1.5 text-slate-600 font-medium">
                      <Upload className="w-4 h-4" />
                      <span>{isCompressing ? 'Compressing photo...' : 'Upload Craft Photo'}</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSimulatedImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Description & Materials
                </label>
                <textarea
                  rows={3}
                  required
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Describe your handmade item, thread materials, scents, or styling tips..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Customization Options */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Allow Customization</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowsCustomName}
                      onChange={e => setAllowsCustomName(e.target.checked)}
                      className="rounded text-slate-900"
                    />
                    <span className="text-[11px] text-slate-600">Custom names/initials</span>
                  </label>
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">
                    Color choices (comma separated)
                  </label>
                  <input
                    type="text"
                    value={availableColors}
                    onChange={e => setAvailableColors(e.target.value)}
                    placeholder="e.g. Gold, Blue, Crystal, Emerald"
                    className="w-full h-8 px-2 rounded border border-slate-200 text-xs bg-white"
                  />
                </div>
              </div>

              {/* Delivery Settings */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-semibold text-slate-800 block">
                  Campus Pickup & Delivery Fees
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-500 block">Pickup Fee (₦)</label>
                    <input
                      type="number"
                      value={pickupFee}
                      onChange={e => setPickupFee(Number(e.target.value))}
                      className="w-full h-8 px-2 rounded border border-slate-200 text-xs bg-white font-mono-numbers"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block">Hostel Drop Fee (₦)</label>
                    <input
                      type="number"
                      value={localDeliveryFee}
                      onChange={e => setLocalDeliveryFee(Number(e.target.value))}
                      className="w-full h-8 px-2 rounded border border-slate-200 text-xs bg-white font-mono-numbers"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#ff7a1a] text-[#111111] font-black border-2 border-[#111111] shadow-[0_3px_0_#111111] active:translate-y-0.5 transition-all flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-[#9FE870] border border-[#111111]" />
                  <span>{editingProductId ? 'Save Changes' : 'List Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Real Seller Identity Verification Modal (NIMC NIN + Live Camera Selfie + NDPA 2023) */}
      <SellerVerificationModal
        isOpen={isVerifModalOpen || isVerificationModalOpen}
        onClose={() => {
          setIsVerifModalOpen(false);
          closeVerificationModal();
        }}
      />
    </div>
  );
};
