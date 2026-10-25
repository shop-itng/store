import React from 'react';
import { useApp } from '../context/AppContext';
import { Compass, ShoppingBag, ShieldCheck, MessageSquare, MapPin, PlusCircle } from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const {
    activeView,
    setActiveView,
    cartCount,
    buyerActiveOrdersCount,
    conversations,
    currentUser,
    openQuickListModal,
  } = useApp();

  const totalUnreadMessages = conversations.reduce(
    (sum, c) => sum + (currentUser?.role === 'seller' ? c.unreadSeller : c.unreadBuyer),
    0
  );

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E4E4E7] shadow-lg">
      <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto px-1">
        {/* Tab 1: Marketplace */}
        <button
          onClick={() => setActiveView('catalog')}
          className={`flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeView === 'catalog' ? 'text-[#FF6B00] font-black' : 'text-[#71717A]'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Market</span>
        </button>

        {/* Tab 3: Sell Quick (for Sellers) or Buy Items (for Shoppers) */}
        {currentUser?.role === 'seller' ? (
          <button
            onClick={openQuickListModal}
            className="flex flex-col items-center justify-center min-h-[44px] group"
          >
            <div className="w-9 h-9 rounded-full bg-[#FF6B00] border-2 border-[#111111] text-[#111111] flex items-center justify-center shadow-[0_2px_0_#111111] active:translate-y-0.5 transition-transform relative">
              <PlusCircle className="w-5 h-5 text-[#111111]" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#9FE870] border border-[#111111]" />
            </div>
            <span className="text-[10px] mt-0.5 font-black text-[#111111]">Sell</span>
          </button>
        ) : (
          <button
            onClick={() => setActiveView('catalog')}
            className="flex flex-col items-center justify-center min-h-[44px] group"
          >
            <div className="w-9 h-9 rounded-full bg-[#9FE870] border-2 border-[#111111] text-[#111111] flex items-center justify-center shadow-[0_2px_0_#111111] active:translate-y-0.5 transition-transform relative">
              <ShoppingBag className="w-4 h-4 text-[#111111]" />
            </div>
            <span className="text-[10px] mt-0.5 font-black text-[#111111]">Buy</span>
          </button>
        )}

        {/* Tab 4: Chat */}
        <button
          onClick={() => setActiveView('chat')}
          className={`relative flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeView === 'chat' ? 'text-[#FF6B00] font-black' : 'text-[#71717A]'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          {totalUnreadMessages > 0 && (
            <span className="absolute top-1 right-2.5 w-4 h-4 rounded-full bg-[#FF6B00] text-white text-[10px] font-black flex items-center justify-center font-mono-numbers">
              {totalUnreadMessages}
            </span>
          )}
          <span className="text-[10px] mt-0.5">Chat</span>
        </button>

        {/* Tab 5: Orders */}
        <button
          onClick={() => setActiveView('orders')}
          className={`relative flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeView === 'orders' ? 'text-[#FF6B00] font-black' : 'text-[#71717A]'
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          {buyerActiveOrdersCount > 0 && (
            <span className="absolute top-1 right-2.5 w-4 h-4 rounded-full bg-[#111111] text-[#9FE870] text-[10px] font-black flex items-center justify-center font-mono-numbers">
              {buyerActiveOrdersCount}
            </span>
          )}
          <span className="text-[10px] mt-0.5">Orders</span>
        </button>

        {/* Tab 6: Bag */}
        <button
          onClick={() => setActiveView('cart')}
          className={`relative flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeView === 'cart' ? 'text-[#FF6B00] font-black' : 'text-[#71717A]'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          {cartCount > 0 && (
            <span className="absolute top-1 right-2.5 w-4 h-4 rounded-full bg-[#FF6B00] text-white text-[10px] font-black flex items-center justify-center font-mono-numbers">
              {cartCount}
            </span>
          )}
          <span className="text-[10px] mt-0.5">Cart</span>
        </button>
      </div>
    </nav>
  );
};
