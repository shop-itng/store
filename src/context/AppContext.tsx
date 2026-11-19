import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  LedgerEntry,
  PaymentWebhookEvent,
  ChatMessage,
  Conversation,
  DisputeTicket,
  SellerVerificationRequest,
  AntiBypassFlag,
  AdminSubRole,
  FeeSettings,
  SafePickupSpot,
  BroadcastAnnouncement,
  EmergencyControls,
  AdminAuditLog,
  NotificationPrefs,
  PrivacySettings,
  ChatAttachment,
  FollowRequestItem,
  FollowListUser,
  BlockedAccountItem,
  MutedAccountItem,
  SuggestedSellerItem,
  ProfileSearchResult,
  DbNotificationItem,
} from '../types';
import { VALID_COUPONS, INITIAL_SAFE_SPOTS } from '../data/mockData';
import { getPricingBreakdown, DEFAULT_FEE_SETTINGS } from '../utils/pricing';
import { checkNumbersInText } from '../utils/antiBypass';
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
  preferredSignupRole: UserRole;
  setPreferredSignupRole: (role: UserRole) => void;
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
  }) => Promise<void>;
  refreshCurrentUser: () => Promise<void>;

  // Catalog & Products
  products: Product[];
  filteredProducts: Product[];
  addProduct: (
    newProd: Omit<Product, 'id' | 'createdAt' | 'rating' | 'reviewCount' | 'reviews' | 'serviceFee' | 'displayPrice' | 'isSoldOut' | 'isNewArrival'> &
      Partial<Pick<Product, 'serviceFee' | 'displayPrice' | 'isSoldOut' | 'isNewArrival' | 'isDraft' | 'isPaused'>>
  ) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  toggleProductStock: (id: string) => Promise<void>;
  fetchMyListings: () => Promise<Product[]>;
  toggleProductPin: (productId: string, isPinned: boolean) => Promise<boolean>;
  toggleProductPause: (productId: string, isPaused: boolean) => Promise<boolean>;

  // Profiles & Account Settings (Phase A)
  updateMyProfile: (payload: {
    displayName?: string;
    avatarUrl?: string | null;
    coverUrl?: string | null;
    bio?: string;
    campus?: string;
    locationArea?: string;
    interests?: string[];
    shopName?: string;
    shopBio?: string;
    logoUrl?: string | null;
    bannerUrl?: string | null;
  }) => Promise<{ status: boolean; message?: string; profile?: any }>;
  updateMySettings: (payload: {
    notificationPrefs?: Partial<NotificationPrefs>;
    privacySettings?: Partial<PrivacySettings>;
  }) => Promise<{ status: boolean; message?: string; notificationPrefs?: NotificationPrefs; privacySettings?: PrivacySettings }>;
  requestEmailChangeOtp: (newEmail: string, currentPassword: string) => Promise<{ status: boolean; message?: string }>;
  confirmEmailChange: (newEmail: string, code: string, currentPassword: string) => Promise<{ status: boolean; message?: string }>;
  exportMyData: () => Promise<boolean>;
  deleteMyAccount: (password: string, confirmation: string) => Promise<{ status: boolean; message?: string }>;

  // Social: Follows, Follow Requests, Following Feed & Blocks
  followUser: (targetUserId: string) => Promise<{ status: boolean; followStatus?: 'pending' | 'accepted'; followersCount?: number; message?: string }>;
  unfollowUser: (targetUserId: string) => Promise<{ status: boolean; followersCount?: number; message?: string }>;
  fetchFollowRequests: () => Promise<FollowRequestItem[]>;
  respondToFollowRequest: (followerId: string, action: 'accept' | 'decline') => Promise<{ status: boolean; followersCount?: number }>;
  fetchFollowList: (
    slug: string,
    mode: 'followers' | 'following',
    q?: string
  ) => Promise<{ status: boolean; users: FollowListUser[]; total: number; message?: string }>;
  fetchFollowingFeed: (page?: number) => Promise<{ status: boolean; products: Product[]; total: number; followingCount: number; message?: string }>;
  fetchSuggestedSellers: (limit?: number) => Promise<SuggestedSellerItem[]>;
  searchProfiles: (q: string, limit?: number) => Promise<ProfileSearchResult[]>;
  blockUser: (targetUserId: string, reason?: string) => Promise<{ status: boolean; message?: string }>;
  unblockUser: (targetUserId: string) => Promise<{ status: boolean; message?: string }>;
  fetchBlockedUsers: () => Promise<BlockedAccountItem[]>;
  muteUser: (targetUserId: string) => Promise<{ status: boolean; message?: string }>;
  unmuteUser: (targetUserId: string) => Promise<{ status: boolean; message?: string }>;
  fetchMutedUsers: () => Promise<MutedAccountItem[]>;

  // Sellers
  sellers: SellerProfile[];
  getSellerById: (id: string) => SellerProfile | undefined;
  currentSeller: SellerProfile | null;
  toggleVacationMode: (sellerId: string) => Promise<void>;

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
  isCatalogLoading: boolean;
  selectedProductId: string | null;
  activeProfileSlug: string | null;
  openProduct: (id: string) => void;
  openProfile: (slugOrId: string) => void;
  openAccountSettings: () => void;

  // Restock alerts
  subscribeRestockAlert: (productId: string) => Promise<{ subscribed: boolean; inStock?: boolean }>;
  checkRestockAlert: (productId: string) => Promise<boolean>;

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
  submitOrderReview: (orderId: string, productId: string, rating: number, comment: string) => Promise<boolean>;
  buyerActiveOrdersCount: number;

  // Phase 4: Campus Safe Logistics & Handshake OTP Verification
  safePickupSpots: SafePickupSpot[];
  verifyHandshakeOtp: (orderId: string, inputOtp: string) => Promise<{ success: boolean; message: string }>;

  // Quick-List Product & Catalog Management
  isQuickListModalOpen: boolean;
  editingProduct: Product | null;
  openQuickListModal: (productToEdit?: Product) => void;
  closeQuickListModal: () => void;

  // Phase 3: Locked Chat & Privacy Anti-Bypass
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  refreshConversations: () => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
  loadConversationMessages: (conversationId: string) => Promise<void>;
  openChat: (conversationId?: string, targetInfo?: { orderId?: string; productId?: string; sellerId?: string }) => Promise<void>;
  sendMessage: (
    conversationId: string,
    content: string,
    customOrder?: any,
    presetOffer?: { price: number; quantity: number; title?: string },
    attachment?: ChatAttachment | { fileId: string }
  ) => Promise<{ success: boolean; isBlocked?: boolean; warning?: string }>;

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
  resolveDispute: (disputeId: string, resolution: 'refund_full' | 'release_seller' | 'partial', amount?: number, notes?: string) => Promise<boolean>;
  antiBypassFlags: AntiBypassFlag[];
  updateFlagStatus: (flagId: string, action: 'warn' | 'lock_chat' | 'freeze_account' | 'dismiss') => void;
  feeSettings: FeeSettings;
  updateFeeSettings: (settings: Partial<FeeSettings>) => Promise<boolean>;

  // Moderator Super-Powers & Account Governance
  registeredUsers: User[];
  refreshAdminData: (roleOverride?: UserRole) => Promise<void>;
  deleteUserAccount: (userId: string) => Promise<boolean>;
  banUserAccount: (userId: string, isBanned: boolean, reason?: string) => Promise<boolean>;
  adminResetUserPassword: (userId: string, newPass: string) => Promise<boolean>;
  adminToggleSellerVerification: (sellerId: string, isVerified: boolean) => Promise<boolean>;
  adminForceDeleteProduct: (productId: string) => void;
  adminForceReleaseEscrow: (orderId: string) => void;
  adminForceRefundOrder: (orderId: string, notes?: string) => void;
  broadcastAnnouncement: BroadcastAnnouncement;
  updateBroadcastAnnouncement: (data: Partial<BroadcastAnnouncement>) => Promise<boolean>;
  emergencyControls: EmergencyControls;
  updateEmergencyControls: (controls: Partial<EmergencyControls>) => Promise<boolean>;
  adminAuditLogs: AdminAuditLog[];
  addAdminAuditLog: (action: string, details: string, targetId?: string) => void;

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
  toggleWalletFreeze: (sellerId: string, freeze: boolean, reason?: string) => Promise<boolean>;

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

  // Toast & Database Notification Center
  notifications: NotificationItem[];
  notify: (message: string, type?: 'success' | 'info' | 'error') => void;
  dismissNotification: (id: string) => void;
  dbNotifications: DbNotificationItem[];
  unreadNotificationsCount: number;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // User identity is hydrated strictly from server DB (/api/auth/me), never from localStorage.
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [wallets, setWallets] = useState<Record<string, SellerWallet>>({});
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [paymentWebhooks] = useState<PaymentWebhookEvent[]>([]);

  // Rule 4: Send an Email OTP before every withdrawal
  const [activeWithdrawalOtp, setActiveWithdrawalOtp] = useState<{
    code: string;
    email: string;
    expiresAt: number;
    amount: number;
  } | null>(null);

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
      if (params.get('view') === 'settings') {
        return 'account_settings';
      }
      if (params.get('product')) {
        return 'product_detail';
      }
      if (params.get('profile') || params.get('shop')) {
        return 'profile';
      }
      if (LEGAL_SLUGS.includes(path as AppView)) {
        return path as AppView;
      }
    }
    return 'catalog';
  };

  // Navigation states
  const [activeView, _setActiveView] = useState<AppView>(getInitialView);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('product');
    }
    return null;
  });
  const [activeProfileSlug, setActiveProfileSlug] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('profile') || params.get('shop');
    }
    return null;
  });

  const getOrCreateVisitorId = useCallback((): string => {
    try {
      const existing = localStorage.getItem('shopit_visitor_id');
      if (existing) return existing;
      const created = `vis_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('shopit_visitor_id', created);
      return created;
    } catch {
      return 'guest';
    }
  }, []);

  const trackActivity = useCallback(
    (
      action: string,
      opts?: { targetType?: string; targetId?: string; details?: Record<string, any> }
    ) => {
      if (typeof window === 'undefined') return;
      try {
        fetch('/api/activity/track', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          keepalive: true,
          body: JSON.stringify({
            action,
            targetType: opts?.targetType || 'website',
            targetId: opts?.targetId,
            details: opts?.details || {},
            visitorId: getOrCreateVisitorId(),
          }),
        }).catch(() => {});
      } catch {}
    },
    [getOrCreateVisitorId]
  );

  const setActiveView = (view: AppView) => {
    _setActiveView(view);
    trackActivity('PAGE_VIEWED', { targetType: 'view', targetId: view, details: { view } });
    if (typeof window !== 'undefined') {
      if (view === 'reset-password') {
        if (window.location.pathname !== '/reset-password') {
          window.history.pushState({ view: 'reset-password' }, '', '/reset-password');
        }
      } else if (LEGAL_SLUGS.includes(view)) {
        if (window.location.pathname !== `/${view}`) {
          window.history.pushState({ view }, '', `/${view}`);
        }
      } else if (view === 'account_settings') {
        if (window.location.pathname !== '/' || window.location.search !== '?view=settings') {
          window.history.pushState({ view: 'account_settings' }, '', '/?view=settings');
        }
      } else if (view === 'catalog') {
        if (window.location.pathname !== '/' || window.location.search !== '') {
          window.history.pushState({ view: 'catalog' }, '', '/');
        }
      }
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname.replace(/^\//, '').toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const productParam = params.get('product');
      const profileParam = params.get('profile') || params.get('shop');
      const viewParam = params.get('view');
      if (path === 'reset-password' || path === 'forgot-password') {
        _setActiveView('reset-password');
      } else if (productParam) {
        setSelectedProductId(productParam);
        _setActiveView('product_detail');
      } else if (profileParam) {
        setActiveProfileSlug(profileParam);
        _setActiveView('profile');
      } else if (viewParam === 'settings') {
        _setActiveView('account_settings');
      } else if (LEGAL_SLUGS.includes(path as AppView)) {
        _setActiveView(path as AppView);
      } else if (path === '' || path === '/') {
        setSelectedProductId(null);
        setActiveProfileSlug(null);
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

  // Phase 4: Campus Safe Pickup Spots (verified static locations)
  const [safePickupSpots] = useState<SafePickupSpot[]>(INITIAL_SAFE_SPOTS);
  const [isQuickListModalOpen, setIsQuickListModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState<boolean>(false);
  const openVerificationModal = () => setIsVerificationModalOpen(true);
  const closeVerificationModal = () => setIsVerificationModalOpen(false);

  // Phase 3: Locked Chat States (hydrated from PostgreSQL)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pendingChatTarget, setPendingChatTarget] = useState<{
    conversationId?: string;
    targetInfo?: { orderId?: string; productId?: string; sellerId?: string };
  } | null>(null);

  // Phase 3: Admin & Moderation States (populated strictly from server DB for admins)
  const [adminSubRole, setAdminSubRole] = useState<AdminSubRole>('activity');
  const [verificationRequests, setVerificationRequests] = useState<SellerVerificationRequest[]>([]);
  const [disputes, setDisputes] = useState<DisputeTicket[]>([]);
  const [antiBypassFlags, setAntiBypassFlags] = useState<AntiBypassFlag[]>([]);
  const [feeSettings, setFeeSettings] = useState<FeeSettings>(DEFAULT_FEE_SETTINGS);

  // Registered users repository (loaded exclusively from server database for admins)
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);

  // Site-wide Broadcast, Platform Killswitches & Audit Trail (hydrated authoritatively from PostgreSQL)
  const [broadcastAnnouncement, setBroadcastAnnouncement] = useState<BroadcastAnnouncement>({
    id: 'broad_default',
    isActive: false,
    title: 'Campus Safety & Verified Handshake Advisory',
    message: 'All campus craft handoffs must be verified using the 4-digit Handshake OTP in daylight safe spots.',
    tone: 'info',
    createdAt: new Date().toISOString(),
    author: 'Shop It Safety Desk',
  });

  const [emergencyControls, setEmergencyControls] = useState<EmergencyControls>({
    maintenanceMode: false,
    pauseNewOrders: false,
    pauseSellerSignups: false,
  });

  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLog[]>([]);
  const cartDirtyRef = useRef(false);
  const wishlistDirtyRef = useRef(false);
  const lastTrackedCategoryRef = useRef<string>('all');

  // Phase 3: Report Problem Modal State
  const [isReportProblemModalOpen, setIsReportProblemModalOpen] = useState(false);
  const [activeReportOrderId, setActiveReportOrderId] = useState<string | null>(null);

  // Auth modal states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup' | 'otp' | 'seller_register' | 'forgot_password'>('login');
  const [preferredSignupRole, setPreferredSignupRole] = useState<UserRole>('buyer');
  const [pendingAuthData, setPendingAuthData] = useState<any>(null);

  // Notifications (toast alerts kept separate from DB persistent notifications)
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dbNotifications, setDbNotifications] = useState<DbNotificationItem[]>([]);

  // Hydrate authenticated user strictly from server session (/api/auth/me) on initial mount
  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { headers: getAuthHeaders(), credentials: 'include' })
      .then(async res => {
        if (!active) return;
        if (res.status === 401) {
          localStorage.removeItem('shopit_session_token');
          setCurrentUser(null);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.status && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Admin-only data loader: non-admins never request admin endpoints
  const refreshAdminData = useCallback(
    async (roleOverride?: UserRole) => {
      const effectiveRole = roleOverride ?? currentUser?.role;
      if (effectiveRole !== 'admin') {
        setRegisteredUsers([]);
        setVerificationRequests([]);
        setAdminAuditLogs([]);
        return;
      }
      try {
        const [verifRes, usersRes, activityRes] = await Promise.all([
          fetch('/api/verification/admin/queue', { headers: getAuthHeaders(), credentials: 'include' }).catch(() => null),
          fetch('/api/admin/users?limit=100', { headers: getAuthHeaders(), credentials: 'include' }).catch(() => null),
          fetch('/api/admin/activity?limit=100', { headers: getAuthHeaders(), credentials: 'include' }).catch(() => null),
        ]);

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

        if (activityRes && activityRes.ok) {
          const actData = await activityRes.json();
          if (actData.status && Array.isArray(actData.events)) {
            const mappedLogs: AdminAuditLog[] = actData.events.map((ev: any) => {
              const dt = ev.createdAt ? new Date(ev.createdAt) : new Date();
              const detailEntries =
                ev.details && typeof ev.details === 'object'
                  ? Object.entries(ev.details)
                      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                      .join(' · ')
                  : String(ev.details || '');
              return {
                id: String(ev.id),
                action: ev.action,
                targetId: ev.targetId || undefined,
                targetType: ev.targetType || undefined,
                actorId: ev.actorId || undefined,
                actorEmail: ev.actorEmail || 'guest@visitor',
                actorRole: ev.actorRole || 'visitor',
                details: detailEntries || (ev.targetType ? `${ev.targetType}${ev.targetId ? `:${ev.targetId}` : ''}` : 'Recorded'),
                rawDetails: ev.details && typeof ev.details === 'object' ? ev.details : {},
                ipAddress: ev.ipAddress || undefined,
                createdAt: ev.createdAt,
                timestamp: `${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${dt.toLocaleDateString()}`,
                moderatorName: ev.actorEmail || 'system',
              };
            });
            setAdminAuditLogs(mappedLogs);
          }
        }
      } catch (err: any) {
        console.warn('[Admin Sync Warning]:', err.message);
      }
    },
    [currentUser?.role]
  );

  const fetchPlatformConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/config', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status) {
        if (data.broadcastAnnouncement) setBroadcastAnnouncement(data.broadcastAnnouncement);
        if (data.emergencyControls) setEmergencyControls(data.emergencyControls);
        if (data.feeSettings) setFeeSettings(data.feeSettings);
      }
    } catch {}
  }, []);

  // PostgreSQL Single Source of Truth: Fetch public marketplace products/sellers, live platform config, and (for admins) admin data
  const fetchMarketplaceData = useCallback(async () => {
    try {
      const [prodRes, sellRes] = await Promise.all([
        fetch('/api/products?limit=100', { credentials: 'include' }).catch(() => null),
        fetch('/api/sellers', { credentials: 'include' }).catch(() => null),
        fetchPlatformConfig(),
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

      await refreshAdminData();
    } catch (err: any) {
      console.warn('[PostgreSQL Sync Warning]:', err.message);
    } finally {
      setIsCatalogLoading(false);
    }
  }, [fetchPlatformConfig, refreshAdminData]);

  useEffect(() => {
    fetchMarketplaceData();
  }, [fetchMarketplaceData, currentUser?.id, currentUser?.role]);

  // Direct single-item/seller fetch fallback when deep-linked (?product=... or ?shop=...)
  useEffect(() => {
    if (activeView === 'product_detail' && selectedProductId && !products.some(p => p.id === selectedProductId)) {
      fetch(`/api/products/${encodeURIComponent(selectedProductId)}`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          if (d.status && d.product) {
            setProducts(prev => (prev.some(p => p.id === d.product.id) ? prev : [d.product, ...prev]));
          }
        })
        .catch(() => {});
    }
  }, [activeView, selectedProductId, products]);

  useEffect(() => {
    if ((activeView === 'profile' || activeView === 'seller_shop') && activeProfileSlug && !sellers.some(s => s.id === activeProfileSlug)) {
      fetch(`/api/sellers/${encodeURIComponent(activeProfileSlug)}`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          if (d.status && d.seller) {
            setSellers(prev => (prev.some(s => s.id === d.seller.id) ? prev : [d.seller, ...prev]));
          }
        })
        .catch(() => {});
    }
  }, [activeView, activeProfileSlug, sellers]);

  // Keep broadcast & emergency killswitches synchronized across all active visitor sessions
  useEffect(() => {
    const onFocus = () => {
      void fetchPlatformConfig();
    };
    window.addEventListener('focus', onFocus);
    const interval = setInterval(() => {
      void fetchPlatformConfig();
    }, 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [fetchPlatformConfig]);

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

  const refreshConversations = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch('/api/chat/conversations', { headers: getAuthHeaders(), credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (data.status && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      }
    } catch {}
  }, [currentUser?.id]);

  const refreshNotifications = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch('/api/notifications', { headers: getAuthHeaders(), credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (data.status && Array.isArray(data.notifications)) {
        setDbNotifications(data.notifications);
      }
    } catch {}
  }, [currentUser?.id]);

  // Synchronize authenticated user entities with Neon PostgreSQL
  useEffect(() => {
    if (!currentUser?.id) {
      setDbNotifications([]);
      setConversations([]);
      return;
    }
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
    void refreshConversations();

    // Fetch disputes from PostgreSQL
    fetch('/api/disputes', { headers, credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.status && Array.isArray(data.disputes)) setDisputes(data.disputes);
      })
      .catch(() => {});

    void refreshNotifications();
  }, [currentUser?.id, currentUser?.role, refreshFinancials, refreshConversations, refreshNotifications]);

  // Adaptive background sync for notifications & conversations (paused when tab hidden)
  useEffect(() => {
    if (!currentUser?.id) return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void refreshConversations();
      void refreshNotifications();
    }, 15000);
    return () => clearInterval(interval);
  }, [currentUser?.id, refreshConversations, refreshNotifications]);

  // Sync cart and wishlist to PostgreSQL only on explicit user changes (not initial hydration)
  useEffect(() => {
    if (currentUser?.id && cartDirtyRef.current) {
      cartDirtyRef.current = false;
      fetch('/api/cart', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ items: cart }),
      }).catch(() => {});
    }
  }, [cart, currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id && wishlistDirtyRef.current) {
      wishlistDirtyRef.current = false;
      fetch('/api/wishlist', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ productIds: wishlist }),
      }).catch(() => {});
    }
  }, [wishlist, currentUser?.id]);

  // Track marketplace search queries (debounced) & category filter switches
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return;
    const timer = setTimeout(() => {
      trackActivity('MARKETPLACE_SEARCHED', {
        targetType: 'search',
        details: { query: trimmed, category: selectedCategory },
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, trackActivity]);

  useEffect(() => {
    if (lastTrackedCategoryRef.current === selectedCategory) return;
    lastTrackedCategoryRef.current = selectedCategory;
    if (selectedCategory !== 'all') {
      trackActivity('CATEGORY_FILTERED', {
        targetType: 'category',
        targetId: selectedCategory,
        details: { category: selectedCategory },
      });
    }
  }, [selectedCategory, trackActivity]);

  // Keep localStorage ONLY for client UI settings
  useEffect(() => {
    localStorage.setItem('shopit_low_data', String(lowDataMode));
  }, [lowDataMode]);

  // Escrow auto-release is executed authoritatively on the server via /api/cron/daily.

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
        if (!currentUser) {
          notify('Create your seller account and verify your email first to launch your shop.', 'info');
        }
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
      name: userData.name || 'Member',
      displayName: userData.displayName || (userData.name ? userData.name.trim().split(/\s+/)[0] : 'Member'),
      profileSlug: userData.profileSlug,
      avatarUrl: userData.avatarUrl,
      coverUrl: userData.coverUrl,
      bio: userData.bio,
      campus: userData.campus,
      interests: userData.interests,
      notificationPrefs: userData.notificationPrefs,
      privacySettings: userData.privacySettings,
      email: userData.email || 'customer@shopit.ng',
      role: userData.role || 'buyer',
      ...(userData.subRole ? { subRole: userData.subRole } : {}),
      isVerifiedEmail: userData.isVerifiedEmail ?? true,
      mustChangePassword: Boolean(userData.mustChangePassword),
      isBanned: userData.isBanned,
      age: userData.age,
      hasGuardianConsent: userData.hasGuardianConsent,
      guardianName: userData.guardianName,
      createdAt: userData.createdAt,
      savedDeliveryArea: userData.savedDeliveryArea || userLocation.area || 'Yaba',
      sellerProfile: userData.sellerProfile,
    };
    setCurrentUser(newUser);
    if (newUser.role === 'admin' && !newUser.mustChangePassword) {
      void refreshAdminData('admin');
    } else {
      setRegisteredUsers([]);
      setVerificationRequests([]);
    }
    notify(`Welcome back, ${newUser.displayName || newUser.name}!`, 'success');
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
    setAdminAuditLogs([]);
    setDbNotifications([]);
    setConversations([]);
    setMessages({});
    setActiveConversationId(null);
    setPendingChatTarget(null);
    setEditingProduct(null);
    localStorage.removeItem('shopit_session_token');
    setActiveView('catalog');
    notify('Logged out successfully', 'info');
  };

  const openAuthModal = (tab: 'login' | 'signup' | 'seller_register' | 'forgot_password' = 'login') => {
    if (tab === 'seller_register') {
      if (currentUser?.role === 'seller') {
        setActiveView('seller_dashboard');
        return;
      }
      if (currentUser?.role === 'buyer' || pendingAuthData?.signupVerificationToken) {
        setPreferredSignupRole('seller');
        setAuthTab('seller_register');
        setIsAuthModalOpen(true);
        trackActivity('AUTH_MODAL_OPENED', { targetType: 'auth', targetId: 'seller_register', details: { tab: 'seller_register' } });
        return;
      }
      // Unauthenticated visitor clicking "Sign Up as a Seller" must start at Step 1 (signup with seller role) -> OTP -> shop setup
      setPreferredSignupRole('seller');
      setAuthTab('signup');
      setIsAuthModalOpen(true);
      trackActivity('AUTH_MODAL_OPENED', { targetType: 'auth', targetId: 'seller_signup', details: { tab: 'signup', role: 'seller' } });
      return;
    }

    if (tab === 'signup') {
      setPreferredSignupRole('buyer');
    }
    setAuthTab(tab);
    setIsAuthModalOpen(true);
    trackActivity('AUTH_MODAL_OPENED', { targetType: 'auth', targetId: tab, details: { tab } });
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
  }) => {
    const resolvedArea = sellerData.locationArea || sellerData.location?.area || 'Lagos Mainland';

    // Authenticated buyer upgrading to seller shop
    if (!pendingAuthData?.email) {
      if (currentUser) {
        try {
          const resp = await fetch('/api/sellers/upgrade', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            credentials: 'include',
            body: JSON.stringify({
              shopName: sellerData.shopName,
              bio: sellerData.bio,
              campus: sellerData.campus || 'UNILAG (Akoka)',
              location: sellerData.location,
              locationArea: resolvedArea,
              under18: sellerData.under18,
              guardianName: sellerData.guardianName,
            }),
          });
          const data = await resp.json();
          if (!resp.ok || !data.status) {
            notify(data.message || 'Unable to create seller shop.', 'error');
            return;
          }
          const upgradedUser = data.user;
          if (upgradedUser?.sellerProfile) {
            setSellers(prev => [upgradedUser.sellerProfile, ...prev.filter(s => s.id !== upgradedUser.sellerProfile.id)]);
          }
          setCurrentUser(prev => (prev ? { ...prev, ...upgradedUser } : upgradedUser));
          closeAuthModal();
          setActiveView('seller_dashboard');
          fetchMarketplaceData();
          notify(`Shop "${sellerData.shopName}" created and saved in database!`, 'success');
          return;
        } catch (err: any) {
          console.error('[Seller Upgrade Error]:', err.message);
          notify('Unable to reach database server. Please try again.', 'error');
          return;
        }
      }

      setPreferredSignupRole('seller');
      setAuthTab('signup');
      notify('Please fill out your account details before launching your shop.', 'error');
      return;
    }

    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: pendingAuthData.email,
          password: pendingAuthData.password,
          name: pendingAuthData.name || sellerData.shopName,
          role: 'seller',
          age: pendingAuthData.age,
          hasGuardianConsent: pendingAuthData.hasGuardianConsent,
          guardianName: sellerData.guardianName || pendingAuthData.guardianName,
          signupVerificationToken: pendingAuthData.signupVerificationToken,
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
      setRegisteredUsers([]);
      setVerificationRequests([]);

      closeAuthModal();
      setActiveView('seller_dashboard');
      fetchMarketplaceData();
      notify(`Shop "${sellerData.shopName}" registered in ${resolvedArea} and saved to database!`, 'success');
    } catch (err: any) {
      console.error('[Seller Registration Error]:', err.message);
      notify('Unable to reach database server. Please try again.', 'error');
    }
  };

  const addProduct = async (
    newProd: Omit<
      Product,
      'id' | 'createdAt' | 'rating' | 'reviewCount' | 'reviews' | 'serviceFee' | 'displayPrice' | 'isSoldOut' | 'isNewArrival'
    > &
      Partial<Pick<Product, 'serviceFee' | 'displayPrice' | 'isSoldOut' | 'isNewArrival' | 'isDraft' | 'isPaused'>>
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

    const pricing = getPricingBreakdown(newProd.sellerPrice);
    const sanitizedBadges: Product['sellerBadges'] = (newProd.sellerBadges || []).filter(b => b !== 'verified');
    if (isSellerVerified) {
      sanitizedBadges.push('verified');
    }

    const tempId = `prod_temp_${Date.now()}`;
    const product: Product = {
      ...newProd,
      id: tempId,
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
      isDraft: Boolean(newProd.isDraft),
      isPaused: Boolean(newProd.isPaused),
    };

    try {
      const resp = await fetch('/api/products', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(product),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.status) {
        notify(data.message || 'Failed to save product listing in database.', 'error');
        return;
      }

      if (!product.isDraft && !product.isPaused) {
        const savedProduct: Product = {
          ...product,
          id: data.productId || tempId,
        };
        setProducts(prev => [savedProduct, ...prev]);
      }

      if (product.isDraft) {
        notify(`Draft "${product.title}" saved to your profile!`, 'success');
      } else if (currentSeller && !isSellerVerified) {
        notify('Craft published! Remember to complete your NIN identity verification before requesting bank withdrawals.', 'info');
      } else {
        notify(`Product "${product.title}" listed successfully in the marketplace!`, 'success');
      }
      await refreshCurrentUser();
    } catch (err: any) {
      console.warn('[Add Product Network Error]:', err.message);
      notify('Unable to reach server to publish product. Please try again.', 'error');
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const previousProducts = products;
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

    try {
      const resp = await fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.status) {
        setProducts(previousProducts);
        notify(data.message || 'Failed to update product in database.', 'error');
        return;
      }
      if (updates.isDraft !== undefined || updates.isPaused !== undefined) {
        void fetchMarketplaceData();
      }
      notify('Product updated', 'success');
    } catch (err: any) {
      setProducts(previousProducts);
      console.warn('[Update Product Network Error]:', err.message);
      notify('Unable to reach server to update product.', 'error');
    }
  };

  const deleteProduct = async (id: string) => {
    const previousProducts = products;
    setProducts(prev => prev.filter(p => p.id !== id));

    try {
      const resp = await fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.status) {
        setProducts(previousProducts);
        notify(data.message || 'Failed to delete product from database.', 'error');
        return;
      }
      notify('Product removed', 'info');
    } catch (err: any) {
      setProducts(previousProducts);
      console.warn('[Delete Product Network Error]:', err.message);
      notify('Unable to reach server to delete product.', 'error');
    }
  };

  const toggleProductStock = async (id: string) => {
    const target = products.find(p => p.id === id);
    if (!target) return;
    const newStock = target.stock > 0 ? 0 : 5;
    await updateProduct(id, { stock: newStock, isSoldOut: newStock === 0 });
  };

  const fetchMyListings = useCallback(async (): Promise<Product[]> => {
    if (!currentUser?.id) return [];
    try {
      const res = await fetch('/api/products/mine', { headers: getAuthHeaders(), credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status && Array.isArray(data.products)) {
        return data.products;
      }
      return [];
    } catch {
      return [];
    }
  }, [currentUser?.id]);

  const toggleProductPin = async (productId: string, isPinned: boolean): Promise<boolean> => {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}/pin`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ isPinned }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        notify(data.message || 'Could not update pin state.', 'error');
        return false;
      }
      setProducts(prev => prev.map(p => (p.id === productId ? { ...p, isPinned } : p)));
      notify(isPinned ? 'Item pinned to top of your profile.' : 'Item unpinned.', 'success');
      return true;
    } catch {
      notify('Unable to update pinned item.', 'error');
      return false;
    }
  };

  const toggleProductPause = async (productId: string, isPaused: boolean): Promise<boolean> => {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ isPaused }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        notify(data.message || 'Failed to update product visibility.', 'error');
        return false;
      }
      void fetchMarketplaceData();
      notify(isPaused ? 'Listing paused and hidden from marketplace.' : 'Listing resumed and live!', 'info');
      return true;
    } catch {
      notify('Unable to update listing visibility.', 'error');
      return false;
    }
  };

  const toggleVacationMode = async (sellerId: string) => {
    const targetSeller = sellers.find(s => s.id === sellerId);
    const nextMode = !(targetSeller?.vacationMode ?? currentUser?.sellerProfile?.vacationMode ?? false);
    const previousSellers = sellers;
    const previousUser = currentUser;

    setSellers(prev => prev.map(s => (s.id === sellerId ? { ...s, vacationMode: nextMode } : s)));
    if (currentUser?.sellerProfile?.id === sellerId || currentUser?.id === sellerId) {
      setCurrentUser(prev =>
        prev
          ? {
              ...prev,
              sellerProfile: prev.sellerProfile
                ? { ...prev.sellerProfile, vacationMode: nextMode }
                : undefined,
            }
          : null
      );
    }

    try {
      const resp = await fetch(`/api/sellers/${encodeURIComponent(sellerId)}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ vacationMode: nextMode }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.status) {
        setSellers(previousSellers);
        setCurrentUser(previousUser);
        notify(data.message || 'Failed to update vacation mode in database.', 'error');
        return;
      }
      notify(
        nextMode ? 'Vacation mode activated. Your shop is paused.' : 'Vacation mode disabled. Your shop is open!',
        'info'
      );
    } catch (err: any) {
      setSellers(previousSellers);
      setCurrentUser(previousUser);
      notify('Unable to reach server to update vacation mode.', 'error');
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
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (data.status && data.user) {
        const serverUser = data.user;
        setCurrentUser(prev => {
          if (!prev) return serverUser;
          return {
            ...prev,
            ...serverUser,
            sellerProfile: serverUser.sellerProfile ? {
              ...(prev.sellerProfile || {}),
              ...serverUser.sellerProfile,
            } : prev.sellerProfile,
          };
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

  const toggleWishlist = (productId: string) => {
    wishlistDirtyRef.current = true;
    const willSave = !wishlist.includes(productId);
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
    trackActivity('WISHLIST_TOGGLED', {
      targetType: 'product',
      targetId: productId,
      details: { saved: willSave },
    });
  };

  const addToCart = (item: CartItem) => {
    cartDirtyRef.current = true;
    setCart(prev => {
      const existingIdx = prev.findIndex(i => i.product.id === item.product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += item.quantity;
        return updated;
      }
      return [...prev, item];
    });
    trackActivity('CART_ITEM_ADDED', {
      targetType: 'product',
      targetId: item.product.id,
      details: { title: item.product.title, quantity: item.quantity, price: item.product.displayPrice },
    });
    notify(`Added "${item.product.title.slice(0, 24)}..." to cart!`, 'success');
  };

  const removeFromCart = (cartItemId: string) => {
    cartDirtyRef.current = true;
    setCart(prev => prev.filter(i => i.id !== cartItemId));
    trackActivity('CART_ITEM_REMOVED', { targetType: 'cart_item', targetId: cartItemId });
    notify('Item removed from cart', 'info');
  };

  const clearCart = () => {
    cartDirtyRef.current = true;
    setCart([]);
    trackActivity('CART_CLEARED', { targetType: 'cart' });
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
          buyerDisplayName: ord.buyerDisplayName || currentUser?.displayName || 'Customer',
          buyerAvatarUrl: ord.buyerAvatarUrl || currentUser?.avatarUrl,
          buyerProfileSlug: ord.buyerProfileSlug || currentUser?.profileSlug,
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

  const submitOrderReview = async (
    orderId: string,
    productId: string,
    rating: number,
    comment: string
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/review`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ productId, rating, comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        notify(data.message || 'Could not submit review.', 'error');
        return false;
      }

      if (data.review) {
        setProducts(prev =>
          prev.map(p => {
            if (p.id === (data.productId || productId)) {
              return {
                ...p,
                reviews: [data.review, ...(p.reviews || [])],
                reviewCount: data.reviewCount ?? (p.reviews?.length || 0) + 1,
                rating: data.rating ?? p.rating,
              };
            }
            return p;
          })
        );
      }

      setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, hasReview: true } : o)));
      notify(data.message || 'Thank you for rating your artisan!', 'success');
      return true;
    } catch (err: any) {
      notify(err?.message || 'Unable to save review right now.', 'error');
      return false;
    }
  };

  const checkRestockAlert = useCallback(
    async (productId: string): Promise<boolean> => {
      if (!currentUser?.id || !productId) return false;
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(productId)}/restock-alert`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        return Boolean(res.ok && data.status && data.subscribed);
      } catch {
        return false;
      }
    },
    [currentUser?.id]
  );

  const subscribeRestockAlert = async (
    productId: string
  ): Promise<{ subscribed: boolean; inStock?: boolean }> => {
    if (!currentUser?.id) {
      openAuthModal('login');
      notify('Please sign in to be notified when this item restocks.', 'info');
      return { subscribed: false };
    }
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}/restock-alert`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        notify(data.message || 'Could not save restock alert.', 'error');
        return { subscribed: false };
      }
      notify(
        data.message || 'We will notify you when this item is restocked!',
        data.inStock ? 'info' : 'success'
      );
      return { subscribed: Boolean(data.subscribed), inStock: Boolean(data.inStock) };
    } catch (err: any) {
      notify(err?.message || 'Network error setting restock alert.', 'error');
      return { subscribed: false };
    }
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

  // Rule 5: Admin can freeze a wallet (persisted in PostgreSQL)
  const toggleWalletFreeze = async (sellerId: string, freeze: boolean, reason?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/wallets/${encodeURIComponent(sellerId)}/freeze`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ isFrozen: freeze, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        notify(data.message || 'Failed to update wallet freeze status in database.', 'error');
        return false;
      }

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
      notify(freeze ? `Wallet for ${sellerId} frozen in database.` : `Wallet for ${sellerId} unfrozen in database.`, 'info');
      void refreshAdminData();
      return true;
    } catch (err: any) {
      notify(err?.message || 'Unable to reach database to update wallet status.', 'error');
      return false;
    }
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

  // Phase 3: Locked Chat Handlers (PostgreSQL-persisted)
  const markConversationRead = useCallback(
    async (conversationId: string) => {
      if (!currentUser?.id || !conversationId) return;
      try {
        const res = await fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/read`, {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.status) {
          setConversations(prev =>
            prev.map(c =>
              c.id === conversationId
                ? {
                    ...c,
                    unreadBuyer: typeof data.unreadBuyer === 'number' ? data.unreadBuyer : c.unreadBuyer,
                    unreadSeller: typeof data.unreadSeller === 'number' ? data.unreadSeller : c.unreadSeller,
                  }
                : c
            )
          );
        }
      } catch {}
    },
    [currentUser?.id]
  );

  const loadConversationMessages = useCallback(
    async (conversationId: string) => {
      if (!currentUser?.id || !conversationId) return;
      try {
        const res = await fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.status && Array.isArray(data.messages)) {
          const formatted: ChatMessage[] = data.messages.map((m: any) => ({
            ...m,
            timestamp: m.createdAt
              ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : m.timestamp || 'Just now',
          }));
          setMessages(prev => ({ ...prev, [conversationId]: formatted }));
          void markConversationRead(conversationId);
        }
      } catch {}
    },
    [currentUser?.id, markConversationRead]
  );

  // Adaptive 4s polling for the open chat conversation
  useEffect(() => {
    if (!currentUser?.id || activeView !== 'chat' || !activeConversationId) return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void loadConversationMessages(activeConversationId);
    }, 4000);
    return () => clearInterval(interval);
  }, [currentUser?.id, activeView, activeConversationId, loadConversationMessages]);

  const openChat = useCallback(
    async (
      conversationId?: string,
      targetInfo?: { orderId?: string; productId?: string; sellerId?: string }
    ) => {
      if (!currentUser?.id) {
        setPendingChatTarget({ conversationId, targetInfo });
        openAuthModal('login');
        notify('Please sign in to ask the seller via Escrow Chat.', 'info');
        return;
      }

      if (conversationId) {
        setActiveConversationId(conversationId);
        _setActiveView('chat');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        await loadConversationMessages(conversationId);
        return;
      }

      if (targetInfo) {
        const product = targetInfo.productId ? products.find(p => p.id === targetInfo.productId) : undefined;
        const resolvedSellerId = targetInfo.sellerId || product?.sellerId;
        if (!resolvedSellerId) {
          notify('Seller details are unavailable for this listing.', 'error');
          return;
        }
        if (resolvedSellerId === currentUser.id || resolvedSellerId === currentUser.sellerProfile?.id) {
          notify('You cannot start a buyer chat with your own shop.', 'info');
          return;
        }

        try {
          const res = await fetch('/api/chat/conversations', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            credentials: 'include',
            body: JSON.stringify({
              sellerId: resolvedSellerId,
              productId: targetInfo.productId,
              productTitle: product?.title,
              productImage: product?.images?.[0],
              orderId: targetInfo.orderId,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.status || !data.conversation) {
            notify(data.message || 'Unable to open seller chat right now.', 'error');
            return;
          }

          const conv: Conversation = data.conversation;
          setConversations(prev => [conv, ...prev.filter(c => c.id !== conv.id)]);
          setActiveConversationId(conv.id);
          await loadConversationMessages(conv.id);
        } catch (err: any) {
          notify(err?.message || 'Unable to reach chat server.', 'error');
          return;
        }
      }

      _setActiveView('chat');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentUser?.id, currentUser?.sellerProfile?.id, products, loadConversationMessages]
  );

  // Automatically resume pending Ask Seller chat right after user signs in
  useEffect(() => {
    if (currentUser?.id && pendingChatTarget) {
      const target = pendingChatTarget;
      setPendingChatTarget(null);
      void openChat(target.conversationId, target.targetInfo);
    }
  }, [currentUser?.id, pendingChatTarget, openChat]);

  useEffect(() => {
    if (!isAuthModalOpen && !currentUser?.id && pendingChatTarget) {
      setPendingChatTarget(null);
    }
  }, [isAuthModalOpen, currentUser?.id, pendingChatTarget]);

  const sendMessage = async (
    conversationId: string,
    content: string,
    _customOrder?: any,
    presetOffer?: { price: number; quantity: number; title?: string },
    attachment?: ChatAttachment | { fileId: string }
  ): Promise<{ success: boolean; isBlocked?: boolean; warning?: string }> => {
    if (!currentUser?.id) {
      openAuthModal('login');
      return { success: false, warning: 'Sign in required' };
    }

    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return { success: false };

    if (conv.isChatLocked) {
      notify('This chat is locked by Shop It safety moderation due to repeated bypass attempts.', 'error');
      return { success: false, isBlocked: true, warning: 'Chat locked by moderation' };
    }

    if (conv.isBlocked) {
      notify('Messaging is unavailable because one participant has blocked the other.', 'error');
      return { success: false, isBlocked: true, warning: 'Blocked user' };
    }

    // Block typed digits and number words in regular text messages (presetOffer uses curated chip values)
    if (content.trim() && !presetOffer) {
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

    const attachmentFileId =
      attachment && 'fileId' in attachment
        ? attachment.fileId
        : attachment && 'id' in attachment
          ? attachment.id
          : undefined;

    const postPayload = JSON.stringify({
      content,
      presetOffer,
      ...(attachmentFileId ? { attachment: { fileId: attachmentFileId } } : {}),
    });
    const url = `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`;

    const attemptSend = async (): Promise<Response> =>
      fetch(url, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: postPayload,
      });

    try {
      let res: Response;
      try {
        res = await attemptSend();
      } catch {
        // Retry once automatically on transient network drop (never on HTTP 4xx/5xx)
        await new Promise(resolve => setTimeout(resolve, 500));
        res = await attemptSend();
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status || !data.message) {
        notify(data.message || 'Unable to send message.', 'error');
        return { success: false, isBlocked: res.status === 403, warning: data.message };
      }

      const savedMsg: ChatMessage = {
        ...data.message,
        timestamp: data.message.createdAt
          ? new Date(data.message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'Just now',
      };

      setMessages(prev => {
        const list = prev[conversationId] || [];
        if (list.some(m => m.id === savedMsg.id)) return prev;
        return { ...prev, [conversationId]: [...list, savedMsg] };
      });

      const lastPreview = savedMsg.content
        ? savedMsg.content
        : savedMsg.attachment
          ? `[Attachment: ${savedMsg.attachment.originalName}]`
          : '[Custom Offer]';

      setConversations(prev =>
        prev.map(c =>
          c.id === conversationId
            ? {
                ...c,
                lastMessage: lastPreview,
                lastMessageAt: savedMsg.createdAt || savedMsg.timestamp,
                isChatLocked: Boolean(data.isChatLocked ?? c.isChatLocked),
                bypassViolationsCount: data.bypassViolationsCount ?? c.bypassViolationsCount,
              }
            : c
        )
      );

      if (data.warning || savedMsg.isBlockedBypass) {
        notify(data.warning || 'Safety Warning: Off-platform contact details blocked!', 'error');
      }

      return {
        success: true,
        isBlocked: Boolean(savedMsg.isBlockedBypass),
        warning: data.warning,
      };
    } catch (err: any) {
      notify(err?.message || 'Network error sending message.', 'error');
      return { success: false };
    }
  };

  // ==========================================
  // SOCIAL & NOTIFICATION CENTER ACTIONS
  // ==========================================

  const followUser = useCallback(
    async (targetUserId: string) => {
      if (!currentUser?.id) {
        openAuthModal('login');
        return { status: false, message: 'Please sign in to follow artisans and shoppers.' };
      }
      try {
        const res = await fetch('/api/follows', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ targetUserId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.status) {
          notify(data.message || 'Unable to follow user.', 'error');
          return { status: false, message: data.message };
        }
        notify(
          data.followStatus === 'pending' ? 'Follow request sent!' : 'Following! You will see their new crafts.',
          'success'
        );
        return {
          status: true,
          followStatus: data.followStatus as 'pending' | 'accepted',
          followersCount: Number(data.followersCount ?? 0),
        };
      } catch {
        notify('Network error following user.', 'error');
        return { status: false, message: 'Network error' };
      }
    },
    [currentUser?.id]
  );

  const unfollowUser = useCallback(
    async (targetUserId: string) => {
      if (!currentUser?.id) return { status: false };
      try {
        const res = await fetch(`/api/follows/${encodeURIComponent(targetUserId)}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.status) {
          notify(data.message || 'Unable to unfollow.', 'error');
          return { status: false, message: data.message };
        }
        notify('Unfollowed.', 'info');
        return { status: true, followersCount: Number(data.followersCount ?? 0) };
      } catch {
        notify('Network error unfollowing.', 'error');
        return { status: false };
      }
    },
    [currentUser?.id]
  );

  const fetchFollowRequests = useCallback(async (): Promise<FollowRequestItem[]> => {
    if (!currentUser?.id) return [];
    try {
      const res = await fetch('/api/follows/requests', { headers: getAuthHeaders(), credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      return res.ok && data.status && Array.isArray(data.requests) ? data.requests : [];
    } catch {
      return [];
    }
  }, [currentUser?.id]);

  const respondToFollowRequest = useCallback(
    async (followerId: string, action: 'accept' | 'decline') => {
      try {
        const res = await fetch(`/api/follows/requests/${encodeURIComponent(followerId)}`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ action }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.status) {
          notify(data.message || 'Could not update request.', 'error');
          return { status: false };
        }
        notify(action === 'accept' ? 'Follow request accepted.' : 'Follow request declined.', 'success');
        return { status: true, followersCount: data.followersCount };
      } catch {
        notify('Network error handling follow request.', 'error');
        return { status: false };
      }
    },
    []
  );

  const fetchFollowList = useCallback(
    async (slug: string, mode: 'followers' | 'following', q?: string) => {
      try {
        const qs = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
        const res = await fetch(`/api/profiles/${encodeURIComponent(slug)}/${mode}${qs}`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.status) {
          return { status: false, users: [], total: 0, message: data.message || `Unable to load ${mode}.` };
        }
        return { status: true, users: data.users || [], total: Number(data.total || 0) };
      } catch {
        return { status: false, users: [], total: 0, message: 'Network error.' };
      }
    },
    []
  );

  const fetchFollowingFeed = useCallback(async (page = 1) => {
    if (!currentUser?.id) {
      return { status: false, products: [], total: 0, followingCount: 0, message: 'Sign in required' };
    }
    try {
      const res = await fetch(`/api/feed/following?page=${page}&limit=40`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        return { status: false, products: [], total: 0, followingCount: 0, message: data.message || 'Unable to load Following feed.' };
      }
      return {
        status: true,
        products: data.products || [],
        total: Number(data.total || 0),
        followingCount: Number(data.followingCount || 0),
      };
    } catch {
      return { status: false, products: [], total: 0, followingCount: 0, message: 'Network error loading feed.' };
    }
  }, [currentUser?.id]);

  const blockUser = useCallback(
    async (targetUserId: string, reason?: string) => {
      if (!currentUser?.id) {
        openAuthModal('login');
        return { status: false, message: 'Sign in required.' };
      }
      try {
        const res = await fetch('/api/blocks', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ targetUserId, ...(reason ? { reason } : {}) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.status) {
          notify(data.message || 'Could not block user.', 'error');
          return { status: false, message: data.message };
        }
        notify(data.message || 'User blocked.', 'info');
        void refreshConversations();
        return { status: true, message: data.message };
      } catch {
        notify('Network error blocking user.', 'error');
        return { status: false };
      }
    },
    [currentUser?.id, refreshConversations]
  );

  const unblockUser = useCallback(
    async (targetUserId: string) => {
      if (!currentUser?.id) return { status: false };
      try {
        const res = await fetch(`/api/blocks/${encodeURIComponent(targetUserId)}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.status) {
          notify(data.message || 'Could not unblock user.', 'error');
          return { status: false, message: data.message };
        }
        notify('User unblocked.', 'success');
        void refreshConversations();
        return { status: true };
      } catch {
        notify('Network error unblocking user.', 'error');
        return { status: false };
      }
    },
    [currentUser?.id, refreshConversations]
  );

  const fetchBlockedUsers = useCallback(async (): Promise<BlockedAccountItem[]> => {
    if (!currentUser?.id) return [];
    try {
      const res = await fetch('/api/blocks', { headers: getAuthHeaders(), credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      return res.ok && data.status && Array.isArray(data.blocks) ? data.blocks : [];
    } catch {
      return [];
    }
  }, [currentUser?.id]);

  const fetchSuggestedSellers = useCallback(async (limit = 8): Promise<SuggestedSellerItem[]> => {
    try {
      const res = await fetch(`/api/profiles/discover/suggested?limit=${limit}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      return res.ok && data.status && Array.isArray(data.sellers) ? data.sellers : [];
    } catch {
      return [];
    }
  }, []);

  const searchProfiles = useCallback(async (q: string, limit = 8): Promise<ProfileSearchResult[]> => {
    const clean = q.trim();
    if (clean.length < 2) return [];
    try {
      const res = await fetch(
        `/api/profiles/search?q=${encodeURIComponent(clean)}&limit=${limit}`,
        { headers: getAuthHeaders(), credentials: 'include' }
      );
      const data = await res.json().catch(() => ({}));
      return res.ok && data.status && Array.isArray(data.profiles) ? data.profiles : [];
    } catch {
      return [];
    }
  }, []);

  const muteUser = useCallback(
    async (targetUserId: string) => {
      if (!currentUser?.id) {
        openAuthModal('login');
        return { status: false, message: 'Sign in required.' };
      }
      try {
        const res = await fetch('/api/mutes', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ targetUserId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.status) {
          notify(data.message || 'Could not mute notifications.', 'error');
          return { status: false, message: data.message };
        }
        notify(data.message || 'Notifications muted for this account.', 'info');
        return { status: true, message: data.message };
      } catch {
        notify('Network error muting account.', 'error');
        return { status: false };
      }
    },
    [currentUser?.id]
  );

  const unmuteUser = useCallback(
    async (targetUserId: string) => {
      if (!currentUser?.id) return { status: false };
      try {
        const res = await fetch(`/api/mutes/${encodeURIComponent(targetUserId)}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.status) {
          notify(data.message || 'Could not unmute user.', 'error');
          return { status: false, message: data.message };
        }
        notify('Notifications unmuted.', 'success');
        return { status: true };
      } catch {
        notify('Network error unmuting user.', 'error');
        return { status: false };
      }
    },
    [currentUser?.id]
  );

  const fetchMutedUsers = useCallback(async (): Promise<MutedAccountItem[]> => {
    if (!currentUser?.id) return [];
    try {
      const res = await fetch('/api/mutes', { headers: getAuthHeaders(), credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      return res.ok && data.status && Array.isArray(data.mutes) ? data.mutes : [];
    } catch {
      return [];
    }
  }, [currentUser?.id]);

  const markNotificationRead = useCallback(
    async (id: string) => {
      setDbNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
      try {
        await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          credentials: 'include',
        });
      } catch {}
    },
    []
  );

  const markAllNotificationsRead = useCallback(async () => {
    setDbNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
    } catch {}
  }, []);

  const unreadNotificationsCount = useMemo(
    () => dbNotifications.filter(n => !n.isRead).length,
    [dbNotifications]
  );

  // Phase 3: Admin & Moderation Handlers
  const updateVerificationRequest = async (
    id: string,
    status: 'approved' | 'rejected' | 'needs_resubmission' | 'verified',
    notes?: string,
    adminName?: string
  ) => {
    if (currentUser?.role !== 'admin') {
      notify('Administrator session required.', 'error');
      return;
    }
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
            guardianConsent: !!data.guardianConsentSigned,
          };
        }
        return s;
      })
    );

    setCurrentUser(prev => {
      if (!prev) return prev;
      if (prev.id === data.sellerId || prev.sellerProfile?.id === data.sellerId) {
        return {
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
      }
      return prev;
    });

    notify('ID & selfie submitted for review! Our moderator will review it within 24 hours.', 'success');
  };

  const resolveDispute = async (
    disputeId: string,
    resolution: 'refund_full' | 'release_seller' | 'partial',
    amount?: number,
    notes?: string
  ): Promise<boolean> => {
    const disp = disputes.find(d => d.id === disputeId);
    if (!disp) return false;
    const ord = orders.find(o => o.id === disp.orderId);

    try {
      const res = await fetch(`/api/disputes/${encodeURIComponent(disputeId)}/resolve`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ resolution, partialRefundAmount: amount, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        notify(data.message || 'Failed to resolve dispute in database.', 'error');
        return false;
      }

      setDisputes(prev =>
        prev.map(d =>
          d.id === disputeId
            ? {
                ...d,
                status: data.disputeStatus || d.status,
                refundAmount: data.refundNaira,
                resolutionNotes: data.resolutionNotes || notes,
              }
            : d
        )
      );

      await Promise.all([refreshFinancials(), refreshAdminData()]);

      let decisionText = data.resolutionNotes || 'Dispute reviewed and resolved';
      const buyerEmail = ord?.buyerEmail || '';
      const buyerName = disp.buyerName || ord?.buyerName || 'Customer';
      if (buyerEmail) {
        sendTransactionalEmail(buyerEmail, 'dispute_resolved', {
          name: buyerName,
          order_id: disp.orderId,
          decision: decisionText,
        });
      }

      const targetSeller = sellers.find(s => s.id === disp.sellerId);
      if (targetSeller?.email) {
        sendTransactionalEmail(targetSeller.email, 'dispute_resolved', {
          name: targetSeller.shopName || targetSeller.ownerName || 'Seller',
          order_id: disp.orderId,
          decision: decisionText,
        });
      }

      notify(data.message || 'Dispute resolved and saved in database.', 'success');
      return true;
    } catch (err: any) {
      notify(err?.message || 'Unable to reach database server to resolve dispute.', 'error');
      return false;
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
      fetch(`/api/admin/chat/conversations/${encodeURIComponent(flag.conversationId)}/lock`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ isChatLocked: true }),
      }).catch(() => {});
      setConversations(prev =>
        prev.map(c => c.id === flag.conversationId ? { ...c, isChatLocked: true } : c)
      );
      notify(`Chat locked for flag #${flagId}.`, 'info');
    } else if (flag && action === 'freeze_account') {
      if (flag.senderRole === 'seller') {
        void toggleWalletFreeze(flag.senderId, true, 'Anti-bypass repeated violation');
      }
      notify(`Account for sender ${flag.senderDisplayName} frozen for safety review.`, 'error');
    } else {
      notify(`Flag action: ${action} applied.`, 'info');
    }
    addAdminAuditLog('FLAG_ACTION_APPLIED', `Anti-bypass flag #${flagId} updated with action: ${action}`, flagId);
  };

  const updateFeeSettings = async (newSettings: Partial<FeeSettings>): Promise<boolean> => {
    const merged = { ...feeSettings, ...newSettings };
    try {
      const res = await fetch('/api/admin/fee-settings', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(merged),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        notify(data.message || 'Failed to save fee settings in database.', 'error');
        return false;
      }
      if (data.feeSettings) {
        setFeeSettings(data.feeSettings);
      } else {
        setFeeSettings(merged);
      }
      notify('Platform fee settings saved to database!', 'success');
      void refreshAdminData();
      return true;
    } catch (err: any) {
      notify(err?.message || 'Unable to reach database server to save fee settings.', 'error');
      return false;
    }
  };

  // ==========================================
  // MODERATOR SUPER-POWERS & ACCOUNT GOVERNANCE
  // ==========================================

  const deleteUserAccount = async (userId: string): Promise<boolean> => {
    if (currentUser?.role !== 'admin') {
      notify('Administrator session required.', 'error');
      return false;
    }
    if (userId === 'admin_adeyinka_joseph') {
      notify('Master Admin account cannot be deleted.', 'error');
      return false;
    }

    const targetUser = registeredUsers.find(u => u.id === userId);
    const targetEmail = targetUser?.email;

    try {
      const resp = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.status) {
        notify(data.message || 'Failed to delete user account in database.', 'error');
        return false;
      }

      setRegisteredUsers(prev => prev.filter(u => u.id !== userId));
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
        setActiveView('catalog');
      }

      await refreshAdminData('admin');
      notify(`Account "${targetUser?.name || 'User'}" (${targetEmail || userId}) permanently deleted from database.`, 'success');
      addAdminAuditLog('ACCOUNT_DELETED', `Permanently deleted account ${targetUser?.name || 'User'} (${targetEmail || userId})`, userId);
      return true;
    } catch (err: any) {
      console.warn('API delete user error:', err.message);
      notify('Unable to reach database server to delete user.', 'error');
      return false;
    }
  };

  const banUserAccount = async (userId: string, isBanned: boolean, reason?: string): Promise<boolean> => {
    if (currentUser?.role !== 'admin') {
      notify('Administrator session required.', 'error');
      return false;
    }
    if (userId === 'admin_adeyinka_joseph') {
      notify('Master Admin account cannot be suspended.', 'error');
      return false;
    }

    try {
      const resp = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/ban`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ isBanned, banReason: reason }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.status) {
        notify(data.message || 'Failed to update suspension status in database.', 'error');
        return false;
      }

      setRegisteredUsers(prev => prev.map(u => (u.id === userId ? { ...u, isBanned } : u)));

      if (isBanned) {
        toggleWalletFreeze(userId, true, reason || 'Account suspended by moderator');
        setSellers(prev => prev.map(s => (s.id === userId ? { ...s, vacationMode: true } : s)));
        notify(`Account suspended in database and store hidden from marketplace.`, 'info');
        addAdminAuditLog('ACCOUNT_SUSPENDED', `Suspended account ${userId}. Reason: ${reason || 'Safety violation'}`, userId);
      } else {
        toggleWalletFreeze(userId, false);
        setSellers(prev => prev.map(s => (s.id === userId ? { ...s, vacationMode: false } : s)));
        notify(`Account suspension lifted in database.`, 'success');
        addAdminAuditLog('ACCOUNT_UNSUSPENDED', `Lifted suspension for account ${userId}`, userId);
      }

      await refreshAdminData('admin');
      return true;
    } catch (err: any) {
      console.warn('API ban user error:', err.message);
      notify('Unable to reach database server to update suspension.', 'error');
      return false;
    }
  };

  const adminResetUserPassword = async (userId: string, newPass: string): Promise<boolean> => {
    if (currentUser?.role !== 'admin') {
      notify('Administrator session required.', 'error');
      return false;
    }
    if (!newPass || newPass.trim().length < 8) {
      notify('Password must be at least 8 characters.', 'error');
      return false;
    }

    try {
      const resp = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ newPassword: newPass.trim() }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.status) {
        notify(data.message || 'Failed to reset user password in database.', 'error');
        return false;
      }

      notify('Password reset successfully in database for account.', 'success');
      addAdminAuditLog('PASSWORD_RESET', `Direct password reset executed for account ${userId}`, userId);
      return true;
    } catch (err: any) {
      console.warn('API reset password error:', err.message);
      notify('Unable to reach database server to reset password.', 'error');
      return false;
    }
  };

  const adminToggleSellerVerification = async (sellerId: string, isVerified: boolean): Promise<boolean> => {
    if (currentUser?.role !== 'admin') {
      notify('Administrator session required.', 'error');
      return false;
    }
    try {
      const resp = await fetch(`/api/admin/sellers/${encodeURIComponent(sellerId)}/verify`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ isVerified }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.status) {
        notify(data.message || 'Failed to update seller verification in database.', 'error');
        return false;
      }

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
          return {
            ...prev,
            sellerProfile: prev.sellerProfile
              ? {
                  ...prev.sellerProfile,
                  isVerifiedSeller: isVerified,
                  verificationStatus: isVerified ? ('verified' as const) : ('pending' as const),
                  badges: isVerified
                    ? (Array.from(new Set([...(prev.sellerProfile.badges || []), 'verified'])) as any)
                    : ((prev.sellerProfile.badges || []).filter(b => b !== 'verified') as any),
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
        }
        return prev;
      });

      await refreshAdminData('admin');
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
      return true;
    } catch (err: any) {
      console.warn('API verify seller error:', err.message);
      notify('Unable to reach database server to update verification.', 'error');
      return false;
    }
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
      actorEmail: currentUser?.email || 'moderator',
      actorRole: currentUser?.role || 'admin',
      details,
      createdAt: new Date().toISOString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + new Date().toLocaleDateString(),
      moderatorName: currentUser?.name || currentUser?.email || 'Moderator',
    };
    setAdminAuditLogs(prev => [newEntry, ...prev.slice(0, 99)]);
    if (currentUser?.role === 'admin') {
      fetch('/api/admin/audit', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          action,
          targetType: 'admin_panel',
          targetId,
          summary: details,
        }),
      }).catch(() => {});
    }
  };

  const updateBroadcastAnnouncement = async (data: Partial<BroadcastAnnouncement>): Promise<boolean> => {
    const payload = { ...broadcastAnnouncement, ...data };
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.status) {
        notify(result.message || 'Failed to save broadcast in database.', 'error');
        return false;
      }
      if (result.broadcastAnnouncement) {
        setBroadcastAnnouncement(result.broadcastAnnouncement);
      } else {
        setBroadcastAnnouncement(payload);
      }
      notify(payload.isActive ? 'Site-wide broadcast saved and live for all visitors!' : 'Broadcast settings saved in database.', 'success');
      void refreshAdminData();
      return true;
    } catch (err: any) {
      notify(err?.message || 'Unable to reach database server to update broadcast.', 'error');
      return false;
    }
  };

  const updateEmergencyControls = async (controls: Partial<EmergencyControls>): Promise<boolean> => {
    const merged = { ...emergencyControls, ...controls };
    try {
      const res = await fetch('/api/admin/emergency-controls', {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(merged),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.status) {
        notify(result.message || 'Failed to save emergency killswitch in database.', 'error');
        return false;
      }
      if (result.emergencyControls) {
        setEmergencyControls(result.emergencyControls);
      } else {
        setEmergencyControls(merged);
      }
      notify('Emergency platform control saved & enforced in database.', 'success');
      void refreshAdminData();
      return true;
    } catch (err: any) {
      notify(err?.message || 'Unable to reach database server to update emergency controls.', 'error');
      return false;
    }
  };

  const openCheckoutModal = () => {
    setIsCheckoutModalOpen(true);
    trackActivity('CHECKOUT_OPENED', { targetType: 'checkout', details: { itemCount: cart.length } });
  };
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
    _setActiveView('product_detail');
    if (typeof window !== 'undefined') {
      const targetSearch = `?product=${encodeURIComponent(id)}`;
      if (window.location.pathname !== '/' || window.location.search !== targetSearch) {
        window.history.pushState({ view: 'product_detail', productId: id }, '', `/${targetSearch}`);
      }
    }
    const prod = products.find(p => p.id === id);
    if (!prod) {
      fetch(`/api/products/${encodeURIComponent(id)}`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          if (d.status && d.product) {
            setProducts(prev => (prev.some(p => p.id === d.product.id) ? prev : [d.product, ...prev]));
          }
        })
        .catch(() => {});
    }
    trackActivity('PRODUCT_VIEWED', {
      targetType: 'product',
      targetId: id,
      details: prod ? { title: prod.title, price: prod.displayPrice, sellerId: prod.sellerId } : {},
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openProfile = (slugOrId: string) => {
    const clean = String(slugOrId || '').trim();
    if (!clean) return;
    setActiveProfileSlug(clean);
    _setActiveView('profile');
    if (typeof window !== 'undefined') {
      const targetSearch = `?profile=${encodeURIComponent(clean)}`;
      if (window.location.pathname !== '/' || window.location.search !== targetSearch) {
        window.history.pushState({ view: 'profile', profileSlug: clean }, '', `/${targetSearch}`);
      }
    }
    trackActivity('PROFILE_VIEWED', {
      targetType: 'profile',
      targetId: clean,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openAccountSettings = () => {
    if (!currentUser) {
      openAuthModal('login');
      notify('Please sign in to access your Account Settings.', 'info');
      return;
    }
    setActiveView('account_settings');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateMyProfile: AppContextType['updateMyProfile'] = async payload => {
    try {
      const res = await fetch('/api/profiles/me', {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        notify(data.message || 'Could not update profile.', 'error');
        return { status: false, message: data.message };
      }
      await Promise.all([refreshCurrentUser(), fetchMarketplaceData()]);
      if (data.profile?.profileSlug && activeView === 'profile') {
        setActiveProfileSlug(data.profile.profileSlug);
        if (typeof window !== 'undefined') {
          window.history.replaceState({ view: 'profile', profileSlug: data.profile.profileSlug }, '', `/?profile=${encodeURIComponent(data.profile.profileSlug)}`);
        }
      }
      notify(data.message || 'Profile saved!', 'success');
      return { status: true, profile: data.profile };
    } catch {
      notify('Network error saving profile.', 'error');
      return { status: false, message: 'Network error saving profile.' };
    }
  };

  const updateMySettings: AppContextType['updateMySettings'] = async payload => {
    try {
      const res = await fetch('/api/profiles/me/settings', {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        notify(data.message || 'Could not update account settings.', 'error');
        return { status: false, message: data.message };
      }
      setCurrentUser(prev =>
        prev
          ? {
              ...prev,
              notificationPrefs: data.notificationPrefs || prev.notificationPrefs,
              privacySettings: data.privacySettings || prev.privacySettings,
            }
          : prev
      );
      notify(data.message || 'Settings saved.', 'success');
      return {
        status: true,
        message: data.message,
        notificationPrefs: data.notificationPrefs,
        privacySettings: data.privacySettings,
      };
    } catch {
      notify('Network error saving settings.', 'error');
      return { status: false, message: 'Network error saving settings.' };
    }
  };

  const requestEmailChangeOtp = async (newEmail: string, currentPassword: string) => {
    try {
      const res = await fetch('/api/auth/change-email/request-otp', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ newEmail, currentPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        notify(data.message || 'Unable to send confirmation code.', 'error');
        return { status: false, message: data.message };
      }
      notify(data.message || 'Confirmation code sent to your new email.', 'success');
      return { status: true, message: data.message };
    } catch {
      notify('Network error sending confirmation code.', 'error');
      return { status: false, message: 'Network error' };
    }
  };

  const confirmEmailChange = async (newEmail: string, code: string, currentPassword: string) => {
    try {
      const res = await fetch('/api/auth/change-email/confirm', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ newEmail, code, currentPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        notify(data.message || 'Failed to verify email change code.', 'error');
        return { status: false, message: data.message };
      }
      if (data.sessionToken && typeof localStorage !== 'undefined') {
        localStorage.setItem('shopit_session_token', data.sessionToken);
      }
      if (data.email) {
        setCurrentUser(prev => (prev ? { ...prev, email: data.email } : prev));
      }
      await refreshCurrentUser();
      notify(data.message || 'Email address updated!', 'success');
      return { status: true, message: data.message };
    } catch {
      notify('Network error confirming email change.', 'error');
      return { status: false, message: 'Network error' };
    }
  };

  const exportMyData = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/profiles/me/export', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) {
        notify('Unable to download your data export right now.', 'error');
        return false;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shopit-my-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify('Personal data JSON exported.', 'success');
      return true;
    } catch {
      notify('Error downloading personal data.', 'error');
      return false;
    }
  };

  const deleteMyAccount = async (password: string, confirmation: string) => {
    try {
      const res = await fetch('/api/profiles/me', {
        method: 'DELETE',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ password, confirmation }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        notify(data.message || 'Could not delete account.', 'error');
        return { status: false, message: data.message };
      }
      localStorage.removeItem('shopit_session_token');
      setCurrentUser(null);
      setOrders([]);
      setCart([]);
      setWishlist([]);
      setConversations([]);
      setMessages({});
      setActiveProfileSlug(null);
      setActiveView('catalog');
      notify(data.message || 'Your account has been deleted.', 'info');
      return { status: true, message: data.message };
    } catch {
      notify('Network error deleting account.', 'error');
      return { status: false, message: 'Network error deleting account.' };
    }
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

  const openQuickListModal = (productToEdit?: Product) => {
    setEditingProduct(productToEdit || null);
    setIsQuickListModalOpen(true);
  };
  const closeQuickListModal = () => {
    setIsQuickListModalOpen(false);
    setEditingProduct(null);
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
        preferredSignupRole,
        setPreferredSignupRole,
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
        fetchMyListings,
        toggleProductPin,
        toggleProductPause,
        updateMyProfile,
        updateMySettings,
        requestEmailChangeOtp,
        confirmEmailChange,
        exportMyData,
        deleteMyAccount,
        followUser,
        unfollowUser,
        fetchFollowRequests,
        respondToFollowRequest,
        fetchFollowList,
        fetchFollowingFeed,
        fetchSuggestedSellers,
        searchProfiles,
        blockUser,
        unblockUser,
        fetchBlockedUsers,
        muteUser,
        unmuteUser,
        fetchMutedUsers,
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
        isCatalogLoading,
        selectedProductId,
        activeProfileSlug,
        openProduct,
        openProfile,
        openAccountSettings,
        subscribeRestockAlert,
        checkRestockAlert,
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
        refreshConversations,
        markConversationRead,
        loadConversationMessages,
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
        refreshAdminData,
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
        // Phase 4: Campus Safe Logistics & Handshake OTP
        safePickupSpots,
        verifyHandshakeOtp,
        // Quick-List
        isQuickListModalOpen,
        editingProduct,
        openQuickListModal,
        closeQuickListModal,
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
        dbNotifications,
        unreadNotificationsCount,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
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
