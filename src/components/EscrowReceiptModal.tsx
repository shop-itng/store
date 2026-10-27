import React, { useState } from 'react';
import { Order } from '../types';
import { formatNaira } from '../utils/pricing';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Printer,
  Copy,
  Check,
  X,
  QrCode,
  MapPin,
  Calendar,
  Building2,
  FileText,
  AlertCircle,
  HelpCircle,
  KeyRound,
} from 'lucide-react';

interface EscrowReceiptModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EscrowReceiptModal: React.FC<EscrowReceiptModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  if (!isOpen || !order) return null;

  const handleCopyOtp = () => {
    if (!order.handshakeOtp) return;
    navigator.clipboard.writeText(order.handshakeOtp);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 2000);
  };

  const handleCopyRef = () => {
    navigator.clipboard.writeText(order.paymentReference || order.id);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const isCompleted = order.status === 'completed';
  const isHeldInEscrow = order.status === 'paid' || order.status === 'packed' || order.status === 'shipped' || order.status === 'delivered';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
      <div className="relative max-w-lg w-full bg-white rounded-3xl overflow-hidden shadow-2xl border-2 border-[#111111] my-8 animate-in fade-in zoom-in-95 duration-150 print:border-none print:shadow-none print:m-0 print:max-w-none">
        {/* Top Decorative Escrow Banner */}
        <div className="bg-[#111111] text-white p-5 sm:p-6 border-b-2 border-[#111111] relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-[#9FE870]/10 pointer-events-none" />
          
          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <img
                src="/shopit-logo.png"
                alt="Shop It"
                className="w-10 h-10 rounded-xl object-contain border border-[#9FE870] shadow-xs shrink-0"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-black tracking-tight text-white">
                    Shop It Safe Escrow Pass
                  </h3>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#9FE870] text-[#111111]">
                    OFFICIAL
                  </span>
                </div>
                <p className="text-[11px] text-stone-300 font-mono">
                  Certificate #{order.id}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors print:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 text-stone-900">
          {/* Handshake OTP Security Box */}
          <div className="bg-amber-50 rounded-2xl p-4 border-2 border-amber-300 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-[#FF6B00]" />
                <span>4-Digit Handshake OTP</span>
              </span>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-md">
                DO NOT SHARE EARLY
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-amber-300 shadow-2xs">
              <div className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-[#111111]">
                {order.handshakeOtp || '4912'}
              </div>
              <button
                type="button"
                onClick={handleCopyOtp}
                className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-800 transition-colors flex items-center gap-1 print:hidden"
              >
                {copiedOtp ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy OTP</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-amber-900 leading-relaxed">
              <strong>Campus Safety Rule:</strong> Only give this 4-digit code to the artisan or courier <em>after</em> you have physically inspected your craft in daylight. Once entered, escrow payment is instantly released to the seller.
            </p>
          </div>

          {/* Escrow Vault Status Badge */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-stone-900 block">
                  {isCompleted ? 'Escrow Vault Settled' : 'Funds Secured in Escrow Vault'}
                </span>
                <span className="text-[11px] text-stone-500">
                  {isCompleted
                    ? 'Payment has been released to the artisan.'
                    : '100% money-back guarantee until you confirm receipt.'}
                </span>
              </div>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isCompleted
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-[#9FE870] text-[#111111]'
            }`}>
              {order.status.toUpperCase()}
            </span>
          </div>

          {/* Order Details List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-stone-200 font-bold">
              <span>Item & Craft Summary</span>
              <span>Subtotal</span>
            </div>

            <div className="divide-y divide-stone-100 max-h-48 overflow-y-auto text-xs">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-10 h-10 rounded-lg object-cover border border-stone-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-stone-900 truncate">{item.title}</p>
                      <p className="text-[11px] text-stone-500">
                        {item.quantity}x by <strong className="text-stone-700">{item.sellerShopName}</strong>
                      </p>
                      {(item.selectedColor || item.customNameText) && (
                        <p className="text-[10px] text-[#FF6B00] font-semibold">
                          {item.selectedColor && `Color: ${item.selectedColor} `}
                          {item.customNameText && `· Name: "${item.customNameText}"`}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="font-mono-numbers font-bold text-stone-900 shrink-0">
                    {formatNaira(item.displayPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Price Calculations */}
            <div className="pt-2 border-t border-stone-200 space-y-1.5 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-mono-numbers">{formatNaira(order.itemsSubtotal)}</span>
              </div>
              <div className="flex justify-between text-emerald-800">
                <span>Shop It Protection Fee (Escrow Insurance)</span>
                <span className="font-mono-numbers">+{formatNaira(order.serviceFeeTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Campus Delivery / Handoff Fee</span>
                <span className="font-mono-numbers">+{formatNaira(order.deliveryTotal)}</span>
              </div>
              {order.discountTotal > 0 && (
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>Coupon Discount</span>
                  <span className="font-mono-numbers">-{formatNaira(order.discountTotal)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline font-black text-sm text-stone-950">
                <span>Total Escrow Amount</span>
                <span className="text-lg font-mono-numbers text-[#111111]">
                  {formatNaira(order.grandTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Delivery & Security Audit Trail */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-stone-500 block">Delivery Area</span>
                <strong className="text-stone-900 block truncate">{order.deliveryArea}</strong>
              </div>
              <div>
                <span className="text-stone-500 block">Payment Date</span>
                <strong className="text-stone-900 block">
                  {new Date(order.createdAt).toLocaleDateString()} · {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </strong>
              </div>
              <div>
                <span className="text-stone-500 block">Paystack Reference</span>
                <div className="flex items-center gap-1">
                  <code className="text-stone-800 font-mono text-[10px] truncate">
                    {order.paymentReference || 'pstk_ref_auto'}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyRef}
                    className="text-stone-500 hover:text-stone-900 print:hidden"
                  >
                    {copiedRef ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <div>
                <span className="text-stone-500 block">Auto-Release Due</span>
                <strong className="text-stone-900 block">
                  {order.status === 'completed'
                    ? 'Settled'
                    : new Date(order.autoReleaseAt).toLocaleDateString()}
                </strong>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-stone-200 flex items-center justify-between gap-3 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl border-2 border-stone-300 hover:bg-stone-100 text-xs font-bold text-stone-800 transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save Receipt</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-stone-950 hover:bg-black text-white text-xs font-black transition-all shadow-md active:scale-95"
            >
              Done
            </button>
          </div>
        </div>

        {/* Footer print watermark */}
        <div className="bg-stone-50 px-6 py-2 border-t border-stone-200 text-center text-[10px] text-stone-400">
          Shop It Escrow Protocol · NIMC Verified · Paystack Test Protected
        </div>
      </div>
    </div>
  );
};
