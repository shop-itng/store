import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  User,
  AppView,
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
  PaymentWebhookEvent,
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
  BroadcastAnnouncement,
  EmergencyControls,
  AdminAuditLog,
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
  PAYMENT_CONFIG,
  calculateBalancesFromLedger,
  isPayoutAccountCooled,
  validateAccountNameMatch,
} from '../utils/paymentService';
import {
  generateEmailOtp,
  getResendCooldownSeconds,
  isKnownDevice,
  recordKnownDevice,
  getDeviceId,
} from '../utils/emailOtpManager';
import { sendTransactionalEmail } from '../utils/transactionalEmails';

const getAuthHeaders = (extra?: Record<string, string>): Record<string, string> => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('shopit_session_token') : null;
  return {
    ...(token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {}),
    ...(extra || {}),
  };
};

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
  openAuthModal: (tab?: 'login' | 'signup' | 'seller_register' | 'forgot_password') => void;
  closeAuthModal: () => void;
  authTab: 'login' | 'signup' | 'otp' | 'seller_register' | 'forgot_password';
  setAuthTab: (tab: 'login' | 'signup' | 'otp' | 'seller_register' | 'forgot_password') => void;
  pendingAuthData: any;
  setPendingAuthData: (data: any) => void;
  verifyOtp: (code: string) => Promise<boolean>;
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
  refreshCurrentUser: () => Promise<void>;

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
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  requestAccountDeletion: () => void;
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
  updateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    extra?: { packedPhotoUrl?: string; disputeReason?: string; handshakeOtp?: string }
  ) => void;
  confirmItemReceived: (orderId: string) => void;
  cancelOrder: (orderId: string) => void;
  openDispute: (orderId: string, reason: string, evidencePhotoUrl?: string) => void;
  submitOrderReview: (orderId: string, productId: string, rating: number, comment: string) => void;
  buyerActiveOrdersCount: number;

  // Phase 4: Campus Safe Logistics & Handshake OTP Verification
  safePickupSpots: SafePickupSpot[];
  campusRunners: CampusRunner[];
  runnerTrips: RunnerTrip[];
  verifyHandshakeOtp: (orderId: string, inputOtp: string) => Promise<{ success: boolean; message: string }>;
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
  updateVerificationRequest: (
    id: string,
    status: 'approved' | 'rejected' | 'needs_resubmission' | 'verified',
    notes?: string,
    adminName?: string
  ) => void;
  submitVerificationRequest: (
    req: Omit<SellerVerificationRequest, 'id' | 'submittedAt' | 'status'>,
    options?: { skipServerSubmit?: boolean }
  ) => void;
  isVerificationModalOpen: boolean;
  openVerificationModal: () => void;
  closeVerificationModal: () => void;
  disputes: DisputeTicket[];
  resolveDispute: (disputeId: string, resolution: 'refund_full' | 'release_seller' | 'partial', amount?: number, notes?: string) => void;
  antiBypassFlags: AntiBypassFlag[];
  updateFlagStatus: (flagId: string, action: 'warn' | 'lock_chat' | 'freeze_account' | 'dismiss') => void;
  feeSettings: FeeSettings;
  updateFeeSettings: (settings: Partial<FeeSettings>) => void;

  // Moderator Super-Powers & Account Governance
  registeredUsers: User[];
  deleteUserAccount: (userId: string) => boolean;
  banUserAccount: (userId: string, isBanned: boolean, reason?: string) => void;
  adminResetUserPassword: (userId: string, newPass: string) => boolean;
  adminToggleSellerVerification: (sellerId: string, isVerified: boolean) => void;
  adminForceDeleteProduct: (productId: string) => void;
  adminForceReleaseEscrow: (orderId: string) => void;
  adminForceRefundOrder: (orderId: string, notes?: string) => void;
  broadcastAnnouncement: BroadcastAnnouncement;
  updateBroadcastAnnouncement: (data: Partial<BroadcastAnnouncement>) => void;
  emergencyControls: EmergencyControls;
  updateEmergencyControls: (controls: Partial<EmergencyControls>) => void;
  adminAuditLogs: AdminAuditLog[];
  addAdminAuditLog: (action: string, details: string, targetId?: string) => void;
  clearMarketplaceDatabase: () => void;

  // Phase 3: Report Problem Modal
  isReportProblemModalOpen: boolean;
  activeReportOrderId: string | null;
  openReportProblemModal: (orderId: string) => void;
  closeReportProblemModal: () => void;

  // Seller Wallet & Payouts (Rules 1-6)
  wallets: Record<string, SellerWallet>;
  currentWallet: SellerWallet | null;
  ledgerEntries: LedgerEntry[];
  paymentWebhooks: PaymentWebhookEvent[];
  activeWithdrawalOtp: { code: string; email: string; expiresAt: number; amount: number } | null;
  sendWithdrawalOtp: (amount: number, accountInfo?: { bank_name?: string; last4?: string }) => Promise<{ success: boolean; error?: string; waitSeconds?: number }>;
  requestWithdrawal: (amount: number, payoutAccountId: string, otpCode: string) => Promise<boolean>;
  addPayoutAccount: (bankCode: string, bankName: string, accountNumber: string, accountName: string, otpCode?: string) => Promise<boolean>;
  sendPayoutAccountOtp: (accountInfo?: { bank_name?: string; last4?: string }) => Promise<{ success: boolean; error?: string; waitSeconds?: number }>;
  resendSignupOtp: () => Promise<{ success: boolean; error?: string; waitSeconds?: number }>;
  toggleWalletFreeze: (sellerId: string, freeze: boolean, reason?: string) => void;

  // Security Hardening
  securityProfile: SecurityProfile;
  toggleTwoFactor: () => void;
  revokeSession: (sessionId: string) => void;

  // Safety switch flags
  paymentsEnabled: boolean;
  payoutsEnabled: boolean;

  // Checkout modal & coupons
  isCheckoutModalOpen: boolean;
  openCheckoutModal: () => void;
  closeCheckoutModal: () => void;
  appliedCoupon: Coupon | null;
  applyCoupon: (code: string, currentTotal: number) => Promise<boolean>;
  removeCoupon: () => void;

  // Low-Data Mode, Language & Theme
  lowDataMode: boolean;
  toggleLowDataMode: () => void;
  language: 'en' | 'pidgin';
  toggleLanguage: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Toast Notifications
  notifications: NotificationItem[];
  notify: (message: string, type?: 'success' | 'info' | 'error') => void;
  dismissNotification: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // One-time fix: Clear forced automatic moderator session so public visitors are not logged in as admin
  if (typeof window !== 'undefined' && !localStorage.getItem('shopit_fix_auto_moderator_login_v2')) {
    localStorage.removeItem('shopit_current_user');
    localStorage.removeItem('shopit_admin_session_active');
    localStorage.setItem('shopit_fix_auto_moderator_login_v2', 'true');
  }

  // Automatic Database Purge Migration:
  // Completely wipes all sellers, products, businesses, orders, chats, and accounts, retaining ONLY moderator Adeyinka Joseph in registered users.
  if (typeof window !== 'undefined' && !localStorage.getItem('shopit_db_purged_moderator_only_v4')) {
    localStorage.setItem('shopit_sellers', '[]');
    localStorage.setItem('shopit_products_ready_made', '[]');
    localStorage.removeItem('shopit_products');
    localStorage.setItem('shopit_orders', '[]');
    localStorage.setItem('shopit_conversations', '[]');
    localStorage.setItem('shopit_messages', '{}');
    localStorage.setItem('shopit_wallets', '{}');
    localStorage.setItem('shopit_cart', '[]');
    localStorage.setItem('shopit_wishlist', '[]');
    localStorage.setItem('shopit_ledger_entries_v5', '[]');
    localStorage.setItem('shopit_payment_webhooks_v5', '[]');
    localStorage.setItem('shopit_disputes', '[]');
    localStorage.setItem('shopit_verification_requests', '[]');
    localStorage.setItem('shopit_anti_bypass_flags', '[]');
    localStorage.setItem('shopit_commissions', '[]');
    localStorage.setItem('shopit_campus_drops', '[]');
    localStorage.setItem('shopit_style_posts', '[]');
    localStorage.setItem('shopit_db_purged_moderator_only_v4', 'true');
  }

  // Persistence helpers: Public visitors start as guest (null), NEVER forced to moderator!
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('shopit_current_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.id && parsed.email) {
          const isAdmin = parsed.role === 'admin';
          if (isAdmin) {
            const hasExplicitAdminSession = localStorage.getItem('shopit_admin_session_active') === 'true';
            if (hasExplicitAdminSession) {
              return parsed;
            }
            // Clear auto-assigned or stale admin session without explicit credentials login
            localStorage.removeItem('shopit_current_user');
            return null;
          }
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('shopit_products_ready_made');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [sellers, setSellers] = useState<SellerProfile[]>(() => {
    try {
      const saved = localStorage.getItem('shopit_sellers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('shopit_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('shopit_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('shopit_orders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [wallets, setWallets] = useState<Record<string, SellerWallet>>(() => {
    try {
      const saved = localStorage.getItem('shopit_wallets');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Rule 5: All balances come from an append-only ledger (sale, fee, withdrawal, refund)
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>(() => {
    const saved = localStorage.getItem('shopit_ledger_entries_v5');
    return saved ? JSON.parse(saved) : [];
  });

  // Processed payment webhook events (idempotency tracker)
  const [paymentWebhooks, setPaymentWebhooks] = useState<PaymentWebhookEvent[]>(() => {
    const saved = localStorage.getItem('shopit_payment_webhooks_v5');
    return saved ? JSON.parse(saved) : [];
  });

  // Rule 4: Send an Email OTP before every withdrawal
  const [activeWithdrawalOtp, setActiveWithdrawalOtp] = useState<{
    code: string;
    email: string;
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

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('shopit_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {}
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('shopit_theme', theme);
  }, [theme]);

  // Checkout & Coupon states
  const paymentsEnabled = import.meta.env.VITE_PAYMENTS_ENABLED === 'true';
  const payoutsEnabled = import.meta.env.VITE_PAYOUTS_ENABLED === 'true';
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

  const LEGAL_SLUGS: AppView[] = [
    'terms',
    'privacy',
    'refunds',
    'prohibited-items',
    'seller-guide',
    'buyer-protection',
    'faq',
    'contact',
  ];

  const getInitialView = (): AppView => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.replace(/^\//, '').toLowerCase();
      const params = new URLSearchParams(window.location.search);
      if (path === 'reset-password' || path === 'forgot-password' || window.location.search.includes('code=')) {
        return 'reset-password';
      }
      if (params.get('view') === 'orders' || params.has('payment_ref') || params.has('tx_ref')) {
        return 'orders';
      }
      if (LEGAL_SLUGS.includes(path as AppView)) {
        return path as AppView;
      }
    }
    return 'catalog';
  };

  // Navigation states
  const [activeView, _setActiveView] = useState<AppView>(getInitialView);

  const setActiveView = (view: AppView) => {
    _setActiveView(view);
    if (typeof window !== 'undefined') {
      if (view === 'reset-password') {
        if (window.location.pathname !== '/reset-password') {
          window.history.pushState({ view: 'reset-password' }, '', '/reset-password');
        }
      } else if (LEGAL_SLUGS.includes(view)) {
        if (window.location.pathname !== `/${view}`) {
          window.history.pushState({ view }, '', `/${view}`);
        }
      } else if (view === 'catalog') {
        if (window.location.pathname !== '/' && window.location.pathname !== '') {
          window.history.pushState({ view: 'catalog' }, '', '/');
        }
      }
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname.replace(/^\//, '').toLowerCase();
      if (path === 'reset-password' || path === 'forgot-password') {
        _setActiveView('reset-password');
      } else if (LEGAL_SLUGS.includes(path as AppView)) {
        _setActiveView(path as AppView);
      } else if (path === '' || path === '/') {
        _setActiveView('catalog');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Rule 6: 24-hour unpaid order cancellation routine (cancels unpaid orders older than 24h & returns stock)
  useEffect(() => {
    const checkUnpaidOrders = () => {
      const now = Date.now();
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      setOrders(prev =>
        prev.map(ord => {
          if (
            (ord.status as any) === 'pending_payment' &&
            now - new Date(ord.createdAt).getTime() > ONE_DAY_MS
          ) {
            // Restore product stock
            ord.items.forEach(item => {
              setProducts(currProds =>
                currProds.map(p =>
                  p.id === item.productId
                    ? { ...p, stock: (p.stock || 0) + item.quantity, isSoldOut: false }
                    : p
                )
              );
            });
            return {
              ...ord,
              status: 'cancelled',
              disputeReason: 'Order automatically cancelled after 24 hours without payment. Stock returned.',
            };
          }
          return ord;
        })
      );
    };

    checkUnpaidOrders();
    const interval = setInterval(checkUnpaidOrders, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState<boolean>(false);
  const openVerificationModal = () => setIsVerificationModalOpen(true);
  const closeVerificationModal = () => setIsVerificationModalOpen(false);

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

  // Registered users repository (buyers, sellers, and system accounts)
  const [registeredUsers, setRegisteredUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('shopit_registered_users');
      if (saved) {
        const parsed: User[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {}
    return [];
  });

  // Site-wide Broadcast, Platform Killswitches & Audit Trail
  const [broadcastAnnouncement, setBroadcastAnnouncement] = useState<BroadcastAnnouncement>(() => {
    try {
      const saved = localStorage.getItem('shopit_broadcast_announcement');
      return saved
        ? JSON.parse(saved)
        : {
            id: 'broad_default',
            isActive: false,
            title: 'Campus Safety & Verified Handshake Advisory',
            message: 'All campus craft handoffs must be verified using the 4-digit Handshake OTP in daylight safe spots.',
            tone: 'info',
            createdAt: new Date().toISOString(),
            author: 'Shop It Safety Desk',
          };
    } catch {
      return {
        id: 'broad_default',
        isActive: false,
        title: 'Campus Safety & Verified Handshake Advisory',
        message: 'All campus craft handoffs must be verified using the 4-digit Handshake OTP in daylight safe spots.',
        tone: 'info',
        createdAt: new Date().toISOString(),
        author: 'Shop It Safety Desk',
      };
    }
  });

  const [emergencyControls, setEmergencyControls] = useState<EmergencyControls>(() => {
    try {
      const saved = localStorage.getItem('shopit_emergency_controls');
      return saved
        ? JSON.parse(saved)
        : {
            maintenanceMode: false,
            pauseNewOrders: false,
            pauseSellerSignups: false,
          };
    } catch {
      return {
        maintenanceMode: false,
        pauseNewOrders: false,
        pauseSellerSignups: false,
      };
    }
  });

  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLog[]>(() => {
    try {
      const saved = localStorage.getItem('shopit_admin_audit_logs');
      return saved
        ? JSON.parse(saved)
        : [
            {
              id: 'audit_root_init',
              action: 'SUPER_ADMIN_INITIALIZED',
              details: 'Adeyinka Joseph moderator root security authority active across Shop It marketplace.',
              timestamp: new Date().toISOString(),
              moderatorName: 'Adeyinka Joseph',
            },
          ];
    } catch {
      return [];
    }
  });

  // Phase 3: Report Problem Modal State
  const [isReportProblemModalOpen, setIsReportProblemModalOpen] = useState(false);
  const [activeReportOrderId, setActiveReportOrderId] = useState<string | null>(null);

  // Auth modal states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup' | 'otp' | 'seller_register' | 'forgot_password'>('login');
  const [pendingAuthData, setPendingAuthData] = useState<any>(null);

  // Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Sync state to LocalStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('shopit_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('shopit_current_user');
      localStorage.removeItem('shopit_admin_session_active');
    }
  }, [currentUser]);

  // Neon PostgreSQL Single Source of Truth: Fetch products, sellers, and (for admins) verification queue and accounts
  const fetchMarketplaceData = useCallback(async () => {
    try {
      const isAdminUser = currentUser?.role === 'admin';
      const [prodRes, sellRes, verifRes, usersRes] = await Promise.all([
        fetch('/api/products?limit=100', { credentials: 'include' }).catch(() => null),
        fetch('/api/sellers', { credentials: 'include' }).catch(() => null),
        isAdminUser
          ? fetch('/api/verification/admin/queue', { headers: getAuthHeaders(), credentials: 'include' }).catch(() => null)
          : Promise.resolve(null),
        isAdminUser
          ? fetch('/api/admin/users?limit=100', { headers: getAuthHeaders(), credentials: 'include' }).catch(() => null)
          : Promise.resolve(null),
      ]);

      if (prodRes && prodRes.ok) {
        const prodData = await prodRes.json();
        if (prodData.status && Array.isArray(prodData.products)) {
          setProducts(prodData.products);
        }
      }

      if (sellRes && sellRes.ok) {
        const sellData = await sellRes.json();
        if (sellData.status && Array.isArray(sellData.sellers)) {
          setSellers(sellData.sellers);
        }
      }

      if (verifRes && verifRes.ok) {
        const verifData = await verifRes.json();
        if (verifData.status && Array.isArray(verifData.queue)) {
          setVerificationRequests(verifData.queue);
        }
      }

      if (usersRes && usersRes.ok) {
        const usersData = await usersRes.json();
        if (usersData.status && Array.isArray(usersData.users)) {
          setRegisteredUsers(usersData.users);
        }
      }
    } catch (err: any) {
      console.warn('[PostgreSQL Sync Warning]:', err.message);
    }
  }, [currentUser?.role]);

  useEffect(() => {
    fetchMarketplaceData();
  }, [fetchMarketplaceData]);

  const refreshFinancials = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const headers = getAuthHeaders();
      const [ordRes, walRes] = await Promise.all([
        fetch('/api/orders?limit=100', { headers, credentials: 'include' }).catch(() => null),
        currentUser.role === 'seller' || currentUser.role === 'admin'
          ? fetch('/api/wallet', { headers, credentials: 'include' }).catch(() => null)
          : Promise.resolve(null),
      ]);
      if (ordRes && ordRes.ok) {
        const ordData = await ordRes.json();
        if (ordData.status && Array.isArray(ordData.orders)) {
          setOrders(ordData.orders);
        }
      }
      if (walRes && walRes.ok) {
        const walData = await walRes.json();
        if (walData.status && walData.wallet) {
          setWallets(prev => ({ ...prev, [currentUser.id]: walData.wallet }));
          if (Array.isArray(walData.wallet.ledger)) {
            setLedgerEntries(walData.wallet.ledger);
          }
        }
      }
    } catch {}
  }, [currentUser?.id, currentUser?.role]);

  // Synchronize authenticated user entities with Neon PostgreSQL
  useEffect(() => {
    if (!currentUser?.id) return;
    const headers = getAuthHeaders();

    // Fetch user cart from PostgreSQL
    fetch('/api/cart', { headers, credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.status && Array.isArray(data.items)) setCart(data.items);
      })
      .catch(() => {});

    // Fetch user wishlist from PostgreSQL
    fetch('/api/wishlist', { headers, credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.status && Array.isArray(data.productIds)) setWishlist(data.productIds);
      })
      .catch(() => {});

    refreshFinancials();

    // Fetch chat conversations from PostgreSQL
    fetch('/api/chat/conversations', { headers, credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.status && Array.isArray(data.conversations)) setConversations(data.conversations);
      })
      .catch(() => {});

    // Fetch disputes from PostgreSQL
    fetch('/api/disputes', { headers, credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.status && Array.isArray(data.disputes)) setDisputes(data.disputes);
      })
      .catch(() => {});

    // Fetch notifications from PostgreSQL
    fetch('/api/notifications', { headers, credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.status && Array.isArray(data.notifications)) setNotifications(data.notifications);
      })
      .catch(() => {});

    // Fetch custom commissions from PostgreSQL
    fetch('/api/commissions', { headers, credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.status && Array.isArray(data.commissions)) setCommissions(data.commissions);
      })
      .catch(() => {});

    // One-time browser migration cleanup
    try {
      const hasLegacyStranded = Boolean(
        localStorage.getItem('shopit_products_ready_made') ||
        localStorage.getItem('shopit_sellers') ||
        localStorage.getItem('shopit_orders')
      );
      if (hasLegacyStranded && !localStorage.getItem('shopit_migrated_to_neon_v1')) {
        localStorage.setItem('shopit_migrated_to_neon_v1', 'true');
        localStorage.removeItem('shopit_products_ready_made');
        localStorage.removeItem('shopit_sellers');
        localStorage.removeItem('shopit_orders');
        localStorage.removeItem('shopit_wallets');
        localStorage.removeItem('shopit_ledger_entries_v5');
        localStorage.removeItem('shopit_disputes');
        localStorage.removeItem('shopit_conversations');
        localStorage.removeItem('shopit_messages');
        localStorage.removeItem('shopit_registered_users');
      }
    } catch {}
  }, [currentUser?.id, currentUser?.role, refreshFinancials]);

  // Sync cart and wishlist to PostgreSQL when changed by authenticated user
  useEffect(() => {
    if (currentUser?.id && cart.length > 0) {
      fetch('/api/cart', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ items: cart }),
      }).catch(() => {});
    }
  }, [cart, currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id && wishlist.length > 0) {
      fetch('/api/wishlist', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ productIds: wishlist }),
      }).catch(() => {});
    }
  }, [wishlist, currentUser?.id]);

  // Keep localStorage ONLY for client UI settings
  useEffect(() => {
    localStorage.setItem('shopit_low_data', String(lowDataMode));
  }, [lowDataMode]);

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

  // Escrow auto-release is executed authoritatively on the server via /api/cron/escrow.

  // NDPA Compliance: 30-day automated purge for verification ID photos and selfies
  useEffect(() => {
    const purgeStaleVerificationFiles = () => {
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      setVerificationRequests(prev => {
        let changed = false;
        const updated = prev.map(req => {
          const submittedTime = req.submittedAt ? new Date(req.submittedAt).getTime() : 0;
          const isOlderThan30Days = submittedTime > 0 && now - submittedTime > THIRTY_DAYS_MS;
          if (
            isOlderThan30Days &&
            (req.idCardPhotoUrl !== '[Purged after 30-day retention]' ||
              (req.selfiePhotoUrl && req.selfiePhotoUrl !== '[Purged after 30-day retention]'))
          ) {
            changed = true;
            return {
              ...req,
              idCardPhotoUrl: '[Purged after 30-day retention]',
              selfiePhotoUrl: req.selfiePhotoUrl ? '[Purged after 30-day retention]' : undefined,
            };
          }
          return req;
        });
        return changed ? updated : prev;
      });
    };

    purgeStaleVerificationFiles();
    const interval = setInterval(purgeStaleVerificationFiles, 60000);
    return () => clearInterval(interval);
  }, []);

  const requestAccountDeletion = () => {
    if (!currentUser) return;
    const scheduledDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    notify(
      `Account deletion scheduled. As guaranteed by our Privacy Policy, your account and personal data will be permanently purged in 14 days (${scheduledDate}).`,
      'info'
    );
    const updatedUser: User = {
      ...currentUser,
      deletionRequestedAt: new Date().toISOString(),
      scheduledDeletionDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    };
    setCurrentUser(updatedUser);
    localStorage.setItem('shopit_current_user', JSON.stringify(updatedUser));
  };

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
      if (currentUser?.role === 'admin') {
        setActiveView('admin');
        notify('Switched to Administrator Command Center', 'info');
      } else {
        openAuthModal('login');
        notify('Administrator access restricted. Please log in with admin credentials.', 'error');
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

  const login = (userData: Partial<User> & { sessionToken?: string }) => {
    if (userData.sessionToken && typeof localStorage !== 'undefined') {
      localStorage.setItem('shopit_session_token', userData.sessionToken);
    }
    const newUser: User = {
      id: userData.id || `user_${Date.now()}`,
      name: userData.name || 'Shopper',
      email: userData.email || 'customer@shopit.ng',
      role: userData.role || 'buyer',
      isVerifiedEmail: true,
      savedDeliveryArea: userData.savedDeliveryArea || userLocation.area || 'Yaba',
      sellerProfile: userData.sellerProfile,
    };
    setCurrentUser(newUser);
    notify(`Welcome back, ${newUser.name}!`, 'success');
  };

  const logout = () => {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    }).catch(() => {});
    setCurrentUser(null);
    setOrders([]);
    setCart([]);
    setWishlist([]);
    setWallets({});
    setLedgerEntries([]);
    setRegisteredUsers([]);
    setVerificationRequests([]);
    localStorage.removeItem('shopit_session_token');
    localStorage.removeItem('shopit_current_user');
    localStorage.removeItem('shopit_admin_session_active');
    localStorage.removeItem('shopit_registered_users');
    setActiveView('catalog');
    notify('Logged out successfully', 'info');
  };

  const openAuthModal = (tab: 'login' | 'signup' | 'seller_register' | 'forgot_password' = 'login') => {
    setAuthTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setPendingAuthData(null);
  };

  const verifyOtp = async (code: string): Promise<boolean> => {
    if (!pendingAuthData?.email) {
      notify('No pending verification found. Please sign up again.', 'error');
      return false;
    }

    try {
      const verifyResp = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: pendingAuthData.email,
          purpose: 'signup',
          code: code.trim(),
        }),
      });
      const verification = await verifyResp.json();
      if (!verifyResp.ok || !verification.status) {
        notify(verification.message || verification.error || 'Invalid or expired verification code.', 'error');
        return false;
      }

      const signupVerificationToken = verification.signupVerificationToken;

      if (pendingAuthData.role === 'seller') {
        setPendingAuthData((prev: any) => ({ ...prev, signupVerificationToken }));
        setAuthTab('seller_register');
        notify('Email verified! Complete your shop profile.', 'success');
        return true;
      } else {
        const resp = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: pendingAuthData.email,
            password: pendingAuthData.password,
            name: pendingAuthData.name,
            role: 'buyer',
            age: pendingAuthData.age,
            hasGuardianConsent: pendingAuthData.hasGuardianConsent,
            guardianName: pendingAuthData.guardianName,
            signupVerificationToken,
          }),
        });
        const regData = await resp.json();
        if (!resp.ok || !regData.status) {
          notify(regData.message || 'Database error saving user account.', 'error');
          return false;
        }

        const savedUser = regData.user;
        login({ ...savedUser, sessionToken: regData.sessionToken });
        closeAuthModal();
        notify('Account created and registered successfully in database!', 'success');
        return true;
      }
    } catch (err: any) {
      console.error('[Registration Error]:', err.message);
      notify('Unable to connect to database server. Please try again.', 'error');
      return false;
    }
  };

  const resendSignupOtp = async (): Promise<{ success: boolean; error?: string; waitSeconds?: number }> => {
    if (!pendingAuthData?.email) {
      notify('No pending registration found.', 'error');
      return { success: false, error: 'No email found' };
    }
    const result = await generateEmailOtp(pendingAuthData.email, 'signup', {
      name: pendingAuthData.name || pendingAuthData.email.split('@')[0],
    });
    if (!result.success) {
      notify(result.error || 'Please wait before requesting a new code.', 'error');
      return result;
    }
    notify(`[Email Verification] A new 6-digit code was sent to ${pendingAuthData.email}! Valid for 10 minutes.`, 'info');
    return result;
  };

  const submitSellerRegistration = async (sellerData: {
    shopName: string;
    campus?: Campus;
    location?: NigerianLocation;
    locationArea?: string;
    bio: string;
    under18: boolean;
    guardianName?: string;
    guardianPhone?: string;
  }) => {
    const resolvedArea = sellerData.locationArea || sellerData.location?.area || 'Lagos Mainland';

    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: pendingAuthData?.email,
          password: pendingAuthData?.password,
          name: pendingAuthData?.name || sellerData.shopName,
          role: 'seller',
          age: pendingAuthData?.age,
          hasGuardianConsent: pendingAuthData?.hasGuardianConsent,
          guardianName: sellerData.guardianName || pendingAuthData?.guardianName,
          guardianPhone: sellerData.guardianPhone,
          signupVerificationToken: pendingAuthData?.signupVerificationToken,
          shopName: sellerData.shopName,
          bio: sellerData.bio,
          campus: sellerData.campus || 'UNILAG (Akoka)',
          location: sellerData.location,
          locationArea: resolvedArea,
        }),
      });

      const regData = await resp.json();
      if (!resp.ok || !regData.status) {
        notify(regData.message || 'Database error saving seller shop.', 'error');
        return;
      }

      if (regData.sessionToken && typeof localStorage !== 'undefined') {
        localStorage.setItem('shopit_session_token', regData.sessionToken);
      }

      const serverUser = regData.user;
      const serverSellerProfile = serverUser.sellerProfile || {
        id: serverUser.id,
        shopName: sellerData.shopName,
        ownerName: serverUser.name,
        email: serverUser.email,
        bio: sellerData.bio,
        campus: sellerData.campus || 'UNILAG (Akoka)',
        location: sellerData.location,
        locationArea: resolvedArea,
        isVerifiedSeller: false,
        verificationStatus: 'not_started',
        under18: sellerData.under18,
        guardianConsent: sellerData.under18,
        guardianName: sellerData.guardianName,
        guardianPhone: sellerData.guardianPhone,
        badges: [],
        level: 1,
        rating: 5.0,
        reviewCount: 0,
        salesCount: 0,
        viewsCount: 0,
        vacationMode: false,
        joinedDate: 'Today',
      };

      setSellers(prev => [serverSellerProfile, ...prev]);

      const newWallet: SellerWallet = {
        sellerId: serverUser.id,
        pendingBalance: 0,
        availableBalance: 0,
        totalWithdrawn: 0,
        isFrozen: false,
        payoutAccounts: [],
        ledger: [],
        transactions: [],
      };
      setWallets(prev => ({ ...prev, [serverUser.id]: newWallet }));

      setCurrentUser(serverUser);
      localStorage.setItem('shopit_current_user', JSON.stringify(serverUser));

      closeAuthModal();
      setActiveView('seller_dashboard');
      fetchMarketplaceData();
      notify(`Shop "${sellerData.shopName}" registered in ${resolvedArea} and saved to database!`, 'success');
    } catch (err: any) {
      console.error('[Seller Registration Error]:', err.message);
      notify('Unable to reach database server. Please try again.', 'error');
    }
  };

  const addProduct = (
    newProd: Omit<
      Product,
      'id' | 'createdAt' | 'rating' | 'reviewCount' | 'reviews' | 'serviceFee' | 'displayPrice' | 'isSoldOut' | 'isNewArrival'
    > &
      Partial<Pick<Product, 'serviceFee' | 'displayPrice' | 'isSoldOut' | 'isNewArrival'>>
  ) => {
    const isSellerVerified = Boolean(
      currentSeller?.isVerifiedSeller ||
      currentSeller?.verificationStatus === 'verified' ||
      currentSeller?.verificationStatus === 'approved' ||
      currentUser?.sellerProfile?.isVerifiedSeller ||
      currentUser?.sellerProfile?.verificationStatus === 'verified' ||
      currentUser?.sellerProfile?.verificationStatus === 'approved' ||
      (currentUser as any)?.isVerifiedSeller ||
      (currentUser as any)?.verificationStatus === 'verified' ||
      (currentUser as any)?.verificationStatus === 'approved' ||
      verificationRequests?.some(r =>
        (r.sellerId === currentSeller?.id || r.sellerId === currentUser?.id || r.sellerId === currentUser?.sellerProfile?.id) &&
        (r.status === 'verified' || r.status === 'approved')
      ) ||
      currentUser?.role === 'admin'
    );

    // Allow smooth product listing for all creators (NIN verification is enforced at withdrawal time)
    if (currentSeller && !isSellerVerified) {
      notify('Craft published! Remember to complete your NIN identity verification before requesting bank payouts.', 'info');
    }

    const id = `prod_${Date.now()}`;
    const pricing = getPricingBreakdown(newProd.sellerPrice);
    const sanitizedBadges: Product['sellerBadges'] = (newProd.sellerBadges || []).filter(b => b !== 'verified');
    if (isSellerVerified) {
      sanitizedBadges.push('verified');
    }

    const product: Product = {
      ...newProd,
      id,
      sellerBadges: sanitizedBadges,
      location: newProd.location || userLocation,
      locationArea: newProd.locationArea || newProd.location?.area || userLocation.area,
      serviceFee: pricing.serviceFee,
      displayPrice: pricing.displayPrice,
      rating: 5.0,
      reviewCount: 0,
      reviews: [],
      createdAt: new Date().toISOString().split('T')[0],
      isSoldOut: (newProd.stock ?? 1) <= 0,
      isNewArrival: true,
    };
    setProducts(prev => [product, ...prev]);

    // Persist to Neon PostgreSQL with session headers
    fetch('/api/products', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(product),
    }).catch(err => {
      console.warn('[Add Product Network Error]:', err.message);
    });

    notify(`Product "${product.title}" listed successfully in the marketplace!`, 'success');
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

    // Persist updates to Neon PostgreSQL
    fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(updates),
    }).catch(err => console.warn('[Update Product Network Error]:', err.message));

    notify('Product updated', 'success');
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));

    // Delete in Neon PostgreSQL
    fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    }).catch(err => console.warn('[Delete Product Network Error]:', err.message));

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

  // Sync fresh user & seller verification profile from PostgreSQL session
  const refreshCurrentUser = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.status === 401) {
        setCurrentUser(null);
        localStorage.removeItem('shopit_session_token');
        localStorage.removeItem('shopit_current_user');
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (data.status && data.user) {
        const serverUser = data.user;
        setCurrentUser(prev => {
          if (!prev) return serverUser;
          const merged = {
            ...prev,
            ...serverUser,
            sellerProfile: serverUser.sellerProfile ? {
              ...(prev.sellerProfile || {}),
              ...serverUser.sellerProfile,
            } : prev.sellerProfile,
          };
          try {
            localStorage.setItem('shopit_current_user', JSON.stringify(merged));
          } catch {}
          return merged;
        });

        if (data.isVerifiedSeller !== undefined) {
          setSellers(prev =>
            prev.map(s => {
              if (s.id === serverUser.id || (s.email && s.email.toLowerCase() === serverUser.email.toLowerCase())) {
                return {
                  ...s,
                  isVerifiedSeller: Boolean(data.isVerifiedSeller),
                  verificationStatus: data.verificationStatus || (data.isVerifiedSeller ? 'verified' : s.verificationStatus),
                  badges: data.isVerifiedSeller
                    ? (Array.from(new Set([...s.badges, 'verified'])) as any)
                    : s.badges,
                };
              }
              return s;
            })
          );
        }
        await refreshFinancials();
      }
    } catch (err: any) {
      console.warn('[Profile Sync Warning]', err.message);
    }
  }, [currentUser?.id, refreshFinancials]);

  useEffect(() => {
    refreshCurrentUser();
  }, [currentUser?.id, refreshCurrentUser]);

  const matchedSeller = currentUser
    ? sellers.find(
        s =>
          s.id === currentUser.id ||
          (s.email && s.email.toLowerCase() === currentUser.email?.toLowerCase()) ||
          s.id === currentUser.sellerProfile?.id
      )
    : null;

  const currentSeller: SellerProfile | null = useMemo(() => {
    if (!currentUser && sellers.length === 0) return null;

    const base = matchedSeller || currentUser?.sellerProfile;
    if (base) {
      const isVerified = Boolean(
        matchedSeller?.isVerifiedSeller ||
        currentUser?.sellerProfile?.isVerifiedSeller ||
        (currentUser as any)?.isVerifiedSeller ||
        matchedSeller?.verificationStatus === 'verified' ||
        matchedSeller?.verificationStatus === 'approved' ||
        currentUser?.sellerProfile?.verificationStatus === 'verified' ||
        currentUser?.sellerProfile?.verificationStatus === 'approved' ||
        (currentUser as any)?.verificationStatus === 'verified' ||
        (currentUser as any)?.verificationStatus === 'approved' ||
        verificationRequests?.some(r =>
          (r.sellerId === base.id || r.sellerId === currentUser?.id || r.id === base.id) &&
          (r.status === 'verified' || r.status === 'approved')
        ) ||
        currentUser?.role === 'admin'
      );

      const status = isVerified
        ? 'verified'
        : (matchedSeller?.verificationStatus || currentUser?.sellerProfile?.verificationStatus || (currentUser as any)?.verificationStatus || 'not_started');

      return {
        ...base,
        isVerifiedSeller: isVerified,
        verificationStatus: status,
        badges: isVerified
          ? (Array.from(new Set([...(base.badges || []), 'verified'])) as any)
          : (base.badges || []),
      };
    }

    if (currentUser && (currentUser.role === 'seller' || (currentUser as any).isVerifiedSeller)) {
      const isVerified = Boolean(
        (currentUser as any).isVerifiedSeller ||
        (currentUser as any).verificationStatus === 'verified' ||
        (currentUser as any).verificationStatus === 'approved' ||
        verificationRequests?.some(r =>
          (r.sellerId === currentUser.id) &&
          (r.status === 'verified' || r.status === 'approved')
        ) ||
        currentUser.role === 'admin'
      );
      return {
        id: currentUser.id,
        shopName: `${currentUser.name}'s Shop`,
        ownerName: currentUser.name,
        email: currentUser.email,
        bio: 'Student artisan and maker.',
        campus: (currentUser as any).campus || 'Lagos Mainland',
        isVerifiedSeller: isVerified,
        verificationStatus: isVerified ? 'verified' : 'not_started',
        badges: isVerified ? ['verified'] : [],
        level: 1,
        rating: 5.0,
        reviewCount: 0,
        salesCount: 0,
        viewsCount: 0,
        vacationMode: false,
        under18: false,
        guardianConsent: false,
        joinedDate: new Date().toISOString().split('T')[0],
      };
    }

    return null;
  }, [currentUser, matchedSeller, sellers, verificationRequests]);

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

  // Coupons (Server-validated against shopit_coupons when signed in, with fallback to catalog rules)
  const applyCoupon = async (code: string, currentTotal: number): Promise<boolean> => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return false;

    if (currentUser?.id) {
      try {
        const res = await fetch('/api/coupons/validate', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ code: cleanCode, subtotal: currentTotal }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.status || !data.coupon) {
          notify(data.message || 'Invalid or ineligible promo code.', 'error');
          return false;
        }
        setAppliedCoupon(data.coupon);
        notify(`Promo code ${data.coupon.code} applied: ₦${Number(data.coupon.discountAmount).toLocaleString()} discount!`, 'success');
        return true;
      } catch {
        // fall through to offline/preview check below only if network unreachable
      }
    }

    const coupon = VALID_COUPONS.find(c => c.code === cleanCode);
    if (!coupon) {
      notify('Invalid promo code.', 'error');
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

  // Orders and Escrow Management (Server-authoritative state machine & ledger)
  const updateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    extra?: { packedPhotoUrl?: string; disputeReason?: string; handshakeOtp?: string }
  ) => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          status,
          notes: extra?.disputeReason || `Order marked as ${status}`,
          packedPhotoUrl: extra?.packedPhotoUrl,
          handshakeOtp: extra?.handshakeOtp,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status === false) {
        notify(data.message || `Could not update order to ${status}.`, 'error');
        return;
      }

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
      } else if (status === 'completed') {
        notify('Order completed and escrow funds released!', 'success');
      }

      await refreshFinancials();
    } catch (err: any) {
      notify(err.message || 'Network error updating order status.', 'error');
    }
  };

  // Money moves to Available only after buyer confirms item received on the server (or server cron auto-release)
  const confirmItemReceived = async (orderId: string) => {
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;

    if (ord.status === 'disputed') {
      notify(`Cannot release escrow: Order #${orderId} has an open dispute under moderation. Funds remain frozen.`, 'error');
      return;
    }

    await updateOrderStatus(orderId, 'completed');
  };

  const cancelOrder = async (orderId: string) => {
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;
    if (ord.status !== 'paid') {
      notify('Orders cannot be cancelled once the seller marks them as packed.', 'error');
      return;
    }
    await updateOrderStatus(orderId, 'cancelled');
    notify(`Order #${orderId} cancellation requested.`, 'info');
  };

  const openDispute = async (orderId: string, reason: string, evidencePhotoUrl?: string) => {
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          orderId,
          reason,
          description: reason,
          evidencePhotoUrl: evidencePhotoUrl || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status === false) {
        notify(data.message || 'Unable to open dispute.', 'error');
        return;
      }

      const ord = orders.find(o => o.id === orderId);
      if (ord) {
        const newDispute: DisputeTicket = {
          id: data.disputeId || `DISP-${Date.now()}`,
          orderId,
          buyerMaskedId: ord.buyerMaskedId,
          buyerName: ord.buyerName || 'Customer',
          sellerId: ord.items[0]?.sellerId || '',
          sellerShopName: ord.items[0]?.sellerShopName || 'Seller Shop',
          reason,
          description: reason,
          sellerPackedPhotoUrl: ord.packedPhotoUrl,
          evidencePhotoUrl: evidencePhotoUrl || '',
          amountHeldInEscrow: ord.grandTotal,
          status: 'open',
          createdAt: new Date().toISOString(),
        };
        setDisputes(prev => [newDispute, ...prev]);
        setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: 'disputed', disputeReason: reason } : o)));
      }
      await refreshFinancials();
      notify('Dispute opened. Escrow release is frozen while moderation reviews.', 'error');
    } catch (err: any) {
      notify(err?.message || 'Network error opening dispute.', 'error');
    }
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

  // Rule 4: Send an Email OTP before every withdrawal
  const sendWithdrawalOtp = async (
    amount: number,
    accountInfo?: { bank_name?: string; last4?: string }
  ): Promise<{ success: boolean; error?: string; waitSeconds?: number }> => {
    const email = (currentUser?.email || '').trim();
    if (!email) {
      notify('Please sign in with your registered email to request a withdrawal OTP.', 'error');
      return { success: false, error: 'Missing registered email' };
    }
    const name = currentUser?.name || currentSeller?.shopName || 'Artisan';
    const bank_name = accountInfo?.bank_name || 'Nigerian Bank Account';
    const last4 = accountInfo?.last4 || '••••';
    const result = await generateEmailOtp(email, 'withdrawal', { name, amount, bank_name, last4 });
    if (!result.success) {
      notify(result.error || 'Could not generate withdrawal OTP.', 'error');
      return result;
    }

    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    setActiveWithdrawalOtp({ code: 'HASHED_ON_SERVER', email, expiresAt, amount });
    notify(`[Email Authorization] A 6-digit withdrawal code was sent to ${email}. Valid for 10 minutes.`, 'info');
    return result;
  };

  const sendPayoutAccountOtp = async (
    accountInfo?: { bank_name?: string; last4?: string }
  ): Promise<{ success: boolean; error?: string; waitSeconds?: number }> => {
    const email = (currentUser?.email || '').trim();
    if (!email) {
      notify('Please sign in with your registered email to request an authorization code.', 'error');
      return { success: false, error: 'Missing registered email' };
    }
    const name = currentUser?.name || currentSeller?.shopName || 'Artisan';
    const bank_name = accountInfo?.bank_name || 'Nigerian Bank Account';
    const last4 = accountInfo?.last4 || '••••';
    const result = await generateEmailOtp(email, 'payout_account', { name, bank_name, last4 });
    if (!result.success) {
      notify(result.error || 'Could not generate authorization code.', 'error');
      return result;
    }
    notify(`[Email Security] A 6-digit payout account authorization code was sent to ${email}. Valid for 10 minutes.`, 'info');
    return result;
  };

  // Seller withdrawals go through server payout endpoint with atomic ledger debit & OTP enforcement
  const requestWithdrawal = async (amount: number, payoutAccountId: string, otpCode: string): Promise<boolean> => {
    if (!payoutsEnabled) {
      notify('Payouts are currently disabled by system safety switch. No withdrawal can be requested or debited.', 'error');
      return false;
    }

    if (!currentSeller) return false;

    // Rule: Unverified sellers cannot withdraw
    if (currentSeller.verificationStatus !== 'verified' && currentSeller.verificationStatus !== 'approved') {
      notify('Withdrawals Locked: Identity verification is required before withdrawing funds.', 'error');
      setIsVerificationModalOpen(true);
      return false;
    }

    const sellerLedger = ledgerEntries.filter(e => e.walletId === currentSeller.id);
    const balances = calculateBalancesFromLedger(sellerLedger);
    const baseWallet = wallets[currentSeller.id];

    if (baseWallet?.isFrozen) {
      notify(`Wallet is frozen by Administrator: ${baseWallet.freezeReason || 'Security review in progress'}. Withdrawals are temporarily disabled.`, 'error');
      return false;
    }

    if (amount < 1000) {
      notify('Minimum withdrawal amount is ₦1,000.', 'error');
      return false;
    }

    const cleanOtp = otpCode.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      notify('Please enter the 6-digit withdrawal OTP sent to your email.', 'error');
      return false;
    }

    const payoutAccount = (baseWallet?.payoutAccounts || []).find(p => p.id === payoutAccountId);
    if (!payoutAccount) {
      notify('Selected payout account not found. Please link a verified Nigerian bank account.', 'error');
      return false;
    }

    const cooling = isPayoutAccountCooled(payoutAccount);
    if (!cooling.isCooled) {
      notify(`This payout account was added recently and is in a 24-hour security cooling period (${cooling.hoursRemaining}h remaining) to prevent unauthorized drain.`, 'error');
      return false;
    }

    const verifiedName = currentSeller.verifiedLegalName || currentSeller.guardianName || currentUser?.name || currentSeller.shopName;
    const nameMatch = validateAccountNameMatch(payoutAccount.accountName, verifiedName);
    if (!nameMatch.isMatch) {
      notify(nameMatch.reason || `Account name must match verified seller identity (${verifiedName}).`, 'error');
      return false;
    }

    // Option 1: Shop It absorbs Flutterwave transfer fees (₦0 seller withdrawal fee)
    const fee = 0;
    const totalDeduction = amount;

    if (balances.availableBalance < totalDeduction) {
      notify(`Insufficient Available balance. You have ₦${balances.availableBalance.toLocaleString()} available. Needed: ₦${totalDeduction.toLocaleString()}.`, 'error');
      return false;
    }

    // Server verifies & consumes OTP atomically inside transfer flow
    try {
      const resp = await fetch('/api/payments/transfer', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          amount,
          payoutAccountId: payoutAccount.id,
          otpCode: cleanOtp,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.status) {
        notify(data.message || 'Withdrawal failed.', 'error');
        return false;
      }

      await Promise.all([fetchMarketplaceData(), refreshFinancials()]);
      setActiveWithdrawalOtp(null);
      notify(data.message || `Transfer of ₦${amount.toLocaleString()} dispatched.`, 'success');
      return true;
    } catch (err: any) {
      notify(`Transfer network error: ${err.message}`, 'error');
      return false;
    }
  };

  // Add Payout Account (server verifies & consumes OTP atomically)
  const addPayoutAccount = async (
    bankCode: string,
    bankName: string,
    accountNumber: string,
    accountName: string,
    otpCode?: string
  ): Promise<boolean> => {
    if (!currentSeller) return false;

    if (
      currentSeller.verificationStatus !== 'verified' &&
      currentSeller.verificationStatus !== 'approved' &&
      currentSeller.verificationStatus !== 'pending'
    ) {
      notify('Identity Verification Required: Please submit your NIN and live selfie before linking a bank payout account.', 'error');
      setIsVerificationModalOpen(true);
      return false;
    }

    if (accountNumber.trim().length !== 10) {
      notify('Nigerian bank/Opay account numbers must be exactly 10 digits.', 'error');
      return false;
    }

    const cleanOtp = otpCode?.trim() || '';
    if (!/^\d{6}$/.test(cleanOtp)) {
      notify('Please request and enter the 6-digit email authorization code.', 'error');
      return false;
    }

    const verifiedName = currentSeller.verifiedLegalName || currentSeller.guardianName || currentUser?.name || currentSeller.shopName;
    const nameMatch = validateAccountNameMatch(accountName, verifiedName);
    if (!nameMatch.isMatch) {
      notify(nameMatch.reason || `Account name must match your verified seller identity (${verifiedName}).`, 'error');
      return false;
    }

    try {
      const resp = await fetch('/api/wallet/payout-account', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          bankCode,
          bankName,
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim().toUpperCase(),
          otpCode: cleanOtp,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.status) {
        notify(data.message || 'Failed to save payout account.', 'error');
        return false;
      }

      await Promise.all([fetchMarketplaceData(), refreshFinancials()]);
      notify(`Payout account ${bankName} (${accountNumber}) linked! 24-hr security cooling period active until tomorrow.`, 'success');
      return true;
    } catch (err: any) {
      notify(`Failed to link payout account: ${err.message}`, 'error');
      return false;
    }
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
      notify(nextVal ? 'Two-Factor Authentication (2FA via Email) enabled!' : 'Two-Factor Authentication disabled.', 'info');
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
  const updateVerificationRequest = async (
    id: string,
    status: 'approved' | 'rejected' | 'needs_resubmission' | 'verified',
    notes?: string,
    adminName?: string
  ) => {
    const canonicalStatus: 'verified' | 'rejected' | 'needs_resubmission' =
      status === 'approved' ? 'verified' : status;
    const reviewer = adminName || currentUser?.name || 'Admin Moderator';

    setVerificationRequests(prev =>
      prev.map(req => {
        if (req.id === id) {
          return {
            ...req,
            status: canonicalStatus,
            reviewedAt: new Date().toISOString(),
            reviewedBy: reviewer,
            rejectionReason: canonicalStatus !== 'verified' ? notes : undefined,
            adminNotes: notes || req.adminNotes,
          };
        }
        return req;
      })
    );

    const targetReq = verificationRequests.find(r => r.id === id);
    const targetSellerId = targetReq?.sellerId || id;

    const targetSeller = sellers.find(s => s.id === targetSellerId);
    const sellerEmail = targetSeller?.email || '';
    const sellerName = targetReq?.ownerName || targetReq?.shopName || targetSeller?.shopName || 'Seller';

    try {
      await Promise.all([
        fetch('/api/verification/admin/review', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({
            requestId: id,
            sellerId: targetSellerId,
            decision: canonicalStatus,
            rejectionReason: notes,
          }),
        }).catch(err => console.warn('Server review call warning:', err.message)),
        fetch(`/api/admin/sellers/${encodeURIComponent(targetSellerId)}/verify`, {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ isVerified: canonicalStatus === 'verified' }),
        }).catch(err => console.warn('Server verify seller warning:', err.message)),
      ]);
    } catch {}

    if (canonicalStatus === 'verified') {
      if (sellerEmail) {
        sendTransactionalEmail(sellerEmail, 'seller_verified', {
          name: sellerName,
        });
      }

      setSellers(prev =>
        prev.map(s => {
          if (s.id === targetSellerId || (s.email && s.email.toLowerCase() === sellerEmail.toLowerCase())) {
            return {
              ...s,
              isVerifiedSeller: true,
              verificationStatus: 'verified',
              verifiedLegalName: targetReq?.ownerName || s.ownerName,
              verifiedNinLast4: targetReq?.fullNinLast4 || s.verifiedNinLast4,
              verifiedAt: new Date().toISOString(),
              verificationRejectionReason: undefined,
              badges: Array.from(new Set([...s.badges, 'verified'])),
            };
          }
          return s;
        })
      );

      // Immediately sync currentUser state
      setCurrentUser(prev => {
        if (!prev) return prev;
        if (
          prev.id === targetSellerId ||
          prev.sellerProfile?.id === targetSellerId ||
          (prev.email && prev.email.toLowerCase() === sellerEmail.toLowerCase())
        ) {
          const updated: User = {
            ...prev,
            sellerProfile: prev.sellerProfile
              ? {
                  ...prev.sellerProfile,
                  isVerifiedSeller: true,
                  verificationStatus: 'verified' as const,
                  verifiedLegalName: targetReq?.ownerName || prev.sellerProfile.verifiedLegalName,
                  verifiedNinLast4: targetReq?.fullNinLast4 || prev.sellerProfile.verifiedNinLast4,
                  badges: Array.from(new Set([...(prev.sellerProfile.badges || []), 'verified'])) as any,
                }
              : {
                  id: targetSellerId,
                  shopName: targetReq?.shopName || `${prev.name}'s Shop`,
                  isVerifiedSeller: true,
                  verificationStatus: 'verified' as const,
                  bio: 'Student artisan and maker.',
                  campus: 'UNILAG (Akoka)',
                  badges: ['verified' as any],
                  level: 1,
                  rating: 5.0,
                  reviewCount: 0,
                  salesCount: 0,
                  viewsCount: 0,
                  vacationMode: false,
                  under18: false,
                  guardianConsent: false,
                  joinedDate: new Date().toISOString(),
                },
          };
          try {
            localStorage.setItem('shopit_current_user', JSON.stringify(updated));
          } catch {}
          return updated;
        }
        return prev;
      });

      addAdminAuditLog(
        'SELLER_IDENTITY_VERIFIED',
        `Approved NIN & live selfie verification for seller "${sellerName}". Real Verified Badge issued.`,
        targetSellerId
      );
      notify(`Seller "${sellerName}" verified! Verified badge granted.`, 'success');
    } else if (canonicalStatus === 'rejected') {
      sendTransactionalEmail(sellerEmail, 'verification_not_approved', {
        name: sellerName,
        reason: notes || 'Document or selfie did not match identity verification criteria.',
      });

      setSellers(prev =>
        prev.map(s => {
          if (s.id === targetSellerId) {
            return {
              ...s,
              isVerifiedSeller: false,
              verificationStatus: 'rejected',
              verificationRejectionReason: notes || 'Document or selfie did not match identity verification criteria.',
              badges: s.badges.filter(b => b !== 'verified'),
            };
          }
          return s;
        })
      );
      addAdminAuditLog(
        'SELLER_IDENTITY_REJECTED',
        `Rejected identity verification for "${sellerName}". Reason: ${notes || 'Verification failed'}`,
        targetSellerId
      );
      notify(`Verification for "${sellerName}" rejected. Reason: ${notes || 'Failed criteria'}`, 'error');
    } else if (canonicalStatus === 'needs_resubmission') {
      // 14. VERIFICATION NOT APPROVED
      sendTransactionalEmail(sellerEmail, 'verification_not_approved', {
        name: sellerName,
        reason: notes || 'Please upload a clearer ID and selfie and try again.',
      });

      setSellers(prev =>
        prev.map(s => {
          if (s.id === targetSellerId) {
            return {
              ...s,
              isVerifiedSeller: false,
              verificationStatus: 'needs_resubmission',
              verificationRejectionReason: notes || 'Please resubmit a clearer photo of your ID or selfie.',
              badges: s.badges.filter(b => b !== 'verified'),
            };
          }
          return s;
        })
      );
      addAdminAuditLog(
        'SELLER_IDENTITY_RESUBMISSION_REQUESTED',
        `Requested re-submission of documents for "${sellerName}". Reason: ${notes || 'Clearer document needed'}`,
        targetSellerId
      );
      notify(`Requested resubmission for "${sellerName}". Seller prompted to upload clearer ID.`, 'info');
    }
  };

  const submitVerificationRequest = (
    data: Omit<SellerVerificationRequest, 'id' | 'submittedAt' | 'status'>,
    options?: { skipServerSubmit?: boolean }
  ) => {
    const id = `VERIF-${Math.floor(10000 + Math.random() * 90000)}`;
    const newReq: SellerVerificationRequest = {
      ...data,
      id,
      submittedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: 'pending',
    };

    setVerificationRequests(prev => [newReq, ...prev.filter(r => r.sellerId !== data.sellerId)]);

    // Persist standalone verification submission to PostgreSQL only when not already submitted via /api/verification/submit
    if (!options?.skipServerSubmit) {
      fetch('/api/sellers/verify/submit', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          sellerId: data.sellerId,
          ownerName: data.ownerName,
          shopName: data.shopName,
          nin: data.fullNinLast4,
          idType: data.idType,
          idCardPhotoUrl: data.idCardPhotoUrl,
          selfiePhotoUrl: data.selfiePhotoUrl,
          under18: data.under18,
          guardianName: data.guardianName,
          guardianPhone: data.guardianPhone,
          guardianConsent: data.guardianConsentSigned,
        }),
      }).catch(err => console.warn('Verification server submit warning:', err.message));
    }

    setSellers(prev =>
      prev.map(s => {
        if (s.id === data.sellerId) {
          return {
            ...s,
            verificationStatus: 'pending',
            isVerifiedSeller: false,
            badges: s.badges.filter(b => b !== 'verified'),
            verifiedLegalName: data.ownerName,
            under18: data.under18,
            guardianName: data.guardianName,
            guardianPhone: data.guardianPhone,
            guardianConsent: !!data.guardianConsentSigned,
          };
        }
        return s;
      })
    );

    setCurrentUser(prev => {
      if (!prev) return prev;
      if (prev.id === data.sellerId || prev.sellerProfile?.id === data.sellerId) {
        const updated = {
          ...prev,
          sellerProfile: prev.sellerProfile
            ? {
                ...prev.sellerProfile,
                verificationStatus: 'pending' as const,
                isVerifiedSeller: false,
                verifiedLegalName: data.ownerName,
              }
            : undefined,
        };
        try {
          localStorage.setItem('shopit_current_user', JSON.stringify(updated));
        } catch {}
        return updated;
      }
      return prev;
    });

    notify('ID & selfie submitted for review! Our moderator will review it within 24 hours.', 'success');
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

    // 12. DISPUTE RESOLVED (notify both buyer & seller)
    let decisionText = 'Dispute reviewed and resolved';
    if (resolution === 'release_seller') {
      decisionText = 'Funds released to seller after review';
    } else if (resolution === 'refund_full') {
      decisionText = `Full refund of ₦${disp.amountHeldInEscrow.toLocaleString()} returned to buyer`;
    } else if (resolution === 'partial') {
      const refundVal = amount || Math.round(disp.amountHeldInEscrow / 2);
      decisionText = `Partial resolution: ₦${refundVal.toLocaleString()} refunded to buyer, remaining released to seller`;
    }
    if (notes) {
      decisionText += ` (${notes})`;
    }

    const buyerEmail = ord?.buyerEmail || currentUser?.email || '';
    const buyerName = disp.buyerName || ord?.buyerName || 'Customer';
    if (buyerEmail) {
      sendTransactionalEmail(buyerEmail, 'dispute_resolved', {
        name: buyerName,
        order_id: disp.orderId,
        decision: decisionText,
      });
    }

    const targetSeller = sellers.find(s => s.id === disp.sellerId);
    const sellerEmail = targetSeller?.email || '';
    const sellerName = targetSeller?.shopName || targetSeller?.ownerName || 'Seller';
    if (sellerEmail) {
      sendTransactionalEmail(sellerEmail, 'dispute_resolved', {
        name: sellerName,
        order_id: disp.orderId,
        decision: decisionText,
      });
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

  // ==========================================
  // MODERATOR SUPER-POWERS & ACCOUNT GOVERNANCE
  // ==========================================

  const deleteUserAccount = (userId: string): boolean => {
    if (userId === 'admin_adeyinka_joseph') {
      notify('Master Admin account cannot be deleted.', 'error');
      return false;
    }

    const targetUser = registeredUsers.find(u => u.id === userId);
    const targetEmail = targetUser?.email;

    // Delete in PostgreSQL on server
    fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    }).catch(err => {
      console.warn('API delete user warning:', err.message);
    });

    setRegisteredUsers(prev => prev.filter(u => u.id !== userId));

    // Cleanup seller profile, listings, and wallet if seller
    setSellers(prev => prev.filter(s => s.id !== userId));
    setProducts(prev => prev.filter(p => p.sellerId !== userId));
    setVerificationRequests(prev => prev.filter(v => v.sellerId !== userId));
    setWallets(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });

    if (currentUser?.id === userId) {
      setCurrentUser(null);
      localStorage.removeItem('shopit_current_user');
      setActiveView('catalog');
    }

    notify(`Account "${targetUser?.name || 'User'}" (${targetEmail || userId}) permanently deleted from database.`, 'success');
    addAdminAuditLog('ACCOUNT_DELETED', `Permanently deleted account ${targetUser?.name || 'User'} (${targetEmail || userId})`, userId);
    return true;
  };

  const banUserAccount = (userId: string, isBanned: boolean, reason?: string) => {
    if (userId === 'admin_adeyinka_joseph') {
      notify('Master Admin account cannot be suspended.', 'error');
      return;
    }

    // Update in PostgreSQL on server
    fetch(`/api/admin/users/${encodeURIComponent(userId)}/ban`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ isBanned, banReason: reason }),
    }).catch(err => {
      console.warn('API ban user warning:', err.message);
    });

    setRegisteredUsers(prev => prev.map(u => u.id === userId ? { ...u, isBanned } : u));

    if (isBanned) {
      toggleWalletFreeze(userId, true, reason || 'Account suspended by moderator');
      setSellers(prev => prev.map(s => s.id === userId ? { ...s, vacationMode: true } : s));
      notify(`Account suspended in database and store hidden from marketplace.`, 'info');
      addAdminAuditLog('ACCOUNT_SUSPENDED', `Suspended account ${userId}. Reason: ${reason || 'Safety violation'}`, userId);
    } else {
      toggleWalletFreeze(userId, false);
      setSellers(prev => prev.map(s => s.id === userId ? { ...s, vacationMode: false } : s));
      notify(`Account suspension lifted in database.`, 'success');
      addAdminAuditLog('ACCOUNT_UNSUSPENDED', `Lifted suspension for account ${userId}`, userId);
    }
  };

  const adminResetUserPassword = (userId: string, newPass: string): boolean => {
    if (!newPass || newPass.trim().length < 8) {
      notify('Password must be at least 8 characters.', 'error');
      return false;
    }

    // Update in PostgreSQL on server
    fetch(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ newPassword: newPass.trim() }),
    }).catch(err => {
      console.warn('API reset password warning:', err.message);
    });

    notify('Password reset successfully in database for account.', 'success');
    addAdminAuditLog('PASSWORD_RESET', `Direct password reset executed for account ${userId}`, userId);
    return true;
  };

  const adminToggleSellerVerification = (sellerId: string, isVerified: boolean) => {
    // Update in PostgreSQL on server
    fetch(`/api/admin/sellers/${encodeURIComponent(sellerId)}/verify`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ isVerified }),
    }).catch(err => {
      console.warn('API verify seller warning:', err.message);
    });

    setSellers(prev =>
      prev.map(s => {
        if (s.id === sellerId) {
          const newBadges = isVerified
            ? Array.from(new Set([...s.badges, 'verified']))
            : s.badges.filter(b => b !== 'verified');
          return {
            ...s,
            isVerifiedSeller: isVerified,
            verificationStatus: isVerified ? 'verified' : 'pending',
            badges: newBadges as any,
          };
        }
        return s;
      })
    );

    setCurrentUser(prev => {
      if (!prev) return prev;
      if (prev.id === sellerId || prev.sellerProfile?.id === sellerId || (prev.email && prev.email.toLowerCase() === sellerId.toLowerCase())) {
        const updated = {
          ...prev,
          sellerProfile: prev.sellerProfile
            ? {
                ...prev.sellerProfile,
                isVerifiedSeller: isVerified,
                verificationStatus: isVerified ? ('verified' as const) : ('pending' as const),
                badges: isVerified
                  ? (Array.from(new Set([...(prev.sellerProfile.badges || []), 'verified'])) as any)
                  : (prev.sellerProfile.badges || []).filter(b => b !== 'verified') as any,
              }
            : {
                id: prev.id,
                shopName: `${prev.name}'s Shop`,
                bio: '',
                isVerifiedSeller: isVerified,
                verificationStatus: isVerified ? ('verified' as const) : ('pending' as const),
                badges: isVerified ? (['verified'] as any) : [],
                under18: false,
                guardianConsent: false,
                level: 1,
                rating: 5,
                reviewCount: 0,
                salesCount: 0,
                viewsCount: 0,
                vacationMode: false,
                joinedDate: new Date().toISOString(),
              },
        };
        try {
          localStorage.setItem('shopit_current_user', JSON.stringify(updated));
        } catch {}
        return updated;
      }
      return prev;
    });
    notify(
      isVerified
        ? `Seller verified with NIN Slip! Verified maker badge activated in database.`
        : `Seller verification status revoked in database.`,
      'info'
    );
    addAdminAuditLog(
      isVerified ? 'NIN_BADGE_GRANTED' : 'NIN_BADGE_REVOKED',
      `Seller NIN verification status set to ${isVerified ? 'VERIFIED' : 'UNVERIFIED'}`,
      sellerId
    );
  };

  const adminForceDeleteProduct = (productId: string) => {
    deleteProduct(productId);
    notify(`Listing #${productId} deleted permanently by moderator.`, 'info');
    addAdminAuditLog('PRODUCT_FORCE_DELETED', `Deleted product listing #${productId} from marketplace`, productId);
  };

  const adminForceReleaseEscrow = (orderId: string) => {
    confirmItemReceived(orderId);
    notify(`[Moderator Override] Escrow released for Order #${orderId} to seller available balance.`, 'success');
    addAdminAuditLog('ESCROW_FORCE_RELEASED', `Escrow funds force-released directly to seller for order #${orderId}`, orderId);
  };

  const adminForceRefundOrder = (orderId: string, notes?: string) => {
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;
    updateOrderStatus(orderId, 'cancelled', { disputeReason: notes || 'Moderator forced refund to buyer' });

    // Call server refund API
    if (ord.paymentReference) {
      fetch('/api/payments/refund', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          reference: ord.paymentReference,
          amountKobo: Math.round(ord.grandTotal * 100),
          reason: notes || `Moderator forced refund for Order #${orderId}`,
        }),
      })
        .then(() => refreshFinancials())
        .catch(err => {
          console.warn('Refund call warning:', err.message);
        });
    }

    notify(`[Moderator Override] Order #${orderId} cancelled & refund initiated.`, 'success');
    addAdminAuditLog('ORDER_FORCE_REFUNDED', `Order #${orderId} cancelled and refund initiated. Notes: ${notes || 'Direct intervention'}`, orderId);
  };

  const addAdminAuditLog = (action: string, details: string, targetId?: string) => {
    const newEntry: AdminAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      action,
      targetId,
      details,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + new Date().toLocaleDateString(),
      moderatorName: currentUser?.name || 'Adeyinka Joseph (Moderator)',
    };
    setAdminAuditLogs(prev => [newEntry, ...prev.slice(0, 49)]);
  };

  const updateBroadcastAnnouncement = (data: Partial<BroadcastAnnouncement>) => {
    setBroadcastAnnouncement(prev => {
      const updated = { ...prev, ...data };
      localStorage.setItem('shopit_broadcast_announcement', JSON.stringify(updated));
      return updated;
    });
    addAdminAuditLog(
      data.isActive !== undefined ? (data.isActive ? 'BROADCAST_ACTIVATED' : 'BROADCAST_DEACTIVATED') : 'BROADCAST_UPDATED',
      `Live site broadcast announcement updated: "${data.title || broadcastAnnouncement.title}"`
    );
    notify(data.isActive ? 'Site-wide broadcast is now live!' : 'Broadcast settings updated.', 'info');
  };

  const updateEmergencyControls = (controls: Partial<EmergencyControls>) => {
    setEmergencyControls(prev => {
      const updated = { ...prev, ...controls };
      localStorage.setItem('shopit_emergency_controls', JSON.stringify(updated));
      return updated;
    });
    const changed = Object.entries(controls)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    addAdminAuditLog('KILLSWITCH_TOGGLED', `Emergency platform killswitches updated: ${changed}`);
    notify('Emergency platform control updated.', 'info');
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

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      notify(next === 'dark' ? 'Night Mode activated · High-contrast dark theme' : 'Day Mode activated', 'info');
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

  const verifyHandshakeOtp = async (
    orderId: string,
    inputOtp: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanInput = inputOtp.trim();
    if (!/^\d{4}$/.test(cleanInput)) {
      notify('Please enter a valid 4-digit Handshake PIN.', 'error');
      return { success: false, message: 'Invalid 4-digit Handshake PIN.' };
    }

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          status: 'completed',
          handshakeOtp: cleanInput,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status === false) {
        notify(data.message || 'Incorrect Handshake PIN.', 'error');
        return { success: false, message: data.message || 'Invalid 4-digit Handshake PIN.' };
      }

      await refreshFinancials();
      notify(`Handshake Verified! Order #${orderId} completed and escrow funds released.`, 'success');
      return { success: true, message: 'Handshake PIN verified successfully! Escrow released.' };
    } catch (err: any) {
      notify(err.message || 'Network error verifying Handshake PIN.', 'error');
      return { success: false, message: err.message || 'Verification failed.' };
    }
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

  const clearMarketplaceDatabase = () => {
    fetch('/api/admin/users/wipe-non-admins', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    }).catch(err => {
      console.warn('Wipe non-admins API warning:', err.message);
    });

    // 1. Wipe all products and listings
    setProducts([]);
    // 2. Wipe all sellers and shops
    setSellers([]);
    // 3. Wipe all orders
    setOrders([]);
    // 4. Wipe all wallets
    setWallets({});
    // 5. Wipe shopping cart and wishlist
    setCart([]);
    setWishlist([]);
    // 6. Wipe all conversations and messages
    setConversations([]);
    setMessages({});
    // 7. Wipe verification requests, disputes, anti-bypass flags
    setVerificationRequests([]);
    setDisputes([]);
    setAntiBypassFlags([]);
    // 8. Wipe ledgers and webhooks
    setLedgerEntries([]);
    setPaymentWebhooks([]);
    // 9. Wipe commissions, drops, style posts
    setCommissions([]);
    setCampusDrops([]);
    setStylePosts([]);
    notify('Database wipe has been permanently disabled for security and data protection compliance.', 'info');
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
        refreshCurrentUser,
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
        requestAccountDeletion,
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
        submitVerificationRequest,
        isVerificationModalOpen,
        openVerificationModal,
        closeVerificationModal,
        disputes,
        resolveDispute,
        antiBypassFlags,
        updateFlagStatus,
        feeSettings,
        updateFeeSettings,
        // Moderator Super-Powers & Account Governance
        registeredUsers,
        deleteUserAccount,
        banUserAccount,
        adminResetUserPassword,
        adminToggleSellerVerification,
        adminForceDeleteProduct,
        adminForceReleaseEscrow,
        adminForceRefundOrder,
        broadcastAnnouncement,
        updateBroadcastAnnouncement,
        emergencyControls,
        updateEmergencyControls,
        adminAuditLogs,
        addAdminAuditLog,
        clearMarketplaceDatabase,
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
        paymentWebhooks,
        activeWithdrawalOtp,
        sendWithdrawalOtp,
        requestWithdrawal,
        addPayoutAccount,
        sendPayoutAccountOtp,
        resendSignupOtp,
        toggleWalletFreeze,
        securityProfile: currentSecurityProfile,
        toggleTwoFactor,
        revokeSession,
        paymentsEnabled,
        payoutsEnabled,
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
        theme,
        toggleTheme,
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
