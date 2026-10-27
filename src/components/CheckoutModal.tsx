import React, { useState } from 'react';
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
  Truck,
  MapPin,
  Clock,
  Sparkles,
  AlertCircle,
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
  const [deliveryAreaNote, setDeliveryAreaNote] = useState('New Hall Quad Hub / Moremi');
  const [hostelRoomNote, setHostelRoomNote] = useState('Room 312 (Couriers only)');
  const [couponInput, setCouponInput] = useState('');

  // Payment form states
  const [cardNumber, setCardNumber] = useState('5399 •••• •••• 4120');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvv, setCardCvv] = useState('912');
  const [cardPin, setCardPin] = useState('1234');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [transferConfirmed, setTransferConfirmed] = useState(false);

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

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    applyCoupon(couponInput, subtotalItems + totalServiceFees);
  };

  const handleCompletePayment = () => {
    setIsProcessing(true);
    setProcessingStage('1/3 Contacting Paystack Test Gateway (pk_test_...)...');

    setTimeout(() => {
      setProcessingStage('2/3 Awaiting Paystack Webhook (charge.success + HMAC SHA-512)...');
      setTimeout(() => {
        setProcessingStage('3/3 Verifying signature & committing to Seller Escrow Ledger...');
        setTimeout(() => {
          setIsProcessing(false);
          setProcessingStage('');

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

          const newOrder = placeOrder({
            buyerId: currentUser?.id || 'guest_buyer',
            buyerMaskedId: `Buyer #${Math.floor(1000 + Math.random() * 9000)}`,
            buyerName: currentUser?.name || 'Student Shopper',
            deliveryArea: `${selectedCampus} · ${deliveryAreaNote}`,
            pickupPoint: deliveryAreaNote,
            items: orderItems,
            itemsSubtotal: subtotalItems,
            serviceFeeTotal: totalServiceFees,
            deliveryTotal,
            discountTotal: discountAmount,
            couponCode: appliedCoupon?.code,
            grandTotal,
            status: 'paid',
            paymentMethod: paymentMethod === 'ussd' ? 'paystack_transfer' : paymentMethod,
            paymentReference: `PSTK_TEST_${Math.floor(100000 + Math.random() * 900000)}`,
          });

          closeCheckoutModal();
          setActiveView('orders');
        }, 600);
      }, 700);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#15161C] rounded-3xl max-w-xl w-full p-5 sm:p-8 space-y-5 shadow-2xl relative my-6 border border-slate-200 dark:border-[#27272A]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272A] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00C3F7] flex items-center justify-center text-[#111111] font-black text-sm shadow-xs">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Paystack Escrow Checkout</h2>
                <span className="text-[10px] font-black text-[#111111] bg-[#9FE870] px-2 py-0.5 rounded-full border border-[#111111]">
                  TEST MODE
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#A1A1AA]">
                Rule 1: Direct payment · No buyer wallet needed · Card never stored
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

        {/* Rule 1 Guarantee Banner */}
        <div className="p-3 bg-amber-50/70 dark:bg-[#1E2028] border border-amber-200 dark:border-amber-700/50 rounded-xl text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
            <ShieldCheck className="w-4 h-4 text-[#FF6B00]" />
            <span>Paystack Protected Checkout & Refund Guarantee</span>
          </div>
          <p className="text-[11px] text-amber-800 dark:text-[#A1A1AA] leading-relaxed">
            Buyers pay directly at checkout. We <strong>never store card details</strong>. If an order is canceled or returned, refunds are automatically credited back to your original payment method via Paystack.
          </p>
        </div>

        {/* Delivery / Campus Hub Selection */}
        <div className="space-y-3 bg-slate-50 dark:bg-[#1E2028] p-4 rounded-2xl border border-slate-200/90 dark:border-[#27272A] text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-[#9FE870]" />
              <span>Campus Delivery Destination</span>
            </span>
            <span className="text-slate-500 dark:text-[#A1A1AA] text-[11px]">Handled in-app</span>
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

          {/* Privacy Notice on exact delivery address */}
          <div className="p-2 bg-white dark:bg-[#15161C] rounded-lg border border-slate-200 dark:border-[#27272A] text-[11px] text-slate-500 dark:text-[#A1A1AA]">
            <strong>Anti-Bypass Privacy: </strong>
            The seller only sees your <strong>Buyer #ID</strong> and campus area (
            {selectedCampus}). Your private phone number and room number are never exposed to the seller.
          </div>
        </div>

        {/* Promo Code Input */}
        <div className="flex items-center gap-2">
          {appliedCoupon ? (
            <div className="flex-1 flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  <strong>{appliedCoupon.code}</strong> applied ({formatNaira(appliedCoupon.discountAmount)} off)
                </span>
              </div>
              <button
                type="button"
                onClick={removeCoupon}
                className="text-xs text-rose-600 hover:underline font-semibold"
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
                  placeholder="Promo Code (try: CAMPUSLOVE or FIRSTCRAFT)"
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-xs text-slate-900 uppercase"
                />
              </div>
              <button
                type="submit"
                className="px-4 h-10 bg-[#FF6B00] hover:bg-[#ff7a1a] text-[#111111] font-black rounded-xl text-xs border-2 border-[#111111] shadow-[0_2px_0_#111111] active:translate-y-0.5 transition-all shrink-0"
              >
                Apply
              </button>
            </form>
          )}
        </div>

        {/* Payment Gateway Options (Paystack or Flutterwave) */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-900 block">
            Select Payment Method
          </label>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('paystack_card')}
              className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 text-center transition-all ${
                paymentMethod === 'paystack_card'
                  ? 'border-[#111111] bg-[#111111] text-[#9FE870] shadow-[0_2px_0_#FF6B00]'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-[#111111]'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span className="text-xs font-black">Debit Card</span>
              <span className="text-[10px] opacity-75">Mastercard/Verve</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('paystack_transfer')}
              className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 text-center transition-all ${
                paymentMethod === 'paystack_transfer'
                  ? 'border-[#111111] bg-[#111111] text-[#9FE870] shadow-[0_2px_0_#FF6B00]'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-[#111111]'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span className="text-xs font-black">Bank Transfer</span>
              <span className="text-[10px] opacity-75">Titan / Wema Bank</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('ussd')}
              className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 text-center transition-all ${
                paymentMethod === 'ussd'
                  ? 'border-[#111111] bg-[#111111] text-[#9FE870] shadow-[0_2px_0_#FF6B00]'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-[#111111]'
              }`}
            >
              <PhoneCall className="w-4 h-4" />
              <span className="text-xs font-black">USSD</span>
              <span className="text-[10px] opacity-75">*737# / *919#</span>
            </button>
          </div>

          {/* Card Form Simulation */}
          {paymentMethod === 'paystack_card' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Card Number (Never stored on server)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={e => setCardNumber(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs font-mono-numbers text-slate-900"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    VERVE / VISA
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Expiry (MM/YY)
                  </label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={e => setCardExpiry(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs font-mono-numbers text-slate-900 text-center"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">CVV</label>
                  <input
                    type="password"
                    maxLength={3}
                    value={cardCvv}
                    onChange={e => setCardCvv(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs font-mono-numbers text-slate-900 text-center"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Simulated Virtual Bank Transfer */}
          {paymentMethod === 'paystack_transfer' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-700">
                <span>Transfer exact amount to:</span>
                <span className="font-extrabold text-slate-900 font-mono-numbers text-sm">
                  {formatNaira(grandTotal)}
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Bank Name</span>
                  <strong className="text-slate-900">Wema Bank / Paystack Titan</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Account Number</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-base font-mono-numbers text-emerald-800">
                      9948 2103 81
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText?.('9948210381');
                        notify('Account number copied!', 'success');
                      }}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded font-semibold text-slate-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Account Name</span>
                  <span className="font-medium text-slate-800">Shop It Escrow - Student Order</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Use your bank app or Opay to transfer. Your order will be confirmed in under 60 seconds.
              </p>
            </div>
          )}

          {/* USSD Simulation */}
          {paymentMethod === 'ussd' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <span className="font-bold text-slate-800 block">Dial USSD Code on your phone:</span>
              <div className="bg-white p-3 rounded-xl border border-slate-200 font-mono text-center text-sm font-bold text-slate-900 tracking-wider">
                *737*2*{grandTotal}*9948210381#
              </div>
              <p className="text-[11px] text-slate-500 text-center">
                Follow phone prompts to authorize via GTBank, Zenith or UBA.
              </p>
            </div>
          )}
        </div>

        {/* Final Price Breakdown (Prompt Rule: Item price + fee + delivery - coupon = Total) */}
        <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Items Subtotal</span>
            <span className="font-mono-numbers">{formatNaira(subtotalItems)}</span>
          </div>
          <div className="flex justify-between text-emerald-800">
            <span>Shop It Buyer Protection Fee</span>
            <span className="font-mono-numbers">+{formatNaira(totalServiceFees)}</span>
          </div>
          <div className="flex justify-between">
            <span>Campus Delivery / Pickup</span>
            <span className="font-mono-numbers">+{formatNaira(deliveryTotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-rose-700 font-semibold">
              <span>Coupon Discount ({appliedCoupon?.code})</span>
              <span className="font-mono-numbers">-{formatNaira(discountAmount)}</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline text-slate-900">
            <span className="text-sm font-bold">Total Amount to Pay</span>
            <span className="text-xl font-black font-mono-numbers text-slate-900">
              {formatNaira(grandTotal)}
            </span>
          </div>
        </div>

        {/* Emergency Pause Notice if activated by Moderator */}
        {emergencyControls?.pauseNewOrders && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Orders Temporarily Paused:</strong> Moderator has paused new checkouts for network verification. Please try again in a few minutes.
            </span>
          </div>
        )}

        {/* Pay Button */}
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
                {processingStage || 'Verifying Paystack Escrow Webhook...'}
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
        <div className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Payment held safely in escrow until you inspect your handmade craft.</span>
        </div>
      </div>
    </div>
  );
};
