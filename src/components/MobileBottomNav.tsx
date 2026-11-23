import React from 'react';
import { useApp } from '../context/AppContext';
import { Compass, ShoppingBag, ShieldCheck, MessageSquare, PlusCircle, User, Search } from 'lucide-react';

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
    (sum, c) => sum + (c.buyerId === currentUser?.id ? c.unreadBuyer : c.unreadSeller),
    0
  );

  const isOwnProfileActive =
    (activeView === 'profile' || activeView === 'seller_shop') &&
    Boolean(currentUser && (activeProfileSlug === currentUser.profileSlug || activeProfileSlug === currentUser.id));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0D0E12]/95 backdrop-blur-md border-t border-[#E4E4E7] dark:border-[#27272A] shadow-xl transition-all duration-200">
      <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto px-2">
        
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
            <span className="absolute top-1 right-3 w-4 h-4 rounded-full bg-[#FF6B00] text-white text-[10px] font-black flex items-center justify-center">
              {totalUnreadMessages}
            </span>
          )}
          <span className="text-[10px] mt-0.5">Chat</span>
        </button>

        {/* Tab 4: Cart */}
        <button
          onClick={() => setActiveView('cart')}
          className={`relative flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeView === 'cart' ? 'text-[#FF6B00] font-black' : 'text-[#71717A] dark:text-[#A1A1AA]'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          {cartCount > 0 && (
            <span className="absolute top-1 right-3 w-4 h-4 rounded-full bg-[#FF6B00] text-[#111111] text-[10px] font-black flex items-center justify-center">
              {cartCount}
            </span>
          )}
          <span className="text-[10px] mt-0.5">Cart</span>
        </button>

        {/* Tab 5: Profile / Me */}
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
              alt={currentUser.name || 'Profile'}
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
