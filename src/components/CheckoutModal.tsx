import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatNaira } from '../utils/pricing';
import { CAMPUSES } from '../data/mockData';
import { Campus } from '../types';
import {
  X,
  CreditCard,
  Building2,
  PhoneCall,
  Wallet,
  ShieldCheck,
  Lock,
  Tag,
  ExternalLink,
  MapPin,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

type PaymentChannelChoice =
  | 'flutterwave_card'
  | 'flutterwave_transfer'
  | 'flutterwave_ussd'
  | 'flutterwave_opay';

export const CheckoutModal: React.FC = () => {
  const {
    isCheckoutModalOpen,
    closeCheckoutModal,
    cart,
    currentUser,
    openAuthModal,
    refreshCurrentUser,
    clearCart,
    setActiveView,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    notify,
    emergencyControls,
    paymentsEnabled,
  } = useApp();

  const [paymentMethod, setPaymentMethod] = useState<PaymentChannelChoice>('flutterwave_card');
  const [selectedCampus, setSelectedCampus] = useState<Campus>(
    (currentUser?.savedDeliveryArea as Campus) || 'UNILAG (Akoka)'
  );
  const [deliveryAreaNote, setDeliveryAreaNote] = useState('');
  const [buyerEmailInput, setBuyerEmailInput] = useState(currentUser?.email || '');
  const [couponInput, setCouponInput] = useState('');

  // Payment states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [activePublicKey, setActivePublicKey] = useState<string>(
    (import.meta as any).env?.VITE_FLW_PUBLIC_KEY || ''
  );
  const [awaitingExternalPayment, setAwaitingExternalPayment] = useState<{
    reference: string;
    authorizationUrl: string;
    assignedOrderId: string;
    expiresAt?: string;
    pricing: any;
  } | null>(null);

  useEffect(() => {
    if (isCheckoutModalOpen) {
      fetch('/api/payments/config')
        .then(r => r.json())
        .then(data => {
          if (data.publicKey) {
            setActivePublicKey(data.publicKey);
          }
        })
        .catch(() => {});
    }
  }, [isCheckoutModalOpen]);

  useEffect(() => {
    if (currentUser?.email) {
      setBuyerEmailInput(currentUser.email);
    }
  }, [currentUser?.email]);

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
  const isLiveMode = activePublicKey.startsWith('FLWPUBK-') && !activePublicKey.startsWith('FLWPUBK_TEST');

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    await applyCoupon(couponInput, subtotalItems + totalServiceFees);
  };

  const finalizeOrder = async (assignedOrderId: string) => {
    clearCart();
    removeCoupon();
    await refreshCurrentUser().catch(() => {});
    setIsProcessing(false);
    setProcessingStage('');
    setAwaitingExternalPayment(null);
    closeCheckoutModal();
    setActiveView('orders');
    notify(`Order #${assignedOrderId} payment confirmed and held in Escrow!`, 'success');
  };

  const pollVerification = async (
    reference: string,
    assignedOrderId: string,
    retriesLeft = 6
  ) => {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('shopit_session_token') : null;
      const res = await fetch(`/api/payments/verify/${encodeURIComponent(reference)}`, {
        headers: token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {},
        credentials: 'include',
      });
      const data = await res.json();

      if (data.isPaid === true) {
        await finalizeOrder(assignedOrderId);
        return;
      }

      if (data.expired === true) {
        setIsProcessing(false);
        setProcessingStage('');
        setAwaitingExternalPayment(null);
        notify('This 30-minute checkout session expired and reserved stock was released. Please start a fresh checkout.', 'error');
        return;
      }
    } catch {
      // ignore transient network glitch and retry
    }

    if (retriesLeft > 0) {
      setTimeout(() => {
        pollVerification(reference, assignedOrderId, retriesLeft - 1);
      }, 2500);
    } else {
      setIsProcessing(false);
      setProcessingStage('');
      notify('Awaiting gateway confirmation. Complete payment on Flutterwave and tap "Check Payment Status".', 'info');
    }
  };

  const handleCompletePayment = async () => {
    if (!paymentsEnabled) {
      notify('Online payments are coming soon. Arrange directly with the seller', 'info');
      return;
    }

    if (!currentUser) {
      notify('Please sign in or register an account before paying.', 'info');
      closeCheckoutModal();
      openAuthModal('login');
      return;
    }

    if (!deliveryAreaNote.trim()) {
      notify('Please enter your delivery pickup point or landmark.', 'error');
      return;
    }

    const cleanBuyerEmail = (buyerEmailInput || currentUser.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanBuyerEmail)) {
      notify('Please enter a valid email address for your payment receipt.', 'error');
      return;
    }

    setIsProcessing(true);
    setProcessingStage('1/3 Reserving stock & creating secure Flutterwave session...');

    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('shopit_session_token') : null;
      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          email: buyerEmailInput || currentUser.email,
          items: cart.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            deliveryMethod: item.deliveryMethod,
          })),
          campus: selectedCampus,
          deliveryArea: `${selectedCampus} · ${deliveryAreaNote}`,
          pickupPoint: deliveryAreaNote,
          couponCode: appliedCoupon?.code,
          paymentMethod,
        }),
      });

      const initData = await response.json();

      if (!response.ok || !initData.status) {
        throw new Error(initData.message || 'Payment initialization failed. Please try again.');
      }

      const payload = initData.data || initData;
      const reference = payload.reference;
      const assignedOrderId = payload.orderId;
      const pricing = payload.pricing;
      const authorizationUrl = payload.authorization_url || payload.authorizationUrl || payload.link || '';
      const pubKey = payload.publicKey || activePublicKey;

      if (pubKey) {
        setActivePublicKey(pubKey);
      }

      setIsProcessing(false);
      setProcessingStage('');
      setAwaitingExternalPayment({
        reference,
        authorizationUrl,
        assignedOrderId,
        expiresAt: payload.expiresAt,
        pricing,
      });

      if (authorizationUrl) {
        notify('Checkout session ready. Tap "Open Flutterwave Checkout" to pay securely, then verify status.', 'info');
      }
    } catch (err: any) {
      setIsProcessing(false);
      setProcessingStage('');
      notify(err.message || 'Payment initiation failed. Please try again.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-backdrop">
      <div className="bg-white dark:bg-[#15161C] rounded-3xl max-w-xl w-full p-5 sm:p-7 space-y-4 shadow-2xl relative my-6 border border-slate-200 dark:border-[#27272A] transition-colors animate-modal-enter">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272A] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F5A623] flex items-center justify-center text-[#111111] font-black text-sm shadow-xs border border-[#111111]">
              FW
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Flutterwave Escrow Checkout</h2>
                {isLiveMode ? (
                  <span className="text-[10px] font-black text-white bg-emerald-600 px-2 py-0.5 rounded-full border border-emerald-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    LIVE SECURE
                  </span>
                ) : (
                  <span className="text-[10px] font-black text-[#111111] bg-[#9FE870] px-2 py-0.5 rounded-full border border-[#111111]">
                    ESCROW SECURED
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

        {/* Gateway Hosted Checkout / Status Check Panel */}
        {awaitingExternalPayment && (
          <div className="p-4 sm:p-5 bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/40 dark:to-teal-950/30 border-2 border-emerald-400 dark:border-emerald-600 rounded-2xl space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60 dark:border-emerald-800/60">
              <span className="text-xs sm:text-sm font-black text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-[#9FE870] animate-spin" />
                <span>Complete Payment &amp; Verify Status</span>
              </span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                Ref: {awaitingExternalPayment.reference.slice(-8)}
              </span>
            </div>

            <div className="bg-white dark:bg-[#15161C] p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Order Reference</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{awaitingExternalPayment.assignedOrderId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Server Total Due</span>
                <span className="font-black font-mono-numbers text-emerald-600 dark:text-[#9FE870] text-base">
                  {formatNaira(awaitingExternalPayment.pricing?.grandTotalNaira || grandTotal)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
              Your items are reserved for 30 minutes. Complete payment securely via Flutterwave (Card, Bank Transfer, USSD, or OPay where enabled), then return here or tap Check Payment Status.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {awaitingExternalPayment.authorizationUrl && (
                <a
                  href={awaitingExternalPayment.authorizationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] font-black rounded-xl text-xs flex items-center gap-1.5 border border-[#111111] shadow-[0_2px_0_#111111] active:translate-y-0.5"
                >
                  <ExternalLink className="w-4 h-4 text-[#111111]" />
                  <span>Open Flutterwave Checkout</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsProcessing(true);
                  setProcessingStage('Checking server payment verification...');
                  pollVerification(
                    awaitingExternalPayment.reference,
                    awaitingExternalPayment.assignedOrderId,
                    3
                  );
                }}
                className="px-3.5 py-2.5 bg-white dark:bg-stone-900 text-slate-800 dark:text-white border border-slate-300 dark:border-stone-700 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer hover:bg-slate-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check Payment Status</span>
              </button>
            </div>
          </div>
        )}

        {/* Buyer Protection Card */}
        <div className="p-4 bg-gradient-to-r from-emerald-50/90 to-teal-50/70 dark:from-[#15161C] dark:to-[#1E2028] border-2 border-emerald-500/30 dark:border-emerald-600/40 rounded-2xl text-xs space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-emerald-950 dark:text-emerald-100">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-[#9FE870] shrink-0" />
              <span className="text-xs sm:text-sm font-extrabold tracking-tight">
                Shop It Buyer Protection
              </span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-[#9FE870] bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
              5-Day Hold
            </span>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Payments are processed by Flutterwave. Shop It holds your payment until you meet at the campus hub, inspect the craft, and tap <strong>&quot;Item received&quot;</strong>.
          </p>

          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-emerald-200/50 dark:border-emerald-900/50 text-[10px] text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Zero Card Storage</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Dispute Protection</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Verified Makers</span>
            </div>
          </div>
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
              Your Email Address (for Payment Receipt)
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
                  placeholder="Enter promo code"
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
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-900 dark:text-white">
              Preferred Payment Channel
            </label>
            <span className="text-[11px] text-slate-500 font-medium">PCI-DSS Level 1 Certified</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('flutterwave_card')}
              className={`p-2.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                paymentMethod === 'flutterwave_card'
                  ? 'border-[#111111] dark:border-white bg-[#111111] text-[#9FE870] shadow-[0_3px_0_#FF6B00]'
                  : 'border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#15161C] text-slate-700 dark:text-[#A1A1AA] hover:border-slate-400'
              }`}
            >
              <CreditCard className={`w-4 h-4 ${paymentMethod === 'flutterwave_card' ? 'text-[#9FE870]' : 'text-slate-500'}`} />
              <span className="text-xs font-black tracking-tight">Card</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${paymentMethod === 'flutterwave_card' ? 'bg-[#9FE870]/20 text-[#9FE870]' : 'bg-slate-100 dark:bg-stone-800 text-slate-500'}`}>
                Verve / Visa / MC
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('flutterwave_transfer')}
              className={`p-2.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                paymentMethod === 'flutterwave_transfer'
                  ? 'border-[#111111] dark:border-white bg-[#111111] text-[#9FE870] shadow-[0_3px_0_#FF6B00]'
                  : 'border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#15161C] text-slate-700 dark:text-[#A1A1AA] hover:border-slate-400'
              }`}
            >
              <Building2 className={`w-4 h-4 ${paymentMethod === 'flutterwave_transfer' ? 'text-[#9FE870]' : 'text-slate-500'}`} />
              <span className="text-xs font-black tracking-tight">Bank Transfer</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${paymentMethod === 'flutterwave_transfer' ? 'bg-[#9FE870]/20 text-[#9FE870]' : 'bg-slate-100 dark:bg-stone-800 text-slate-500'}`}>
                One-Time Account
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('flutterwave_ussd')}
              className={`p-2.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                paymentMethod === 'flutterwave_ussd'
                  ? 'border-[#111111] dark:border-white bg-[#111111] text-[#9FE870] shadow-[0_3px_0_#FF6B00]'
                  : 'border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#15161C] text-slate-700 dark:text-[#A1A1AA] hover:border-slate-400'
              }`}
            >
              <PhoneCall className={`w-4 h-4 ${paymentMethod === 'flutterwave_ussd' ? 'text-[#9FE870]' : 'text-slate-500'}`} />
              <span className="text-xs font-black tracking-tight">USSD</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${paymentMethod === 'flutterwave_ussd' ? 'bg-[#9FE870]/20 text-[#9FE870]' : 'bg-slate-100 dark:bg-stone-800 text-slate-500'}`}>
                Dial Code
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('flutterwave_opay')}
              className={`p-2.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                paymentMethod === 'flutterwave_opay'
                  ? 'border-[#111111] dark:border-white bg-[#111111] text-[#9FE870] shadow-[0_3px_0_#FF6B00]'
                  : 'border-slate-200 dark:border-[#27272A] bg-white dark:bg-[#15161C] text-slate-700 dark:text-[#A1A1AA] hover:border-slate-400'
              }`}
            >
              <Wallet className={`w-4 h-4 ${paymentMethod === 'flutterwave_opay' ? 'text-[#9FE870]' : 'text-slate-500'}`} />
              <span className="text-xs font-black tracking-tight">OPay</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${paymentMethod === 'flutterwave_opay' ? 'bg-[#9FE870]/20 text-[#9FE870]' : 'bg-slate-100 dark:bg-stone-800 text-slate-500'}`}>
                Wallet Checkout
              </span>
            </button>
          </div>

          <p className="text-[10px] text-slate-500 dark:text-[#A1A1AA] text-center pt-0.5">
            Payments are processed securely via Flutterwave. Zero card details are saved on our servers.
          </p>
        </div>

        {/* Final Price Breakdown (Server Authoritative) */}
        <div className="pt-3 border-t border-slate-200 dark:border-[#27272A] space-y-2 text-xs text-slate-600 dark:text-[#A1A1AA]">
          <div className="flex justify-between items-center">
            <span>Handmade Crafts Subtotal</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{formatNaira(subtotalItems)}</span>
          </div>
          <div className="flex justify-between items-center text-emerald-800 dark:text-[#9FE870]">
            <span>Shop It Buyer Escrow Protection</span>
            <span className="font-mono font-bold">+{formatNaira(totalServiceFees)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Campus Delivery / Safe Hub Pickup</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">+{formatNaira(deliveryTotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between items-center text-rose-600 dark:text-rose-400 font-semibold">
              <span>Coupon Discount ({appliedCoupon?.code})</span>
              <span className="font-mono font-bold">-{formatNaira(discountAmount)}</span>
            </div>
          )}

          <div className="pt-2.5 border-t border-slate-200 dark:border-[#27272A] flex justify-between items-baseline text-slate-900 dark:text-white">
            <div>
              <span className="text-sm font-black block">Total Payable via Flutterwave</span>
              <span className="text-[10px] text-slate-400">Includes all fees &amp; escrow security</span>
            </div>
            <span className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
              {formatNaira(grandTotal)}
            </span>
          </div>
        </div>

        {/* Safety Notice if payments are disabled */}
        {!paymentsEnabled && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-bold">
              Online payments are coming soon. Arrange directly with the seller
            </span>
          </div>
        )}

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
          disabled={isProcessing || emergencyControls?.pauseNewOrders || !paymentsEnabled}
          className="w-full h-12 bg-[#FF6B00] hover:bg-[#ff7a1a] disabled:bg-stone-300 disabled:border-stone-400 disabled:text-stone-500 disabled:shadow-none text-[#111111] font-black text-xs sm:text-sm rounded-xl transition-all border-2 border-[#111111] shadow-[0_3px_0_#111111] active:translate-y-0.5 active:shadow-[0_1px_0_#111111] flex items-center justify-center gap-2"
        >
          {!paymentsEnabled ? (
            <span className="font-bold text-center px-2">Online payments are coming soon. Arrange directly with the seller</span>
          ) : emergencyControls?.pauseNewOrders ? (
            <span className="font-bold">Checkout Temporarily Disabled by Moderation</span>
          ) : isProcessing ? (
            <div className="flex items-center gap-2 text-[#111111]">
              <div className="w-4 h-4 border-2 border-[#111111]/30 border-t-[#111111] rounded-full animate-spin shrink-0" />
              <span className="font-extrabold text-[11px] sm:text-xs tracking-tight truncate max-w-sm">
                {processingStage || 'Connecting to Flutterwave...'}
              </span>
            </div>
          ) : (
            <>
              <div className="w-5 h-5 rounded-md bg-[#9FE870] border border-[#111111] flex items-center justify-center text-[#111111]">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <span className="font-black text-[#111111]">Authorize &amp; Pay {formatNaira(grandTotal)}</span>
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
