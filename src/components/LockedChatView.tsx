import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getTrustCopy } from '../../shared/trustAndLegalCopy';
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
  Paperclip,
  FileText,
  Download,
  Search,
  Ban,
  ExternalLink,
  Loader2,
  CheckCheck,
  Check,
  Bell,
  BellOff,
  Smile,
  ShoppingBag,
} from 'lucide-react';
import { checkNumbersInText, PRESET_PRICES, PRESET_QUANTITIES } from '../utils/antiBypass';
import { ChatAttachment, ChatMessage } from '../types';
import { ReportModal, ReportTarget } from './ReportModal';
import { UserIdentityBadge } from './UserIdentityBadge';
import { uploadFileToServer } from '../utils/fileUpload';
import { formatNaira } from '../utils/pricing';

const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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
    openProduct,
    blockUser,
    muteUser,
    unmuteUser,
    fetchMutedUsers,
    addToCart,
    paymentsEnabled,
    products,
    notify,
  } = useApp();

  const [inputContent, setInputContent] = useState('');
  const [convSearch, setConvSearch] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [selectedPrice, setSelectedPrice] = useState<number>(1000);
  const [showOfferPicker, setShowOfferPicker] = useState<boolean>(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [numberWarning, setNumberWarning] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [sending, setSending] = useState(false);

  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [blockingUser, setBlockingUser] = useState(false);
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set());
  const [muteBusy, setMuteBusy] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const QUICK_EMOJIS = ['😊', '🙏', '👍', '❤️', '🔥', '✨', '🎨', '🧶', '💎', '🛍️', '📦', '🎉'];

  const formatDayLabel = (rawDate?: string): string | null => {
    if (!rawDate) return null;
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return null;
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, today)) return 'Today';
    if (sameDay(d, yesterday)) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  useEffect(() => {
    if (!currentUser?.id) return;
    void fetchMutedUsers().then(list => {
      setMutedIds(new Set(list.map(m => m.mutedUserId)));
    });
  }, [currentUser?.id, fetchMutedUsers]);

  const activeConv = conversations.find(c => c.id === activeConversationId) || conversations[0];
  const activeMessages = activeConv ? messages[activeConv.id] || [] : [];

  const matchedProduct = activeConv?.productId
    ? products.find(p => p.id === activeConv.productId)
    : undefined;

  useEffect(() => {
    setPendingAttachment(null);
    setBlockConfirmOpen(false);
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
    const isBuyerInThread = Boolean(currentUser?.id && conv.buyerId === currentUser.id);
    if (!isBuyerInThread) {
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

  const filteredConversations = conversations.filter(conv => {
    const q = convSearch.trim().toLowerCase();
    if (!q) return true;
    const label = getCounterpartLabel(conv).toLowerCase();
    return (
      label.includes(q) ||
      (conv.productTitle || '').toLowerCase().includes(q) ||
      (conv.lastMessage || '').toLowerCase().includes(q)
    );
  });

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

  const handleAttachmentPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeConv) return;
    setIsUploadingFile(true);
    try {
      const uploaded = await uploadFileToServer(file, 'chat', { conversationId: activeConv.id });
      setPendingAttachment({
        id: uploaded.id,
        url: uploaded.url,
        originalName: uploaded.originalName,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        kind: uploaded.kind,
      });
      notify('File attached and ready to send.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to upload file attachment.', 'error');
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || sending || isUploadingFile) return;
    if (!inputContent.trim() && !pendingAttachment) return;

    if (inputContent.trim()) {
      const check = checkNumbersInText(inputContent);
      if (check.hasNumber) {
        notify('Numbers and number words are blocked in chat. Use the preset buttons below.', 'error');
        return;
      }
    }

    setSending(true);
    const res = await sendMessage(
      activeConv.id,
      inputContent.trim(),
      undefined,
      undefined,
      pendingAttachment || undefined
    );
    setSending(false);
    if (res.success) {
      setInputContent('');
      setPendingAttachment(null);
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
        paymentsEnabled
          ? `Added to bag! Checkout uses the verified listing price (₦${targetProduct.displayPrice.toLocaleString()}). Ask the seller to update the listing price if a discount was agreed.`
          : `Added to bag at the listing price (₦${targetProduct.displayPrice.toLocaleString()}). You can arrange directly with the seller here in chat.`,
        'info'
      );
    }

    if (paymentsEnabled) {
      openCheckoutModal();
    } else {
      setActiveView('cart');
    }
  };

  const handleConfirmBlockCounterpart = async () => {
    if (!activeConv || blockingUser) return;
    const counterpart = getCounterpartInfo(activeConv);
    if (!counterpart.userId) return;
    setBlockingUser(true);
    const res = await blockUser(counterpart.userId);
    setBlockingUser(false);
    if (res.status) {
      setBlockConfirmOpen(false);
    }
  };

  const trustCopy = getTrustCopy(paymentsEnabled);

  // Quick message chips without numbers
  const quickMessages = [
    'Is this item still available?',
    'Can you deliver to my area?',
    trustCopy.chatQuickActionLine,
    'Item received in good condition, thanks!',
  ];

  const isThreadDisabled = Boolean(activeConv?.isBlocked || activeConv?.isChatLocked);
  const activeCounterpart = activeConv ? getCounterpartInfo(activeConv) : null;

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
          <span>{trustCopy.chatHeaderBadge}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] overflow-hidden shadow-xs grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
        {/* Left: Conversations list */}
        <div className="md:col-span-4 border-r border-[#E4E4E7] dark:border-[#27272A] flex flex-col bg-[#FAFAFA] dark:bg-[#0D0E12]">
          <div className="p-4 border-b border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#15161C] space-y-2.5">
            <div>
              <h2 className="text-sm font-black text-[#111111] dark:text-white">Messages</h2>
              <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA] mt-0.5">
                Chats with numbers are blocked to prevent off-platform scams.
              </p>
            </div>
            {conversations.length > 0 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={convSearch}
                  onChange={e => setConvSearch(e.target.value)}
                  placeholder="Search people or items..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#1E2028] text-xs text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredConversations.length > 0 ? (
              filteredConversations.map(conv => {
                const isSelected = activeConv?.id === conv.id;
                const unread = conv.buyerId === currentUser?.id ? conv.unreadBuyer : conv.unreadSeller;
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
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-[#111111] dark:text-white truncate">
                        {getCounterpartLabel(conv)}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {unread > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF6B00] text-[#111111] text-[10px] font-black flex items-center justify-center font-mono-numbers">
                            {unread}
                          </span>
                        )}
                        <span className="text-[10px] text-[#A1A1AA]">{conv.lastMessageAt}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-[#52525B] dark:text-[#D4D4D8] truncate font-medium">
                        {conv.productTitle}
                      </p>
                      {(conv.isBlocked || conv.isChatLocked) && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 shrink-0">
                          {conv.isBlocked ? 'Blocked' : 'Locked'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA] truncate mt-1">{conv.lastMessage}</p>
                  </div>
                );
              })
            ) : conversations.length > 0 ? (
              <div className="p-6 text-center text-xs text-[#71717A] dark:text-[#A1A1AA]">
                No conversations matching &ldquo;{convSearch}&rdquo;.
              </div>
            ) : (
              <div className="p-8 text-center text-[#71717A] dark:text-[#A1A1AA] text-xs">
                <MessageSquare className="w-8 h-8 text-[#D4D4D8] dark:text-[#3F3F46] mx-auto mb-2" />
                <p className="font-bold text-[#111111] dark:text-white">No active chats yet</p>
                <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA] mt-1">
                  {trustCopy.chatEmptyHint}
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
              <div className="p-3.5 border-b border-[#E4E4E7] dark:border-[#27272A] flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-[#15161C]">
                <div className="min-w-0 flex items-center gap-3">
                  <UserIdentityBadge
                    userId={activeCounterpart?.userId}
                    profileSlug={activeCounterpart?.profileSlug}
                    displayName={activeCounterpart?.displayName || 'Member'}
                    avatarUrl={activeCounterpart?.avatarUrl}
                    subtitle={`Re: ${activeConv.productTitle || 'Order Inquiry'}`}
                    size="sm"
                  />
                  {activeConv.productId && (
                    <button
                      type="button"
                      onClick={() => openProduct(activeConv.productId!)}
                      className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAFAFA] dark:bg-[#1E2028] border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF6B00] text-[11px] font-bold text-[#111111] dark:text-white whitespace-nowrap shrink-0"
                    >
                      <span>View Item</span>
                      <ExternalLink className="w-3 h-3 text-[#FF6B00]" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {activeCounterpart?.userId && (
                    <button
                      type="button"
                      disabled={muteBusy}
                      onClick={async () => {
                        const targetId = activeCounterpart.userId!;
                        setMuteBusy(true);
                        if (mutedIds.has(targetId)) {
                          const r = await unmuteUser(targetId);
                          if (r.status) {
                            setMutedIds(prev => {
                              const next = new Set(prev);
                              next.delete(targetId);
                              return next;
                            });
                          }
                        } else {
                          const r = await muteUser(targetId);
                          if (r.status) {
                            setMutedIds(prev => new Set(prev).add(targetId));
                          }
                        }
                        setMuteBusy(false);
                      }}
                      className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold whitespace-nowrap ${
                        mutedIds.has(activeCounterpart.userId)
                          ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40'
                          : 'text-[#71717A] hover:text-[#FF6B00] hover:bg-stone-100 dark:hover:bg-[#1E2028]'
                      }`}
                      title={
                        mutedIds.has(activeCounterpart.userId)
                          ? 'Unmute chat notifications'
                          : 'Mute notifications from this user'
                      }
                    >
                      {mutedIds.has(activeCounterpart.userId) ? (
                        <BellOff className="w-3.5 h-3.5" />
                      ) : (
                        <Bell className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">
                        {mutedIds.has(activeCounterpart.userId) ? 'Muted' : 'Mute'}
                      </span>
                    </button>
                  )}

                  {activeCounterpart?.userId && !activeConv.isBlocked && (
                    <button
                      type="button"
                      onClick={() => setBlockConfirmOpen(true)}
                      className="p-1.5 text-[#71717A] hover:text-rose-600 rounded-lg hover:bg-stone-100 dark:hover:bg-[#1E2028] transition-colors flex items-center gap-1 text-[11px] font-bold whitespace-nowrap"
                      title="Block User"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Block</span>
                    </button>
                  )}

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
                {!isThreadDisabled && (
                  <button
                    type="button"
                    onClick={() => setShowOfferPicker(!showOfferPicker)}
                    className="px-3 py-1 bg-[#FF6B00] hover:bg-[#E55E00] text-white text-[10px] font-black rounded-lg transition-colors shadow-2xs whitespace-nowrap shrink-0"
                  >
                    {showOfferPicker ? 'Close Offer' : '+ Make Offer'}
                  </button>
                )}
              </div>

              {/* Blocked or Locked Notice */}
              {isThreadDisabled && (
                <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
                  <Ban className="w-4 h-4 shrink-0" />
                  <span>
                    {activeConv.isBlocked
                      ? 'Messaging is disabled because one participant has blocked the other.'
                      : 'This chat has been locked by moderation due to repeated anti-bypass violations.'}
                  </span>
                </div>
              )}

              {/* Preset Price & Quantity Picker Panel */}
              {showOfferPicker && !isThreadDisabled && (
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
                      <span className="text-[#71717A] dark:text-[#A1A1AA]">{trustCopy.chatOfferTotalLabel} </span>
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

              {/* Compact Linked Product Card */}
              {matchedProduct && (
                <div className="px-3.5 py-2 bg-white dark:bg-[#15161C] border-b border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {matchedProduct.images?.[0] ? (
                      <img
                        src={matchedProduct.images[0]}
                        alt={matchedProduct.title}
                        className="w-10 h-10 rounded-xl object-cover border border-[#E4E4E7] dark:border-[#27272A] shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-[#FFF4EC] dark:bg-[#1E2028] flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-4 h-4 text-[#FF6B00]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-black text-[#111111] dark:text-white truncate">
                        {matchedProduct.title}
                      </p>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-black text-[#FF6B00]">{formatNaira(matchedProduct.displayPrice)}</span>
                        <span
                          className={`font-bold ${
                            matchedProduct.isSoldOut || matchedProduct.stock <= 0
                              ? 'text-rose-600'
                              : 'text-emerald-700 dark:text-[#9FE870]'
                          }`}
                        >
                          {matchedProduct.isSoldOut || matchedProduct.stock <= 0
                            ? 'Sold Out'
                            : 'In Stock'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openProduct(matchedProduct.id)}
                    className="px-2.5 py-1 rounded-lg bg-[#FAFAFA] dark:bg-[#1E2028] border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF6B00] text-[11px] font-bold text-[#111111] dark:text-white shrink-0"
                  >
                    View Item
                  </button>
                </div>
              )}

              {/* Messages Feed */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FBFBFC] dark:bg-[#0D0E12]">
                {activeMessages.map((msg, msgIndex) => {
                  const prevMsg = msgIndex > 0 ? activeMessages[msgIndex - 1] : null;
                  const currentDay = formatDayLabel(msg.createdAt);
                  const prevDay = formatDayLabel(prevMsg?.createdAt);
                  const showDayDivider = Boolean(currentDay && currentDay !== prevDay);

                  const isMe = Boolean(
                    currentUser &&
                      (msg.senderId === currentUser.id ||
                        (Boolean(currentUser.sellerProfile?.id) &&
                          msg.senderId === currentUser.sellerProfile?.id))
                  );
                  const isSystem = msg.senderRole === 'system';

                  return (
                    <React.Fragment key={msg.id}>
                      {showDayDivider && (
                        <div className="flex items-center justify-center my-2">
                          <span className="px-3 py-0.5 rounded-full bg-white dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] text-[10px] font-bold text-[#71717A] dark:text-[#A1A1AA]">
                            {currentDay}
                          </span>
                        </div>
                      )}

                      {isSystem ? (
                        <div className="text-center my-2">
                          <span className="inline-block px-3 py-1 bg-[#F4F4F5] dark:bg-[#1E2028] text-[#52525B] dark:text-[#D4D4D8] rounded-full text-[11px] font-medium border border-[#E4E4E7] dark:border-[#27272A]">
                            {msg.content}
                          </span>
                        </div>
                      ) : (
                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <span className="text-[10px] text-[#71717A] dark:text-[#A1A1AA] mb-0.5 px-1 font-medium flex items-center gap-1">
                            <span>{msg.senderDisplayName} · {msg.timestamp}</span>
                            {isMe && (
                              msg.readByOther ? (
                                <span className="inline-flex items-center gap-0.5 text-[#16A34A] dark:text-[#9FE870] font-bold">
                                  · <CheckCheck className="w-3 h-3" /> Seen
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[#71717A]">
                                  · <Check className="w-3 h-3" /> Sent
                                </span>
                              )
                            )}
                          </span>

                          <div
                            className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                              isMe
                                ? 'bg-[#111111] text-white rounded-br-none shadow-xs border border-[#27272A]'
                                : 'bg-white dark:bg-[#15161C] text-[#111111] dark:text-white border border-[#E4E4E7] dark:border-[#27272A] rounded-bl-none shadow-xs'
                            }`}
                          >
                            {/* File Attachment */}
                            {msg.attachment && (
                              <div className={msg.content ? 'mb-2' : ''}>
                                {msg.attachment.kind === 'image' ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLightboxImage({
                                        url: msg.attachment!.url,
                                        name: msg.attachment!.originalName,
                                      })
                                    }
                                    className="block rounded-xl overflow-hidden border border-black/10 dark:border-white/15 bg-black/5 cursor-zoom-in"
                                  >
                                    <img
                                      src={msg.attachment.url}
                                      alt={msg.attachment.originalName}
                                      className="max-h-56 w-auto object-contain mx-auto"
                                    />
                                  </button>
                                ) : (
                              <a
                                href={`${msg.attachment.url}?download=1`}
                                download={msg.attachment.originalName}
                                className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors ${
                                  isMe
                                    ? 'bg-white/10 border-white/20 text-white hover:bg-white/15'
                                    : 'bg-[#FAFAFA] dark:bg-[#1E2028] border-[#E4E4E7] dark:border-[#27272A] text-[#111111] dark:text-white hover:border-[#FF6B00]'
                                }`}
                              >
                                <FileText className="w-4 h-4 text-[#FF6B00] shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold truncate">{msg.attachment.originalName}</div>
                                  <div className="text-[10px] opacity-75">
                                    {formatFileSize(msg.attachment.sizeBytes)}
                                  </div>
                                </div>
                                <Download className="w-4 h-4 shrink-0 text-[#FF6B00]" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Text Content */}
                        {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}

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
                                {trustCopy.chatOfferCardHeader}
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
                                <span>{trustCopy.chatOfferAcceptLabel}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                    </React.Fragment>
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
              {!isThreadDisabled && (
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
              )}

              {/* Pending File Attachment Preview */}
              {pendingAttachment && !isThreadDisabled && (
                <div className="px-3.5 py-2 bg-[#FFF4EC] dark:bg-[#1E2028] border-t border-[#FED7AA] dark:border-[#27272A] flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    {pendingAttachment.kind === 'image' ? (
                      <img
                        src={pendingAttachment.url}
                        alt={pendingAttachment.originalName}
                        className="w-9 h-9 rounded-lg object-cover border border-[#FF6B00] shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-white dark:bg-[#15161C] border border-[#FED7AA] flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-[#FF6B00]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-[#111111] dark:text-white truncate">
                        {pendingAttachment.originalName}
                      </div>
                      <div className="text-[10px] text-[#71717A] dark:text-[#A1A1AA]">
                        Ready to send · {formatFileSize(pendingAttachment.sizeBytes)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingAttachment(null)}
                    className="p-1 rounded-lg text-[#71717A] hover:text-rose-600"
                    title="Remove attachment"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Message Input Form */}
              <div className="p-3 bg-white dark:bg-[#15161C] border-t-2 border-[#111111]/10 dark:border-[#27272A] relative">
                {showEmojiPicker && !isThreadDisabled && (
                  <div className="mb-2 p-2 rounded-xl bg-[#FAFAFA] dark:bg-[#1E2028] border border-[#E4E4E7] dark:border-[#27272A] flex flex-wrap gap-1.5">
                    {QUICK_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setInputContent(prev => `${prev}${emoji}`);
                          setShowEmojiPicker(false);
                        }}
                        className="w-8 h-8 rounded-lg hover:bg-white dark:hover:bg-[#15161C] text-base flex items-center justify-center transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                <form onSubmit={handleSendText} className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.txt,application/pdf,text/plain"
                    disabled={isThreadDisabled || isUploadingFile}
                    onChange={handleAttachmentPick}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isThreadDisabled || isUploadingFile}
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach image, PDF, or text file"
                    className="p-2.5 rounded-xl border-2 border-[#111111]/15 dark:border-[#27272A] hover:border-[#FF6B00] bg-[#FAFAFA] dark:bg-[#1E2028] text-[#111111] dark:text-white disabled:opacity-50 shrink-0"
                  >
                    {isUploadingFile ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#FF6B00]" />
                    ) : (
                      <Paperclip className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isThreadDisabled}
                    onClick={() => setShowEmojiPicker(v => !v)}
                    title="Quick emoji"
                    className="p-2.5 rounded-xl border-2 border-[#111111]/15 dark:border-[#27272A] hover:border-[#FF6B00] bg-[#FAFAFA] dark:bg-[#1E2028] text-[#111111] dark:text-white disabled:opacity-50 shrink-0"
                  >
                    <Smile className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    disabled={isThreadDisabled}
                    value={inputContent}
                    onChange={e => handleInputChange(e.target.value)}
                    placeholder={
                      isThreadDisabled
                        ? 'Chat is unavailable'
                        : pendingAttachment
                        ? 'Add an optional note (numbers blocked)...'
                        : 'Type in plain words (numbers are blocked)...'
                    }
                    className={`flex-1 px-3.5 py-2.5 rounded-xl border-2 text-xs sm:text-sm bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:outline-none transition-colors disabled:opacity-50 ${
                      numberWarning
                        ? 'border-red-400 bg-red-50/30'
                        : 'border-[#111111]/20 dark:border-[#27272A] focus:border-[#FF6B00]'
                    }`}
                  />

                  <button
                    type="button"
                    disabled={isThreadDisabled}
                    onClick={() => setShowOfferPicker(!showOfferPicker)}
                    className="px-3.5 py-2.5 bg-[#111111] hover:bg-black disabled:opacity-50 text-[#9FE870] font-black text-xs rounded-xl transition-all whitespace-nowrap shrink-0 border-2 border-[#FF6B00] shadow-[0_2px_0_#FF6B00] active:translate-y-0.5"
                    title="Propose price or quantity"
                  >
                    ₦ Offer
                  </button>

                  <button
                    type="submit"
                    disabled={
                      isThreadDisabled ||
                      sending ||
                      isUploadingFile ||
                      (!inputContent.trim() && !pendingAttachment) ||
                      !!numberWarning
                    }
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
                Browse any craft in the marketplace and click &ldquo;Ask Seller&rdquo; to begin safe chatting.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Block User Confirmation Modal */}
      {blockConfirmOpen && activeCounterpart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-backdrop">
          <div className="bg-white dark:bg-[#15161C] rounded-2xl max-w-sm w-full border border-rose-300 dark:border-rose-900 p-5 space-y-4 shadow-2xl animate-modal-enter">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#111111] dark:text-white">
                  Block {activeCounterpart.displayName}?
                </h3>
                <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] mt-1 leading-relaxed">
                  They will no longer be able to follow you, view your profile, or send you messages here. You can unblock anytime from Account Settings.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBlockConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] font-bold text-xs text-[#52525B] dark:text-[#A1A1AA]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={blockingUser}
                onClick={() => void handleConfirmBlockCounterpart()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-xs"
              >
                {blockingUser ? 'Blocking...' : 'Block User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-backdrop"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative max-w-3xl w-full bg-[#111111] rounded-2xl border border-[#27272A] overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-[#27272A] text-white text-xs">
              <span className="font-bold truncate">{lightboxImage.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`${lightboxImage.url}?download=1`}
                  download={lightboxImage.name}
                  className="px-2.5 py-1 rounded-lg bg-[#FF6B00] text-[#111111] font-black inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="p-1 rounded-lg text-[#A1A1AA] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center bg-black max-h-[80vh]">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.name}
                className="max-h-[72vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Safety & Operations Report Modal */}
      <ReportModal
        target={reportTarget}
        isOpen={!!reportTarget}
        onClose={() => setReportTarget(null)}
      />
    </div>
  );
};

