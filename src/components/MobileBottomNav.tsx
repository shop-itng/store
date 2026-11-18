import React from 'react';
import { useApp } from '../context/AppContext';
import { Compass, ShoppingBag, ShieldCheck, MessageSquare, PlusCircle, User } from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const {
    activeView,
    setActiveView,
    cartCount,
    buyerActiveOrdersCount,
    conversations,
    currentUser,
    activeProfileSlug,
    openQuickListModal,
    openAuthModal,
    openProfile,
  } = useApp();

  const totalUnreadMessages = conversations.reduce(
    (sum, c) => sum + (currentUser?.role === 'seller' ? c.unreadSeller : c.unreadBuyer),
    0
  );

  const isOwnProfileActive =
    (activeView === 'profile' || activeView === 'seller_shop') &&
    Boolean(currentUser && (activeProfileSlug === currentUser.profileSlug || activeProfileSlug === currentUser.id));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0D0E12]/95 backdrop-blur-md border-t border-[#E4E4E7] dark:border-[#27272A] shadow-lg transition-colors duration-200">
      <div className="grid grid-cols-6 items-center h-16 max-w-lg mx-auto px-1">
        {/* Tab 1: Marketplace */}
        <button
          onClick={() => setActiveView('catalog')}
          className={`flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeView === 'catalog' ? 'text-[#FF6B00] font-black' : 'text-[#71717A] dark:text-[#A1A1AA]'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Market</span>
        </button>

        {/* Tab 2: Sell Quick */}
        <button
          onClick={() => {
            if (!currentUser) {
              openAuthModal('seller_register');
            } else {
              openQuickListModal();
            }
          }}
          className="flex flex-col items-center justify-center min-h-[44px] group"
        >
          <div className="w-8 h-8 rounded-full bg-[#FF6B00] border-2 border-[#111111] text-[#111111] flex items-center justify-center shadow-[0_2px_0_#111111] active:translate-y-0.5 transition-transform relative">
            <PlusCircle className="w-4 h-4 text-[#111111]" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#9FE870] border border-[#111111]" />
          </div>
          <span className="text-[10px] mt-0.5 font-black text-[#111111] dark:text-white">Sell</span>
        </button>

        {/* Tab 3: Chat */}
        <button
          onClick={() => setActiveView('chat')}
          className={`relative flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeView === 'chat' ? 'text-[#FF6B00] font-black' : 'text-[#71717A] dark:text-[#A1A1AA]'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          {totalUnreadMessages > 0 && (
            <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-[#FF6B00] text-white text-[10px] font-black flex items-center justify-center font-mono-numbers">
              {totalUnreadMessages}
            </span>
          )}
          <span className="text-[10px] mt-0.5">Chat</span>
        </button>

        {/* Tab 4: Orders */}
        <button
          onClick={() => setActiveView('orders')}
          className={`relative flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeView === 'orders' ? 'text-[#FF6B00] font-black' : 'text-[#71717A] dark:text-[#A1A1AA]'
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          {buyerActiveOrdersCount > 0 && (
            <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-[#111111] dark:bg-[#1E2028] text-[#9FE870] border border-stone-800 text-[10px] font-black flex items-center justify-center font-mono-numbers">
              {buyerActiveOrdersCount}
            </span>
          )}
          <span className="text-[10px] mt-0.5">Orders</span>
        </button>

        {/* Tab 5: Cart */}
        <button
          onClick={() => setActiveView('cart')}
          className={`relative flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeView === 'cart' ? 'text-[#FF6B00] font-black' : 'text-[#71717A] dark:text-[#A1A1AA]'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          {cartCount > 0 && (
            <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-[#FF6B00] text-[#111111] text-[10px] font-black flex items-center justify-center font-mono-numbers">
              {cartCount}
            </span>
          )}
          <span className="text-[10px] mt-0.5">Cart</span>
        </button>

        {/* Tab 6: Profile / Me */}
        <button
          onClick={() => {
            if (currentUser) {
              openProfile(currentUser.profileSlug || currentUser.id);
            } else {
              openAuthModal('login');
            }
          }}
          className={`relative flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            isOwnProfileActive ? 'text-[#FF6B00] font-black' : 'text-[#71717A] dark:text-[#A1A1AA]'
          }`}
        >
          {currentUser?.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.displayName || 'Profile'}
              className="w-5 h-5 rounded-full object-cover border border-[#FF6B00]"
            />
          ) : (
            <User className="w-5 h-5" />
          )}
          <span className="text-[10px] mt-0.5">{currentUser ? 'Me' : 'Sign In'}</span>
        </button>
      </div>
    </nav>
  );
};
