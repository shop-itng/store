import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Order, OrderStatus } from '../types';
import { formatNaira } from '../utils/pricing';
import {
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Truck,
  ShieldCheck,
  Star,
  ArrowLeft,
  ChevronRight,
  Camera,
  MessageSquare,
  HelpCircle,
  CornerDownRight,
  ExternalLink,
  KeyRound,
  FileText,
} from 'lucide-react';
import { EscrowReceiptModal } from './EscrowReceiptModal';
import { OrderTrackingModal } from './OrderTrackingModal';

export const OrdersView: React.FC = () => {
  const {
    orders,
    confirmItemReceived,
    cancelOrder,
    openDispute,
    submitOrderReview,
    setActiveView,
    openProduct,
    openSellerShop,
    notify,
    openChat,
    openReportProblemModal,
  } = useApp();

  // Modal states for Dispute, Review, Safe Pass Receipt & Timeline Tracking
  const [selectedDisputeOrder, setSelectedDisputeOrder] = useState<Order | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [selectedReviewOrder, setSelectedReviewOrder] = useState<Order | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);

  // Return URL verification state (Part 1 Item 4)
  const [verifiedPaymentBanner, setVerifiedPaymentBanner] = useState<{
    reference: string;
    amount?: number;
    orderId?: string;
  } | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const ref =
      urlParams.get('payment_ref') ||
      urlParams.get('tx_ref') ||
      urlParams.get('ref') ||
      urlParams.get('reference') ||
      urlParams.get('trxref');
    const transactionId = urlParams.get('transaction_id');
    const trackId = urlParams.get('track') || urlParams.get('trackOrder');

    if (ref) {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('shopit_session_token') : null;
      const query = transactionId ? `?transaction_id=${encodeURIComponent(transactionId)}` : '';
      fetch(`/api/payments/verify/${encodeURIComponent(ref)}${query}`, {
        headers: token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {},
        credentials: 'include',
      })
        .then(res => res.json())
        .then(data => {
          if (data.isPaid === true) {
            setVerifiedPaymentBanner({
              reference: ref,
              amount: data.amountNaira,
              orderId: data.orderId,
            });
            notify('Payment confirmed via Flutterwave! Order verified and funds held in Escrow.', 'success');
          } else if (data.expired) {
            notify('Your 30-minute checkout window expired before payment settled. If you were debited, contact support with your reference.', 'error');
          }
        })
        .catch(() => {});
    }

    if (trackId) {
      const match = orders.find(o => o.id === trackId || o.id === `ORD-${trackId}`);
      if (match) {
        setTrackingOrder(match);
      }
    }
  }, [orders]);

  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all');

  const filteredOrders = orders.filter(ord => {
    if (activeTab === 'active') {
      return ord.status === 'pending_payment' || ord.status === 'paid' || ord.status === 'packed' || ord.status === 'shipped' || ord.status === 'delivered';
    }
    if (activeTab === 'completed') {
      return ord.status === 'completed' || ord.status === 'cancelled' || ord.status === 'refunded' || ord.status === 'disputed';
    }
    return true;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending_payment':
        return { label: 'Awaiting Payment', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'paid':
        return { label: 'Paid · In Escrow', color: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'packed':
        return { label: 'Packed & Verified', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'shipped':
        return { label: 'Dispatched to Campus', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
      case 'delivered':
        return { label: 'Delivered · Awaiting Confirmation', color: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' };
      case 'completed':
        return { label: 'Completed · Escrow Released', color: 'bg-slate-100 text-slate-800 border-slate-200' };
      case 'refunded':
        return { label: 'Refunded', color: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'cancelled':
        return { label: 'Cancelled & Refunded', color: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'disputed':
        return { label: 'Disputed · Escrow Frozen', color: 'bg-rose-100 text-rose-900 border-rose-300 font-bold' };
    }
  };

  const handleDisputeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDisputeOrder) return;
    openDispute(selectedDisputeOrder.id, disputeReason);
    setSelectedDisputeOrder(null);
    setDisputeReason('');
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReviewOrder) return;
    const firstProduct = selectedReviewOrder.items[0];
    if (firstProduct) {
      submitOrderReview(selectedReviewOrder.id, firstProduct.productId, reviewRating, reviewComment);
    }
    setSelectedReviewOrder(null);
    setReviewComment('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => setActiveView('catalog')}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-white transition-colors mb-2 min-h-[38px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Marketplace</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            My Orders & Escrow Tracking
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#A1A1AA] mt-0.5">
            Track handmade shipments, confirm delivery to release funds, or report an issue.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#1E2028] p-1.5 rounded-xl self-start sm:self-auto text-xs border border-slate-200 dark:border-[#27272A]">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg font-black transition-all ${
              activeTab === 'all'
                ? 'bg-[#111111] dark:bg-stone-800 text-[#9FE870] border-2 border-[#111111] dark:border-stone-700 shadow-[0_2px_0_#FF6B00]'
                : 'text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3.5 py-1.5 rounded-lg font-black transition-all ${
              activeTab === 'active'
                ? 'bg-[#111111] dark:bg-stone-800 text-[#9FE870] border-2 border-[#111111] dark:border-stone-700 shadow-[0_2px_0_#FF6B00]'
                : 'text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Active In-Transit
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3.5 py-1.5 rounded-lg font-black transition-all ${
              activeTab === 'completed'
                ? 'bg-[#111111] dark:bg-stone-800 text-[#9FE870] border-2 border-[#111111] dark:border-stone-700 shadow-[0_2px_0_#FF6B00]'
                : 'text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Past Orders
          </button>
        </div>
      </div>

      {/* Return URL Verified Payment Banner (Part 1 Item 4) */}
      {verifiedPaymentBanner && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-500 rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3 shadow-md animate-fade-in-up">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-xs space-y-1">
              <span className="font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider text-[10px] bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">
                Payment Verified by Flutterwave
              </span>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Transaction Confirmed · Funds Secured in Escrow
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                Reference: <code className="font-mono bg-white dark:bg-stone-800 px-1.5 py-0.5 rounded border border-emerald-200">{verifiedPaymentBanner.reference}</code>
                {verifiedPaymentBanner.orderId && ` · Order #${verifiedPaymentBanner.orderId}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setVerifiedPaymentBanner(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Orders List */}
      {filteredOrders.length > 0 ? (
        <div className="space-y-6">
          {filteredOrders.map((order, idx) => {
            const badge = getStatusBadge(order.status);
            const isCancellable = order.status === 'paid';
            const isDelivered = order.status === 'delivered';
            const isCompleted = order.status === 'completed';

            return (
              <div
                key={order.id}
                style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}
                className="card-lift card-stagger bg-white dark:bg-[#15161C] rounded-2xl border border-slate-200 dark:border-[#27272A] overflow-hidden shadow-xs space-y-4 p-5 sm:p-6"
              >
                {/* Order Top Bar: Reference & Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-[#27272A]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white font-mono tracking-wide">
                      {order.id}
                    </span>
                    <span className="text-slate-400 dark:text-[#71717A] text-xs">·</span>
                    <span className="text-xs text-slate-500 dark:text-[#A1A1AA] font-mono-numbers">
                      {new Date(order.createdAt).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-md border font-medium ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>

                {/* Tracking Progress Steps */}
                {order.status !== 'cancelled' && order.status !== 'disputed' && (
                  <div className="py-2">
                    <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                      {/* Step 1: Paid */}
                      <div className="space-y-1">
                        <div className="w-6 h-6 rounded-full bg-slate-900 dark:bg-stone-700 text-white flex items-center justify-center mx-auto text-xs font-bold">
                          ✓
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white block">Paid</span>
                        <span className="text-[10px] text-slate-400 dark:text-[#71717A]">Escrow held</span>
                      </div>

                      {/* Step 2: Packed */}
                      <div className="space-y-1">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto text-xs font-bold ${
                            order.status !== 'paid'
                              ? 'bg-slate-900 dark:bg-stone-700 text-white'
                              : 'bg-slate-100 dark:bg-[#1E2028] text-slate-400 dark:text-[#71717A]'
                          }`}
                        >
                          {order.status !== 'paid' ? '✓' : '2'}
                        </div>
                        <span
                          className={`block ${
                            order.status !== 'paid' ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-400 dark:text-[#71717A]'
                          }`}
                        >
                          Packed
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-[#71717A]">Photo verified</span>
                      </div>

                      {/* Step 3: Shipped */}
                      <div className="space-y-1">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto text-xs font-bold ${
                            order.status === 'shipped' ||
                            order.status === 'delivered' ||
                            order.status === 'completed'
                              ? 'bg-slate-900 dark:bg-stone-700 text-white'
                              : 'bg-slate-100 dark:bg-[#1E2028] text-slate-400 dark:text-[#71717A]'
                          }`}
                        >
                          {order.status === 'shipped' ||
                          order.status === 'delivered' ||
                          order.status === 'completed'
                            ? '✓'
                            : '3'}
                        </div>
                        <span
                          className={`block ${
                            order.status === 'shipped' ||
                            order.status === 'delivered' ||
                            order.status === 'completed'
                              ? 'font-semibold text-slate-900 dark:text-white'
                              : 'text-slate-400 dark:text-[#71717A]'
                          }`}
                        >
                          Shipped
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-[#71717A]">Campus rider</span>
                      </div>

                      {/* Step 4: Delivered */}
                      <div className="space-y-1">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto text-xs font-bold ${
                            order.status === 'delivered' || order.status === 'completed'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-[#1E2028] text-slate-400 dark:text-[#71717A]'
                          }`}
                        >
                          {order.status === 'completed' ? '✓' : '4'}
                        </div>
                        <span
                          className={`block ${
                            order.status === 'delivered' || order.status === 'completed'
                              ? 'font-semibold text-emerald-800 dark:text-[#9FE870]'
                              : 'text-slate-400 dark:text-[#71717A]'
                          }`}
                        >
                          Delivered
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-[#71717A]">Confirm craft</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Handshake PIN for Campus Handover (Phase 4) */}
                {order.status !== 'cancelled' && order.status !== 'completed' && (
                  <div className="p-3 bg-orange-50 dark:bg-[#1E2028] border border-orange-200 dark:border-[#FF6B00]/30 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-[#FF6B00] shrink-0" />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">Delivery Handshake PIN:</span>
                        <p className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">
                          Show this 4-digit code to seller or runner at your area safe spot upon craft inspection to unlock escrow.
                        </p>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-white dark:bg-[#15161C] border border-orange-300 dark:border-[#FF6B00] rounded-lg font-mono-numbers font-extrabold text-sm text-[#FF6B00] tracking-widest shadow-xs shrink-0">
                      {order.handshakeOtp || '7429'}
                    </div>
                  </div>
                )}

                {/* Packed Proof Photo (Seller uploaded before dispatch!) */}
                {order.packedPhotoUrl && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 text-xs">
                    <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0 border border-slate-300">
                      <img
                        src={order.packedPhotoUrl}
                        alt="Proof of packing"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5 text-slate-600" />
                        <span>Seller Packaging Verification</span>
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Uploaded by seller prior to dispatch as proof of complete order.
                      </p>
                    </div>
                  </div>
                )}

                {/* Disputed Notice (if applicable) */}
                {order.status === 'disputed' && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-950">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Dispute Under Review: </strong>
                      {order.disputeReason || 'Buyer reported an issue with this handmade order.'} Escrow payment is frozen safely until our student moderation team resolves the case.
                    </div>
                  </div>
                )}

                {/* Order Items */}
                <div className="space-y-3 pt-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex gap-3 text-xs">
                      <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4
                          onClick={() => openProduct(item.productId)}
                          className="font-bold text-slate-900 hover:underline cursor-pointer truncate"
                        >
                          {item.title}
                        </h4>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Shop:{' '}
                          <span
                            onClick={() => openSellerShop(item.sellerId)}
                            className="font-medium text-slate-700 hover:underline cursor-pointer"
                          >
                            {item.sellerShopName}
                          </span>{' '}
                          · {item.deliveryMethod === 'pickup' ? 'Pickup' : 'Hostel delivery'}
                        </div>
                        {(item.selectedColor || item.customNameText) && (
                          <div className="text-[11px] text-emerald-800 font-medium mt-0.5">
                            {item.selectedColor && `Color: ${item.selectedColor} `}
                            {item.customNameText && `· Name: "${item.customNameText}"`}
                          </div>
                        )}
                        <div className="text-xs font-mono-numbers font-bold text-slate-800 mt-1">
                          {item.quantity} × {formatNaira(item.displayPrice)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Delivery details and Receipt Summary */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between gap-2 text-xs text-slate-500">
                  <div>
                    <span>Delivery Location: </span>
                    <strong className="text-slate-800">{order.deliveryArea}</strong>
                  </div>
                  <div className="text-right">
                    <span>Total Paid (Escrow): </span>
                    <strong className="text-base text-slate-900 font-mono-numbers">
                      {formatNaira(order.grandTotal)}
                    </strong>
                  </div>
                </div>

                {/* Action Buttons: Confirm Received, Cancel, Dispute, Review */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                  {/* Cancel Order (Allowed before seller packs) */}
                  {isCancellable && (
                    <button
                      onClick={() => cancelOrder(order.id)}
                      className="px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-xl transition-colors border border-rose-200"
                    >
                      Cancel Order (Auto-Refund)
                    </button>
                  )}

                  {/* Track Order Timeline Button (Part 2 Item 6) */}
                  <button
                    type="button"
                    onClick={() => setTrackingOrder(order)}
                    className="px-3.5 py-2 text-xs font-black text-stone-900 dark:text-white bg-[#9FE870]/20 hover:bg-[#9FE870]/30 rounded-xl transition-all border-2 border-[#111111] dark:border-stone-700 shadow-[0_2px_0_#111111] active:translate-y-0.5 flex items-center gap-1.5"
                  >
                    <Truck className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Track Timeline</span>
                  </button>

                  {/* Safe Pass & Official Receipt */}
                  <button
                    type="button"
                    onClick={() => setSelectedReceiptOrder(order)}
                    className="px-3.5 py-2 text-xs font-black text-stone-900 bg-white hover:bg-stone-50 rounded-xl transition-all border-2 border-[#111111] shadow-[0_2px_0_#111111] active:translate-y-0.5 flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Safe Pass & Receipt</span>
                  </button>

                  {/* Chat with Artisan */}
                  <button
                    onClick={() => openChat(undefined, { orderId: order.id, sellerId: order.items[0]?.sellerId })}
                    className="px-3.5 py-2 text-xs font-black text-[#111111] hover:bg-[#9FE870]/20 rounded-xl transition-all border-2 border-[#111111] flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Chat with Artisan</span>
                  </button>

                  {/* Report Problem / Dispute */}
                  {order.status !== 'cancelled' && order.status !== 'disputed' && (
                    <button
                      onClick={() => openReportProblemModal(order.id)}
                      className="px-3 py-2 text-xs font-bold text-stone-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      Report a Problem
                    </button>
                  )}

                  {/* Confirm Item Received Button (Releases Escrow) */}
                  {isDelivered && (
                    <button
                      onClick={() => confirmItemReceived(order.id)}
                      className="px-4 py-2 bg-[#9FE870] hover:bg-[#aef084] text-[#111111] text-xs font-black rounded-xl transition-all border-2 border-[#111111] shadow-[0_3px_0_#111111] active:translate-y-0.5 active:shadow-[0_1px_0_#111111] flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#111111]" />
                      <span>Item Received · Release Payment</span>
                    </button>
                  )}

                  {/* Leave Review (Only for completed orders!) */}
                  {isCompleted && !order.hasReview && (
                    <button
                      onClick={() => setSelectedReviewOrder(order)}
                      className="px-4 py-2 bg-[#FF6B00] hover:bg-[#ff7a1a] text-[#111111] text-xs font-black rounded-xl transition-all border-2 border-[#111111] shadow-[0_3px_0_#111111] active:translate-y-0.5 flex items-center gap-1.5"
                    >
                      <Star className="w-3.5 h-3.5 text-[#111111] fill-[#111111]" />
                      <span>Leave Review for Artisan</span>
                    </button>
                  )}

                  {isCompleted && order.hasReview && (
                    <span className="text-xs text-emerald-800 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Review Submitted</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-4">
          <Package className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">No orders found</h2>
          <p className="text-xs text-slate-500">
            You don't have any orders in this tab. Start browsing handmade waist beads and dorm fragrances!
          </p>
          <button
            onClick={() => setActiveView('catalog')}
            className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
          >
            Explore Marketplace
          </button>
        </div>
      )}

      {/* Dispute Modal */}
      {selectedDisputeOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">
              Open Dispute on Order #{selectedDisputeOrder.id}
            </h3>
            <p className="text-xs text-slate-600">
              Money remains safely held in escrow. Our campus finance and moderation team will contact you and the seller within 24 hours.
            </p>
            <form onSubmit={handleDisputeSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  What is the issue with your item?
                </label>
                <textarea
                  rows={3}
                  required
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                  placeholder="e.g. Scent oil bottle arrived leaked, or bead sizing is wrong..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDisputeOrder(null)}
                  className="px-4 py-2 font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700"
                >
                  Submit Dispute (Freeze Funds)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal (Strict rule: Reviews only for completed orders) */}
      {selectedReviewOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">
              Rate Your Handmade Order
            </h3>
            <p className="text-xs text-slate-600">
              Your feedback is verified and helps other campus students discover authentic makers.
            </p>
            <form onSubmit={handleReviewSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= reviewRating
                            ? 'text-amber-500 fill-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-sm font-bold font-mono-numbers text-slate-800 ml-2">
                    {reviewRating} of 5 stars
                  </span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Comment on Craft Quality & Packaging
                </label>
                <textarea
                  rows={3}
                  required
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  placeholder="e.g. Beautiful waist beads! The string is strong and packaging was so cute."
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReviewOrder(null)}
                  className="px-4 py-2 font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800"
                >
                  Post Verified Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Escrow Safe Pass & Digital Receipt Modal */}
      <EscrowReceiptModal
        order={selectedReceiptOrder}
        isOpen={!!selectedReceiptOrder}
        onClose={() => setSelectedReceiptOrder(null)}
      />

      {/* Live Order Tracking Timeline Modal (Part 2 Item 6) */}
      <OrderTrackingModal
        order={trackingOrder}
        onClose={() => setTrackingOrder(null)}
        onConfirmReceived={confirmItemReceived}
        onReportIssue={openReportProblemModal}
      />
    </div>
  );
};
