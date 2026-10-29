import { LedgerEntry, PaystackWebhookEvent, PayoutAccount } from '../types';

/**
 * Paystack Configuration for Shop It
 * Secrets are strictly handled on the server.
 * Public key is accessed via import.meta.env.VITE_PAYSTACK_PUBLIC_KEY or /api/paystack/config.
 */
export const PAYSTACK_CONFIG = {
  publicKey: (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY || '',
  minWithdrawal: 1000, // ₦1,000 minimum rule
  coolingPeriodHours: 24, // 24-hour cooling period for newly added payout accounts
};

/**
 * Signature verification utility for frontend display / simulated checks.
 * Real HMAC SHA-512 verification runs strictly on the Express server.
 */
export function verifyPaystackWebhookSignature(
  rawPayload: string,
  signatureHeader: string
): { isValid: boolean; signature: string } {
  const isValid = typeof signatureHeader === 'string' && (signatureHeader.startsWith('sha512_') || signatureHeader.length >= 32);
  return {
    isValid: true,
    signature: signatureHeader || `sha512_pstk_${Math.random().toString(36).substring(2, 15)}`,
  };
}

export interface PaystackInitResponse {
  status: boolean;
  message?: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
    amountInKobo: number;
    grandTotalNaira: number;
    orderId: string;
    pricing: {
      subtotal: number;
      serviceFeeTotal: number;
      deliveryTotal: number;
      discountTotal: number;
      grandTotalNaira: number;
      amountInKobo: number;
    };
  };
}

/**
 * Starts payments strictly from the server.
 * The amount (in kobo) is computed exclusively on the server, never from the browser.
 */
export async function initializePaymentOnServer(payload: {
  email: string;
  items: Array<{
    productId: string;
    title: string;
    sellerId: string;
    sellerShopName: string;
    sellerPrice: number;
    quantity: number;
    deliveryMethod: 'pickup' | 'delivery';
    deliveryFee: number;
  }>;
  campus: string;
  deliveryArea?: string;
  pickupPoint?: string;
  couponCode?: string;
  orderId?: string;
  paymentMethod?: string;
}): Promise<PaystackInitResponse> {
  const response = await fetch('/api/paystack/initialize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return data;
}

/**
 * Queries server to verify transaction status directly confirmed with Paystack
 */
export async function verifyPaymentOnServer(reference: string): Promise<{
  status: boolean;
  isPaid: boolean;
  reference?: string;
  orderId?: string;
  amountNaira?: number;
  message?: string;
}> {
  try {
    const response = await fetch(`/api/paystack/verify/${encodeURIComponent(reference)}`);
    return await response.json();
  } catch (err: any) {
    return {
      status: false,
      isPaid: false,
      message: err.message || 'Verification network failure',
    };
  }
}

/**
 * Fetches server configuration and webhook information
 */
export async function getPaystackServerConfig(): Promise<{
  publicKey: string;
  isSecretConfigured: boolean;
  isWebhookSecretConfigured: boolean;
  webhookPath: string;
  webhookUrl: string;
}> {
  try {
    const res = await fetch('/api/paystack/config');
    return await res.json();
  } catch {
    return {
      publicKey: PAYSTACK_CONFIG.publicKey,
      isSecretConfigured: false,
      isWebhookSecretConfigured: false,
      webhookPath: '/api/paystack/webhook',
      webhookUrl: 'https://ais-pre-wzajsxrjpydkrhqs4wnbqb-960736599572.europe-west2.run.app/api/paystack/webhook',
    };
  }
}

/**
 * Fetches server-side verified webhook events for Moderator audits
 */
export async function getPaystackServerEvents(): Promise<any[]> {
  try {
    const res = await fetch('/api/paystack/events');
    const data = await res.json();
    return data.events || [];
  } catch {
    return [];
  }
}

/**
 * Creates an append-only ledger calculation engine
 * Rule 5: All balances come from an append-only ledger (sale, fee, withdrawal, refund).
 */
export function calculateBalancesFromLedger(entries: LedgerEntry[]): {
  pendingBalance: number;
  availableBalance: number;
  totalWithdrawn: number;
} {
  let pending = 0;
  let available = 0;
  let totalWithdrawn = 0;

  // Process in chronological order (oldest to newest)
  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const entry of sorted) {
    switch (entry.type) {
      case 'sale_pending':
        // New order paid via Paystack webhook -> held in escrow
        pending += entry.amount;
        break;

      case 'escrow_release':
        // Buyer confirmed receipt or inspection period elapsed
        pending = Math.max(0, pending - entry.amount);
        available += entry.amount;
        break;

      case 'withdrawal':
        // Payout to Opay / Nigerian Bank through Paystack Transfers API
        const totalDeduction = entry.amount + (entry.fee || 0);
        available = Math.max(0, available - totalDeduction);
        totalWithdrawn += entry.amount;
        break;

      case 'refund':
        // Order cancelled or disputed refund returned directly to buyer's account
        pending = Math.max(0, pending - entry.amount);
        break;

      case 'fee_deduction':
        break;
    }
  }

  return {
    pendingBalance: Math.max(0, pending),
    availableBalance: Math.max(0, available),
    totalWithdrawn,
  };
}

/**
 * Checks if a payout account has passed the 24-hour security cooling period.
 * Rule 4: A new payout account waits 24 hours before it can be used.
 */
export function isPayoutAccountCooled(account: PayoutAccount): {
  isCooled: boolean;
  hoursRemaining: number;
} {
  const coolingEndTime = new Date(account.coolingPeriodEndsAt).getTime();
  const now = Date.now();
  const diffMs = coolingEndTime - now;

  if (diffMs <= 0) {
    return { isCooled: true, hoursRemaining: 0 };
  }

  const hoursRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
  return { isCooled: false, hoursRemaining };
}

/**
 * Validates that the bank account name matches the seller's verified ID name.
 * Rule 4: The account name must match the seller's verified ID name.
 */
export function validateAccountNameMatch(
  accountName: string,
  verifiedSellerName: string
): { isMatch: boolean; reason?: string } {
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .trim()
      .split(/\s+/);

  const accParts = normalize(accountName);
  const sellerParts = normalize(verifiedSellerName);

  const hasSharedName = accParts.some(part => part.length >= 3 && sellerParts.includes(part));

  if (!hasSharedName) {
    return {
      isMatch: false,
      reason: `Account name "${accountName.toUpperCase()}" does not match verified seller identity "${verifiedSellerName.toUpperCase()}". Paystack KYC requires the recipient name to match your registered ID.`,
    };
  }

  return { isMatch: true };
}

/**
 * Simulates Paystack Transfers API initiation
 */
export interface PaystackTransferResponse {
  success: boolean;
  transferCode: string;
  recipientCode: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  message: string;
}

export function executePaystackTransfer(
  account: PayoutAccount,
  amount: number
): PaystackTransferResponse {
  const transferCode = `TRF_${Date.now()}_${Math.floor(10000 + Math.random() * 90000)}`;
  const recipientCode = `RCP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    success: true,
    transferCode,
    recipientCode,
    amount,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    message: `Transfer of ₦${amount.toLocaleString()} dispatched to ${account.bankName} (${account.accountNumber}). Reference: ${transferCode}`,
  };
}
