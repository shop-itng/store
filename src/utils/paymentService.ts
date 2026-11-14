import { LedgerEntry, PayoutAccount } from '../types';

/**
 * Flutterwave v3 Configuration for Shop It
 * Secrets are strictly handled on the server.
 * Public key is accessed via import.meta.env.VITE_FLW_PUBLIC_KEY or /api/payments/config.
 */
function getAuthHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('shopit_session_token') : null;
  return token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {};
}

export const PAYMENT_CONFIG = {
  publicKey: (import.meta as any).env?.VITE_FLW_PUBLIC_KEY || '',
  minWithdrawal: 1000, // ₦1,000 minimum rule
  coolingPeriodHours: 24, // 24-hour cooling period for newly added payout accounts
};

export interface PaymentInitResponse {
  status: boolean;
  message?: string;
  data?: {
    authorization_url: string;
    link?: string;
    reference: string;
    tx_ref?: string;
    amountInKobo: number;
    grandTotalNaira: number;
    orderId: string;
    expiresAt?: string;
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

export interface SupportedBank {
  id?: number;
  code: string;
  name: string;
}

/**
 * Starts payments strictly from the server.
 * The amount (in kobo) is computed exclusively on the server, never from the browser.
 */
export async function initializePaymentOnServer(payload: {
  email?: string;
  items: Array<{
    productId: string;
    quantity: number;
    deliveryMethod: 'pickup' | 'delivery';
  }>;
  campus: string;
  deliveryArea?: string;
  pickupPoint?: string;
  couponCode?: string;
  orderId?: string;
  paymentMethod?: string;
}): Promise<PaymentInitResponse> {
  const response = await fetch('/api/payments/initialize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  return await response.json();
}

/**
 * Queries server to verify transaction status directly confirmed with Flutterwave v3
 */
export async function verifyPaymentOnServer(
  reference: string,
  transactionId?: string | number | null
): Promise<{
  status: boolean;
  isPaid: boolean;
  expired?: boolean;
  reference?: string;
  orderId?: string;
  amountNaira?: number;
  message?: string;
}> {
  try {
    const query = transactionId ? `?transaction_id=${encodeURIComponent(String(transactionId))}` : '';
    const response = await fetch(`/api/payments/verify/${encodeURIComponent(reference)}${query}`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
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
export async function getPaymentServerConfig(): Promise<{
  provider?: string;
  mode?: string;
  paymentsEnabled?: boolean;
  payoutsEnabled?: boolean;
  publicKey: string;
  isSecretConfigured: boolean;
  isWebhookSecretConfigured: boolean;
  webhookPath: string;
  webhookUrl: string;
}> {
  try {
    const res = await fetch('/api/payments/config');
    return await res.json();
  } catch {
    return {
      provider: 'flutterwave',
      publicKey: PAYMENT_CONFIG.publicKey,
      isSecretConfigured: false,
      isWebhookSecretConfigured: false,
      webhookPath: '/api/payments/webhook',
      webhookUrl: 'https://shop-itng-pied.vercel.app/api/payments/webhook',
    };
  }
}

/**
 * Fetches server-side verified webhook events for Moderator audits
 */
export async function getPaymentServerEvents(): Promise<any[]> {
  try {
    const res = await fetch('/api/payments/events', {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return data.events || [];
  } catch {
    return [];
  }
}

/**
 * Fetches live list of Flutterwave NG supported payout banks from /api/payments/banks
 */
export async function fetchSupportedBanks(): Promise<{
  status: boolean;
  banks: SupportedBank[];
  message?: string;
}> {
  try {
    const res = await fetch('/api/payments/banks', {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return {
      status: Boolean(data.status && Array.isArray(data.banks)),
      banks: Array.isArray(data.banks) ? data.banks : [],
      message: data.message,
    };
  } catch (err: any) {
    return {
      status: false,
      banks: [],
      message: err.message || 'Could not load supported banks.',
    };
  }
}

/**
 * Resolves a Nigerian bank account name via Flutterwave /v3/accounts/resolve on the server
 */
export async function resolveBankAccount(
  bankCode: string,
  accountNumber: string
): Promise<{
  status: boolean;
  accountName?: string;
  accountNumber?: string;
  message?: string;
}> {
  try {
    const res = await fetch('/api/payments/resolve-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify({ bankCode, accountNumber }),
    });
    const data = await res.json();
    return {
      status: Boolean(data.status && data.accountName),
      accountName: data.accountName,
      accountNumber: data.accountNumber,
      message: data.message,
    };
  } catch (err: any) {
    return {
      status: false,
      message: err.message || 'Bank account lookup failed.',
    };
  }
}

/**
 * Creates an append-only ledger calculation engine
 * All balances come from an append-only ledger (sale, fee, withdrawal, refund).
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
        // New order paid via Flutterwave webhook -> held in escrow
        pending += entry.amount;
        break;

      case 'escrow_release':
        // Buyer confirmed receipt or inspection period elapsed
        pending = Math.max(0, pending - entry.amount);
        available += entry.amount;
        break;

      case 'withdrawal':
        // Payout to Nigerian Bank through Flutterwave Transfers API
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
 * A new payout account waits 24 hours before it can be used.
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

  const hasSharedName = accParts.some(part => part.length >= 2 && sellerParts.includes(part));

  if (!hasSharedName) {
    return {
      isMatch: false,
      reason: `Account name "${accountName.toUpperCase()}" does not match verified seller identity "${verifiedSellerName.toUpperCase()}". KYC requires the recipient bank account name to match your registered ID.`,
    };
  }

  return { isMatch: true };
}
