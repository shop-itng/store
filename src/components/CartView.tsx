import React from 'react';
import { useApp } from '../context/AppContext';
import { formatNaira } from '../utils/pricing';
import {
  ArrowLeft,
  Trash2,
  ShoppingBag,
  ShieldCheck,
  Truck,
  Sparkles,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

export const CartView: React.FC = () => {
  const { cart, removeFromCart, setActiveView, openCheckoutModal, notify } = useApp();

  // Aggregate items by seller to combine delivery fees per seller!
  const sellersInCart = Array.from(new Set(cart.map(i => i.product.sellerShopName)));

  // Calculate totals
  const subtotalItems = cart.reduce((sum, item) => sum + item.product.sellerPrice * item.quantity, 0);
  const totalServiceFees = cart.reduce((sum, item) => sum + item.product.serviceFee * item.quantity, 0);

  // Group delivery fees by seller (combine delivery into 1 fee per seller as required in prompt)
  const deliveryTotal = sellersInCart.reduce((sum, sellerName) => {
    const sellerItems = cart.filter(i => i.product.sellerShopName === sellerName);
    const highestDeliveryFee = Math.max(
      ...sellerItems.map(i =>
        i.deliveryMethod === 'pickup'
          ? i.product.delivery.pickupFee
          : i.product.delivery.localDeliveryFee
      )
    );
    return sum + (highestDeliveryFee > 0 ? highestDeliveryFee : 200);
  }, 0);

  const grandTotal = subtotalItems + totalServiceFees + deliveryTotal;

  const handleCheckoutClick = () => {
    openCheckoutModal();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setActiveView('catalog')}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Continue Shopping</span>
        </button>

        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-slate-900" />
          <span>Shopping Bag ({cart.length})</span>
        </h1>
      </div>

      {cart.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Cart Items List */}
          <div className="md:col-span-7 space-y-4">
            {/* Delivery Bundling Notice (Prompt Rule: Combine delivery into 1 fee per seller) */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-900">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Smart Bundling: </strong>
                Delivery fees are grouped per artisan shop so you only pay one delivery charge per seller.
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
              {cart.map(item => (
                <div key={item.id} className="p-4 flex gap-4">
                  <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                    <img
                      src={item.product.images[0]}
                      alt={item.product.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {item.product.title}
                        </h3>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {item.product.sellerShopName} · {item.deliveryMethod === 'pickup' ? 'Campus Pickup' : 'Hostel Drop'}
                      </div>

                      {(item.selectedColor || item.customNameText) && (
                        <div className="text-[11px] text-emerald-800 font-medium mt-1">
                          {item.selectedColor && `Color: ${item.selectedColor} `}
                          {item.customNameText && `· Custom Name: "${item.customNameText}"`}
                        </div>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-slate-50">
                      <span className="text-xs text-slate-500">Qty: {item.quantity}</span>
                      <span className="text-sm font-extrabold text-slate-900 font-mono-numbers">
                        {formatNaira(item.product.displayPrice * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Checkout Breakdown (Prompt Rule: Checkout shows: Item price + Shop It service fee + delivery fee = Total) */}
          <div className="md:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              Order Summary
            </h2>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-mono-numbers font-medium text-slate-900">
                  {formatNaira(subtotalItems)}
                </span>
              </div>

              <div className="flex justify-between text-emerald-800">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Shop It Buyer Protection Fee</span>
                </span>
                <span className="font-mono-numbers font-medium">
                  +{formatNaira(totalServiceFees)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Campus Delivery / Pickup ({sellersInCart.length} seller{sellersInCart.length > 1 ? 's' : ''})</span>
                </span>
                <span className="font-mono-numbers font-medium text-slate-900">
                  +{formatNaira(deliveryTotal)}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline text-sm font-extrabold text-slate-900">
                <span>Total Amount</span>
                <span className="text-lg font-mono-numbers">{formatNaira(grandTotal)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckoutClick}
              className="w-full h-12 bg-[#FF6B00] hover:bg-[#ff7a1a] text-[#111111] font-black rounded-xl text-sm transition-all border-2 border-[#111111] shadow-[0_3px_0_#111111] active:translate-y-0.5 active:shadow-[0_1px_0_#111111] flex items-center justify-center gap-2"
            >
              <div className="w-5 h-5 rounded-md bg-[#9FE870] border border-[#111111] flex items-center justify-center text-[#111111]">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <span>Proceed to Escrow Checkout</span>
            </button>

            <div className="bg-[#111111] border-2 border-[#9FE870] rounded-xl p-3 text-[11px] text-white flex items-start gap-2 shadow-sm">
              <div className="w-4 h-4 rounded-full bg-[#9FE870] text-[#111111] flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-3 h-3" />
              </div>
              <span>
                Payment is held in Shop It escrow until you inspect your items. Dispute protection and locked chat active.
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-[#111111] p-12 text-center max-w-md mx-auto space-y-4 shadow-[0_4px_0_#111111]">
          <ShoppingBag className="w-12 h-12 text-[#FF6B00] mx-auto" />
          <h2 className="text-base font-black text-slate-900">Your bag is empty</h2>
          <p className="text-xs text-slate-500">
            Browse handmade waist beads, perfumes, crochet bags, fashion, and crafts from Nigerian teens and youth.
          </p>
          <button
            onClick={() => setActiveView('catalog')}
            className="px-6 py-2.5 bg-[#FF6B00] hover:bg-[#ff7a1a] text-[#111111] border-2 border-[#111111] shadow-[0_3px_0_#111111] active:translate-y-0.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 mx-auto"
          >
            <span className="w-2 h-2 rounded-full bg-[#9FE870] border border-[#111111]" />
            <span>Start Browsing Marketplace</span>
          </button>
        </div>
      )}
    </div>
  );
};
