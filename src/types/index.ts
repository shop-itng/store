export type UserRole = 'buyer' | 'seller' | 'admin';
export type AdminSubRole = 'activity' | 'moderator' | 'accounts' | 'finance' | 'support' | 'emergency' | 'payments' | 'reports';


export type Campus =
  | 'UNILAG (Akoka)'
  | 'UNILORIN'
  | 'UI (Ibadan)'
  | 'OAU (Ile-Ife)'
  | 'Covenant Univ'
  | 'UNN (Nsukka)'
  | 'LASU (Ojo)'
  | 'FUTA (Akure)'
  | 'ABU (Zaria)'
  | 'All Campuses';

export interface NigerianLocation {
  state: string;
  city: string;
  area: string;
}

export interface NotificationPrefs {
  emailOrders: boolean;
  emailMessages: boolean;
  emailFollowers: boolean;
  emailRestock: boolean;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'followers';
  showLastSeen: boolean;
  showFollowersList: boolean;
  showFollowingList: boolean;
  whoCanFollow: 'everyone' | 'approval';
  whoCanMessage: 'everyone' | 'followers' | 'mutual';
}

export interface ProfileBadge {
  id: string;
  label: string;
}

export interface CompletenessItem {
  key: string;
  label: string;
  done: boolean;
  targetField?: string;
}

export interface DeliveryOptionsConfig {
  allowsPickup: boolean;
  allowsLocalDelivery: boolean;
  pickupSpots: string[];
}

export interface PublicProfileData {
  id: string;
  email?: string;
  fullName?: string;
  displayName: string;
  profileSlug: string;
  canonicalSlug?: string;
  redirectedFromSlug?: string;
  tagline?: string;
  role: UserRole;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  bio: string;
  locationState?: string;
  campus: string;
  locationArea: string;
  interests: string[];
  languages?: string[];
  isVerifiedEmail?: boolean;
  isUnder18?: boolean;
  memberSince: string;
  lastSeenAt?: string | null;
  followStatus?: 'none' | 'pending' | 'accepted';
  isMutualFollow?: boolean;
  isMuted?: boolean;
  whoCanFollow?: 'everyone' | 'approval';
  whoCanMessage?: 'everyone' | 'followers' | 'mutual';
  showFollowersList?: boolean;
  showFollowingList?: boolean;
  isRestricted?: boolean;
  pendingFollowRequestsCount?: number;
  followersCount: number;
  followingCount: number;
  completedOrdersCount?: number;
  productsCount?: number;
  totalProductsCount?: number;
  reviewCount?: number;
  averageRating?: number;
  isVerifiedSeller?: boolean;
  badges: ProfileBadge[];
  reviews: Array<ProductReview & { productTitle?: string }>;
  products: Product[];
  wishlistProducts?: Product[];
  completeness?: {
    score: number;
    items: CompletenessItem[];
  };
  notificationPrefs?: NotificationPrefs;
  privacySettings?: PrivacySettings;
  seller?: {
    id: string;
    shopName: string;
    bio: string;
    shopStory?: string;
    craftMaterials?: string;
    processingTime?: string;
    deliveryOptions?: DeliveryOptionsConfig;
    locationState?: string;
    campus: string;
    locationArea: string;
    logoUrl?: string | null;
    bannerUrl?: string | null;
    isVerifiedSeller: boolean;
    verificationStatus: SellerProfile['verificationStatus'];
    vacationMode: boolean;
    under18?: boolean;
  } | null;
}

export interface SellerProfile {
  id: string;
  shopName: string;
  ownerName?: string;
  email?: string;
  bio: string;
  shopStory?: string;
  craftMaterials?: string;
  processingTime?: string;
  deliveryOptions?: DeliveryOptionsConfig;
  locationState?: string;
  campus?: Campus;
  location?: NigerianLocation;
  locationArea?: string; // Only Area shown publicly as required
  logoUrl?: string;
  bannerUrl?: string;
  isVerifiedSeller: boolean;
  verificationStatus: 'not_started' | 'pending' | 'verified' | 'rejected' | 'needs_resubmission' | 'approved'; // 'approved' retained for backward-compat
  verificationRejectionReason?: string;
  verifiedAt?: string;
  verifiedNinLast4?: string;
  verifiedLegalName?: string;
  under18: boolean;
  guardianConsent: boolean;
  guardianName?: string;
  badges: ('verified' | 'fast_responder' | 'sales_10' | 'top_rated')[];
  level: number; // 1 to 5
  rating: number;
  reviewCount: number;
  salesCount: number;
  viewsCount: number;
  vacationMode: boolean;
  joinedDate: string;
  profileSlug?: string;
}

export type AppView =
  | 'catalog'
  | 'product_detail'
  | 'profile'
  | 'account_settings'
  | 'seller_shop'
  | 'seller_dashboard'
  | 'wishlist'
  | 'cart'
  | 'orders'
  | 'admin'
  | 'chat'
  | 'campus_logistics'
  | 'terms'
  | 'privacy'
  | 'refunds'
  | 'prohibited-items'
  | 'seller-guide'
  | 'buyer-protection'
  | 'faq'
  | 'contact'
  | 'reset-password';

export interface User {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  profileSlug?: string;
  tagline?: string;
  avatarUrl?: string;
  coverUrl?: string;
  bio?: string;
  locationState?: string;
  campus?: string;
  interests?: string[];
  languages?: string[];
  notificationPrefs?: NotificationPrefs;
  privacySettings?: PrivacySettings;
  lastSeenAt?: string;
  password?: string;
  role: UserRole;
  subRole?: 'superadmin' | 'moderator' | 'finance' | 'support' | string;
  adminSubRole?: AdminSubRole;
  isVerifiedEmail: boolean;
  mustChangePassword?: boolean;
  isBanned?: boolean;
  sellerProfile?: SellerProfile;
  savedDeliveryArea?: string;
  location?: NigerianLocation;
  locationArea?: string;
  age?: number;
  hasGuardianConsent?: boolean;
  guardianName?: string;
  agreedToTermsDate?: string;
  createdAt?: string;
  deletionRequestedAt?: string;
  scheduledDeletionDate?: string;
}

export type ProductCategory =
  | 'all'
  | 'beads'
  | 'fragrance'
  | 'bags'
  | 'fashion'
  | 'decor'
  | 'crafts';

export interface ProductCustomization {
  allowsCustomName?: boolean;
  availableColors?: string[];
  availableSizes?: string[];
  notesPrompt?: string;
}

export interface DeliverySetting {
  allowsPickup: boolean;
  pickupLocation: string;
  pickupFee: number;
  allowsLocalDelivery: boolean;
  localDeliveryFee: number;
  minOrderForDelivery: number;
}

export interface ProductReview {
  id: string;
  productId: string;
  reviewerId?: string;
  reviewerName: string;
  reviewerAvatarUrl?: string;
  reviewerProfileSlug?: string;
  rating: number;
  comment: string;
  date: string;
  verifiedPurchase: boolean;
}

export interface Product {
  id: string;
  sellerId: string;
  sellerShopName: string;
  sellerDisplayName?: string;
  sellerAvatarUrl?: string;
  sellerProfileSlug?: string;
  sellerCampus?: Campus;
  location?: NigerianLocation;
  locationArea?: string; // Only Area shown publicly as required
  sellerBadges: ('verified' | 'fast_responder' | 'sales_10' | 'top_rated')[];
  title: string;
  description: string;
  category: ProductCategory;
  sellerPrice: number; // What seller enters & earns
  serviceFee: number; // Shop It buyer protection fee
  displayPrice: number; // sellerPrice + serviceFee
  images: string[];
  stock: number;
  rating: number;
  reviewCount: number;
  reviews: ProductReview[];
  customization?: ProductCustomization;
  delivery: DeliverySetting;
  isSoldOut: boolean;
  isNewArrival: boolean;
  isPaused?: boolean;
  isDraft?: boolean;
  isPinned?: boolean;
  pinnedAt?: string;
  createdAt: string;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
  customNameText?: string;
  deliveryMethod: 'pickup' | 'local_delivery';
}

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'disputed';

export interface OrderItem {
  productId: string;
  title: string;
  image: string;
  sellerId: string;
  sellerShopName: string;
  sellerCampus: Campus;
  quantity: number;
  sellerPrice: number;
  serviceFee: number;
  displayPrice: number;
  selectedColor?: string;
  selectedSize?: string;
  customNameText?: string;
  deliveryMethod: 'pickup' | 'local_delivery';
  deliveryFee: number;
}

export interface Order {
  id: string; // e.g. "ORD-84192"
  buyerId: string;
  buyerDisplayName: string;
  buyerAvatarUrl?: string;
  buyerProfileSlug?: string;
  buyerName?: string; // Visible only to admin, NOT seller!
  buyerEmail?: string;
  deliveryArea: string;
  pickupPoint?: string;
  items: OrderItem[];
  itemsSubtotal: number;
  serviceFeeTotal: number;
  deliveryTotal: number;
  discountTotal: number;
  couponCode?: string;
  grandTotal: number;
  status: OrderStatus;
  paymentMethod: 'paystack_card' | 'paystack_transfer' | 'paystack_ussd' | 'paystack_bank' | 'paystack_qr' | 'online';
  paymentReference: string;
  packedPhotoUrl?: string; // Uploaded by seller before dispatch
  createdAt: string;
  packedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  autoReleaseAt: string; // 5-day auto-release timer
  disputeReason?: string;
  adminHold?: boolean;
  hasReview: boolean;
  // Phase 4: Campus Safe Logistics & Handshake Verification
  handshakeOtp?: string; // e.g. "4912"
  handshakeVerified?: boolean;
  runnerId?: string;
  runnerName?: string;
  safeMeetingSpotId?: string;
  safeMeetingSpotName?: string;
}

export interface Coupon {
  code: string;
  discountAmount: number;
  minOrder: number;
  description: string;
}

export type LedgerEntryType =
  | 'sale_pending'      // Credit pending balance when buyer pays via Paystack
  | 'escrow_release'    // Debit pending balance, Credit available balance upon buyer confirmation or 5-day timeout
  | 'withdrawal'        // Debit available balance when seller withdraws via Paystack Transfers API
  | 'fee_deduction'     // Paystack transfer network fee
  | 'refund';           // Debit pending balance when order cancelled/refunded to buyer's card/bank

export interface LedgerEntry {
  id: string; // e.g. "LEDGER-84192"
  walletId?: string; // sellerId
  orderId?: string;
  type: LedgerEntryType;
  amount: number; // in Naira (₦)
  fee: number;
  balanceType?: 'pending' | 'available';
  balanceAfter: number;
  description: string;
  reference: string;
  status?: string;
  paymentEventId?: string;
  payoutBank?: string;
  payoutAccountNumber?: string;
  payoutAccountName?: string;
  transferCode?: string;
  createdAt: string;
}

export type WalletTransactionType = LedgerEntryType;
export type WalletTransaction = LedgerEntry;

export interface PayoutAccount {
  id: string;
  bankCode: string;
  bankName: string; // Opay, PalmPay, Kuda, GTBank, Access Bank, Zenith
  accountNumber: string;
  accountName: string; // Must match verified ID name (or guardian ID for under-18)
  isVerified: boolean;
  coolingPeriodEndsAt: string; // 24-hr cooling period
  isMinorGuardianAccount?: boolean;
  guardianName?: string;
  adminApproved?: boolean;
  adminApprovedBy?: string;
  adminApprovedAt?: string;
  createdAt: string;
}

export interface SellerWallet {
  sellerId: string;
  pendingBalance: number; // Calculated from ledger (paid, waiting for buyer confirmation)
  availableBalance: number; // Calculated from ledger (can be withdrawn)
  totalWithdrawn: number;
  isFrozen: boolean;
  freezeReason?: string;
  isMinorSeller?: boolean;
  dailyWithdrawalCap?: number;
  guardianName?: string;
  payoutAccounts: PayoutAccount[];
  activePayoutAccountId?: string;
  ledger: LedgerEntry[];
  transactions: LedgerEntry[];
}

export interface PaymentWebhookEvent {
  id: string; // evt_...
  event: 'charge.completed' | 'transfer.completed' | 'refund.completed';
  signature: string; // verif-hash verified against FLW_WEBHOOK_SECRET_HASH
  verified: boolean;
  processedAt: string;
  reference: string;
  amount: number;
  customerEmail: string;
  orderId: string;
  channel: 'card' | 'bank_transfer' | 'ussd' | 'opay';
}


export interface FeeSettings {
  tierMode: 'tiered' | 'flat';
  flatFee: number;
  tierLowFee: number; // Under ₦2,000 -> ₦200
  tierMidFee: number; // ₦2,000 - ₦10,000 -> ₦500
  tierHighPercentage: number; // Above ₦10,000 -> 5%
  firstMonthPromoFree: boolean;
  minWithdrawal?: number;
  withdrawalFeeRule: {
    freeThreshold: number; // e.g. Free above ₦5,000, ₦50 below
    flatFeeBelowThreshold: number;
  };
}

// ==========================================
// PHASE 3: LOCKED CHAT & PRIVACY ANTI-BYPASS
// ==========================================

export interface ChatAttachment {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'image' | 'document';
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderRole: 'buyer' | 'seller' | 'system' | 'admin';
  senderDisplayName: string;
  senderAvatarUrl?: string;
  senderProfileSlug?: string;
  senderName?: string;
  senderId: string;
  content: string; // [blocked] if bypass attempt
  originalContent?: string;
  attachment?: ChatAttachment;
  readByOther?: boolean;
  isBlockedBypass?: boolean;
  blockedTokens?: string[];
  timestamp: string;
  createdAt?: string;
  isQuickReply?: boolean;
  presetOffer?: {
    price: number;
    quantity: number;
    title?: string;
  };
  customOrderDetails?: {
    color?: string;
    size?: string;
    customName?: string;
    notes?: string;
  };
}

export interface Conversation {
  id: string;
  orderId?: string;
  productId?: string;
  productTitle?: string;
  productImage?: string;
  buyerId: string;
  buyerDisplayName: string;
  buyerAvatarUrl?: string;
  buyerProfileSlug?: string;
  sellerId: string;
  sellerShopName: string;
  sellerDisplayName?: string;
  sellerAvatarUrl?: string;
  sellerProfileSlug?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadBuyer: number;
  unreadSeller: number;
  isChatLocked?: boolean;
  isBlocked?: boolean;
  bypassViolationsCount: number;
}

export interface FollowRequestItem {
  id: string;
  followerId: string;
  displayName: string;
  profileSlug: string;
  avatarUrl?: string | null;
  campus?: string;
  createdAt: string;
}

export interface FollowListUser {
  id: string;
  displayName: string;
  profileSlug: string;
  avatarUrl?: string | null;
  campus?: string;
  role?: string;
  shopName?: string;
  followedAt?: string;
  viewerFollowStatus?: 'none' | 'pending' | 'accepted';
  isMutual?: boolean;
}

export interface BlockedAccountItem {
  id: string;
  blockedUserId: string;
  displayName: string;
  profileSlug: string;
  avatarUrl?: string | null;
  reason?: string;
  createdAt: string;
}

export interface MutedAccountItem {
  id: string;
  mutedUserId: string;
  displayName: string;
  profileSlug: string;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface SuggestedSellerItem {
  id: string;
  displayName: string;
  profileSlug: string;
  shopName: string;
  avatarUrl?: string | null;
  campus?: string;
  bio?: string;
  isVerifiedSeller: boolean;
  productCount: number;
  followersCount: number;
  rating: number;
  isSameCampus?: boolean;
}

export interface ProfileSearchResult {
  id: string;
  displayName: string;
  profileSlug: string;
  role: string;
  shopName?: string;
  avatarUrl?: string | null;
  campus?: string;
  isVerifiedSeller: boolean;
  followersCount: number;
  followStatus: 'none' | 'pending' | 'accepted';
}

export interface DbNotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

// ==========================================
// PHASE 3: ADMIN & DISPUTE RESOLUTION TYPES
// ==========================================

export interface DisputeTicket {
  id: string;
  orderId: string;
  buyerDisplayName: string;
  buyerAvatarUrl?: string;
  buyerProfileSlug?: string;
  buyerName?: string; // Visible only to Admin
  sellerId: string;
  sellerShopName: string;
  reason: string;
  description: string;
  evidencePhotoUrl?: string;
  sellerPackedPhotoUrl?: string;
  amountHeldInEscrow: number;
  status: 'open' | 'resolved_refunded' | 'resolved_released' | 'resolved_partial';
  refundAmount?: number;
  resolutionNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}

export type VerificationStatus =
  | 'not_started'
  | 'pending'
  | 'verified'
  | 'approved'
  | 'rejected'
  | 'needs_resubmission';

export type IdDocumentType =
  | 'nin_slip'
  | 'nin_card'
  | 'drivers_license'
  | 'voters_card'
  | 'international_passport';

export interface SellerVerificationRequest {
  id: string;
  sellerId: string;
  shopName: string;
  ownerName: string; // Legal full name
  dateOfBirth?: string;
  campus: Campus;
  idType: IdDocumentType;
  idNumber: string; // Masked on client (e.g. "***-***-8901")
  fullNinLast4: string; // Last 4 digits only
  idCardPhotoUrl: string; // Uploaded ID document photo
  selfiePhotoUrl?: string; // Captured live in app (no gallery upload)
  livenessVerified?: boolean;
  livenessScore?: number; // 0-100
  under18: boolean;
  guardianName?: string;
  guardianNinLast4?: string;
  guardianIdCardPhotoUrl?: string;
  guardianConsentSigned?: boolean;
  guardianConsentLetterUrl?: string;
  ndpaConsentSigned: boolean;
  ndpaConsentTimestamp: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  status: VerificationStatus;
  rejectionReason?: string;
  adminNotes?: string;
  attemptsCount: number;
  lockedUntil?: string;
  apiCheckResult?: {
    provider: string;
    status: 'match' | 'mismatch' | 'manual_review_required';
    nameMatchScore: number;
    dobMatch: boolean;
    nimcRegisteredName?: string;
    verifiedAt: string;
  };
  deviceFingerprint?: string;
  isFlaggedDuplicate?: boolean;
  notes?: string;
}

export interface AntiBypassFlag {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: 'buyer' | 'seller';
  senderDisplayName: string;
  offendingText: string;
  maskedText: string;
  detectedPatterns: string[];
  timestamp: string;
  status: 'warning_issued' | 'chat_locked' | 'account_frozen' | 'reviewed';
}

// ==========================================
// PHASE 4: CAMPUS LOGISTICS, CAMPUS PICKUP SPOTS & HANDSHAKE OTP
// ==========================================

export interface SafePickupSpot {
  id: string;
  campus: Campus;
  name: string;
  landmark: string;
  operatingHours: string;
  securityLevel: 'manned_porter' | 'campus_security_post' | 'cctv_monitored' | 'open_quad';
  securityBadgeText: string;
  activeOrdersCount: number;
  directionsTip: string;
  contactPorterTitle?: string;
}


// ==========================================
// MODERATOR EMERGENCY BROADCAST & AUDIT LOGS
// ==========================================

export interface BroadcastAnnouncement {
  id: string;
  isActive: boolean;
  title: string;
  message: string;
  tone: 'info' | 'warning' | 'emergency' | 'promo';
  createdAt: string;
  author: string;
}

export interface EmergencyControls {
  maintenanceMode: boolean;
  pauseNewOrders: boolean;
  pauseSellerSignups: boolean;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  targetId?: string;
  targetType?: string;
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  details: string;
  rawDetails?: Record<string, any>;
  ipAddress?: string;
  createdAt?: string;
  timestamp: string;
  moderatorName: string;
}



