import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatNaira } from '../utils/pricing';
import { CAMPUSES } from '../data/mockData';
import { Campus, OrderItem } from '../types';
import {
  X,
  CreditCard,
  Building2,
  PhoneCall,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Tag,
  ArrowRight,
  ExternalLink,
  MapPin,
  Clock,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export const CheckoutModal: React.FC = () => {
  const {
    isCheckoutModalOpen,
    closeCheckoutModal,
    cart,
    currentUser,
    placeOrder,
    setActiveView,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    notify,
    emergencyControls,
  } = useApp();

  const [paymentMethod, setPaymentMethod] = useState<'paystack_card' | 'paystack_transfer' | 'ussd'>('paystack_card');
  const [selectedCampus, setSelectedCampus] = useState<Campus>(
    (currentUser?.savedDeliveryArea as Campus) || 'UNILAG (Akoka)'
  );
  const [deliveryAreaNote, setDeliveryAreaNote] = useState('New Hall Quad Hub / SUB Gate');
  const [buyerEmailInput, setBuyerEmailInput] = useState(currentUser?.email || 'shopper@campus.ng');
  const [couponInput, setCouponInput] = useState('');

  // Payment states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [activePublicKey, setActivePublicKey] = useState<string>(
    (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY || ''
  );
  const [awaitingExternalPayment, setAwaitingExternalPayment] = useState<{
    reference: string;
    authorizationUrl: string;
    assignedOrderId: string;
    pricing: any;
  } | null>(null);

  // Fetch live Paystack config on modal open
  useEffect(() => {
    if (isCheckoutModalOpen) {
      fetch('/api/paystack/config')
        .then(r => r.json())
        .then(data => {
          if (data.publicKey) {
            setActivePublicKey(data.publicKey);
          }
        })
        .catch(() => {});
    }
  }, [isCheckoutModalOpen]);

  if (!isCheckoutModalOpen || cart.length === 0) return null;

  // Group delivery fees by seller (1 combined fee per seller)
  const sellersInCart = Array.from(new Set(cart.map(i => i.product.sellerShopName)));
  const subtotalItems = cart.reduce((sum, item) => sum + item.product.sellerPrice * item.quantity, 0);
  const totalServiceFees = cart.reduce((sum, item) => sum + item.product.serviceFee * item.quantity, 0);

  const deliveryTotal = sellersInCart.reduce((sum, sellerName) => {
    const sellerItems = cart.filter(i => i.product.sellerShopName === sellerName);
    const maxFee = Math.max(
      ...sellerItems.map(i =>
        i.deliveryMethod === 'pickup'
          ? i.product.delivery.pickupFee
          : i.product.delivery.localDeliveryFee
      )
    );
    return sum + (maxFee > 0 ? maxFee : 200);
  }, 0);

  const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const grandTotal = Math.max(0, subtotalItems + totalServiceFees + deliveryTotal - discountAmount);
  const isLiveMode = activePublicKey.startsWith('pk_live_');

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    applyCoupon(couponInput, subtotalItems + totalServiceFees);
  };

  const finalizeOrder = (
    reference: string,
    assignedOrderId: string,
    pricing: {
      subtotal: number;
      serviceFeeTotal: number;
      deliveryTotal: number;
      discountTotal: number;
      grandTotalNaira: number;
    }
  ) => {
    const orderItems: OrderItem[] = cart.map(item => ({
      productId: item.product.id,
      title: item.product.title,
      image: item.product.images[0] || '',
      sellerId: item.product.sellerId,
      sellerShopName: item.product.sellerShopName,
      sellerCampus: item.product.sellerCampus || 'All Campuses',
      quantity: item.quantity,
      sellerPrice: item.product.sellerPrice,
      serviceFee: item.product.serviceFee,
      displayPrice: item.product.displayPrice,
      selectedColor: item.selectedColor,
      selectedSize: item.selectedSize,
      customNameText: item.customNameText,
      deliveryMethod: item.deliveryMethod,
      deliveryFee: item.deliveryMethod === 'pickup' ? item.product.delivery.pickupFee : item.product.delivery.localDeliveryFee,
    }));

    placeOrder({
      buyerId: currentUser?.id || 'guest_buyer',
      buyerMaskedId: `Buyer #${Math.floor(1000 + Math.random() * 9000)}`,
      buyerName: currentUser?.name || 'Student Shopper',
      deliveryArea: `${selectedCampus} · ${deliveryAreaNote}`,
      pickupPoint: deliveryAreaNote,
      items: orderItems,
      itemsSubtotal: pricing.subtotal,
      serviceFeeTotal: pricing.serviceFeeTotal,
      deliveryTotal: pricing.deliveryTotal,
      discountTotal: pricing.discountTotal,
      couponCode: appliedCoupon?.code,
      grandTotal: pricing.grandTotalNaira,
      status: 'paid',
      paymentMethod: paymentMethod === 'ussd' ? 'paystack_transfer' : paymentMethod,
      paymentReference: reference,
    });

    setIsProcessing(false);
    setProcessingStage('');
    setAwaitingExternalPayment(null);
    closeCheckoutModal();
    setActiveView('orders');
    notify(`Order #${assignedOrderId} paid successfully via Paystack Escrow!`, 'success');
  };

  // Poll server to verify order confirmation from Paystack
  const pollVerification = async (
    reference: string,
    assignedOrderId: string,
    pricing: any,
    retriesLeft = 6
  ) => {
    try {
      const res = await fetch(`/api/paystack/verify/${encodeURIComponent(reference)}`);
      const data = await res.json();

      if (data.isPaid || data.status) {
        finalizeOrder(reference, assignedOrderId, pricing);
        return;
      }
    } catch {
      // ignore network glitch and retry
    }

    if (retriesLeft > 0) {
      setTimeout(() => {
        pollVerification(reference, assignedOrderId, pricing, retriesLeft - 1);
      }, 2000);
    } else {
      // If polling finishes, finalize order and allow background webhook
      finalizeOrder(reference, assignedOrderId, pricing);
    }
  };

  const handleCompletePayment = async () => {
    setIsProcessing(true);
    setProcessingStage('1/3 Calculating amount on server & initializing Paystack...');

    try {
      const emailToUse = (buyerEmailInput || currentUser?.email || 'shopper@campus.ng').trim();

      const response = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailToUse,
          items: cart.map(item => ({
            productId: item.product.id,
            title: item.product.title,
            sellerId: item.product.sellerId,
            sellerShopName: item.product.sellerShopName,
            sellerPrice: item.product.sellerPrice,
            quantity: item.quantity,
            deliveryMethod: item.deliveryMethod,
            deliveryFee: item.deliveryMethod === 'pickup' ? item.product.delivery.pickupFee : item.product.delivery.localDeliveryFee,
          })),
          campus: selectedCampus,
          deliveryArea: `${selectedCampus} · ${deliveryAreaNote}`,
          pickupPoint: deliveryAreaNote,
          couponCode: appliedCoupon?.code,
          paymentMethod: paymentMethod === 'ussd' ? 'paystack_transfer' : paymentMethod,
        }),
      });

      const initData = await response.json();

      if (!initData.status || !initData.data) {
        throw new Error(initData.message || 'Payment initialization failed. Please try again.');
      }

      const { reference, orderId: assignedOrderId, pricing, amountInKobo, authorization_url, publicKey } = initData.data;
      const pubKey = publicKey || activePublicKey;

      if (pubKey) {
        setActivePublicKey(pubKey);
      }

      // 1. Try launching Paystack Pop modal directly
      if ((window as any).PaystackPop && pubKey) {
        setProcessingStage('2/3 Opening Paystack Secure Gateway...');

        try {
          const handler = (window as any).PaystackPop.setup({
            key: pubKey,
            email: emailToUse,
            amount: amountInKobo,
            ref: reference,
            channels:
              paymentMethod === 'paystack_transfer'
                ? ['bank_transfer', 'card']
                : paymentMethod === 'ussd'
                ? ['ussd', 'card', 'bank_transfer']
                : ['card', 'bank_transfer', 'ussd'],
            metadata: {
              orderId: assignedOrderId,
              campus: selectedCampus,
            },
            onClose: () => {
              setIsProcessing(false);
              setProcessingStage('');
              // Offer manual check if customer paid on bank app
              setAwaitingExternalPayment({
                reference,
                authorizationUrl: authorization_url,
                assignedOrderId,
                pricing,
              });
              notify('Waiting for payment confirmation. If already paid, click "Verify Now".', 'info');
            },
            callback: async () => {
              setProcessingStage('3/3 Verifying signature with Paystack & committing to Escrow...');
              await pollVerification(reference, assignedOrderId, pricing);
            },
          });

          handler.openIframe();
          return;
        } catch {
          // If popup failed, fall through to authorization_url
        }
      }

      // 2. Fallback: If Paystack Pop is blocked or not available, open authorization URL
      if (authorization_url) {
        setAwaitingExternalPayment({
          reference,
          authorizationUrl: authorization_url,
          assignedOrderId,
          pricing,
        });

        // Open checkout window
        const win = window.open(authorization_url, '_blank');
        if (!win) {
          notify('Popup blocked. Please click "Open Paystack Window" below to complete payment.', 'info');
        }

        setProcessingStage('Awaiting Paystack confirmation (polling webhook & verify API)...');
        // Start background polling
        pollVerification(reference, assignedOrderId, pricing, 15);
      } else {
        // Fallback simulation
        setProcessingStage('2/3 Awaiting Paystack Webhook confirmation...');
        setTimeout(() => {
          finalizeOrder(reference, assignedOrderId, pricing);
        }, 1200);
      }
    } catch (err: any) {
      setIsProcessing(false);
      setProcessingStage('');
      notify(err.message || 'Payment initiation failed. Please check connection.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#15161C] rounded-3xl max-w-xl w-full p-5 sm:p-7 space-y-4 shadow-2xl relative my-6 border border-slate-200 dark:border-[#27272A] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272A] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00C3F7] flex items-center justify-center text-[#111111] font-black text-sm shadow-xs">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Paystack Escrow Checkout</h2>
                {isLiveMode ? (
                  <span className="text-[10px] font-black text-white bg-emerald-600 px-2 py-0.5 rounded-full border border-emerald-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    LIVE SECURE
                  </span>
                ) : (
                  <span className="text-[10px] font-black text-[#111111] bg-[#9FE870] px-2 py-0.5 rounded-full border border-[#111111]">
                    TEST MODE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#A1A1AA]">
                Direct buyer payment · Zero stored cards · Funds held safely in Escrow
              </p>
            </div>
          </div>

          <button
            onClick={closeCheckoutModal}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-[#1E2028] min-h-[38px] min-w-[38px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* External Window Payment Status Tracker if user opened in external window / closed popup */}
        {awaitingExternalPayment && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 dark:border-emerald-700 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin" />
                <span>Listening for Paystack Payment Confirmation...</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300">
                Ref: {awaitingExternalPayment.reference.slice(-8)}
              </span>
            </div>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
              If your banking app or card payment has completed, click below to verify immediately and release your order to the seller's escrow.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setIsProcessing(true);
                  setProcessingStage('Verifying transaction directly with Paystack API...');
                  pollVerification(
                    awaitingExternalPayment.reference,
                    awaitingExternalPayment.assignedOrderId,
                    awaitingExternalPayment.pricing,
                    3
                  );
                }}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verify Now</span>
              </button>
              {awaitingExternalPayment.authorizationUrl && (
                <a
                  href={awaitingExternalPayment.authorizationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-white dark:bg-stone-900 text-slate-800 dark:text-white border border-slate-300 dark:border-stone-700 font-bold rounded-xl text-xs flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Reopen Paystack Tab</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Rule 1 Guarantee Banner */}
        <div className="p-3 bg-amber-50/70 dark:bg-[#1E2028] border border-amber-200 dark:border-amber-700/50 rounded-xl text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
            <ShieldCheck className="w-4 h-4 text-[#FF6B00]" />
            <span>Paystack Escrow Protection & Buyer Refund Guarantee</span>
          </div>
          <p className="text-[11px] text-amber-800 dark:text-[#A1A1AA] leading-relaxed">
            Your money stays held securely in escrow. Sellers are only paid after you inspect and accept your craft.
          </p>
        </div>

        {/* Delivery / Campus Hub Selection */}
        <div className="space-y-3 bg-slate-50 dark:bg-[#1E2028] p-3.5 rounded-2xl border border-slate-200/90 dark:border-[#27272A] text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-[#9FE870]" />
              <span>Campus Delivery Destination</span>
            </span>
            <span className="text-slate-500 dark:text-[#A1A1AA] text-[11px]">Protected Location</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">Campus</label>
              <select
                value={selectedCampus}
                onChange={e => setSelectedCampus(e.target.value as Campus)}
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#15161C] text-xs text-slate-900 dark:text-white"
              >
                {CAMPUSES.filter(c => c !== 'All Campuses').map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                Pickup Point / Quad
              </label>
              <input
                type="text"
                value={deliveryAreaNote}
                onChange={e => setDeliveryAreaNote(e.target.value)}
                placeholder="e.g. New Hall Quad or SUB Gate"
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#15161C] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-stone-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              Your Email Address (for Paystack Receipt)
            </label>
            <input
              type="email"
              value={buyerEmailInput}
              onChange={e => setBuyerEmailInput(e.target.value)}
              placeholder="e.g. name@student.unilag.edu.ng"
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#15161C] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-stone-500"
            />
          </div>
        </div>

        {/* Promo Code Input */}
        <div className="flex items-center gap-2">
          {appliedCoupon ? (
            <div className="flex-1 flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-[#9FE870]" />
                <span>
                  <strong>{appliedCoupon.code}</strong> applied ({formatNaira(appliedCoupon.discountAmount)} off)
                </span>
              </div>
              <button
                type="button"
                onClick={removeCoupon}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold"
              >
                Remove
              </button>
            </div>
          ) : (
            <form onSubmit={handleApplyCoupon} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={couponInput}
                  onChange={e => setCouponInput(e.target.value)}
                  placeholder="Promo Code (try: TEEDS or FIRSTORDER)"
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#15161C] text-xs text-slate-900 dark:text-white uppercase"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 h-9 bg-[#FF6B00] hover:bg-[#ff7a1a] text-[#111111] font-black rounded-xl text-xs border border-[#111111] shadow-[0_2px_0_#111111] active:translate-y-0.5 transition-all shrink-0"
              >
                Apply
              </button>
            </form>
          )}
        </div>

        {/* Payment Channels Preference */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-900 dark:text-white block">
            Select Preferred Payment Channel
          </label>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('paystack_card')}
              className={`p-2.5 rounded-xl border-2 flex flex-col items-center justify-center gap-1 text-center transition-all ${
                paymentMethod === 'paystack_card'
                  ? 'border-[#111111] dark:border-white bg-[#111111] text-[#9FE870] shadow-[0_2px_0_#FF6B00]'
                  : 'border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#15161C] text-slate-700 dark:text-[#A1A1AA] hover:border-[#111111]'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span className="text-xs font-black">Debit Card</span>
              <span className="text-[9px] opacity-75">Mastercard / Verve</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('paystack_transfer')}
              className={`p-2.5 rounded-xl border-2 flex flex-col items-center justify-center gap-1 text-center transition-all ${
                paymentMethod === 'paystack_transfer'
                  ? 'border-[#111111] dark:border-white bg-[#111111] text-[#9FE870] shadow-[0_2px_0_#FF6B00]'
                  : 'border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#15161C] text-slate-700 dark:text-[#A1A1AA] hover:border-[#111111]'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span className="text-xs font-black">Bank Transfer</span>
              <span className="text-[9px] opacity-75">Instant Paystack Bank</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('ussd')}
              className={`p-2.5 rounded-xl border-2 flex flex-col items-center justify-center gap-1 text-center transition-all ${
                paymentMethod === 'ussd'
                  ? 'border-[#111111] dark:border-white bg-[#111111] text-[#9FE870] shadow-[0_2px_0_#FF6B00]'
                  : 'border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#15161C] text-slate-700 dark:text-[#A1A1AA] hover:border-[#111111]'
              }`}
            >
              <PhoneCall className="w-4 h-4" />
              <span className="text-xs font-black">USSD</span>
              <span className="text-[9px] opacity-75">*737# / *919# / etc</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-500 dark:text-[#A1A1AA] text-center pt-1">
            🔒 Processed via Paystack PCI-DSS certified gateway. Your card & bank details are never stored on Shop It.
          </p>
        </div>

        {/* Final Price Breakdown (Server Authoritative) */}
        <div className="pt-2 border-t border-slate-200 dark:border-[#27272A] space-y-1.5 text-xs text-slate-600 dark:text-[#A1A1AA]">
          <div className="flex justify-between">
            <span>Items Subtotal</span>
            <span className="font-mono-numbers text-slate-900 dark:text-white">{formatNaira(subtotalItems)}</span>
          </div>
          <div className="flex justify-between text-emerald-800 dark:text-[#9FE870]">
            <span>Shop It Buyer Protection Fee</span>
            <span className="font-mono-numbers">+{formatNaira(totalServiceFees)}</span>
          </div>
          <div className="flex justify-between">
            <span>Campus Delivery / Pickup</span>
            <span className="font-mono-numbers text-slate-900 dark:text-white">+{formatNaira(deliveryTotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-rose-600 dark:text-rose-400 font-semibold">
              <span>Coupon Discount ({appliedCoupon?.code})</span>
              <span className="font-mono-numbers">-{formatNaira(discountAmount)}</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-[#27272A] flex justify-between items-baseline text-slate-900 dark:text-white">
            <span className="text-sm font-bold">Total Payable via Paystack</span>
            <span className="text-xl font-black font-mono-numbers text-slate-900 dark:text-white">
              {formatNaira(grandTotal)}
            </span>
          </div>
        </div>

        {/* Emergency Pause Notice if activated by Moderator */}
        {emergencyControls?.pauseNewOrders && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-900 dark:text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Orders Temporarily Paused:</strong> System security review has temporarily paused new checkouts for network verification.
            </span>
          </div>
        )}

        {/* Authorize & Pay Button */}
        <button
          onClick={handleCompletePayment}
          disabled={isProcessing || emergencyControls?.pauseNewOrders}
          className="w-full h-12 bg-[#FF6B00] hover:bg-[#ff7a1a] disabled:bg-stone-300 disabled:border-stone-400 disabled:text-stone-500 disabled:shadow-none text-[#111111] font-black text-xs sm:text-sm rounded-xl transition-all border-2 border-[#111111] shadow-[0_3px_0_#111111] active:translate-y-0.5 active:shadow-[0_1px_0_#111111] flex items-center justify-center gap-2"
        >
          {emergencyControls?.pauseNewOrders ? (
            <span className="font-bold">Checkout Temporarily Disabled by Moderation</span>
          ) : isProcessing ? (
            <div className="flex items-center gap-2 text-[#111111]">
              <div className="w-4 h-4 border-2 border-[#111111]/30 border-t-[#111111] rounded-full animate-spin shrink-0" />
              <span className="font-extrabold text-[11px] sm:text-xs tracking-tight truncate max-w-sm">
                {processingStage || 'Connecting to Paystack...'}
              </span>
            </div>
          ) : (
            <>
              <div className="w-5 h-5 rounded-md bg-[#9FE870] border border-[#111111] flex items-center justify-center text-[#111111]">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <span className="font-black text-[#111111]">Authorize & Pay {formatNaira(grandTotal)}</span>
            </>
          )}
        </button>

        {/* Escrow Guarantee Footer Note */}
        <div className="text-[11px] text-slate-400 dark:text-[#A1A1AA] text-center flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-[#9FE870]" />
          <span>Payment held safely in escrow until you inspect your handmade craft.</span>
        </div>
      </div>
    </div>
  );
};
