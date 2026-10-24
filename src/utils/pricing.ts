import { FeeSettings } from '../types';

export const DEFAULT_FEE_SETTINGS: FeeSettings = {
  tierMode: 'tiered',
  flatFee: 500,
  tierLowFee: 200, // Under ₦2,000
  tierMidFee: 500, // ₦2,000 to ₦10,000
  tierHighPercentage: 0.05, // 5% above ₦10,000
  firstMonthPromoFree: false,
  withdrawalFeeRule: {
    freeThreshold: 5000,
    flatFeeBelowThreshold: 50,
  },
};

/**
 * Calculates Shop It service fee based on seller's base price.
 * Display price = seller price + Shop It service fee.
 */
export function calculateServiceFee(sellerPrice: number, settings: FeeSettings = DEFAULT_FEE_SETTINGS): number {
  if (settings.firstMonthPromoFree) {
    return 0;
  }

  if (settings.tierMode === 'flat') {
    return settings.flatFee;
  }

  // Tiered calculation
  if (sellerPrice < 2000) {
    return settings.tierLowFee; // ₦200
  } else if (sellerPrice <= 10000) {
    return settings.tierMidFee; // ₦500
  } else {
    // 5% rounded to nearest ₦50
    const rawFee = sellerPrice * settings.tierHighPercentage;
    return Math.round(rawFee / 50) * 50;
  }
}

export interface PricingBreakdown {
  sellerPrice: number;
  serviceFee: number;
  displayPrice: number;
  feePercentageDisplay: string;
}

export function getPricingBreakdown(sellerPrice: number, settings: FeeSettings = DEFAULT_FEE_SETTINGS): PricingBreakdown {
  const safeSellerPrice = Math.max(0, Number(sellerPrice) || 0);
  const serviceFee = calculateServiceFee(safeSellerPrice, settings);
  const displayPrice = safeSellerPrice + serviceFee;
  const percentage = safeSellerPrice > 0 ? ((serviceFee / safeSellerPrice) * 100).toFixed(1) : '0';

  return {
    sellerPrice: safeSellerPrice,
    serviceFee,
    displayPrice,
    feePercentageDisplay: `${percentage}%`,
  };
}

/**
 * Formats a number as Nigerian Naira (₦) with standard thousand separators.
 */
export function formatNaira(amount: number): string {
  const safeAmount = Math.round(Number(amount) || 0);
  return `₦${safeAmount.toLocaleString('en-NG')}`;
}
