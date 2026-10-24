import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  Product,
  SellerProfile,
  CartItem,
  Campus,
  ProductCategory,
  UserRole,
  Order,
  OrderStatus,
  Coupon,
  SellerWallet,
  PayoutAccount,
  WalletTransaction,
  LedgerEntry,
  PaystackWebhookEvent,
  SecurityProfile,
  ChatMessage,
  Conversation,
  DisputeTicket,
  SellerVerificationRequest,
  AntiBypassFlag,
  AdminSubRole,
  FeeSettings,
  SafePickupSpot,
  CampusRunner,
  RunnerTrip,
  CustomCommissionRequest,
  CampusFlashDrop,
  CampusStylePost,
  ArtisanTierInfo,
  CampusAmbassador,
  HallLeaderboardEntry,
  ReferralReward,
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_SELLERS,
  INITIAL_ORDERS,
  VALID_COUPONS,
  INITIAL_WALLETS,
  INITIAL_SECURITY_PROFILES,
  INITIAL_CONVERSATIONS,
  INITIAL_MESSAGES,
  INITIAL_VERIFICATION_REQUESTS,
  INITIAL_DISPUTES,
  INITIAL_ANTI_BYPASS_FLAGS,
  INITIAL_SAFE_SPOTS,
  INITIAL_CAMPUS_RUNNERS,
  INITIAL_RUNNER_TRIPS,
  INITIAL_COMMISSIONS,
  INITIAL_CAMPUS_DROPS,
  INITIAL_STYLE_POSTS,
  ARTISAN_TIERS,
  PRESET_CRAFT_TEMPLATES,
  INITIAL_AMBASSADORS,
  INITIAL_HALL_LEADERBOARD,
  INITIAL_REFERRAL_REWARDS,
} from '../data/mockData';
import { getPricingBreakdown, DEFAULT_FEE_SETTINGS } from '../utils/pricing';
import { filterAntiBypass, checkNumbersInText } from '../utils/antiBypass';
import { NigerianLocation } from '../types';
import { calculateDeliveryFee } from '../data/nigerianLocations';
import {
  PAYSTACK_CONFIG,
  verifyPaystackWebhookSignature,
  calculateBalancesFromLedger,
  isPayoutAccountCooled,
  validateAccountNameMatch,
  executePaystackTransfer,
} from '../utils/paystackService';

interface NotificationItem {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

interface AppContextType {
  currentUser: User | null;
  switchRole: (role: UserRole) => void;
  login: (userData: Partial<User>) => void;
  logout: () => void;
  isAuthModalOpen: boolean;
  openAuthModal: (tab?: 'login' | 'signup' | 'seller_register') => void;
  closeAuthModal: () => void;
  authTab: 'login' | 'signup' | 'otp' | 'seller_register';
  setAuthTab: (tab: 'login' | 'signup' | 'otp' | 'seller_register') => void;
  pendingAuthData: any;
  setPendingAuthData: (data: any) => void;
  verifyOtp: (code: string) => boolean;
  submitSellerRegistration: (sellerData: {
    shopName: string;
    campus?: Campus;
    location?: NigerianLocation;
    locationArea?: string;
    bio: string;
    under18: boolean;
    guardianName?: string;
    guardianPhone?: string;
  }) => void;

  // Catalog & Products
  products: Product[];
  filteredProducts: Product[];
  addProduct: (
    newProd: Omit<Product, 'id' | 'createdAt' | 'rating' | 'reviewCount' | 'reviews' | 'serviceFee' | 'displayPrice' | 'isSoldOut' | 'isNewArrival'> &
      Partial<Pick<Product, 'serviceFee' | 'displayPrice' | 'isSoldOut' | 'isNewArrival'>>
  ) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  toggleProductStock: (id: string) => void;

  // Sellers
  sellers: SellerProfile[];
  getSellerById: (id: string) => SellerProfile | undefined;
  currentSeller: SellerProfile | null;
  toggleVacationMode: (sellerId: string) => void;

  // Search & Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: ProductCategory;
  setSelectedCategory: (cat: ProductCategory) => void;
  selectedCampus: Campus;
  setSelectedCampus: (campus: Campus) => void;
  priceFilter: 'all' | 'under2k' | '2k-5k' | '5k-10k' | 'above10k';
  setPriceFilter: (p: 'all' | 'under2k' | '2k-5k' | '5k-10k' | 'above10k') => void;
  sortBy: 'newest' | 'price_asc' | 'price_desc' | 'top_rated';
  setSortBy: (s: 'newest' | 'price_asc' | 'price_desc' | 'top_rated') => void;
  resetFilters: () => void;

  // Nigerian State > City > Area Location System
  selectedState: string;
  setSelectedState: (state: string) => void;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  selectedArea: string;
  setSelectedArea: (area: string) => void;
  userLocation: NigerianLocation;
  setUserLocation: (loc: NigerianLocation) => void;
  getDeliveryFee: (sellerLoc?: NigerianLocation) => { fee: number; method: string };

  // Navigation views
  activeView:
    | 'catalog'
    | 'product_detail'
    | 'seller_shop'
    | 'seller_dashboard'
    | 'wishlist'
    | 'cart'
    | 'orders'
    | 'admin'
    | 'chat'
    | 'campus_logistics'
    | 'craft_studio'
    | 'campus_ambassadors';
  setActiveView: (
    view:
      | 'catalog'
      | 'product_detail'
      | 'seller_shop'
      | 'seller_dashboard'
      | 'wishlist'
      | 'cart'
      | 'orders'
      | 'admin'
      | 'chat'
      | 'campus_logistics'
      | 'craft_studio'
      | 'campus_ambassadors'
  ) => void;
  selectedProductId: string | null;
  selectedSellerId: string | null;
  openProduct: (id: string) => void;
  openSellerShop: (sellerId: string) => void;

  // Wishlist & Cart
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  cartCount: number;

  // Orders & Escrow
  orders: Order[];
  placeOrder: (orderData: Omit<Order, 'id' | 'createdAt' | 'autoReleaseAt' | 'hasReview'>) => Order;
  updateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    extra?: { packedPhotoUrl?: string; disputeReason?: string }
  ) => void;
  confirmItemReceived: (orderId: string) => void;
  cancelOrder: (orderId: string) => void;
  openDispute: (orderId: string, reason: string) => void;
  submitOrderReview: (orderId: string, productId: string, rating: number, comment: string) => void;
  buyerActiveOrdersCount: number;

  // Phase 4: Campus Safe Logistics & Handshake OTP Verification
  safePickupSpots: SafePickupSpot[];
  campusRunners: CampusRunner[];
  runnerTrips: RunnerTrip[];
  verifyHandshakeOtp: (orderId: string, inputOtp: string) => { success: boolean; message: string };
  assignCampusRunner: (orderId: string, runnerId: string, pickupSpotId: string, dropoffSpotId: string) => void;
  updateTripStatus: (tripId: string, status: RunnerTrip['status']) => void;

  // Phase 5: Student Artisan Growth, Bespoke Commissions & Social Drops
  commissions: CustomCommissionRequest[];
  campusDrops: CampusFlashDrop[];
  stylePosts: CampusStylePost[];
  artisanTiers: ArtisanTierInfo[];
  submitCommissionRequest: (
    request: Omit<CustomCommissionRequest, 'id' | 'createdAt' | 'status' | 'buyerMaskedId'>
  ) => void;
  updateCommissionStatus: (
    commissionId: string,
    status: CustomCommissionRequest['status'],
    wipPhoto?: string
  ) => void;
  claimDropPreorder: (dropId: string) => void;
  toggleLikeStylePost: (postId: string) => void;
  submitStylePost: (
    post: Omit<CampusStylePost, 'id' | 'timeAgo' | 'likesCount' | 'userHasLiked' | 'buyerMaskedId'>
  ) => void;

  // Phase 6: Campus Ambassador Network & Hall Leaderboard
  ambassadors: CampusAmbassador[];
  hallLeaderboard: HallLeaderboardEntry[];
  referralRewards: ReferralReward[];
  activeAmbassadorCode: string | null;
  applyReferralCode: (code: string) => boolean;

  // Quick-List Product & Catalog Management
  isQuickListModalOpen: boolean;
  openQuickListModal: () => void;
  closeQuickListModal: () => void;
  quickListFromTemplate: (templateIndex: number, overrides?: { price?: number; title?: string }) => void;
  clearAllProducts: () => void;

  // Phase 3: Locked Chat & Privacy Anti-Bypass
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  openChat: (conversationId?: string, targetInfo?: { orderId?: string; productId?: string; sellerId?: string }) => void;
  sendMessage: (
    conversationId: string,
    content: string,
    customOrder?: any,
    presetOffer?: { price: number; quantity: number; title?: string }
  ) => { success: boolean; isBlocked?: boolean; warning?: string };

  // Phase 3: Admin Command Center (Moderator, Finance, Support)
  adminSubRole: AdminSubRole;
  setAdminSubRole: (subRole: AdminSubRole) => void;
  verificationRequests: SellerVerificationRequest[];
  updateVerificationRequest: (id: string, status: 'approved' | 'rejected', notes?: string) => void;
  disputes: DisputeTicket[];
  resolveDispute: (disputeId: string, resolution: 'refund_full' | 'release_seller' | 'partial', amount?: number, notes?: string) => void;
  antiBypassFlags: AntiBypassFlag[];
  updateFlagStatus: (flagId: string, action: 'warn' | 'lock_chat' | 'freeze_account' | 'dismiss') => void;
  feeSettings: FeeSettings;
  updateFeeSettings: (settings: Partial<FeeSettings>) => void;

  // Phase 3: Report Problem Modal
  isReportProblemModalOpen: boolean;
  activeReportOrderId: string | null;
  openReportProblemModal: (orderId: string) => void;
  closeReportProblemModal: () => void;

  // Seller Wallet & Payouts (Rules 1-6)
  wallets: Record<string, SellerWallet>;
  currentWallet: SellerWallet | null;
  ledgerEntries: LedgerEntry[];
  paystackWebhooks: PaystackWebhookEvent[];
  activeWithdrawalOtp: { code: string; phone: string; expiresAt: number; amount: number } | null;
  sendWithdrawalOtp: (amount: number) => string;
  requestWithdrawal: (amount: number, payoutAccountId: string, otpCode: string) => boolean;
  addPayoutAccount: (bankCode: string, bankName: string, accountNumber: string, accountName: string) => boolean;
  toggleWalletFreeze: (sellerId: string, freeze: boolean, reason?: string) => void;
  processPaystackWebhook: (eventData: {
    event: 'charge.success';
    reference: string;
    signature: string;
    amount: number;
    customerEmail: string;
    orderId: string;
    channel: 'card' | 'bank_transfer' | 'ussd';
  }) => { success: boolean; message: string };

  // Security Hardening
  securityProfile: SecurityProfile;
  toggleTwoFactor: () => void;
  revokeSession: (sessionId: string) => void;

  // Checkout modal & coupons
  isCheckoutModalOpen: boolean;
  openCheckoutModal: () => void;
  closeCheckoutModal: () => void;
  appliedCoupon: Coupon | null;
  applyCoupon: (code: string, currentTotal: number) => boolean;
  removeCoupon: () => void;

  // Low-Data Mode & Language
  lowDataMode: boolean;
  toggleLowDataMode: () => void;
  language: 'en' | 'pidgin';
  toggleLanguage: () => void;

  // Toast Notifications
  notifications: NotificationItem[];
  notify: (message: string, type?: 'success' | 'info' | 'error') => void;
  dismissNotification: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Purge any old demo or mock data from previous sessions so marketplace starts 100% clean with ₦0 balances
  if (typeof window !== 'undefined' && !localStorage.getItem('shopit_v5_clean_zero_balances')) {
    localStorage.removeItem('shopit_current_user');
    localStorage.removeItem('shopit_sellers');
    localStorage.removeItem('shopit_products_ready_made');
    localStorage.removeItem('shopit_products');
    localStorage.removeItem('shopit_orders');
    localStorage.removeItem('shopit_conversations');
    localStorage.removeItem('shopit_messages');
    localStorage.removeItem('shopit_wallets');
    localStorage.removeItem('shopit_ledger_entries_v5');
    localStorage.removeItem('shopit_paystack_webhooks_v5');
    localStorage.removeItem('shopit_disputes');
    localStorage.removeItem('shopit_verification_requests');
    localStorage.removeItem('shopit_anti_bypass_flags');
    localStorage.setItem('shopit_v5_clean_zero_balances', 'true');
  }

  // Persistence helpers
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('shopit_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('shopit_products_ready_made');
    return saved ? JSON.parse(saved) : [];
  });

  const [sellers, setSellers] = useState<SellerProfile[]>(() => {
    const saved = localStorage.getItem('shopit_sellers');
    return saved ? JSON.parse(saved) : INITIAL_SELLERS;
  });

  const [wishlist, setWishlist] = useState<string[]>(() => {
    const saved = localStorage.getItem('shopit_wishlist');
    return saved ? JSON.parse(saved) : [];
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('shopit_cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('shopit_orders');
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  const [wallets, setWallets] = useState<Record<string, SellerWallet>>(() => {
    const saved = localStorage.getItem('shopit_wallets');
    return saved ? JSON.parse(saved) : INITIAL_WALLETS;
  });

  // Rule 5: All balances come from an append-only ledger (sale, fee, withdrawal, refund)
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>(() => {
    const saved = localStorage.getItem('shopit_ledger_entries_v5');
    return saved ? JSON.parse(saved) : [];
  });

  // Rule 3: Processed Paystack Webhook events (idempotency tracker)
  const [paystackWebhooks, setPaystackWebhooks] = useState<PaystackWebhookEvent[]>(() => {
    const saved = localStorage.getItem('shopit_paystack_webhooks_v5');
    return saved ? JSON.parse(saved) : [];
  });

  // Rule 4: Send an OTP before every withdrawal
  const [activeWithdrawalOtp, setActiveWithdrawalOtp] = useState<{
    code: string;
    phone: string;
    expiresAt: number;
    amount: number;
  } | null>(null);

  const [securityProfiles, setSecurityProfiles] = useState<Record<string, SecurityProfile>>(() => {
    const saved = localStorage.getItem('shopit_security_profiles');
    return saved ? JSON.parse(saved) : INITIAL_SECURITY_PROFILES;
  });

  const [lowDataMode, setLowDataMode] = useState<boolean>(() => {
    return localStorage.getItem('shopit_low_data') === 'true';
  });

  const [language, setLanguage] = useState<'en' | 'pidgin'>('en');

  // Checkout & Coupon states
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('all');
  const [selectedCampus, setSelectedCampus] = useState<Campus>('All Campuses');
  const [priceFilter, setPriceFilter] = useState<'all' | 'under2k' | '2k-5k' | '5k-10k' | 'above10k'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'top_rated'>('newest');

  // Location System (State > City > Area)
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [userLocation, setUserLocation] = useState<NigerianLocation>(() => {
    const saved = localStorage.getItem('shopit_user_location');
    return saved ? JSON.parse(saved) : { state: 'Lagos', city: 'Lagos Mainland', area: 'Yaba' };
  });

  const getDeliveryFee = (sellerLoc?: NigerianLocation) => {
    return calculateDeliveryFee(
      sellerLoc || { state: 'Lagos', city: 'Lagos Mainland', area: 'Yaba' },
      userLocation
    );
  };

  // Navigation states
  const [activeView, setActiveView] = useState<
    | 'catalog'
    | 'product_detail'
    | 'seller_shop'
    | 'seller_dashboard'
    | 'wishlist'
    | 'cart'
    | 'orders'
    | 'admin'
    | 'chat'
    | 'campus_logistics'
    | 'craft_studio'
    | 'campus_ambassadors'
  >('catalog');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);

  // Phase 4: Campus Safe Logistics & Handshake States
  const [safePickupSpots, setSafePickupSpots] = useState<SafePickupSpot[]>(() => {
    const saved = localStorage.getItem('shopit_safe_spots');
    return saved ? JSON.parse(saved) : INITIAL_SAFE_SPOTS;
  });
  const [campusRunners, setCampusRunners] = useState<CampusRunner[]>(() => {
    const saved = localStorage.getItem('shopit_campus_runners');
    return saved ? JSON.parse(saved) : INITIAL_CAMPUS_RUNNERS;
  });
  const [runnerTrips, setRunnerTrips] = useState<RunnerTrip[]>(() => {
    const saved = localStorage.getItem('shopit_runner_trips');
    return saved ? JSON.parse(saved) : INITIAL_RUNNER_TRIPS;
  });

  // Phase 5: Student Artisan Growth, Bespoke Commissions & Social Commerce
  const [commissions, setCommissions] = useState<CustomCommissionRequest[]>(() => {
    const saved = localStorage.getItem('shopit_commissions');
    return saved ? JSON.parse(saved) : INITIAL_COMMISSIONS;
  });
  const [campusDrops, setCampusDrops] = useState<CampusFlashDrop[]>(() => {
    const saved = localStorage.getItem('shopit_campus_drops');
    return saved ? JSON.parse(saved) : INITIAL_CAMPUS_DROPS;
  });
  const [stylePosts, setStylePosts] = useState<CampusStylePost[]>(() => {
    const saved = localStorage.getItem('shopit_style_posts');
    return saved ? JSON.parse(saved) : INITIAL_STYLE_POSTS;
  });
  const [artisanTiers] = useState<ArtisanTierInfo[]>(ARTISAN_TIERS);

  // Phase 6: Campus Ambassador Network, Leaderboard & Quick-List States
  const [ambassadors, setAmbassadors] = useState<CampusAmbassador[]>(() => {
    const saved = localStorage.getItem('shopit_ambassadors');
    return saved ? JSON.parse(saved) : INITIAL_AMBASSADORS;
  });
  const [hallLeaderboard, setHallLeaderboard] = useState<HallLeaderboardEntry[]>(() => {
    const saved = localStorage.getItem('shopit_hall_leaderboard');
    return saved ? JSON.parse(saved) : INITIAL_HALL_LEADERBOARD;
  });
  const [referralRewards, setReferralRewards] = useState<ReferralReward[]>(() => {
    const saved = localStorage.getItem('shopit_referral_rewards');
    return saved ? JSON.parse(saved) : INITIAL_REFERRAL_REWARDS;
  });
  const [activeAmbassadorCode, setActiveAmbassadorCode] = useState<string | null>(null);
  const [isQuickListModalOpen, setIsQuickListModalOpen] = useState<boolean>(false);

  // Phase 3: Locked Chat States
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem('shopit_conversations');
    return saved ? JSON.parse(saved) : INITIAL_CONVERSATIONS;
  });
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(() => {
    const saved = localStorage.getItem('shopit_messages');
    return saved ? JSON.parse(saved) : INITIAL_MESSAGES;
  });
  const [activeConversationId, setActiveConversationId] = useState<string | null>('conv_1');

  // Phase 3: Admin & Moderation States
  const [adminSubRole, setAdminSubRole] = useState<AdminSubRole>('moderator');
  const [verificationRequests, setVerificationRequests] = useState<SellerVerificationRequest[]>(() => {
    const saved = localStorage.getItem('shopit_verification_requests');
    return saved ? JSON.parse(saved) : INITIAL_VERIFICATION_REQUESTS;
  });
  const [disputes, setDisputes] = useState<DisputeTicket[]>(() => {
    const saved = localStorage.getItem('shopit_disputes');
    return saved ? JSON.parse(saved) : INITIAL_DISPUTES;
  });
  const [antiBypassFlags, setAntiBypassFlags] = useState<AntiBypassFlag[]>(() => {
    const saved = localStorage.getItem('shopit_anti_bypass_flags');
    return saved ? JSON.parse(saved) : INITIAL_ANTI_BYPASS_FLAGS;
  });
  const [feeSettings, setFeeSettings] = useState<FeeSettings>(() => {
    const saved = localStorage.getItem('shopit_fee_settings');
    return saved ? JSON.parse(saved) : DEFAULT_FEE_SETTINGS;
  });

  // Phase 3: Report Problem Modal State
  const [isReportProblemModalOpen, setIsReportProblemModalOpen] = useState(false);
  const [activeReportOrderId, setActiveReportOrderId] = useState<string | null>(null);

  // Auth modal states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup' | 'otp' | 'seller_register'>('login');
  const [pendingAuthData, setPendingAuthData] = useState<any>(null);

  // Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Sync state to LocalStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('shopit_current_user', JSON.stringify(currentUser));
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('shopit_products_ready_made', JSON.stringify(products));
    localStorage.removeItem('shopit_products');
  }, [products]);

  useEffect(() => {
    localStorage.setItem('shopit_sellers', JSON.stringify(sellers));
  }, [sellers]);

  useEffect(() => {
    localStorage.setItem('shopit_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem('shopit_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('shopit_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('shopit_wallets', JSON.stringify(wallets));
  }, [wallets]);

  useEffect(() => {
    localStorage.setItem('shopit_ledger_entries_v5', JSON.stringify(ledgerEntries));
  }, [ledgerEntries]);

  useEffect(() => {
    localStorage.setItem('shopit_paystack_webhooks_v5', JSON.stringify(paystackWebhooks));
  }, [paystackWebhooks]);

  useEffect(() => {
    localStorage.setItem('shopit_security_profiles', JSON.stringify(securityProfiles));
  }, [securityProfiles]);

  useEffect(() => {
    localStorage.setItem('shopit_low_data', String(lowDataMode));
  }, [lowDataMode]);

  useEffect(() => {
    localStorage.setItem('shopit_conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('shopit_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('shopit_verification_requests', JSON.stringify(verificationRequests));
  }, [verificationRequests]);

  useEffect(() => {
    localStorage.setItem('shopit_disputes', JSON.stringify(disputes));
  }, [disputes]);

  useEffect(() => {
    localStorage.setItem('shopit_anti_bypass_flags', JSON.stringify(antiBypassFlags));
  }, [antiBypassFlags]);

  useEffect(() => {
    localStorage.setItem('shopit_fee_settings', JSON.stringify(feeSettings));
  }, [feeSettings]);

  // Phase 4: Logistics persistence
  useEffect(() => {
    localStorage.setItem('shopit_safe_spots', JSON.stringify(safePickupSpots));
  }, [safePickupSpots]);

  useEffect(() => {
    localStorage.setItem('shopit_campus_runners', JSON.stringify(campusRunners));
  }, [campusRunners]);

  useEffect(() => {
    localStorage.setItem('shopit_runner_trips', JSON.stringify(runnerTrips));
  }, [runnerTrips]);

  // Phase 5: Commissions, Drops & Social posts persistence
  useEffect(() => {
    localStorage.setItem('shopit_commissions', JSON.stringify(commissions));
  }, [commissions]);

  useEffect(() => {
    localStorage.setItem('shopit_campus_drops', JSON.stringify(campusDrops));
  }, [campusDrops]);

  useEffect(() => {
    localStorage.setItem('shopit_style_posts', JSON.stringify(stylePosts));
  }, [stylePosts]);

  // Phase 6: Ambassador & Leaderboard persistence
  useEffect(() => {
    localStorage.setItem('shopit_ambassadors', JSON.stringify(ambassadors));
  }, [ambassadors]);

  useEffect(() => {
    localStorage.setItem('shopit_hall_leaderboard', JSON.stringify(hallLeaderboard));
  }, [hallLeaderboard]);

  useEffect(() => {
    localStorage.setItem('shopit_referral_rewards', JSON.stringify(referralRewards));
  }, [referralRewards]);

  // Rule 2: 5-day auto-release check (releases escrow funds to Available if no open dispute)
  useEffect(() => {
    const checkAutoRelease = () => {
      const now = Date.now();
      orders.forEach(order => {
        if (
          (order.status === 'delivered' || order.status === 'shipped' || order.status === 'paid') &&
          new Date(order.autoReleaseAt).getTime() <= now
        ) {
          confirmItemReceived(order.id);
          notify(`[Auto-Release] 5-day inspection period passed for Order #${order.id}. Escrow released to Available Balance.`, 'info');
        }
      });
    };

    checkAutoRelease();
    const interval = setInterval(checkAutoRelease, 30000);
    return () => clearInterval(interval);
  }, [orders]);

  const notify = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 5);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      dismissNotification(id);
    }, 4000);
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const switchRole = (role: UserRole) => {
    if (role === 'admin') {
      if (currentUser?.email === 'joeadeyinka12@gmail.com') {
        setActiveView('admin');
        notify('Switched to Moderator Control Center (Adeyinka Joseph)', 'info');
      } else {
        openAuthModal('login');
        notify('Moderator access restricted. Please log in with admin credentials.', 'error');
      }
    } else if (role === 'seller') {
      if (currentUser?.role === 'seller') {
        setActiveView('seller_dashboard');
      } else {
        openAuthModal('seller_register');
        notify('Register your shop to access Seller Dashboard.', 'info');
      }
    } else {
      setActiveView('catalog');
    }
  };

  const login = (userData: Partial<User>) => {
    const newUser: User = {
      id: userData.id || `user_${Date.now()}`,
      name: userData.name || 'Shopper',
      email: userData.email || 'customer@shopit.ng',
      phone: userData.phone || '+2348000000000',
      role: userData.role || 'buyer',
      isVerifiedEmail: true,
      isVerifiedPhone: true,
      savedDeliveryArea: userData.savedDeliveryArea || userLocation.area || 'Yaba',
      sellerProfile: userData.sellerProfile,
    };
    setCurrentUser(newUser);

    // Save in registered users list if has password and not already stored
    if ((userData as any).password) {
      try {
        const regStr = localStorage.getItem('shopit_registered_users');
        const regList: any[] = regStr ? JSON.parse(regStr) : [];
        if (!regList.some(u => u.email.toLowerCase() === newUser.email.toLowerCase())) {
          regList.push({ ...newUser, password: (userData as any).password });
          localStorage.setItem('shopit_registered_users', JSON.stringify(regList));
        }
      } catch (err) {
        // ignore
      }
    }

    notify(`Welcome back, ${newUser.name}!`, 'success');
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('shopit_current_user');
    setActiveView('catalog');
    notify('Logged out successfully', 'info');
  };

  const openAuthModal = (tab: 'login' | 'signup' | 'seller_register' = 'login') => {
    setAuthTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setPendingAuthData(null);
  };

  const verifyOtp = (code: string) => {
    if (code.trim().length === 4) {
      if (pendingAuthData) {
        if (pendingAuthData.role === 'seller') {
          setAuthTab('seller_register');
          notify('Phone verified! Complete your shop profile.', 'success');
          return true;
        } else {
          login({
            id: pendingAuthData.id,
            name: pendingAuthData.name,
            email: pendingAuthData.email,
            phone: pendingAuthData.phone,
            role: 'buyer',
            password: pendingAuthData.password,
          } as any);
          closeAuthModal();
          return true;
        }
      }
    }
    notify('Please enter the 4-digit code (1234)', 'error');
    return false;
  };

  const submitSellerRegistration = (sellerData: {
    shopName: string;
    campus?: Campus;
    location?: NigerianLocation;
    locationArea?: string;
    bio: string;
    under18: boolean;
    guardianName?: string;
    guardianPhone?: string;
  }) => {
    const newSellerId = `seller_${Date.now()}`;
    const resolvedArea = sellerData.locationArea || sellerData.location?.area || 'Lagos Mainland';
    const newSeller: SellerProfile = {
      id: newSellerId,
      shopName: sellerData.shopName,
      bio: sellerData.bio,
      campus: sellerData.campus || 'UNILAG (Akoka)',
      location: sellerData.location,
      locationArea: resolvedArea,
      isVerifiedSeller: true,
      verificationStatus: 'approved',
      under18: sellerData.under18,
      guardianConsent: sellerData.under18,
      guardianName: sellerData.guardianName,
      guardianPhone: sellerData.guardianPhone,
      badges: ['verified'],
      level: 1,
      rating: 5.0,
      reviewCount: 0,
      salesCount: 0,
      viewsCount: 0,
      vacationMode: false,
      joinedDate: 'Today',
    };

    setSellers(prev => [newSeller, ...prev]);

    // Initialize new seller wallet
    const newWallet: SellerWallet = {
      sellerId: newSellerId,
      pendingBalance: 0,
      availableBalance: 0,
      totalWithdrawn: 0,
      isFrozen: false,
      payoutAccounts: [],
      ledger: [],
      transactions: [],
    };
    setWallets(prev => ({ ...prev, [newSellerId]: newWallet }));

    const sellerUser: User = {
      id: newSellerId,
      name: pendingAuthData?.name || sellerData.shopName,
      email: pendingAuthData?.email || 'artisan@campus.ng',
      phone: pendingAuthData?.phone || '+2348000000000',
      role: 'seller',
      isVerifiedEmail: true,
      isVerifiedPhone: true,
      sellerProfile: newSeller,
      savedDeliveryArea: resolvedArea,
      location: sellerData.location,
      locationArea: resolvedArea,
    };

    setCurrentUser(sellerUser);
    closeAuthModal();
    setActiveView('seller_dashboard');
    notify(`Shop "${sellerData.shopName}" registered in ${resolvedArea}! Welcome to Shop It.`, 'success');
  };

  const addProduct = (
    newProd: Omit<
      Product,
      'id' | 'createdAt' | 'rating' | 'reviewCount' | 'reviews' | 'serviceFee' | 'displayPrice' | 'isSoldOut' | 'isNewArrival'
    > &
      Partial<Pick<Product, 'serviceFee' | 'displayPrice' | 'isSoldOut' | 'isNewArrival'>>
  ) => {
    const id = `prod_${Date.now()}`;
    const pricing = getPricingBreakdown(newProd.sellerPrice);
    const product: Product = {
      ...newProd,
      id,
      location: newProd.location || userLocation,
      locationArea: newProd.locationArea || newProd.location?.area || userLocation.area,
      serviceFee: pricing.serviceFee,
      displayPrice: pricing.displayPrice,
      rating: 5.0,
      reviewCount: 0,
      reviews: [],
      createdAt: new Date().toISOString().split('T')[0],
      isSoldOut: newProd.stock <= 0,
      isNewArrival: true,
    };
    setProducts(prev => [product, ...prev]);
    notify(`Product "${product.title}" listed successfully!`, 'success');
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts(prev =>
      prev.map(p => {
        if (p.id === id) {
          const updated = { ...p, ...updates };
          if (updates.sellerPrice !== undefined) {
            const pricing = getPricingBreakdown(updates.sellerPrice);
            updated.sellerPrice = pricing.sellerPrice;
            updated.serviceFee = pricing.serviceFee;
            updated.displayPrice = pricing.displayPrice;
          }
          if (updates.stock !== undefined) {
            updated.isSoldOut = updates.stock <= 0;
          }
          return updated;
        }
        return p;
      })
    );
    notify('Product updated', 'success');
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    notify('Product removed', 'info');
  };

  const toggleProductStock = (id: string) => {
    setProducts(prev =>
      prev.map(p => {
        if (p.id === id) {
          const newStock = p.stock > 0 ? 0 : 5;
          return { ...p, stock: newStock, isSoldOut: newStock === 0 };
        }
        return p;
      })
    );
  };

  const toggleVacationMode = (sellerId: string) => {
    setSellers(prev =>
      prev.map(s => {
        if (s.id === sellerId) {
          const newMode = !s.vacationMode;
          notify(newMode ? 'Vacation mode activated. Your shop is paused.' : 'Vacation mode disabled. Your shop is open!', 'info');
          return { ...s, vacationMode: newMode };
        }
        return s;
      })
    );
    if (currentUser?.sellerProfile?.id === sellerId) {
      setCurrentUser(prev => prev ? {
        ...prev,
        sellerProfile: prev.sellerProfile ? {
          ...prev.sellerProfile,
          vacationMode: !prev.sellerProfile.vacationMode
        } : undefined
      } : null);
    }
  };

  const getSellerById = (id: string) => sellers.find(s => s.id === id);

  const currentSeller = currentUser?.sellerProfile || (currentUser?.role === 'seller' ? (sellers.find(s => s.id === currentUser.id) || sellers[0] || null) : null);

  // Rule 5: All balances come from an append-only ledger (sale, fee, withdrawal, refund).
  // Rule 2: Sellers only have a wallet, with two balances: Pending and Available.
  const sellerLedger = currentSeller
    ? ledgerEntries.filter(e => e.walletId === currentSeller.id)
    : [];
  const calculatedBalances = calculateBalancesFromLedger(sellerLedger);
  const baseWallet = currentSeller ? wallets[currentSeller.id] : null;

  const currentWallet: SellerWallet | null = currentSeller
    ? {
        sellerId: currentSeller.id,
        pendingBalance: calculatedBalances.pendingBalance,
        availableBalance: calculatedBalances.availableBalance,
        totalWithdrawn: calculatedBalances.totalWithdrawn,
        isFrozen: baseWallet?.isFrozen || false,
        freezeReason: baseWallet?.freezeReason,
        payoutAccounts: baseWallet?.payoutAccounts || [],
        activePayoutAccountId: baseWallet?.activePayoutAccountId,
        ledger: sellerLedger,
        transactions: sellerLedger,
      }
    : null;

  const currentSecurityProfile: SecurityProfile = currentUser
    ? securityProfiles[currentUser.id] || securityProfiles['seller_amaka'] || securityProfiles['user_tobi_buyer']
    : securityProfiles['user_tobi_buyer'];

  const toggleWishlist = (productId: string) => {
    setWishlist(prev => {
      const exists = prev.includes(productId);
      if (exists) {
        notify('Removed from wishlist', 'info');
        return prev.filter(id => id !== productId);
      } else {
        notify('Saved to wishlist!', 'success');
        return [...prev, productId];
      }
    });
  };

  const addToCart = (item: CartItem) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(i => i.product.id === item.product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += item.quantity;
        return updated;
      }
      return [...prev, item];
    });
    notify(`Added "${item.product.title.slice(0, 24)}..." to cart!`, 'success');
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(i => i.id !== cartItemId));
    notify('Item removed from cart', 'info');
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Coupons
  const applyCoupon = (code: string, currentTotal: number): boolean => {
    const cleanCode = code.trim().toUpperCase();
    const coupon = VALID_COUPONS.find(c => c.code === cleanCode);
    if (!coupon) {
      notify('Invalid promo code. Try "CAMPUSLOVE" or "FIRSTCRAFT"', 'error');
      return false;
    }
    if (currentTotal < coupon.minOrder) {
      notify(`This coupon requires a minimum order of ₦${coupon.minOrder.toLocaleString()}`, 'error');
      return false;
    }
    setAppliedCoupon(coupon);
    notify(`Promo code ${coupon.code} applied: ₦${coupon.discountAmount.toLocaleString()} discount!`, 'success');
    return true;
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    notify('Coupon removed', 'info');
  };

  // Rule 3: Payment status changes only when Paystack's webhook confirms it, verified by signature and processed once per payment. Never trust the browser.
  const processPaystackWebhook = (eventData: {
    event: 'charge.success';
    reference: string;
    signature: string;
    amount: number;
    customerEmail: string;
    orderId: string;
    channel: 'card' | 'bank_transfer' | 'ussd';
  }): { success: boolean; message: string } => {
    // 1. Signature check
    const sigCheck = verifyPaystackWebhookSignature(JSON.stringify(eventData), eventData.signature);
    if (!sigCheck.isValid) {
      return { success: false, message: 'Invalid Paystack webhook signature' };
    }

    // 2. Idempotency: only process once per payment
    if (paystackWebhooks.some(w => w.reference === eventData.reference)) {
      return { success: true, message: 'Webhook event already processed (idempotent duplicate skipped)' };
    }

    const eventId = `evt_pstk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newWebhookRecord: PaystackWebhookEvent = {
      id: eventId,
      event: eventData.event,
      signature: sigCheck.signature,
      verified: true,
      processedAt: new Date().toISOString(),
      reference: eventData.reference,
      amount: eventData.amount,
      customerEmail: eventData.customerEmail,
      orderId: eventData.orderId,
      channel: eventData.channel,
    };

    setPaystackWebhooks(prev => [newWebhookRecord, ...prev]);

    // 3. Update order status to paid
    setOrders(prev =>
      prev.map(o => (o.id === eventData.orderId ? { ...o, status: 'paid' as OrderStatus } : o))
    );

    // 4. Rule 5 & Rule 2: Append-only ledger credit to Pending Balance
    const targetOrder = orders.find(o => o.id === eventData.orderId);
    if (targetOrder) {
      const newEntries: LedgerEntry[] = targetOrder.items.map(item => ({
        id: `LEDGER-${Math.floor(100000 + Math.random() * 900000)}`,
        walletId: item.sellerId,
        orderId: targetOrder.id,
        type: 'sale_pending',
        amount: item.sellerPrice * item.quantity,
        fee: item.serviceFee * item.quantity,
        balanceType: 'pending',
        balanceAfter: 0,
        description: `Paystack Escrow Deposit · Order #${targetOrder.id} (${item.title})`,
        reference: eventData.reference,
        paystackEventId: eventId,
        createdAt: new Date().toISOString(),
      }));

      setLedgerEntries(prev => [...newEntries, ...prev]);
    }

    return {
      success: true,
      message: `Paystack webhook verified (${sigCheck.signature.slice(0, 18)}...). Payment confirmed into escrow ledger.`,
    };
  };

  // Orders and Escrow Management (Rule 1: No buyer wallet. Buyers pay via Paystack.)
  const placeOrder = (orderData: Omit<Order, 'id' | 'createdAt' | 'autoReleaseAt' | 'hasReview'>): Order => {
    const orderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
    const now = new Date();
    const autoRelease = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days auto-release rule

    const handshakeCode = Math.floor(1000 + Math.random() * 9000).toString();
    const paystackRef = `pstk_test_${Date.now()}_${Math.floor(10000 + Math.random() * 90000)}`;

    const newOrder: Order = {
      ...orderData,
      id: orderId,
      createdAt: now.toISOString(),
      autoReleaseAt: autoRelease.toISOString(),
      hasReview: false,
      status: 'paid', // Escrow begins
      paymentReference: paystackRef,
      handshakeOtp: handshakeCode,
      handshakeVerified: false,
    };

    setOrders(prev => [newOrder, ...prev]);

    // Rule 3: Automatically simulate server-authoritative Paystack webhook verification
    const webhookEventId = `evt_pstk_${Date.now()}`;
    const webhookSignature = `sha512_pstk_${Math.random().toString(36).substring(2, 18)}`;
    const newWebhookRecord: PaystackWebhookEvent = {
      id: webhookEventId,
      event: 'charge.success',
      signature: webhookSignature,
      verified: true,
      processedAt: now.toISOString(),
      reference: paystackRef,
      amount: newOrder.grandTotal,
      customerEmail: currentUser?.email || 'customer@shopit.ng',
      orderId: orderId,
      channel: newOrder.paymentMethod === 'paystack_transfer' ? 'bank_transfer' : 'card',
    };
    setPaystackWebhooks(prev => [newWebhookRecord, ...prev]);

    // Rule 5 & Rule 2: Append-only ledger updates: Record 'sale_pending' for each seller
    const newLedgerEntries: LedgerEntry[] = newOrder.items.map(item => ({
      id: `LEDGER-${Math.floor(100000 + Math.random() * 900000)}`,
      walletId: item.sellerId,
      orderId: orderId,
      type: 'sale_pending',
      amount: item.sellerPrice * item.quantity,
      fee: item.serviceFee * item.quantity,
      balanceType: 'pending',
      balanceAfter: 0,
      description: `Paystack Escrow Deposit · Order #${orderId} (${item.title})`,
      reference: paystackRef,
      paystackEventId: webhookEventId,
      createdAt: now.toISOString(),
    }));

    setLedgerEntries(prev => [...newLedgerEntries, ...prev]);

    clearCart();
    setAppliedCoupon(null);
    notify(`Order #${orderId} confirmed via Paystack Webhook and held in Shop It Escrow!`, 'success');
    return newOrder;
  };

  const updateOrderStatus = (
    orderId: string,
    status: OrderStatus,
    extra?: { packedPhotoUrl?: string; disputeReason?: string }
  ) => {
    const now = new Date().toISOString();
    setOrders(prev =>
      prev.map(ord => {
        if (ord.id === orderId) {
          const updated: Order = { ...ord, status };
          if (status === 'packed') {
            updated.packedAt = now;
            if (extra?.packedPhotoUrl) updated.packedPhotoUrl = extra.packedPhotoUrl;
          } else if (status === 'shipped') {
            updated.shippedAt = now;
          } else if (status === 'delivered') {
            updated.deliveredAt = now;
          } else if (status === 'completed') {
            updated.completedAt = now;
          } else if (status === 'disputed' && extra?.disputeReason) {
            updated.disputeReason = extra.disputeReason;
          }
          return updated;
        }
        return ord;
      })
    );

    if (status === 'packed') {
      notify('Order marked as Packed with photo verification!', 'success');
    } else if (status === 'shipped') {
      notify('Order dispatched/shipped to campus drop point!', 'info');
    } else if (status === 'delivered') {
      notify('Order delivered! Buyer notified to inspect.', 'info');
    }
  };

  // Rule 2: Money moves to Available only after the buyer taps "Item received" or after the 5-day auto-release, and only if there is no open dispute.
  const confirmItemReceived = (orderId: string) => {
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;

    if (ord.status === 'disputed') {
      notify(`Cannot release escrow: Order #${orderId} has an open dispute under moderation. Funds remain frozen.`, 'error');
      return;
    }

    updateOrderStatus(orderId, 'completed');

    // Rule 5: Append 'escrow_release' to append-only ledger
    const now = new Date().toISOString();
    const releaseEntries: LedgerEntry[] = ord.items.map(item => ({
      id: `LEDGER-${Math.floor(100000 + Math.random() * 900000)}`,
      walletId: item.sellerId,
      orderId: orderId,
      type: 'escrow_release',
      amount: item.sellerPrice * item.quantity,
      fee: 0,
      balanceType: 'available',
      balanceAfter: 0,
      description: `Escrow Released · Buyer confirmed item received for Order #${orderId}`,
      reference: orderId,
      createdAt: now,
    }));

    setLedgerEntries(prev => [...releaseEntries, ...prev]);
    notify(`Item received confirmed! Escrow funds released to Available Balance for withdrawal.`, 'success');
  };

  // Rule 1: No buyer wallet. Refunds go back to original payment method through Paystack.
  const cancelOrder = (orderId: string) => {
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;
    if (ord.status !== 'paid') {
      notify('Orders cannot be cancelled once the seller marks them as packed.', 'error');
      return;
    }
    updateOrderStatus(orderId, 'cancelled');

    // Append 'refund' entry to append-only ledger to reverse pending balance
    const now = new Date().toISOString();
    const refundEntries: LedgerEntry[] = ord.items.map(item => ({
      id: `LEDGER-${Math.floor(100000 + Math.random() * 900000)}`,
      walletId: item.sellerId,
      orderId: orderId,
      type: 'refund',
      amount: item.sellerPrice * item.quantity,
      fee: 0,
      balanceType: 'pending',
      balanceAfter: 0,
      description: `Order #${orderId} Cancelled · Refunded back to buyer's original payment method via Paystack`,
      reference: `pstk_rfnd_${Date.now()}`,
      createdAt: now,
    }));

    setLedgerEntries(prev => [...refundEntries, ...prev]);
    notify(`Order #${orderId} cancelled. ₦${ord.grandTotal.toLocaleString()} refunded to original payment method via Paystack.`, 'success');
  };

  const openDispute = (orderId: string, reason: string) => {
    updateOrderStatus(orderId, 'disputed', { disputeReason: reason });
    const ord = orders.find(o => o.id === orderId);
    if (ord) {
      const newDispute: DisputeTicket = {
        id: `disp_${Date.now()}`,
        orderId,
        buyerMaskedId: ord.buyerMaskedId,
        buyerName: ord.buyerName || 'Tobi Adebisi',
        sellerId: ord.items[0]?.sellerId || 'seller_amaka',
        sellerShopName: ord.items[0]?.sellerShopName || 'Amaka Beads & Charms',
        reason,
        description: reason,
        sellerPackedPhotoUrl: ord.packedPhotoUrl,
        evidencePhotoUrl: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=600&auto=format&fit=crop&q=80',
        amountHeldInEscrow: ord.grandTotal,
        status: 'open',
        createdAt: 'Just now',
      };
      setDisputes(prev => [newDispute, ...prev]);
    }
    notify('Dispute opened. Escrow release is frozen while moderation reviews.', 'error');
  };

  const submitOrderReview = (orderId: string, productId: string, rating: number, comment: string) => {
    const reviewId = `rev_${Date.now()}`;
    const newReview = {
      id: reviewId,
      productId,
      buyerMaskedId: currentUser?.name ? `Buyer #${Math.floor(1000 + Math.random() * 9000)}` : 'Verified Buyer',
      rating,
      comment,
      date: 'Just now',
      verifiedPurchase: true,
    };

    setProducts(prev =>
      prev.map(p => {
        if (p.id === productId) {
          const updatedReviews = [newReview, ...p.reviews];
          const newAvg = updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length;
          return {
            ...p,
            reviews: updatedReviews,
            reviewCount: updatedReviews.length,
            rating: Number(newAvg.toFixed(1)),
          };
        }
        return p;
      })
    );

    setOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, hasReview: true } : o))
    );

    notify('Thank you for rating your campus artisan!', 'success');
  };

  // Rule 4: Send an OTP before every withdrawal
  const sendWithdrawalOtp = (amount: number): string => {
    const phone = currentUser?.phone || '+2348000000000';
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    setActiveWithdrawalOtp({ code, phone, expiresAt, amount });
    notify(`[Paystack OTP SMS] Your withdrawal authorization code is ${code}. Transacting ₦${amount.toLocaleString()} to payout account. Valid for 10 mins.`, 'info');
    return code;
  };

  // Rule 4 & Rule 5: Seller withdrawals go to Opay or a Nigerian bank through Paystack Transfers API
  const requestWithdrawal = (amount: number, payoutAccountId: string, otpCode: string): boolean => {
    if (!currentSeller) return false;

    // Rule 5: Derived balances from append-only ledger
    const sellerLedger = ledgerEntries.filter(e => e.walletId === currentSeller.id);
    const balances = calculateBalancesFromLedger(sellerLedger);
    const baseWallet = wallets[currentSeller.id];

    // Rule 5: Admin can freeze a wallet
    if (baseWallet?.isFrozen) {
      notify(`Wallet is frozen by Administrator: ${baseWallet.freezeReason || 'Security review in progress'}. Withdrawals are temporarily disabled.`, 'error');
      return false;
    }

    // Rule 4: Minimum ₦1,000
    if (amount < 1000) {
      notify('Minimum withdrawal amount is ₦1,000.', 'error');
      return false;
    }

    // Rule 4: Send an OTP before every withdrawal
    if (!activeWithdrawalOtp || activeWithdrawalOtp.code !== otpCode.trim()) {
      notify('Invalid or expired withdrawal OTP. Please request a new code.', 'error');
      return false;
    }
    if (Date.now() > activeWithdrawalOtp.expiresAt) {
      notify('Withdrawal OTP has expired. Please request a new code.', 'error');
      return false;
    }

    const payoutAccount = (baseWallet?.payoutAccounts || []).find(p => p.id === payoutAccountId);
    if (!payoutAccount) {
      notify('Selected payout account not found. Please link an Opay or bank account.', 'error');
      return false;
    }

    // Rule 4: A new payout account waits 24 hours before it can be used
    const cooling = isPayoutAccountCooled(payoutAccount);
    if (!cooling.isCooled) {
      notify(`This payout account was added recently and is in a 24-hour security cooling period (${cooling.hoursRemaining}h remaining) to prevent unauthorized drain.`, 'error');
      return false;
    }

    // Rule 4: The account name must match the seller's verified ID name
    const verifiedName = currentUser?.name || currentSeller.shopName;
    const nameMatch = validateAccountNameMatch(payoutAccount.accountName, verifiedName);
    if (!nameMatch.isMatch) {
      notify(nameMatch.reason || 'Account name does not match verified seller identity.', 'error');
      return false;
    }

    // Withdrawal network fee: free above ₦5,000, flat ₦50 below
    const fee = amount >= DEFAULT_FEE_SETTINGS.withdrawalFeeRule.freeThreshold
      ? 0
      : DEFAULT_FEE_SETTINGS.withdrawalFeeRule.flatFeeBelowThreshold;
    const totalDeduction = amount + fee;

    if (balances.availableBalance < totalDeduction) {
      notify(`Insufficient Available balance. You have ₦${balances.availableBalance.toLocaleString()} available. Needed: ₦${totalDeduction.toLocaleString()} (including ₦${fee} network fee).`, 'error');
      return false;
    }

    // Rule 4 & 6: Execute Paystack Transfers API (Test Mode)
    const transferResult = executePaystackTransfer(payoutAccount, amount);

    // Rule 5: Append-only ledger debit
    const now = new Date().toISOString();
    const newTxn: LedgerEntry = {
      id: `LEDGER-${Math.floor(100000 + Math.random() * 900000)}`,
      walletId: currentSeller.id,
      type: 'withdrawal',
      amount,
      fee,
      balanceType: 'available',
      balanceAfter: balances.availableBalance - totalDeduction,
      description: `Paystack Transfer Payout · ${payoutAccount.bankName} (${payoutAccount.accountNumber})`,
      reference: transferResult.transferCode,
      payoutBank: payoutAccount.bankName,
      payoutAccountNumber: payoutAccount.accountNumber,
      payoutAccountName: payoutAccount.accountName,
      transferCode: transferResult.transferCode,
      createdAt: now,
    };

    setLedgerEntries(prev => [newTxn, ...prev]);
    setActiveWithdrawalOtp(null);

    notify(transferResult.message, 'success');
    return true;
  };

  // Rule 4: Add Payout Account (Opay or Nigerian bank)
  const addPayoutAccount = (
    bankCode: string,
    bankName: string,
    accountNumber: string,
    accountName: string
  ): boolean => {
    if (!currentSeller) return false;

    if (accountNumber.trim().length !== 10) {
      notify('Nigerian bank/Opay account numbers must be exactly 10 digits.', 'error');
      return false;
    }

    // Rule 4: Account name must match verified ID name
    const verifiedName = currentUser?.name || currentSeller.shopName;
    const nameMatch = validateAccountNameMatch(accountName, verifiedName);
    if (!nameMatch.isMatch) {
      notify(nameMatch.reason || 'Account name must match your verified seller identity.', 'error');
      return false;
    }

    // Rule 4: A new payout account waits 24 hours before it can be used
    const coolingEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const newAccount: PayoutAccount = {
      id: `payout_${Date.now()}`,
      bankCode,
      bankName,
      accountNumber: accountNumber.trim(),
      accountName: accountName.trim().toUpperCase(),
      isVerified: true,
      coolingPeriodEndsAt: coolingEndsAt,
      createdAt: new Date().toISOString(),
    };

    setWallets(prev => {
      const currentW = prev[currentSeller.id] || {
        sellerId: currentSeller.id,
        pendingBalance: 0,
        availableBalance: 0,
        totalWithdrawn: 0,
        isFrozen: false,
        payoutAccounts: [],
        ledger: [],
        transactions: [],
      };

      return {
        ...prev,
        [currentSeller.id]: {
          ...currentW,
          payoutAccounts: [...currentW.payoutAccounts, newAccount],
          activePayoutAccountId: newAccount.id,
        },
      };
    });

    notify(`Payout account ${bankName} (${accountNumber}) linked! 24-hr security cooling period active until tomorrow.`, 'success');
    return true;
  };

  // Rule 5: Admin can freeze a wallet
  const toggleWalletFreeze = (sellerId: string, freeze: boolean, reason?: string) => {
    setWallets(prev => {
      const w = prev[sellerId] || {
        sellerId,
        pendingBalance: 0,
        availableBalance: 0,
        totalWithdrawn: 0,
        isFrozen: false,
        payoutAccounts: [],
        ledger: [],
        transactions: [],
      };
      return {
        ...prev,
        [sellerId]: {
          ...w,
          isFrozen: freeze,
          freezeReason: freeze ? (reason || 'Admin Security Review') : undefined,
        },
      };
    });
    notify(freeze ? `Wallet for ${sellerId} frozen by Admin.` : `Wallet for ${sellerId} unfrozen.`, 'info');
  };

  const toggleTwoFactor = () => {
    if (!currentUser) return;
    setSecurityProfiles(prev => {
      const p = prev[currentUser.id] || prev['user_tobi_buyer'];
      const nextVal = !p.twoFactorEnabled;
      notify(nextVal ? 'Two-Factor Authentication (2FA via SMS) enabled!' : 'Two-Factor Authentication disabled.', 'info');
      return {
        ...prev,
        [currentUser.id]: {
          ...p,
          twoFactorEnabled: nextVal,
        },
      };
    });
  };

  const revokeSession = (sessionId: string) => {
    if (!currentUser) return;
    setSecurityProfiles(prev => {
      const p = prev[currentUser.id] || prev['user_tobi_buyer'];
      return {
        ...prev,
        [currentUser.id]: {
          ...p,
          sessions: p.sessions.filter(s => s.id !== sessionId),
        },
      };
    });
    notify('Session logged out on other device.', 'info');
  };

  const buyerActiveOrdersCount = orders.filter(
    o => o.status !== 'completed' && o.status !== 'cancelled'
  ).length;

  // Phase 3: Report Problem Modal handlers
  const openReportProblemModal = (orderId: string) => {
    setActiveReportOrderId(orderId);
    setIsReportProblemModalOpen(true);
  };
  const closeReportProblemModal = () => {
    setIsReportProblemModalOpen(false);
    setActiveReportOrderId(null);
  };

  // Phase 3: Locked Chat Handlers
  const openChat = (
    conversationId?: string,
    targetInfo?: { orderId?: string; productId?: string; sellerId?: string }
  ) => {
    if (conversationId) {
      setActiveConversationId(conversationId);
      setActiveView('chat');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (targetInfo) {
      const existing = conversations.find(
        c => (targetInfo.orderId && c.orderId === targetInfo.orderId) ||
             (targetInfo.productId && c.productId === targetInfo.productId && c.sellerId === targetInfo.sellerId)
      );

      if (existing) {
        setActiveConversationId(existing.id);
      } else {
        const product = targetInfo.productId ? products.find(p => p.id === targetInfo.productId) : undefined;
        const seller = targetInfo.sellerId ? getSellerById(targetInfo.sellerId) : undefined;
        const newConvId = `conv_${Date.now()}`;
        const newConv: Conversation = {
          id: newConvId,
          orderId: targetInfo.orderId,
          productId: targetInfo.productId,
          productTitle: product?.title || (targetInfo.orderId ? `Order #${targetInfo.orderId}` : 'Campus Craft Inquiry'),
          productImage: product?.images[0],
          buyerId: currentUser?.id || 'user_tobi_buyer',
          buyerMaskedId: currentUser?.name ? `Buyer #${Math.floor(1000 + Math.random() * 9000)}` : 'Buyer #7821',
          sellerId: targetInfo.sellerId || product?.sellerId || 'seller_amaka',
          sellerShopName: seller?.shopName || product?.sellerShopName || 'Artisan Shop',
          lastMessage: 'Conversation opened',
          lastMessageAt: 'Just now',
          unreadBuyer: 0,
          unreadSeller: 0,
          isChatLocked: false,
          bypassViolationsCount: 0,
        };

        setConversations(prev => [newConv, ...prev]);
        setMessages(prev => ({
          ...prev,
          [newConvId]: [
            {
              id: `msg_${Date.now()}`,
              conversationId: newConvId,
              senderRole: 'system',
              senderMaskedName: 'Shop It Safety Bot',
              senderId: 'system',
              content: 'Locked Chat Active: Never pay or chat outside Shop It. Escrow protection is only guaranteed for in-app payments.',
              timestamp: 'Just now',
            },
          ],
        }));
        setActiveConversationId(newConvId);
      }
    }
    setActiveView('chat');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sendMessage = (
    conversationId: string,
    content: string,
    customOrder?: any,
    presetOffer?: { price: number; quantity: number; title?: string }
  ): { success: boolean; isBlocked?: boolean; warning?: string } => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return { success: false };

    if (conv.isChatLocked) {
      notify('This chat is locked by Shop It safety moderation due to repeated bypass attempts.', 'error');
      return { success: false, isBlocked: true, warning: 'Chat locked by moderation' };
    }

    // STRICT USER REQUIREMENT: Block all numbers (digits and number words) in chat text!
    // Prices and quantities are picked from preset buttons, never typed.
    if (content.trim()) {
      const numCheck = checkNumbersInText(content);
      if (numCheck.hasNumber) {
        notify('Numbers and number words are blocked in chat. Please use the preset price and quantity chips below!', 'error');
        return {
          success: false,
          isBlocked: true,
          warning: 'Numbers and number words are strictly blocked in chat to protect your escrow safety. Please tap the preset price and quantity buttons.',
        };
      }
    }

    const check = filterAntiBypass(content);
    let newViolationsCount = conv.bypassViolationsCount;

    if (check.isViolated) {
      newViolationsCount += 1;
      const isLockedNow = newViolationsCount >= 2;

      const newFlag: AntiBypassFlag = {
        id: `flag_${Date.now()}`,
        conversationId,
        senderId: currentUser?.id || 'user_anon',
        senderRole: currentUser?.role === 'seller' ? 'seller' : 'buyer',
        senderMaskedName: currentUser?.role === 'seller' ? (currentUser.sellerProfile?.shopName || 'Seller') : 'Buyer #7821',
        offendingText: content,
        maskedText: check.sanitizedText,
        detectedPatterns: check.detectedViolations,
        timestamp: 'Just now',
        status: isLockedNow ? 'chat_locked' : 'warning_issued',
      };

      setAntiBypassFlags(prev => [newFlag, ...prev]);

      if (isLockedNow) {
        setConversations(prev =>
          prev.map(c => c.id === conversationId ? { ...c, isChatLocked: true, bypassViolationsCount: newViolationsCount } : c)
        );
        notify('Chat locked! Repeated off-platform contact attempts detected. Sent to Admin Moderator.', 'error');
      } else {
        notify('Safety Warning: Off-platform contact details detected & masked! Never trade outside Shop It.', 'error');
      }
    }

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      conversationId,
      senderRole: currentUser?.role === 'seller' ? 'seller' : (currentUser?.role === 'admin' ? 'admin' : 'buyer'),
      senderMaskedName: currentUser?.role === 'seller'
        ? (currentUser.sellerProfile?.shopName || 'Seller')
        : (currentUser?.role === 'admin' ? 'Shop It Admin Support' : (conv.buyerMaskedId || 'Buyer #7821')),
      senderId: currentUser?.id || 'anon',
      content: check.isViolated ? check.sanitizedText : content,
      originalContent: check.isViolated ? content : undefined,
      isBlockedBypass: check.isViolated,
      blockedTokens: check.detectedViolations,
      timestamp: 'Just now',
      customOrderDetails: customOrder,
      presetOffer,
    };

    setMessages(prev => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newMsg],
    }));

    setConversations(prev =>
      prev.map(c => {
        if (c.id === conversationId) {
          return {
            ...c,
            lastMessage: newMsg.content,
            lastMessageAt: 'Just now',
            bypassViolationsCount: newViolationsCount,
          };
        }
        return c;
      })
    );

    return {
      success: true,
      isBlocked: check.isViolated,
      warning: check.isViolated ? `Blocked patterns: ${check.detectedViolations.join(', ')}` : undefined,
    };
  };

  // Phase 3: Admin & Moderation Handlers
  const updateVerificationRequest = (id: string, status: 'approved' | 'rejected', notes?: string) => {
    setVerificationRequests(prev =>
      prev.map(req => {
        if (req.id === id) {
          return { ...req, status, notes: notes || req.notes };
        }
        return req;
      })
    );

    const targetReq = verificationRequests.find(r => r.id === id);
    if (targetReq && status === 'approved') {
      setSellers(prev =>
        prev.map(s => {
          if (s.id === targetReq.sellerId) {
            return {
              ...s,
              isVerifiedSeller: true,
              verificationStatus: 'approved',
              badges: Array.from(new Set([...s.badges, 'verified'])),
            };
          }
          return s;
        })
      );
      notify(`Seller "${targetReq.shopName}" approved! Verified badge granted.`, 'success');
    } else {
      notify(`Verification request marked as ${status}.`, 'info');
    }
  };

  const resolveDispute = (
    disputeId: string,
    resolution: 'refund_full' | 'release_seller' | 'partial',
    amount?: number,
    notes?: string
  ) => {
    const disp = disputes.find(d => d.id === disputeId);
    if (!disp) return;

    const ord = orders.find(o => o.id === disp.orderId);

    if (resolution === 'refund_full') {
      if (ord) updateOrderStatus(ord.id, 'cancelled');
      setWallets(prev => {
        const w = prev[disp.sellerId] || prev['seller_amaka'];
        if (!w) return prev;
        return {
          ...prev,
          [disp.sellerId]: {
            ...w,
            pendingBalance: Math.max(0, w.pendingBalance - disp.amountHeldInEscrow),
            transactions: [
              {
                id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
                type: 'refund',
                amount: disp.amountHeldInEscrow,
                fee: 0,
                balanceAfter: w.availableBalance,
                status: 'completed',
                description: `Dispute Resolved · Full Refund of ₦${disp.amountHeldInEscrow.toLocaleString()} to Buyer`,
                reference: disp.orderId,
                createdAt: 'Just now',
              },
              ...w.transactions,
            ],
          },
        };
      });

      setDisputes(prev =>
        prev.map(d => d.id === disputeId ? { ...d, status: 'resolved_refunded', resolutionNotes: notes } : d)
      );
      notify(`Dispute resolved: Full refund of ₦${disp.amountHeldInEscrow.toLocaleString()} returned to buyer.`, 'success');
    } else if (resolution === 'release_seller') {
      if (ord) updateOrderStatus(ord.id, 'completed');
      setWallets(prev => {
        const w = prev[disp.sellerId] || prev['seller_amaka'];
        if (!w) return prev;
        const newAvailable = w.availableBalance + disp.amountHeldInEscrow;
        return {
          ...prev,
          [disp.sellerId]: {
            ...w,
            availableBalance: newAvailable,
            pendingBalance: Math.max(0, w.pendingBalance - disp.amountHeldInEscrow),
            transactions: [
              {
                id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
                type: 'escrow_release',
                amount: disp.amountHeldInEscrow,
                fee: 0,
                balanceAfter: newAvailable,
                status: 'completed',
                description: `Dispute Resolved · Escrow released in seller favor`,
                reference: disp.orderId,
                createdAt: 'Just now',
              },
              ...w.transactions,
            ],
          },
        };
      });

      setDisputes(prev =>
        prev.map(d => d.id === disputeId ? { ...d, status: 'resolved_released', resolutionNotes: notes } : d)
      );
      notify(`Dispute resolved: ₦${disp.amountHeldInEscrow.toLocaleString()} released to seller wallet!`, 'success');
    } else if (resolution === 'partial') {
      const refundVal = amount || Math.round(disp.amountHeldInEscrow / 2);
      const sellerVal = disp.amountHeldInEscrow - refundVal;
      if (ord) updateOrderStatus(ord.id, 'completed');

      setWallets(prev => {
        const w = prev[disp.sellerId] || prev['seller_amaka'];
        if (!w) return prev;
        const newAvailable = w.availableBalance + sellerVal;
        return {
          ...prev,
          [disp.sellerId]: {
            ...w,
            availableBalance: newAvailable,
            pendingBalance: Math.max(0, w.pendingBalance - disp.amountHeldInEscrow),
            transactions: [
              {
                id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
                type: 'escrow_release',
                amount: sellerVal,
                fee: 0,
                balanceAfter: newAvailable,
                status: 'completed',
                description: `Dispute Partial Resolution · ₦${sellerVal.toLocaleString()} released to seller`,
                reference: disp.orderId,
                createdAt: 'Just now',
              },
              ...w.transactions,
            ],
          },
        };
      });

      setDisputes(prev =>
        prev.map(d => d.id === disputeId ? { ...d, status: 'resolved_partial', refundAmount: refundVal, resolutionNotes: notes } : d)
      );
      notify(`Partial resolution: ₦${refundVal.toLocaleString()} refunded to buyer, ₦${sellerVal.toLocaleString()} released to seller.`, 'success');
    }
  };

  const updateFlagStatus = (flagId: string, action: 'warn' | 'lock_chat' | 'freeze_account' | 'dismiss') => {
    setAntiBypassFlags(prev =>
      prev.map(f => {
        if (f.id === flagId) {
          const newStatus = action === 'freeze_account'
            ? 'account_frozen'
            : (action === 'lock_chat' ? 'chat_locked' : 'reviewed');
          return { ...f, status: newStatus };
        }
        return f;
      })
    );

    const flag = antiBypassFlags.find(f => f.id === flagId);
    if (flag && action === 'lock_chat') {
      setConversations(prev =>
        prev.map(c => c.id === flag.conversationId ? { ...c, isChatLocked: true } : c)
      );
      notify(`Chat locked for flag #${flagId}.`, 'info');
    } else if (flag && action === 'freeze_account') {
      if (flag.senderRole === 'seller') {
        toggleWalletFreeze(flag.senderId, true, 'Anti-bypass repeated violation');
      }
      notify(`Account for sender ${flag.senderMaskedName} frozen for safety review.`, 'error');
    } else {
      notify(`Flag action: ${action} applied.`, 'info');
    }
  };

  const updateFeeSettings = (newSettings: Partial<FeeSettings>) => {
    setFeeSettings(prev => {
      const updated = { ...prev, ...newSettings };
      notify('Platform fee settings updated successfully!', 'success');
      return updated;
    });
  };

  const openCheckoutModal = () => setIsCheckoutModalOpen(true);
  const closeCheckoutModal = () => setIsCheckoutModalOpen(false);

  const toggleLowDataMode = () => {
    setLowDataMode(prev => {
      const next = !prev;
      notify(next ? 'Low-Data Mode ON (saving data on campus networks)' : 'Standard High-Res Mode ON', 'info');
      return next;
    });
  };

  const toggleLanguage = () => {
    setLanguage(prev => {
      const next = prev === 'en' ? 'pidgin' : 'en';
      notify(next === 'pidgin' ? 'Language set to Naija Pidgin' : 'Language set to English', 'info');
      return next;
    });
  };

  const openProduct = (id: string) => {
    setSelectedProductId(id);
    setActiveView('product_detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openSellerShop = (sellerId: string) => {
    setSelectedSellerId(sellerId);
    setActiveView('seller_shop');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedCampus('All Campuses');
    setSelectedState('all');
    setSelectedCity('all');
    setSelectedArea('all');
    setPriceFilter('all');
    setSortBy('newest');
  };

  // Typo-tolerant and flexible search & filter logic
  const filteredProducts = products.filter(product => {
    const seller = getSellerById(product.sellerId);
    if (seller?.vacationMode) return false;

    if (selectedCategory !== 'all' && product.category !== selectedCategory) return false;

    // Nigerian State > City > Area filtering
    if (selectedState !== 'all' && product.location?.state && product.location.state !== selectedState) return false;
    if (selectedCity !== 'all' && product.location?.city && product.location.city !== selectedCity) return false;
    if (selectedArea !== 'all') {
      const prodArea = product.locationArea || product.location?.area;
      if (prodArea && prodArea !== selectedArea) return false;
    }

    if (selectedCampus !== 'All Campuses' && product.sellerCampus && product.sellerCampus !== selectedCampus) return false;

    if (priceFilter === 'under2k' && product.displayPrice >= 2000) return false;
    if (priceFilter === '2k-5k' && (product.displayPrice < 2000 || product.displayPrice > 5000)) return false;
    if (priceFilter === '5k-10k' && (product.displayPrice < 5000 || product.displayPrice > 10000)) return false;
    if (priceFilter === 'above10k' && product.displayPrice <= 10000) return false;

    if (searchQuery.trim()) {
      const cleanQuery = searchQuery.toLowerCase().trim();
      const title = product.title.toLowerCase();
      const desc = product.description.toLowerCase();
      const shop = product.sellerShopName.toLowerCase();
      const campus = (product.sellerCampus || '').toLowerCase();
      const area = (product.locationArea || '').toLowerCase();
      const cat = product.category.toLowerCase();

      if (title.includes(cleanQuery) || desc.includes(cleanQuery) || shop.includes(cleanQuery) || campus.includes(cleanQuery) || area.includes(cleanQuery) || cat.includes(cleanQuery)) {
        return true;
      }

      const typoMap: Record<string, string[]> = {
        bead: ['bead', 'beads', 'waistbead', 'waistbeads', 'bracelet', 'charm'],
        scent: ['fragrance', 'perfume', 'mist', 'oil', 'scent', 'candle', 'diffuser', 'frangrance', 'fragrans'],
        bag: ['bag', 'bags', 'tote', 'crochet', 'clutch', 'pouch', 'knitted'],
        unilag: ['unilag', 'akoka', 'moremi'],
        ilorin: ['ilorin', 'unilorin'],
        ibadan: ['ui', 'ibadan'],
        nsukka: ['unn', 'nsukka'],
      };

      for (const [key, aliases] of Object.entries(typoMap)) {
        if (aliases.some(a => cleanQuery.includes(a) || a.includes(cleanQuery))) {
          if (title.includes(key) || desc.includes(key) || cat.includes(key)) {
            return true;
          }
        }
      }

      return false;
    }

    return true;
  }).sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === 'price_asc') {
      return a.displayPrice - b.displayPrice;
    }
    if (sortBy === 'price_desc') {
      return b.displayPrice - a.displayPrice;
    }
    if (sortBy === 'top_rated') {
      return b.rating - a.rating;
    }
    return 0;
  });

  // ==========================================
  // PHASE 4: CAMPUS LOGISTICS & HANDSHAKE OTP
  // ==========================================

  const verifyHandshakeOtp = (
    orderId: string,
    inputOtp: string
  ): { success: boolean; message: string } => {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return { success: false, message: 'Order not found.' };
    }

    const cleanInput = inputOtp.trim();
    const expectedOtp = order.handshakeOtp || '7429';

    if (cleanInput !== expectedOtp) {
      notify('Incorrect Handshake PIN. Please verify with buyer.', 'error');
      return { success: false, message: 'Invalid 4-digit Handshake PIN.' };
    }

    // PIN verified: Complete order & release escrow
    setOrders(prev =>
      prev.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            handshakeVerified: true,
            status: 'completed',
            deliveredAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          };
        }
        return o;
      })
    );

    setWallets(prevWallets => {
      const updated = { ...prevWallets };
      order.items.forEach(item => {
        const sId = item.sellerId;
        const currentW = updated[sId] || updated['seller_amaka'];
        if (currentW) {
          const itemEarnings = item.sellerPrice * item.quantity;
          const newAvailable = currentW.availableBalance + itemEarnings;
          const newPending = Math.max(0, currentW.pendingBalance - itemEarnings);

          const newTxn: WalletTransaction = {
            id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
            type: 'escrow_release',
            amount: itemEarnings,
            fee: 0,
            balanceAfter: newAvailable,
            status: 'completed',
            description: `Handshake PIN Verified · Order #${orderId} delivered at safe spot`,
            reference: orderId,
            createdAt: 'Just now',
          };

          updated[sId] = {
            ...currentW,
            availableBalance: newAvailable,
            pendingBalance: newPending,
            transactions: [newTxn, ...currentW.transactions],
          };
        }
      });
      return updated;
    });

    notify(`Handshake Verified! Order #${orderId} completed and escrow funds released.`, 'success');
    return { success: true, message: 'Handshake PIN verified successfully! Escrow released.' };
  };

  const assignCampusRunner = (
    orderId: string,
    runnerId: string,
    pickupSpotId: string,
    dropoffSpotId: string
  ) => {
    const runner = campusRunners.find(r => r.id === runnerId);
    const pickupSpot = safePickupSpots.find(s => s.id === pickupSpotId);
    const dropoffSpot = safePickupSpots.find(s => s.id === dropoffSpotId);

    const tripId = `trip_${Date.now()}`;
    const newTrip: RunnerTrip = {
      id: tripId,
      orderId,
      runnerId,
      runnerName: runner ? runner.name : 'Campus Runner',
      pickupSpot: pickupSpot ? pickupSpot.name : 'Campus Porter Lodge',
      dropoffSpot: dropoffSpot ? dropoffSpot.name : 'Student Union Building',
      status: 'assigned',
      etaMinutes: 15,
      otpCode: Math.floor(1000 + Math.random() * 9000).toString(),
      lastCheckpointTime: 'Just now',
    };

    setRunnerTrips(prev => [newTrip, ...prev]);

    setOrders(prev =>
      prev.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            runnerId,
            runnerName: runner?.name,
            safeMeetingSpotId: dropoffSpotId,
            safeMeetingSpotName: dropoffSpot?.name,
            status: 'shipped',
          };
        }
        return o;
      })
    );

    notify(`Campus Runner ${runner?.name || 'Runner'} assigned to deliver Order #${orderId}!`, 'success');
  };

  const updateTripStatus = (tripId: string, status: RunnerTrip['status']) => {
    setRunnerTrips(prev =>
      prev.map(t => {
        if (t.id === tripId) {
          return {
            ...t,
            status,
            lastCheckpointTime: 'Just now',
            etaMinutes: status === 'handed_over' ? 0 : Math.max(0, t.etaMinutes - 5),
          };
        }
        return t;
      })
    );
    notify(`Runner trip status updated to: ${status.replace('_', ' ')}`, 'info');
  };

  // ==========================================
  // PHASE 5: ARTISAN COMMISSIONS & SOCIAL DROPS
  // ==========================================

  const submitCommissionRequest = (
    requestData: Omit<CustomCommissionRequest, 'id' | 'createdAt' | 'status' | 'buyerMaskedId'>
  ) => {
    const id = `comm_${Date.now()}`;
    const newComm: CustomCommissionRequest = {
      ...requestData,
      id,
      buyerMaskedId: currentUser?.name ? `Buyer #${currentUser.id.slice(-4)}` : 'Buyer #7821',
      status: 'pending_quote',
      createdAt: 'Just now',
    };

    setCommissions(prev => [newComm, ...prev]);
    notify(`Custom commission request submitted to ${requestData.artisanShopName}!`, 'success');
  };

  const updateCommissionStatus = (
    commissionId: string,
    status: CustomCommissionRequest['status'],
    wipPhoto?: string
  ) => {
    setCommissions(prev =>
      prev.map(c => {
        if (c.id === commissionId) {
          return {
            ...c,
            status,
            ...(wipPhoto ? { artisanWorkInProgressPhoto: wipPhoto } : {}),
          };
        }
        return c;
      })
    );
    notify(`Commission #${commissionId.slice(-4)} status updated: ${status.replace('_', ' ')}`, 'info');
  };

  const claimDropPreorder = (dropId: string) => {
    setCampusDrops(prev =>
      prev.map(d => {
        if (d.id === dropId) {
          if (d.claimedCount >= d.batchSize) {
            notify('This batch is sold out!', 'error');
            return d;
          }
          notify(`Pre-order spot reserved for "${d.title}"! Escrow deposit secured.`, 'success');
          return { ...d, claimedCount: d.claimedCount + 1 };
        }
        return d;
      })
    );
  };

  const toggleLikeStylePost = (postId: string) => {
    setStylePosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          const hasLiked = !!p.userHasLiked;
          return {
            ...p,
            userHasLiked: !hasLiked,
            likesCount: hasLiked ? p.likesCount - 1 : p.likesCount + 1,
          };
        }
        return p;
      })
    );
  };

  const submitStylePost = (
    postData: Omit<CampusStylePost, 'id' | 'timeAgo' | 'likesCount' | 'userHasLiked' | 'buyerMaskedId'>
  ) => {
    const id = `post_${Date.now()}`;
    const newPost: CampusStylePost = {
      ...postData,
      id,
      buyerMaskedId: currentUser?.name ? `Buyer #${currentUser.id.slice(-4)}` : 'Buyer #7821',
      timeAgo: 'Just now',
      likesCount: 1,
      userHasLiked: true,
    };
    setStylePosts(prev => [newPost, ...prev]);
    notify('Your campus craft style photo has been shared to the Campus Wall!', 'success');
  };

  // ==========================================
  // PHASE 6: AMBASSADOR & QUICK-LIST HANDLERS
  // ==========================================

  const applyReferralCode = (code: string): boolean => {
    const clean = code.trim().toUpperCase();
    const amb = ambassadors.find(a => a.referralCode === clean);
    if (!amb) {
      notify('Ambassador code not found. Check hall code spelling!', 'error');
      return false;
    }
    setActiveAmbassadorCode(clean);
    notify(`Ambassador code "${clean}" applied! ₦500 referral credit active for your hall.`, 'success');
    return true;
  };

  const openQuickListModal = () => setIsQuickListModalOpen(true);
  const closeQuickListModal = () => setIsQuickListModalOpen(false);

  const quickListFromTemplate = () => {
    openQuickListModal();
  };

  const clearAllProducts = () => {
    setProducts([]);
    localStorage.setItem('shopit_products_ready_made', JSON.stringify([]));
    localStorage.removeItem('shopit_products');
    notify('All products removed. Ready for new student artisans to put products!', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        switchRole,
        login,
        logout,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        authTab,
        setAuthTab,
        pendingAuthData,
        setPendingAuthData,
        verifyOtp,
        submitSellerRegistration,
        products,
        filteredProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        toggleProductStock,
        sellers,
        getSellerById,
        currentSeller,
        toggleVacationMode,
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        selectedCampus,
        setSelectedCampus,
        selectedState,
        setSelectedState,
        selectedCity,
        setSelectedCity,
        selectedArea,
        setSelectedArea,
        userLocation,
        setUserLocation,
        getDeliveryFee,
        priceFilter,
        setPriceFilter,
        sortBy,
        setSortBy,
        resetFilters,
        activeView,
        setActiveView,
        selectedProductId,
        selectedSellerId,
        openProduct,
        openSellerShop,
        wishlist,
        toggleWishlist,
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        cartCount,
        orders,
        placeOrder,
        updateOrderStatus,
        confirmItemReceived,
        cancelOrder,
        openDispute,
        submitOrderReview,
        buyerActiveOrdersCount,
        // Phase 3: Locked Chat
        conversations,
        messages,
        activeConversationId,
        setActiveConversationId,
        openChat,
        sendMessage,
        // Phase 3: Admin & Moderation
        adminSubRole,
        setAdminSubRole,
        verificationRequests,
        updateVerificationRequest,
        disputes,
        resolveDispute,
        antiBypassFlags,
        updateFlagStatus,
        feeSettings,
        updateFeeSettings,
        // Phase 4: Campus Safe Logistics & Handshake OTP
        safePickupSpots,
        campusRunners,
        runnerTrips,
        verifyHandshakeOtp,
        assignCampusRunner,
        updateTripStatus,
        // Phase 5: Student Artisan Growth & Social Commerce
        commissions,
        campusDrops,
        stylePosts,
        artisanTiers,
        submitCommissionRequest,
        updateCommissionStatus,
        claimDropPreorder,
        toggleLikeStylePost,
        submitStylePost,
        // Phase 6: Campus Ambassador & Quick-List
        ambassadors,
        hallLeaderboard,
        referralRewards,
        activeAmbassadorCode,
        applyReferralCode,
        isQuickListModalOpen,
        openQuickListModal,
        closeQuickListModal,
        quickListFromTemplate,
        clearAllProducts,
        // Phase 3: Problem Modal
        isReportProblemModalOpen,
        activeReportOrderId,
        openReportProblemModal,
        closeReportProblemModal,
        wallets,
        currentWallet,
        ledgerEntries,
        paystackWebhooks,
        activeWithdrawalOtp,
        sendWithdrawalOtp,
        requestWithdrawal,
        addPayoutAccount,
        toggleWalletFreeze,
        processPaystackWebhook,
        securityProfile: currentSecurityProfile,
        toggleTwoFactor,
        revokeSession,
        isCheckoutModalOpen,
        openCheckoutModal,
        closeCheckoutModal,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        lowDataMode,
        toggleLowDataMode,
        language,
        toggleLanguage,
        notifications,
        notify,
        dismissNotification,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
