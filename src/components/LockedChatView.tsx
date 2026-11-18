import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Send,
  Lock,
  ArrowLeft,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
  Tag,
  CheckCircle2,
  X,
  Flag,
} from 'lucide-react';
import { checkNumbersInText, PRESET_PRICES, PRESET_QUANTITIES } from '../utils/antiBypass';
import { ChatMessage } from '../types';
import { ReportModal, ReportTarget } from './ReportModal';
import { UserIdentityBadge } from './UserIdentityBadge';

export const LockedChatView: React.FC = () => {
  const {
    currentUser,
    conversations,
    messages,
    activeConversationId,
    setActiveConversationId,
    loadConversationMessages,
    sendMessage,
    setActiveView,
    openCheckoutModal,
    openAuthModal,
    addToCart,
    paymentsEnabled,
    products,
    notify,
  } = useApp();

  const [inputContent, setInputContent] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [selectedPrice, setSelectedPrice] = useState<number>(1000);
  const [showOfferPicker, setShowOfferPicker] = useState<boolean>(false);
  const [numberWarning, setNumberWarning] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find(c => c.id === activeConversationId) || conversations[0];
  const activeMessages = activeConv ? messages[activeConv.id] || [] : [];

  const matchedProduct = activeConv?.productId
    ? products.find(p => p.id === activeConv.productId)
    : undefined;

  useEffect(() => {
    if (activeConv?.id && currentUser?.id) {
      void loadConversationMessages(activeConv.id);
    }
  }, [activeConv?.id, currentUser?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  const getCounterpartInfo = (conv: typeof activeConv) => {
    if (!conv) {
      return {
        userId: undefined,
        profileSlug: undefined,
        displayName: 'Member',
        avatarUrl: undefined,
      };
    }
    const sellerIds = [currentUser?.id, currentUser?.sellerProfile?.id].filter(Boolean);
    const isSellerInThread = sellerIds.includes(conv.sellerId) && currentUser?.role === 'seller';
    if (isSellerInThread) {
      return {
        userId: conv.buyerId,
        profileSlug: conv.buyerProfileSlug,
        displayName: conv.buyerDisplayName || 'Buyer',
        avatarUrl: conv.buyerAvatarUrl,
      };
    }
    return {
      userId: conv.sellerId,
      profileSlug: conv.sellerProfileSlug,
      displayName: conv.sellerShopName || conv.sellerDisplayName || 'Maker',
      avatarUrl: conv.sellerAvatarUrl,
    };
  };

  const getCounterpartLabel = (conv: typeof activeConv) => getCounterpartInfo(conv).displayName;

  // Real-time live scanning while typing to prevent typing digits or number words
  const handleInputChange = (text: string) => {
    setInputContent(text);
    const check = checkNumbersInText(text);
    if (check.hasNumber) {
      setNumberWarning(
        `Numbers and number words are blocked in chat. Use the preset price and quantity chips below!`
      );
    } else {
      setNumberWarning(null);
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() || !activeConv || sending) return;

    const check = checkNumbersInText(inputContent);
    if (check.hasNumber) {
      notify('Numbers and number words are blocked in chat. Use the preset buttons below.', 'error');
      return;
    }

    setSending(true);
    const res = await sendMessage(activeConv.id, inputContent.trim());
    setSending(false);
    if (res.success) {
      setInputContent('');
      setNumberWarning(null);
    }
  };

  const handleSendOffer = async () => {
    if (!activeConv || sending) return;
    const itemTitle = matchedProduct?.title || activeConv.productTitle || 'Item';
    const totalAmount = selectedPrice * selectedQuantity;

    const offerSummary = `Offer Proposed: ${selectedQuantity} unit(s) at preset price of ₦${selectedPrice.toLocaleString()} each (Total: ₦${totalAmount.toLocaleString()})`;

    setSending(true);
    const res = await sendMessage(
      activeConv.id,
      offerSummary,
      undefined,
      {
        price: selectedPrice,
        quantity: selectedQuantity,
        title: itemTitle,
      }
    );
    setSending(false);

    if (res.success) {
      setShowOfferPicker(false);
      notify(`Offer of ₦${selectedPrice.toLocaleString()} (Qty: ${selectedQuantity}) sent!`, 'success');
    }
  };

  const handleAcceptOffer = async (msg: ChatMessage) => {
    if (!msg.presetOffer || !activeConv) return;
    if (!currentUser) {
      openAuthModal('login');
      return;
    }

    let targetProduct = matchedProduct;
    if (!targetProduct && activeConv.productId) {
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(activeConv.productId)}`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (data.status && data.product) {
          targetProduct = data.product;
        }
      } catch {
        // handled below
      }
    }

    if (!targetProduct) {
      notify('No active product listing is linked to this chat yet. Ask the seller to share their listing first.', 'error');
      return;
    }

    if (targetProduct.isSoldOut || targetProduct.stock <= 0) {
      notify('This item is currently sold out.', 'error');
      return;
    }

    const qty = Math.max(1, Math.min(msg.presetOffer.quantity || 1, targetProduct.stock));
    addToCart({
      id: `cart_offer_${Date.now()}`,
      product: targetProduct,
      quantity: qty,
      deliveryMethod: 'pickup',
    });

    if (
      msg.presetOffer.price !== targetProduct.displayPrice &&
      msg.presetOffer.price !== targetProduct.sellerPrice
    ) {
      notify(
        `Added to bag! Escrow checkout uses the verified listing price (₦${targetProduct.displayPrice.toLocaleString()}). Ask the seller to update the listing price if a discount was agreed.`,
        'info'
      );
    }

    if (paymentsEnabled) {
      openCheckoutModal();
    } else {
      setActiveView('cart');
    }
  };

  // Quick message chips without numbers
  const quickMessages = [
    'Is this item still available?',
    'Can you deliver to my area?',
    'I want to pay with Escrow protection',
    'Item received in good condition, thanks!',
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-[#111111] dark:text-[#F4F4F5]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setActiveView('catalog')}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#52525B] dark:text-[#A1A1AA] hover:text-[#FF6B00] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </button>

        <div className="flex items-center gap-1 text-[11px] font-bold text-[#111111] bg-[#9FE870] px-3 py-1 rounded-full shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-[#111111]" />
          <span>Escrow Protected Chat</span>
        </div>
      </div>

      <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] overflow-hidden shadow-xs grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
        {/* Left: Conversations list */}
        <div className="md:col-span-4 border-r border-[#E4E4E7] dark:border-[#27272A] flex flex-col bg-[#FAFAFA] dark:bg-[#0D0E12]">
          <div className="p-4 border-b border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#15161C]">
            <h2 className="text-sm font-black text-[#111111] dark:text-white">Messages</h2>
            <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA] mt-0.5">
              Chats with numbers are blocked to prevent off-platform scams.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {conversations.length > 0 ? (
              conversations.map(conv => {
                const isSelected = activeConv?.id === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    className={`p-3 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white dark:bg-[#1E2028] ring-2 ring-[#FF6B00] shadow-xs'
                        : 'hover:bg-[#F4F4F5] dark:hover:bg-[#15161C]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#111111] dark:text-white truncate">
                        {getCounterpartLabel(conv)}
                      </span>
                      <span className="text-[10px] text-[#A1A1AA] shrink-0">{conv.lastMessageAt}</span>
                    </div>
                    <p className="text-xs text-[#52525B] dark:text-[#D4D4D8] truncate font-medium">{conv.productTitle}</p>
                    <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA] truncate mt-1">{conv.lastMessage}</p>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-[#71717A] dark:text-[#A1A1AA] text-xs">
                <MessageSquare className="w-8 h-8 text-[#D4D4D8] dark:text-[#3F3F46] mx-auto mb-2" />
                <p className="font-bold text-[#111111] dark:text-white">No active chats yet</p>
                <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA] mt-1">
                  Click "Ask Seller" on any item or shop to start an escrow-protected chat.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Active Chat Window */}
        <div className="md:col-span-8 flex flex-col bg-white dark:bg-[#15161C]">
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="p-3.5 border-b border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between bg-white dark:bg-[#15161C]">
                <div className="min-w-0">
                  <UserIdentityBadge
                    userId={getCounterpartInfo(activeConv).userId}
                    profileSlug={getCounterpartInfo(activeConv).profileSlug}
                    displayName={getCounterpartInfo(activeConv).displayName}
                    avatarUrl={getCounterpartInfo(activeConv).avatarUrl}
                    subtitle={`Re: ${activeConv.productTitle || 'Order Inquiry'}`}
                    size="sm"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setReportTarget({
                        targetType: 'chat',
                        targetId: activeConv.id,
                        targetTitle: `Chat with ${getCounterpartLabel(activeConv)} (Re: ${activeConv.productTitle})`,
                      })
                    }
                    className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-stone-100 dark:hover:bg-[#1E2028] transition-colors flex items-center gap-1 text-[11px] font-bold whitespace-nowrap"
                    title="Report Conversation"
                  >
                    <Flag className="w-3.5 h-3.5 text-rose-500" />
                    <span className="hidden sm:inline text-rose-600">Report</span>
                  </button>

                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#111111] bg-[#FFF4EC] border border-[#FED7AA] px-2.5 py-1 rounded-lg whitespace-nowrap">
                    <Lock className="w-3 h-3 text-[#FF6B00]" />
                    <span>Numbers Blocked</span>
                  </div>
                </div>
              </div>

              {/* Security Rule Notice Banner */}
              <div className="px-3.5 py-2 bg-[#FBFBFC] dark:bg-[#1E2028] border-b border-[#E4E4E7] dark:border-[#27272A] text-[11px] text-[#52525B] dark:text-[#A1A1AA] flex items-center justify-between gap-2">
                <span>
                  <strong>Rule:</strong> Digits and number words are blocked in text. Use preset chips to propose offers!
                </span>
                <button
                  type="button"
                  onClick={() => setShowOfferPicker(!showOfferPicker)}
                  className="px-3 py-1 bg-[#FF6B00] hover:bg-[#E55E00] text-white text-[10px] font-black rounded-lg transition-colors shadow-2xs whitespace-nowrap shrink-0"
                >
                  {showOfferPicker ? 'Close Offer' : '+ Make Offer'}
                </button>
              </div>

              {/* Preset Price & Quantity Picker Panel */}
              {showOfferPicker && (
                <div className="p-4 bg-[#FFF4EC] dark:bg-[#1E2028] border-b border-[#FED7AA] dark:border-[#27272A] space-y-3.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#111111] dark:text-white flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-[#FF6B00]" />
                      <span>Select Preset Offer (Never Typed)</span>
                    </span>
                    <button
                      onClick={() => setShowOfferPicker(false)}
                      className="text-[#71717A] hover:text-[#111111] dark:hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quantity Chips */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#111111] dark:text-white mb-1">
                      1. Pick Quantity:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_QUANTITIES.map(qty => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setSelectedQuantity(qty)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                            selectedQuantity === qty
                              ? 'bg-[#111111] text-white border-[#111111]'
                              : 'bg-white text-[#111111] border-[#FED7AA] hover:bg-white/80'
                          }`}
                        >
                          {qty} {qty === 1 ? 'unit' : 'units'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price Chips */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#111111] dark:text-white mb-1">
                      2. Pick Preset Unit Price (₦):
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_PRICES.map(price => (
                        <button
                          key={price}
                          type="button"
                          onClick={() => setSelectedPrice(price)}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                            selectedPrice === price
                              ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-xs'
                              : 'bg-white text-[#111111] border-[#FED7AA] hover:bg-white/80'
                          }`}
                        >
                          ₦{price.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary & Submit */}
                  <div className="pt-2 border-t border-[#FED7AA] dark:border-[#27272A] flex items-center justify-between">
                    <div className="text-xs">
                      <span className="text-[#71717A] dark:text-[#A1A1AA]">Total Escrow Offer: </span>
                      <strong className="text-[#111111] dark:text-white text-sm font-black">
                        ₦{(selectedPrice * selectedQuantity).toLocaleString()}
                      </strong>
                    </div>

                    <button
                      type="button"
                      disabled={sending}
                      onClick={handleSendOffer}
                      className="px-4 py-2 bg-[#FF6B00] hover:bg-[#E55E00] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{sending ? 'Sending...' : 'Send Preset Offer'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Messages Feed */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FBFBFC] dark:bg-[#0D0E12]">
                {activeMessages.map(msg => {
                  const isMe = Boolean(
                    currentUser &&
                      (msg.senderId === currentUser.id ||
                        (msg.senderId === currentUser.sellerProfile?.id) ||
                        msg.senderRole === (currentUser.role === 'seller' ? 'seller' : 'buyer'))
                  );
                  const isSystem = msg.senderRole === 'system';

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="text-center my-2">
                        <span className="inline-block px-3 py-1 bg-[#F4F4F5] dark:bg-[#1E2028] text-[#52525B] dark:text-[#D4D4D8] rounded-full text-[11px] font-medium border border-[#E4E4E7] dark:border-[#27272A]">
                          {msg.content}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[10px] text-[#71717A] dark:text-[#A1A1AA] mb-0.5 px-1 font-medium">
                        {msg.senderDisplayName} · {msg.timestamp}
                      </span>

                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                          isMe
                            ? 'bg-[#111111] text-white rounded-br-none shadow-xs border border-[#27272A]'
                            : 'bg-white dark:bg-[#15161C] text-[#111111] dark:text-white border border-[#E4E4E7] dark:border-[#27272A] rounded-bl-none shadow-xs'
                        }`}
                      >
                        {/* Text Content */}
                        <p className="whitespace-pre-wrap">{msg.content}</p>

                        {/* Preset Offer Card */}
                        {msg.presetOffer && (
                          <div
                            className={`mt-2.5 p-3 rounded-xl border ${
                              isMe
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-[#F3FDE8] border-[#C8F3A8] text-[#111111]'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1 gap-3">
                              <span className="font-black text-[10px] uppercase tracking-wider text-[#FF6B00]">
                                Official Escrow Offer
                              </span>
                              <span className="font-black text-xs">
                                ₦{(msg.presetOffer.price * msg.presetOffer.quantity).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[11px]">
                              {msg.presetOffer.quantity} unit(s) at ₦{msg.presetOffer.price.toLocaleString()} each
                            </p>
                            {!isMe && (
                              <button
                                type="button"
                                onClick={() => void handleAcceptOffer(msg)}
                                className="mt-2 w-full py-2 bg-[#FF6B00] hover:bg-[#ff7a1a] text-[#111111] text-[11px] font-black rounded-lg transition-all border-2 border-[#111111] shadow-[0_2px_0_#111111] active:translate-y-0.5 flex items-center justify-center gap-1.5"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-[#111111]" />
                                <span>Accept &amp; Pay with Escrow</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Number Warning Indicator */}
              {numberWarning && (
                <div className="px-3.5 py-2 bg-red-50 border-t border-red-200 text-red-700 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span className="font-semibold">{numberWarning}</span>
                </div>
              )}

              {/* Quick Message Chips (Strictly No Numbers) */}
              <div className="px-3 py-2 bg-[#F4F4F5] dark:bg-[#1E2028] border-t border-[#E4E4E7] dark:border-[#27272A] flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
                <span className="text-[11px] font-bold text-[#71717A] dark:text-[#A1A1AA] shrink-0">
                  Quick:
                </span>
                {quickMessages.map((qm, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={sending}
                    onClick={() => void sendMessage(activeConv.id, qm)}
                    className="px-2.5 py-1 bg-white dark:bg-[#15161C] hover:bg-[#9FE870]/20 border-2 border-[#111111]/15 dark:border-[#27272A] hover:border-[#111111] rounded-lg text-[#111111] dark:text-white shrink-0 whitespace-nowrap transition-colors font-bold text-xs disabled:opacity-50"
                  >
                    {qm}
                  </button>
                ))}
              </div>

              {/* Message Input Form */}
              <div className="p-3 bg-white dark:bg-[#15161C] border-t-2 border-[#111111]/10 dark:border-[#27272A]">
                <form onSubmit={handleSendText} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputContent}
                    onChange={e => handleInputChange(e.target.value)}
                    placeholder="Type in plain words (numbers are blocked)..."
                    className={`flex-1 px-3.5 py-2.5 rounded-xl border-2 text-xs sm:text-sm bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:outline-none transition-colors ${
                      numberWarning
                        ? 'border-red-400 bg-red-50/30'
                        : 'border-[#111111]/20 dark:border-[#27272A] focus:border-[#FF6B00]'
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => setShowOfferPicker(!showOfferPicker)}
                    className="px-3.5 py-2.5 bg-[#111111] hover:bg-black text-[#9FE870] font-black text-xs rounded-xl transition-all whitespace-nowrap shrink-0 border-2 border-[#FF6B00] shadow-[0_2px_0_#FF6B00] active:translate-y-0.5"
                    title="Propose price or quantity"
                  >
                    ₦ Offer
                  </button>

                  <button
                    type="submit"
                    disabled={sending || !inputContent.trim() || !!numberWarning}
                    className="px-4 py-2.5 bg-[#FF6B00] hover:bg-[#ff7a1a] disabled:bg-[#E4E4E7] disabled:text-[#A1A1AA] disabled:border-slate-300 text-[#111111] font-black text-xs sm:text-sm rounded-xl transition-all border-2 border-[#111111] shadow-[0_2px_0_#111111] active:translate-y-0.5 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#71717A] dark:text-[#A1A1AA]">
              <MessageSquare className="w-10 h-10 text-[#D4D4D8] dark:text-[#3F3F46] mb-2" />
              <p className="text-sm font-bold text-[#111111] dark:text-white">No active conversation</p>
              <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] mt-1">
                Browse any craft in the marketplace and click "Ask Seller" to begin safe chatting.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Safety & Operations Report Modal */}
      <ReportModal
        target={reportTarget}
        isOpen={!!reportTarget}
        onClose={() => setReportTarget(null)}
      />
    </div>
  );
};
