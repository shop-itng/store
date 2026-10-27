export type UserRole = 'buyer' | 'seller' | 'admin';
export type AdminSubRole = 'moderator' | 'accounts' | 'finance' | 'support' | 'emergency';

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

export interface SellerProfile {
  id: string;
  shopName: string;
  ownerName?: string;
  bio: string;
  campus?: Campus;
  location?: NigerianLocation;
  locationArea?: string; // Only Area shown publicly as required
  logoUrl?: string;
  bannerUrl?: string;
  socialLinks?: {
    instagram?: string;
    whatsappPreview?: string;
    tiktok?: string;
  };
  isVerifiedSeller: boolean;
  verificationStatus: 'pending_approval' | 'approved' | 'rejected';
  under18: boolean;
  guardianConsent: boolean;
  guardianName?: string;
  guardianPhone?: string;
  badges: ('verified' | 'fast_responder' | 'sales_10' | 'top_rated')[];
  level: number; // 1 to 5
  rating: number;
  reviewCount: number;
  salesCount: number;
  viewsCount: number;
  vacationMode: boolean;
  joinedDate: string;
}

export interface User {
  id: string;
  email: string;
  phone: string;
  name: string;
  password?: string;
  role: UserRole;
  adminSubRole?: AdminSubRole;
  isVerifiedEmail: boolean;
  isVerifiedPhone: boolean;
  isBanned?: boolean;
  avatarUrl?: string;
  sellerProfile?: SellerProfile;
  savedDeliveryArea?: string;
  location?: NigerianLocation;
  locationArea?: string;
  createdAt?: string;
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
  buyerMaskedId: string; // e.g. "Buyer #7821" for anti-bypass privacy
  rating: number;
  comment: string;
  date: string;
  verifiedPurchase: boolean;
}

export interface Product {
  id: string;
  sellerId: string;
  sellerShopName: string;
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
  | 'paid'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
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
  buyerMaskedId: string; // e.g. "Buyer #7821" for anti-bypass privacy
  buyerName?: string; // Visible only to admin, NOT seller!
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
  paymentMethod: 'paystack_card' | 'paystack_transfer' | 'flutterwave_card';
  paymentReference: string;
  packedPhotoUrl?: string; // Uploaded by seller before dispatch
  createdAt: string;
  packedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  autoReleaseAt: string; // 5-day auto-release timer
  disputeReason?: string;
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
  paystackEventId?: string;
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
  accountName: string; // Must match verified ID name
  isVerified: boolean;
  coolingPeriodEndsAt: string; // 24-hr cooling period
  createdAt: string;
}

export interface SellerWallet {
  sellerId: string;
  pendingBalance: number; // Calculated from ledger (paid, waiting for buyer confirmation)
  availableBalance: number; // Calculated from ledger (can be withdrawn)
  totalWithdrawn: number;
  isFrozen: boolean;
  freezeReason?: string;
  payoutAccounts: PayoutAccount[];
  activePayoutAccountId?: string;
  ledger: LedgerEntry[];
  transactions: LedgerEntry[];
}

export interface PaystackWebhookEvent {
  id: string; // evt_...
  event: 'charge.success' | 'transfer.success' | 'transfer.failed' | 'refund.processed';
  signature: string; // HMAC SHA-512 signature verified with sk_test_...
  verified: boolean;
  processedAt: string;
  reference: string;
  amount: number;
  customerEmail: string;
  orderId: string;
  channel: 'card' | 'bank_transfer' | 'ussd';
}

export interface SecuritySession {
  id: string;
  device: string;
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface SecurityProfile {
  twoFactorEnabled: boolean;
  loginAlertsEnabled: boolean;
  failedLoginAttempts: number;
  isAccountLocked: boolean;
  sessions: SecuritySession[];
}

export interface FeeSettings {
  tierMode: 'tiered' | 'flat';
  flatFee: number;
  tierLowFee: number; // Under ₦2,000 -> ₦200
  tierMidFee: number; // ₦2,000 - ₦10,000 -> ₦500
  tierHighPercentage: number; // Above ₦10,000 -> 5%
  firstMonthPromoFree: boolean;
  withdrawalFeeRule: {
    freeThreshold: number; // e.g. Free above ₦5,000, ₦50 below
    flatFeeBelowThreshold: number;
  };
}

// ==========================================
// PHASE 3: LOCKED CHAT & PRIVACY ANTI-BYPASS
// ==========================================

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderRole: 'buyer' | 'seller' | 'system' | 'admin';
  senderMaskedName: string; // e.g. "Buyer #7821" or "Amaka Beads & Charms"
  senderId: string;
  content: string; // [blocked] if bypass attempt
  originalContent?: string;
  isBlockedBypass?: boolean;
  blockedTokens?: string[];
  timestamp: string;
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
  buyerMaskedId: string;
  sellerId: string;
  sellerShopName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadBuyer: number;
  unreadSeller: number;
  isChatLocked?: boolean;
  bypassViolationsCount: number;
}

// ==========================================
// PHASE 3: ADMIN & DISPUTE RESOLUTION TYPES
// ==========================================

export interface DisputeTicket {
  id: string;
  orderId: string;
  buyerMaskedId: string;
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

export interface SellerVerificationRequest {
  id: string;
  sellerId: string;
  shopName: string;
  ownerName: string;
  campus: Campus;
  idType: 'student_id' | 'nin' | 'voters_card';
  idNumber: string;
  idCardPhotoUrl: string;
  under18: boolean;
  guardianName?: string;
  guardianPhone?: string;
  guardianConsentLetterUrl?: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

export interface AntiBypassFlag {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: 'buyer' | 'seller';
  senderMaskedName: string;
  offendingText: string;
  maskedText: string;
  detectedPatterns: string[];
  timestamp: string;
  status: 'warning_issued' | 'chat_locked' | 'account_frozen' | 'reviewed';
}

// ==========================================
// PHASE 4: CAMPUS LOGISTICS, SAFE SPOTS & HANDSHAKE OTP
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

export interface CampusRunner {
  id: string;
  name: string;
  campus: Campus;
  studentLevel: string;
  rating: number;
  completedTrips: number;
  isAvailable: boolean;
  avatarUrl: string;
  currentZone: string;
  feePerTrip: number;
  phoneMasked: string;
}

export interface RunnerTrip {
  id: string;
  orderId: string;
  runnerId: string;
  runnerName: string;
  pickupSpot: string;
  dropoffSpot: string;
  status: 'assigned' | 'collected_from_seller' | 'in_transit' | 'arrived_at_spot' | 'handed_over';
  etaMinutes: number;
  otpCode: string;
  lastCheckpointTime: string;
}

// ==========================================
// PHASE 5: ARTISAN COMMISSIONS, DROPS & SOCIAL COMMERCE
// ==========================================

export type CraftCommissionType =
  | 'waist_bead'
  | 'fragrance_blend'
  | 'crochet_wear'
  | 'leather_craft'
  | 'custom_jewelry';

export interface CustomCommissionRequest {
  id: string;
  artisanId: string;
  artisanShopName: string;
  buyerMaskedId: string;
  craftType: CraftCommissionType;
  title: string;
  sizingDetails: string;
  colorPalette: string[];
  inscriptions?: string;
  specialInstructions: string;
  estimatedPrice: number;
  depositAmount: number; // 50% escrow deposit
  status:
    | 'pending_quote'
    | 'artisan_accepted'
    | 'deposit_locked'
    | 'crafting_in_progress'
    | 'photo_proof_ready'
    | 'completed';
  artisanWorkInProgressPhoto?: string;
  createdAt: string;
}

export interface CampusFlashDrop {
  id: string;
  artisanId: string;
  artisanShopName: string;
  artisanAvatar: string;
  campus: Campus;
  title: string;
  tagline: string;
  batchSize: number;
  claimedCount: number;
  price: number;
  originalPrice: number;
  dropTime: string;
  isLive: boolean;
  imageUrl: string;
  perks: string[];
}

export interface CampusStylePost {
  id: string;
  buyerMaskedId: string;
  campus: Campus;
  hallOrLocation: string;
  photoUrl: string;
  caption: string;
  productTitle: string;
  artisanShopName: string;
  artisanId: string;
  likesCount: number;
  userHasLiked?: boolean;
  timeAgo: string;
  tags: string[];
}

export interface ArtisanTierInfo {
  level: number;
  title: string;
  salesRequired: number;
  escrowReleaseTimeHours: number;
  dailyWithdrawalLimit: number;
  feeDiscountPercent: number;
  badgeName: string;
  perks: string[];
}

// ==========================================
// PHASE 6: CAMPUS AMBASSADOR & HALL LEADERBOARD TYPES
// ==========================================

export interface CampusAmbassador {
  id: string;
  name: string;
  campus: Campus;
  hallOfResidence: string;
  referralCode: string;
  avatarUrl: string;
  totalReferrals: number;
  totalEarnedNaira: number;
  activeMakersReferred: number;
  rank: number;
}

export interface HallLeaderboardEntry {
  hallName: string;
  campus: Campus;
  activeArtisansCount: number;
  totalCraftsListed: number;
  totalVolumeNaira: number;
  rankBadge: string;
}

export interface ReferralReward {
  id: string;
  ambassadorId: string;
  referredMakerName: string;
  rewardAmount: number;
  status: 'credited' | 'pending_first_sale';
  date: string;
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
  details: string;
  timestamp: string;
  moderatorName: string;
}



