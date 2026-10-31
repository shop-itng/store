import {
  Product,
  SellerProfile,
  User,
  Campus,
  Order,
  Coupon,
  SellerWallet,
  SecurityProfile,
  ChatMessage,
  Conversation,
  DisputeTicket,
  SellerVerificationRequest,
  AntiBypassFlag,
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

export const CAMPUSES: Campus[] = [
  'All Campuses',
  'UNILAG (Akoka)',
  'UNILORIN',
  'UI (Ibadan)',
  'OAU (Ile-Ife)',
  'Covenant Univ',
  'UNN (Nsukka)',
  'LASU (Ojo)',
  'FUTA (Akure)',
  'ABU (Zaria)',
];

// Starts 100% clean and empty - real sellers will register and list their own crafts
export const INITIAL_SELLERS: SellerProfile[] = [];

// Starts 100% clean and empty - no fake products or stock photos
export const INITIAL_PRODUCTS: Product[] = [];

// Zero preset craft templates - sellers must take and upload their own product photos
export const PRESET_CRAFT_TEMPLATES: any[] = [];

// Designated Admin Moderator account for Adeyinka Joseph
export const ADMIN_CREDENTIALS = {
  name: 'Adeyinka Joseph',
  email: 'joeadeyinka12@gmail.com',
  password: 'shopitislit',
  role: 'admin' as const,
  adminSubRole: 'moderator' as const,
};

export const ROOT_MODERATOR_USER: User = {
  id: 'admin_adeyinka_joseph',
  name: 'Adeyinka Joseph',
  email: 'joeadeyinka12@gmail.com',
  role: 'admin',
  adminSubRole: 'moderator',
  isVerifiedEmail: true,
  password: 'shopitislit',
  savedDeliveryArea: 'Yaba',
};

export const VALID_COUPONS: Coupon[] = [
  {
    code: 'TEEDS',
    discountAmount: 500,
    minOrder: 2500,
    description: '₦500 welcome discount from TEEDS',
  },
  {
    code: 'FIRSTORDER',
    discountAmount: 300,
    minOrder: 1500,
    description: '₦300 discount on your first youth order',
  },
];

// Starts 100% clean and empty - fills only with real user transactions
export const INITIAL_ORDERS: Order[] = [];
export const INITIAL_CONVERSATIONS: Conversation[] = [];
export const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {};
export const INITIAL_VERIFICATION_REQUESTS: SellerVerificationRequest[] = [];
export const INITIAL_DISPUTES: DisputeTicket[] = [];
export const INITIAL_ANTI_BYPASS_FLAGS: AntiBypassFlag[] = [];

// Safe pickup meeting spots across major youth hubs
export const INITIAL_SAFE_SPOTS: SafePickupSpot[] = [
  {
    id: 'spot_yaba_tech',
    campus: 'UNILAG (Akoka)',
    name: 'Yaba Main Security Gate Hub',
    landmark: 'Beside Visitor Lounge / Herbert Macaulay Way',
    operatingHours: '8:00 AM - 6:30 PM (Daily)',
    securityLevel: 'campus_security_post',
    securityBadgeText: 'Security Post Monitored',
    activeOrdersCount: 0,
    directionsTip: 'Meet inside sheltered reception area next to gate officer.',
    contactPorterTitle: 'Gate Security Desk',
  },
  {
    id: 'spot_unilag_sub',
    campus: 'UNILAG (Akoka)',
    name: 'Akoka Safe Youth Spot',
    landmark: 'Student Quadrangle / Quad Hub',
    operatingHours: '8:00 AM - 7:00 PM',
    securityLevel: 'manned_porter',
    securityBadgeText: 'Porter Desk Hub',
    activeOrdersCount: 0,
    directionsTip: 'Ground floor information foyer near the cafeteria.',
    contactPorterTitle: 'Porter Desk',
  },
  {
    id: 'spot_ikeja_hub',
    campus: 'LASU (Ojo)',
    name: 'Ikeja Youth Safe Hub',
    landmark: 'Maryland / Mobolaji Bank Anthony Way',
    operatingHours: '9:00 AM - 6:00 PM',
    securityLevel: 'cctv_monitored',
    securityBadgeText: 'CCTV Monitored Hub',
    activeOrdersCount: 0,
    directionsTip: 'Wait inside reception area with security guard at front desk.',
  },
];

export const INITIAL_CAMPUS_RUNNERS: CampusRunner[] = [];
export const INITIAL_RUNNER_TRIPS: RunnerTrip[] = [];
export const INITIAL_COMMISSIONS: CustomCommissionRequest[] = [];
export const INITIAL_CAMPUS_DROPS: CampusFlashDrop[] = [];
export const INITIAL_STYLE_POSTS: CampusStylePost[] = [];

// Artisan trust tier matrix (Level 1 to 5)
export const ARTISAN_TIERS: ArtisanTierInfo[] = [
  {
    level: 1,
    title: 'New Youth Maker',
    salesRequired: 0,
    escrowReleaseTimeHours: 48,
    dailyWithdrawalLimit: 15000,
    feeDiscountPercent: 0,
    badgeName: '🌱 New Seller',
    perks: ['Standard Escrow Protection', 'Free Safe Spot Handoff', 'Chat Support'],
  },
  {
    level: 2,
    title: 'Rising Artisan',
    salesRequired: 5,
    escrowReleaseTimeHours: 24,
    dailyWithdrawalLimit: 40000,
    feeDiscountPercent: 10,
    badgeName: '⭐ Rising Seller',
    perks: ['24h Escrow Release', '10% Fee Discount', 'Featured in Local Area'],
  },
  {
    level: 3,
    title: 'Trusted Artisan',
    salesRequired: 20,
    escrowReleaseTimeHours: 12,
    dailyWithdrawalLimit: 80000,
    feeDiscountPercent: 20,
    badgeName: '🔥 Trusted Maker',
    perks: ['12h Fast Release', '20% Fee Discount', 'Custom Commission Studio'],
  },
  {
    level: 4,
    title: 'Master Creator',
    salesRequired: 50,
    escrowReleaseTimeHours: 6,
    dailyWithdrawalLimit: 150000,
    feeDiscountPercent: 30,
    badgeName: '👑 Master Maker',
    perks: ['6h Priority Payouts', '30% Fee Discount', 'Flash Drops & Pre-Orders'],
  },
  {
    level: 5,
    title: 'Top Creator Legend',
    salesRequired: 100,
    escrowReleaseTimeHours: 1,
    dailyWithdrawalLimit: 300000,
    feeDiscountPercent: 50,
    badgeName: '💎 Top Legend',
    perks: ['Instant Escrow Release', '50% Fee Discount', 'Dedicated Account Manager'],
  },
];

export const INITIAL_AMBASSADORS: CampusAmbassador[] = [];
export const INITIAL_HALL_LEADERBOARD: HallLeaderboardEntry[] = [];
export const INITIAL_REFERRAL_REWARDS: ReferralReward[] = [];

export const INITIAL_WALLETS: Record<string, SellerWallet> = {};

export const INITIAL_SECURITY_PROFILES: Record<string, SecurityProfile> = {};

export const NIGERIAN_BANKS = [
  { code: '999992', name: 'OPay Digital Services', icon: '🟢' },
  { code: '999991', name: 'PalmPay Limited', icon: '🟣' },
  { code: '058', name: 'Guaranty Trust Bank (GTBank)', icon: '🟠' },
  { code: '057', name: 'Zenith Bank', icon: '🔴' },
  { code: '044', name: 'Access Bank', icon: '🟠' },
  { code: '011', name: 'First Bank of Nigeria', icon: '🔵' },
  { code: '033', name: 'United Bank for Africa (UBA)', icon: '🔴' },
  { code: '50211', name: 'Kuda Microfinance Bank', icon: '🟣' },
  { code: '50515', name: 'Moniepoint Microfinance Bank', icon: '🔵' },
  { code: '035', name: 'Wema Bank / ALAT', icon: '🟣' },
  { code: '214', name: 'First City Monument Bank (FCMB)', icon: '🟡' },
  { code: '070', name: 'Fidelity Bank', icon: '🔵' },
  { code: '232', name: 'Sterling Bank', icon: '🔴' },
  { code: '221', name: 'Stanbic IBTC Bank', icon: '🔵' },
];
