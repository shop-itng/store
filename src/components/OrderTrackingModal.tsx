import React from 'react';
import { Order } from '../types';
import { formatNaira } from '../utils/pricing';
import {
  X,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  ShieldCheck,
  MapPin,
  Camera,
  AlertTriangle,
  Lock,
} from 'lucide-react';

interface Props {
  order: Order | null;
  onClose: () => void;
  onConfirmReceived?: (orderId: string) => void;
  onReportIssue?: (orderId: string) => void;
}

export const OrderTrackingModal: React.FC<Props> = ({
  order,
  onClose,
  onConfirmReceived,
  onReportIssue,
}) => {
  if (!order) return null;

  const createdAtDate = new Date(order.createdAt);
  const packedDate = order.packedAt ? new Date(order.packedAt) : null;
  const shippedDate = order.shippedAt ? new Date(order.shippedAt) : null;
  const deliveredDate = order.deliveredAt ? new Date(order.deliveredAt) : null;
  const completedDate = order.completedAt ? new Date(order.completedAt) : null;

  const isStep1Done = true; // Paid & Escrow created
  const isStep2Done = Boolean(order.packedAt || order.status === 'packed' || order.status === 'shipped' || order.status === 'delivered' || order.status === 'completed');
  const isStep3Done = Boolean(order.shippedAt || order.status === 'shipped' || order.status === 'delivered' || order.status === 'completed');
  const isStep4Done = Boolean(order.deliveredAt || order.status === 'delivered' || order.status === 'completed');
  const isStep5Done = order.status === 'completed';

  const steps = [
    {
      step: 1,
      title: 'Order Placed & Escrow Created',
      desc: 'Payment confirmed via Flutterwave. Funds locked in secure Escrow.',
      time: createdAtDate.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      done: isStep1Done,
      active: order.status === 'paid',
      icon: ShieldCheck,
    },
    {
      step: 2,
      title: 'Packed & Verified by Artisan',
      desc: order.packedPhotoUrl ? 'Artisan packed and uploaded photographic verification.' : 'Seller is preparing your handmade item.',
      time: packedDate ? packedDate.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Pending packaging',
      done: isStep2Done,
      active: order.status === 'packed',
      icon: Package,
      hasPhoto: Boolean(order.packedPhotoUrl),
    },
    {
      step: 3,
      title: 'Dispatched & On The Way',
      desc: `Dispatched to ${order.deliveryArea || 'Campus Safe Zone'}.`,
      time: shippedDate ? shippedDate.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Pending dispatch',
      done: isStep3Done,
      active: order.status === 'shipped',
      icon: Truck,
    },
    {
      step: 4,
      title: 'Delivered to Safe Spot',
      desc: 'Package ready for buyer inspection at specified pickup/delivery point.',
      time: deliveredDate ? deliveredDate.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Estimated: 1-2 campus days',
      done: isStep4Done,
      active: order.status === 'delivered',
      icon: MapPin,
    },
    {
      step: 5,
      title: 'Item Received & Funds Released',
      desc: 'Buyer confirmed receipt or 5-day window auto-released funds to artisan.',
      time: completedDate ? completedDate.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Auto-release in 5 days if undisputed',
      done: isStep5Done,
      active: isStep5Done,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-backdrop">
      <div className="bg-white dark:bg-[#15161C] rounded-3xl max-w-lg w-full p-5 sm:p-7 space-y-5 shadow-2xl relative my-6 border-2 border-[#111111] dark:border-[#27272A] transition-colors animate-modal-enter">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272A] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#111111] text-[#9FE870] border border-[#FF6B00] flex items-center justify-center font-black">
              <Truck className="w-5 h-5 text-[#9FE870]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-white">Order Tracking Timeline</h2>
                <span className="text-[11px] font-mono font-bold text-[#FF6B00] bg-[#FFF4EC] dark:bg-stone-800 px-2 py-0.5 rounded-md border border-[#FF6B00]/30">
                  #{order.id}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#A1A1AA]">
                Live delivery progress · Funds secured in Shop It Escrow
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-[#1E2028]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Item Quick Summary */}
        <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            {order.items[0]?.image && (
              <img
                src={order.items[0].image}
                alt={order.items[0].title}
                className="w-11 h-11 rounded-lg object-cover border border-stone-300 dark:border-stone-700 shrink-0"
              />
            )}
            <div>
              <p className="font-bold text-slate-900 dark:text-white line-clamp-1">
                {order.items.map(i => `${i.quantity}x ${i.title}`).join(', ')}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-stone-400">
                Seller: {order.items[0]?.sellerShopName || 'Artisan Shop'}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="font-black text-slate-900 dark:text-white font-mono-numbers">
              {formatNaira(order.grandTotal)}
            </span>
            <span className="block text-[10px] text-emerald-600 font-bold">Escrow Protected</span>
          </div>
        </div>

        {/* Packed photo preview if available */}
        {order.packedPhotoUrl && (
          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-xl flex items-center gap-3">
            <img
              src={order.packedPhotoUrl}
              alt="Artisan Packaging Verification"
              className="w-14 h-14 rounded-lg object-cover border border-blue-300 dark:border-blue-700 shrink-0"
            />
            <div className="text-xs">
              <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1">
                <Camera className="w-3.5 h-3.5" />
                <span>Verified Packaging Photo</span>
              </span>
              <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5">
                The seller captured this real photo when sealing your parcel for delivery.
              </p>
            </div>
          </div>
        )}

        {/* Timeline Steps */}
        <div className="space-y-4 py-1">
          {steps.map((st, i) => {
            const Icon = st.icon;
            return (
              <div key={st.step} className="flex gap-3 relative">
                {/* Connecting line */}
                {i < steps.length - 1 && (
                  <div
                    className={`absolute left-4 top-8 bottom-0 w-0.5 ${
                      st.done ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-stone-700'
                    }`}
                  />
                )}

                {/* Circle Icon */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2 transition-all ${
                    st.done
                      ? 'bg-emerald-500 border-emerald-600 text-white shadow-xs'
                      : st.active
                      ? 'bg-[#FF6B00] border-[#111111] text-[#111111] animate-pulse shadow-xs'
                      : 'bg-slate-100 dark:bg-stone-800 border-slate-300 dark:border-stone-700 text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {/* Step Info */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center justify-between">
                    <h3
                      className={`text-xs font-bold ${
                        st.done || st.active ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-stone-500'
                      }`}
                    >
                      {st.title}
                    </h3>
                    <span className="text-[10px] text-slate-400 dark:text-stone-500 font-mono">
                      {st.time}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-stone-400 mt-0.5 leading-snug">
                    {st.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-100 dark:border-[#27272A] flex flex-wrap items-center justify-between gap-2.5">
          {order.status === 'delivered' && onConfirmReceived && (
            <button
              onClick={() => {
                onConfirmReceived(order.id);
                onClose();
              }}
              className="px-4 py-2.5 bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] border-2 border-[#111111] text-xs font-black rounded-xl transition-all shadow-[0_2px_0_#111111] flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm Item Received</span>
            </button>
          )}

          {order.status !== 'completed' && order.status !== 'cancelled' && onReportIssue && (
            <button
              onClick={() => {
                onReportIssue(order.id);
                onClose();
              }}
              className="px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-rose-200 dark:border-rose-800/40"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Report Delivery Issue</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 bg-slate-100 dark:bg-stone-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
