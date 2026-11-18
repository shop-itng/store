import {
  Campus,
  Coupon,
  SafePickupSpot,
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
