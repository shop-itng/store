export const PROFILE_INTERESTS = [
  'Waist Beads & Jewelry',
  'Crochet & Yarn',
  'Perfume Oils & Scents',
  'Thrift & Fashion',
  'Room Decor & Candles',
  'Art & Illustration',
  'Phone Cases & Tech Crafts',
  'Hair Accessories',
  'Leather & Bags',
  'Stationery & Gifts',
] as const;

export const ALLOWED_LANGUAGES = [
  'English',
  'Nigerian Pidgin',
  'Yoruba',
  'Igbo',
  'Hausa',
  'Ibibio',
  'Efik',
  'Tiv',
  'Fulfulde',
  'French',
] as const;

export const PROCESSING_TIME_OPTIONS = [
  'Same day',
  '1–2 days',
  '1–3 days',
  '3–5 days',
  '1–2 weeks',
  'Made to order (custom timeline)',
] as const;

export const DEFAULT_AVATAR_PRESETS = [
  { id: 'avatar-1', label: 'Warm Sunset', url: '/avatars/avatar-1.svg' },
  { id: 'avatar-2', label: 'Fresh Leaf', url: '/avatars/avatar-2.svg' },
  { id: 'avatar-3', label: 'Midnight Star', url: '/avatars/avatar-3.svg' },
  { id: 'avatar-4', label: 'Amber Wave', url: '/avatars/avatar-4.svg' },
  { id: 'avatar-5', label: 'Emerald Shield', url: '/avatars/avatar-5.svg' },
  { id: 'avatar-6', label: 'Terracotta Bead', url: '/avatars/avatar-6.svg' },
] as const;

export const MAX_TAGLINE_LENGTH = 80;
export const MAX_BIO_LENGTH = 300;
export const MAX_SHOP_STORY_LENGTH = 600;
export const MAX_CRAFT_MATERIALS_LENGTH = 300;
