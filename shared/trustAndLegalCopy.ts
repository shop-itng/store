/**
 * Shop It Centralized Trust, Payment & Legal Wording
 *
 * ONE single source of truth for all trust, operator attribution, meta description,
 * payment-mode messaging, email trust copy, and legal/help page text.
 *
 * Lawyer updates happen here in one place.
 * Zero browser globals (safe for Node.js/Vercel API, shared email renderer, and Vite React UI).
 */

export interface TrustModeCopy {
  paymentsEnabled: boolean;
  topBarBadgeLong: string;
  topBarBadgeShort: string;
  footerSummary: string;
  footerTagline: string;
  footerStatusPill: string;
  footerOrdersLinkLabel: string;
  footerProtectionLinkLabel: string;
  footerPrivacyLinkLabel: string;
  productCardBadge: string;
  homeWelcomeBadge: string;
  homeWelcomeSubtitle: string;
  homeTrustPrimary: string;
  homeTrustSecondary: string;
  pickupDirectoryTitle: string;
  pickupDirectorySubtitle: string;
  checkoutTitle: string;
  checkoutStatusBadge: string;
  checkoutSubtitle: string;
  checkoutBoxTitle: string;
  checkoutBoxPill: string;
  checkoutBoxBody: string;
  checkoutChannelLabel: string;
  checkoutChannelFootnote: string;
  checkoutFeeLabel: string;
  checkoutTotalSubnote: string;
  checkoutFooterNote: string;
  productInfoTitle: string;
  productInfoBody: string;
  productFeeLabel: string;
  productSellerTrustFallback: string;
  productChatButtonLabel: string;
  cartProceedLabel: string;
  cartDisabledBanner: string;
  cartBottomNote: string;
  chatHeaderBadge: string;
  chatEmptyHint: string;
  chatOfferTotalLabel: string;
  chatOfferCardHeader: string;
  chatOfferAcceptLabel: string;
  chatQuickActionLine: string;
  authTagline: string;
  shareBadgeLabel: string;
  shareFooterTagline: string;
  quickListNoteTitle: string;
  quickListNotePoints: string[];
  ordersHeaderTitle: string;
  ordersHeaderSubtitle: string;
  receiptTitle: string;
  receiptStatusSettled: string;
  receiptStatusActive: string;
  receiptSubSettled: string;
  receiptSubActive: string;
  receiptTotalLabel: string;
  receiptWatermark: string;
  reportHeaderTitle: string;
  reportBannerText: string;
  reportRefundOptionLabel: string;
  reportSubmitLabel: string;
}

// ============================================================================
// OPERATOR ATTRIBUTION CONSTANT
// ============================================================================
// PENDING LAWYER APPROVAL: "Operated by TEEDS" requires lawyer approval because
// TEEDS is an independent student venture and is not registered with the CAC.
export const OPERATOR_INFO = {
  brandName: 'Shop It',
  operatorName: 'TEEDS',
  operatedByLine: 'Operated by TEEDS',
  copyrightLine: '© 2026 Shop It. Made by TEEDS.',
  platformLabel: 'Shop It Nigeria (TEEDS)',
  supportEmail: 'shopitverified@gmail.com',
  supportSlaLine: 'We aim to reply within 3 working days.',
  registrationDisclosure:
    'TEEDS is an independent student venture and is not registered with the Corporate Affairs Commission (CAC).',
  lawyerStatusComment: 'Pending lawyer approval (TEEDS is not CAC-registered).',
} as const;

// ============================================================================
// SITE & META TAG COPY (index.html, metadata.json, SEO)
// ============================================================================
export const META_COPY = {
  title: 'Shop It | Nigerian Teen & Youth Marketplace',
  description:
    'Marketplace for Nigerian teens and youth to buy and sell handmade crafts, beads, scents, crochet, and fashion.',
} as const;

// ============================================================================
// PAYMENT & TRUST STATEMENTS (PENDING LAWYER REVIEW)
// ============================================================================
// PENDING LAWYER REVIEW: Plain accurate statement when PAYMENTS_ENABLED=true.
export const PAYMENT_HOLD_STATEMENT =
  'Payments are processed by Flutterwave. Shop It holds your payment until you confirm delivery.';

export const PAYMENTS_DISABLED_STATEMENT = 'Arrange directly with the seller';

export const PAYMENTS_DISABLED_NOTICE =
  'Online payments are currently turned off. Arrange directly with the seller.';

export const TRUST_COPY_BY_MODE: Record<'enabled' | 'disabled', TrustModeCopy> = {
  enabled: {
    paymentsEnabled: true,
    topBarBadgeLong: 'Shop It Order Payment Hold',
    topBarBadgeShort: 'Order Protection',
    footerSummary:
      'Nigerian teen and youth marketplace where students and young makers sell handmade crafts.',
    footerTagline: 'Nigerian Student & Youth Marketplace',
    footerStatusPill: 'Flutterwave Checkout',
    footerOrdersLinkLabel: 'Track Orders',
    footerProtectionLinkLabel: 'Buyer Protection Policy',
    footerPrivacyLinkLabel: 'Privacy Policy',
    productCardBadge: 'Payment Hold',
    homeWelcomeBadge: 'Nigerian Youth Marketplace',
    homeWelcomeSubtitle:
      'Marketplace for Nigerian teens and youth to buy and sell handmade beads, scent oils, crochet wear, fashion, and crafts.',
    homeTrustPrimary: PAYMENT_HOLD_STATEMENT,
    homeTrustSecondary: 'Campus pickup or local delivery',
    pickupDirectoryTitle: 'Campus Pickup Spots',
    pickupDirectorySubtitle:
      'Public, well-lit campus hubs for inspecting crafts before confirming delivery with your 4-digit Handshake PIN.',
    checkoutTitle: 'Flutterwave Checkout',
    checkoutStatusBadge: 'FLUTTERWAVE',
    checkoutSubtitle:
      'Card details handled by Flutterwave · Payment held until delivery confirmation',
    checkoutBoxTitle: 'How Payment Hold Works',
    checkoutBoxPill: '5-Day Window',
    checkoutBoxBody: PAYMENT_HOLD_STATEMENT,
    checkoutChannelLabel: 'Processed by Flutterwave',
    checkoutChannelFootnote:
      'Payments are processed by Flutterwave. Card details are not stored on Shop It servers.',
    checkoutFeeLabel: 'Shop It Service Fee',
    checkoutTotalSubnote: 'Includes Shop It service fee and delivery',
    checkoutFooterNote: PAYMENT_HOLD_STATEMENT,
    productInfoTitle: 'How Payment Works',
    productInfoBody:
      `${PAYMENT_HOLD_STATEMENT} If an item does not match the listing or does not arrive, report a problem from your Orders page within 3 days for moderation review.`,
    productFeeLabel: 'Shop It Service Fee',
    productSellerTrustFallback: 'Trackable via Orders',
    productChatButtonLabel: 'Ask Seller (In-App Chat)',
    cartProceedLabel: 'Proceed to Checkout',
    cartDisabledBanner: PAYMENTS_DISABLED_NOTICE,
    cartBottomNote: PAYMENT_HOLD_STATEMENT,
    chatHeaderBadge: 'In-App Order Chat',
    chatEmptyHint: 'Click "Ask Seller" on any item or shop to start an in-app conversation.',
    chatOfferTotalLabel: 'Total Offer:',
    chatOfferCardHeader: 'Preset Order Offer',
    chatOfferAcceptLabel: 'Accept & Go to Checkout',
    chatQuickActionLine: 'I would like to order through Shop It checkout',
    authTagline:
      'Marketplace for Nigerian teens and youth to buy and sell handmade crafts.',
    shareBadgeLabel: 'Shop It Listing',
    shareFooterTagline: 'Nigerian Youth Marketplace',
    quickListNoteTitle: 'How Shop It Fees & Orders Work:',
    quickListNotePoints: [
      'Your seller payout is tracked in your Seller Wallet.',
      'Shop It adds a tiered service fee at checkout, shown clearly before payment.',
      'Packing photo upload protects makers if a buyer opens an order dispute.',
    ],
    ordersHeaderTitle: 'My Orders & Delivery Tracking',
    ordersHeaderSubtitle:
      'Track handmade orders, view packing photos, confirm delivery, or report an issue.',
    receiptTitle: 'Shop It Order Pass',
    receiptStatusSettled: 'Order Payment Released',
    receiptStatusActive: 'Payment Held Pending Delivery',
    receiptSubSettled: 'Order payment has been moved to the seller available balance.',
    receiptSubActive: PAYMENT_HOLD_STATEMENT,
    receiptTotalLabel: 'Total Paid',
    receiptWatermark: 'Shop It Order Record · Processed by Flutterwave',
    reportHeaderTitle: 'Report an Order Problem',
    reportBannerText:
      'Opening a dispute pauses automatic release of the held payment until Admin Support reviews evidence from both sides.',
    reportRefundOptionLabel: 'Request Refund',
    reportSubmitLabel: 'Submit Problem Report',
  },
  disabled: {
    paymentsEnabled: false,
    topBarBadgeLong: 'Shop It · Direct Arrangement',
    topBarBadgeShort: 'Arrange Direct',
    footerSummary:
      'Nigerian teen and youth marketplace where students and young makers showcase handmade crafts.',
    footerTagline: 'Nigerian Student & Youth Marketplace',
    footerStatusPill: 'Arrange Directly with Seller',
    footerOrdersLinkLabel: 'View Orders',
    footerProtectionLinkLabel: 'Order & Dispute Policy',
    footerPrivacyLinkLabel: 'Privacy Policy',
    productCardBadge: 'Arrange Direct',
    homeWelcomeBadge: 'Nigerian Youth Marketplace',
    homeWelcomeSubtitle:
      'Marketplace for Nigerian teens and youth to discover handmade beads, scent oils, crochet wear, fashion, and crafts.',
    homeTrustPrimary: PAYMENTS_DISABLED_STATEMENT,
    homeTrustSecondary: 'Campus pickup or local meetup',
    pickupDirectoryTitle: 'Campus Pickup Spots',
    pickupDirectorySubtitle:
      'Public, well-lit campus hubs where buyers and sellers can meet in person.',
    checkoutTitle: 'Direct Order Arrangement',
    checkoutStatusBadge: 'PAYMENTS OFF',
    checkoutSubtitle: 'Online payments are currently turned off',
    checkoutBoxTitle: PAYMENTS_DISABLED_STATEMENT,
    checkoutBoxPill: 'Payments Off',
    checkoutBoxBody:
      'Online payments are currently turned off on Shop It. Arrange directly with the seller via in-app chat.',
    checkoutChannelLabel: 'Online checkout paused',
    checkoutChannelFootnote:
      'Online payments are currently turned off. Arrange directly with the seller.',
    checkoutFeeLabel: 'Estimated Service Fee (when online checkout is enabled)',
    checkoutTotalSubnote: 'Estimated breakdown for reference',
    checkoutFooterNote: PAYMENTS_DISABLED_STATEMENT,
    productInfoTitle: 'How Ordering Works Right Now',
    productInfoBody:
      'Online payments are currently turned off. Message the seller in Shop It chat to arrange directly with the seller for pickup or delivery.',
    productFeeLabel: 'Platform Service Fee (when online checkout is on)',
    productSellerTrustFallback: PAYMENTS_DISABLED_STATEMENT,
    productChatButtonLabel: 'Message Seller to Arrange',
    cartProceedLabel: PAYMENTS_DISABLED_STATEMENT,
    cartDisabledBanner: PAYMENTS_DISABLED_NOTICE,
    cartBottomNote: PAYMENTS_DISABLED_NOTICE,
    chatHeaderBadge: 'In-App Chat',
    chatEmptyHint:
      'Click "Ask Seller" on any item or shop to message the maker directly.',
    chatOfferTotalLabel: 'Total Discussed:',
    chatOfferCardHeader: 'Preset Price Proposal',
    chatOfferAcceptLabel: PAYMENTS_DISABLED_STATEMENT,
    chatQuickActionLine: 'Can we arrange directly for pickup or delivery?',
    authTagline:
      'Marketplace for Nigerian teens and youth to showcase and discover handmade crafts.',
    shareBadgeLabel: 'Shop It Listing',
    shareFooterTagline: 'Nigerian Youth Marketplace',
    quickListNoteTitle: 'Listing & Direct Arrangement:',
    quickListNotePoints: [
      'Online checkout is currently turned off. Buyers will arrange directly with the seller.',
      'Your item stays visible in the marketplace with pickup and delivery details.',
      'Keep communication inside Shop It chat for safety.',
    ],
    ordersHeaderTitle: 'My Orders & Tracking',
    ordersHeaderSubtitle: 'View existing order updates and tracking history.',
    receiptTitle: 'Shop It Order Record',
    receiptStatusSettled: 'Order Completed',
    receiptStatusActive: 'Order In Progress',
    receiptSubSettled: 'Order marked as completed.',
    receiptSubActive: 'View current order tracking details below.',
    receiptTotalLabel: 'Order Total',
    receiptWatermark: 'Shop It Order Record',
    reportHeaderTitle: 'Report an Order Problem',
    reportBannerText:
      'Submit evidence and details below so moderation can review your order.',
    reportRefundOptionLabel: 'Request Refund',
    reportSubmitLabel: 'Submit Problem Report',
  },
};

export function getTrustCopy(paymentsEnabled: boolean): TrustModeCopy {
  return paymentsEnabled ? TRUST_COPY_BY_MODE.enabled : TRUST_COPY_BY_MODE.disabled;
}

// ============================================================================
// EMAIL TRUST COPY (shared/transactionalEmails.ts)
// ============================================================================
export const EMAIL_TRUST_COPY = {
  signatureTeam: 'The Shop It Team',
  signatureSubline: `${OPERATOR_INFO.operatedByLine} · Nigerian Youth & Student Artisanal Marketplace`,
  signatureHelpPrefix: `Support: ${OPERATOR_INFO.supportEmail} (${OPERATOR_INFO.supportSlaLine})`,
  signatureSecurityWarning: 'Never share your codes. Shop It will never ask for your password or code.',
  orderPlacedBodyPrefix:
    'Payment of ₦{total} has been received. Payments are processed by Flutterwave. Shop It holds your payment until you confirm delivery.',
  welcomeBody: 'Your Shop It account is ready.',
} as const;

// ============================================================================
// LEGAL & HELP PAGE COPY (src/components/LegalAndHelpPages.tsx)
// ============================================================================
export interface FaqItemCopy {
  q: string;
  a: string;
}

export function getLegalAndHelpCopy(paymentsEnabled: boolean) {
  return {
    lastUpdated: '3 November 2026',
    terms: {
      eyebrow: 'Marketplace Terms',
      title: 'Terms of Service',
      whoWeAreParagraphs: [
        'Shop It is an online marketplace created for Nigerian students, teenagers, and young creators to list, discover, and buy handmade crafts, beads, fashion, scent oils, crochet wear, and bespoke goods.',
        `Shop It is ${OPERATOR_INFO.operatedByLine.toLowerCase()}. ${OPERATOR_INFO.registrationDisclosure} We do not claim Corporate Affairs Commission (CAC) registration.`,
        `You can reach our team by emailing ${OPERATOR_INFO.supportEmail}. ${OPERATOR_INFO.supportSlaLine}`,
      ],
      buyerDuty: paymentsEnabled
        ? 'Order through Shop It checkout, provide clear delivery or campus pickup instructions, inspect your item upon delivery, and tap "Item received" in the app once satisfied.'
        : 'Arrange directly with the seller using clear delivery or campus pickup details, and inspect items carefully in public campus spots.',
      pricingParagraphs: paymentsEnabled
        ? [
            'Sellers set their own item prices. Shop It adds a tiered service fee calculated automatically by the website and displayed clearly before checkout (Item Price + Service Fee + Delivery Fee = Total).',
            'Any future update to fee formulas will not change an order that has already been paid for.',
            'Sellers choose their delivery options: campus pickup spot, local delivery, or buyer-arranged rider. Delivery costs are shown before confirmation.',
          ]
        : [
            'Online payments are currently turned off. Buyers and sellers arrange directly with the seller for price confirmation, campus pickup, or local delivery.',
          ],
      paymentHandlingTitle: paymentsEnabled ? '6. How Order Payments & Holds Work' : '6. Current Ordering Mode (Online Payments Off)',
      paymentHandlingParagraphs: paymentsEnabled
        ? [
            // PENDING LAWYER REVIEW
            `${PAYMENT_HOLD_STATEMENT} We never see or store your debit card details or banking PINs.`,
            'While an order is in progress, the seller cannot withdraw the order funds. Once you receive the item and tap "Item received", the funds move to the seller\'s Available balance.',
            '5-Day Auto-Release & Unshipped Order Rule: Once an order is dispatched (shipped or delivered) and 5 days pass after payment without an open dispute or buyer confirmation, the funds move to the seller\'s Available balance. If a paid order has not been marked shipped after 3 days, we remind the seller; if still unshipped after 5 days (with no open dispute or admin hold), the order is cancelled and refunded.',
          ]
        : [
            'Online payments are currently turned off on Shop It. Do not enter card details on Shop It while online checkout is off; arrange directly with the seller.',
          ],
      walletParagraphs: paymentsEnabled
        ? [
            'Every seller wallet tracks two balances: Pending Balance (funds awaiting delivery confirmation) and Available Balance (earnings ready to withdraw after buyer confirmation or 5-day auto-release).',
            'The minimum withdrawal amount is ₦1,000 to a supported Nigerian bank account, confirmed with a 6-digit email verification code.',
            '24-Hour Payout Cooling Period: When you add or change a payout bank account, you must wait 24 hours before withdrawing to it.',
            'The name on your payout bank account must match your verified seller identity—or, for sellers under 18, your parent or guardian\'s verified identity (approved once by Admin, with a ₦25,000 daily withdrawal limit for sellers under 18).',
          ]
        : [
            'Online payouts are paused while online payments are turned off. Arrange directly with the seller.',
          ],
      bannedRuleParagraph: paymentsEnabled
        ? 'Chat stays inside Shop It, where numbers and external links are filtered. Never complete off-platform transfers for online orders, as deals outside Shop It are not covered by order dispute review.'
        : 'Use Shop It in-app chat to communicate. Numbers and external contact links are filtered to help protect youth members.',
      liabilityParagraph: paymentsEnabled
        ? 'We provide Shop It in good faith to support student and teen makers. We are not responsible for courier delays or items exchanged outside Shop It. Any refund or adjustment for a paid platform order is limited to the order amount held for that transaction.'
        : 'We provide Shop It in good faith to support student and teen makers. Because online payments are currently off, buyers and sellers arrange directly with the seller.',
    },
    privacy: {
      eyebrow: 'Data & Privacy Notice',
      subtitleSuffix: 'Governed by Nigerian data protection principles (NDPA 2023)',
      intro:
        `Shop It (${OPERATOR_INFO.operatedByLine}, ${OPERATOR_INFO.registrationDisclosure}) respects your privacy and limits data collection to what is needed to run the marketplace.`,
      providersBulletPayment:
        'Flutterwave: Third-party payment gateway used when online checkout is active.',
    },
    refunds: {
      eyebrow: paymentsEnabled ? 'Order Disputes & Refunds' : 'Order Issues',
      bodyBanner: paymentsEnabled
        ? `${PAYMENT_HOLD_STATEMENT} While a dispute is open, held funds do not release until moderation reviews evidence from both sides.`
        : 'Online payments are currently turned off. Arrange directly with the seller and inspect items in person before finalizing.',
      offPlatformRule: paymentsEnabled
        ? 'Deals arranged outside Shop It checkout cannot be refunded through the platform.'
        : 'Because online payments are turned off, transactions are arranged directly with the seller.',
    },
    prohibited: {
      intro:
        'Shop It is a youth marketplace for students, teens, and young makers. To protect members, the following items and behaviours are not allowed:',
    },
    sellerGuide: {
      priceDesc: paymentsEnabled
        ? 'Calculate your materials plus your time. You set your seller price, and Shop It displays the tiered service fee at checkout.'
        : 'Set a clear, honest price for your handmade item so buyers can arrange directly with the seller.',
      step6Title: paymentsEnabled ? 'Get Paid in Your Wallet' : 'Confirm Direct Arrangement',
      step6Desc: paymentsEnabled
        ? 'When the buyer confirms receipt (or after 5 days once dispatched if no dispute is open), your earnings move to your Available balance. Minimum withdrawal is ₦1,000 via email OTP confirmation.'
        : 'Because online payments are currently turned off, agree on pickup or delivery directly with the buyer in Shop It chat.',
      step7Desc: paymentsEnabled
        ? 'Keep order conversations in Shop It chat. Never ask buyers for external phone transfers for Shop It checkout orders.'
        : 'Meet in public, well-lit campus spots during the day and use Shop It chat to coordinate.',
    },
    buyerProtection: {
      eyebrow: paymentsEnabled ? 'Order Dispute Policy' : 'Direct Arrangement Guide',
      title: paymentsEnabled ? 'Buyer Protection' : 'Ordering Safely on Shop It',
      subtitle: paymentsEnabled
        ? 'How Shop It handles order payments and disputes'
        : 'Online payments are currently turned off · Arrange directly with the seller',
      bannerText: paymentsEnabled
        ? PAYMENT_HOLD_STATEMENT
        : 'Online payments are currently turned off. Arrange directly with the seller.',
      processTitle: paymentsEnabled ? 'How Order Protection Works' : 'How Ordering Works Right Now',
      steps: paymentsEnabled
        ? [
            {
              title: 'Step 1: Checkout via Flutterwave',
              body: PAYMENT_HOLD_STATEMENT,
            },
            {
              title: 'Step 2: Maker Delivers',
              body: 'The maker packs your item, uploads a packing photo, and sends it to your campus pickup spot or delivery address.',
            },
            {
              title: 'Step 3: Confirm Delivery',
              body: 'Inspect your item first. Tap "Item received" once you confirm delivery.',
            },
          ]
        : [
            {
              title: 'Step 1: Browse & Pick an Item',
              body: 'Find handmade beads, scents, crochet wear, or crafts from youth makers in your campus or area.',
            },
            {
              title: 'Step 2: Message Seller in Chat',
              body: 'Tap "Ask Seller" to arrange directly with the seller for pickup spot or local delivery.',
            },
            {
              title: 'Step 3: Inspect in Person',
              body: 'Meet at a busy public campus spot in daylight and inspect your item thoroughly.',
            },
          ],
      goldenRule: paymentsEnabled
        ? 'Keep checkout and order chat inside Shop It. If anyone asks for off-platform transfers on a checkout order, report it.'
        : 'Meet in public daytime campus pickup spots and inspect items carefully when arranging directly with the seller.',
    },
    faqs: [
      {
        q: 'How old do I need to be to use Shop It?',
        a: 'You must be at least 10 years old. If you are under 18, you need permission from a parent or guardian. Users under 10 are not permitted to register.',
      },
      {
        q: 'How do payments and pricing work?',
        a: paymentsEnabled
          ? `Sellers set their item price, and Shop It adds a tiered service fee shown before checkout. ${PAYMENT_HOLD_STATEMENT}`
          : 'Online payments are currently turned off. Browse items and arrange directly with the seller via Shop It chat.',
      },
      {
        q: 'Do you collect my phone number?',
        a: 'No. Shop It uses email only. You sign up, log in, and confirm actions with 6-digit codes sent to your inbox.',
      },
      {
        q: paymentsEnabled ? 'What happens if I forget to tap "Item received" or the seller never ships?' : 'How do I buy an item while online payments are off?',
        a: paymentsEnabled
          ? 'Once dispatched and 5 days pass after payment with no open dispute, funds move to the seller\'s Available balance. If a paid order is never marked shipped, we remind the seller at day 3, and at day 5 it is cancelled and refunded unless a dispute or admin hold exists.'
          : 'Open the product you like, tap "Ask Seller", and arrange directly with the seller for pickup or delivery.',
      },
      {
        q: 'How do I get verified as a seller?',
        a: 'Go to your Seller Dashboard and submit your National Identification Number (NIN), a photo of your ID slip or card, and a live selfie. Sellers under 18 also submit parent/guardian consent details.',
      },
      {
        q: 'What happens to my ID photo and selfie after verification?',
        a: 'Your ID photo and selfie are deleted immediately after the admin verification decision. Only the last 4 NIN digits, a cryptographic hash, the decision, and the review date are retained.',
      },
      {
        q: 'How do sellers withdraw their earnings?',
        a: paymentsEnabled
          ? 'Sellers withdraw from their Available balance to a supported Nigerian bank account (minimum ₦1,000, confirmed with an email verification code). For sellers under 18, payouts go to the verified parent/guardian bank account after a one-time Admin approval, capped at ₦25,000/day.'
          : 'Online payouts are inactive while online payments are turned off. Arrange directly with the seller.',
      },
      {
        q: 'Why is there a 24-hour wait on a new payout account?',
        a: 'When you add or change a payout bank account, a 24-hour cooling period applies before withdrawals to reduce unauthorized transfer risk.',
      },
      {
        q: 'How long do I have to report a problem with an order?',
        a: paymentsEnabled
          ? 'You have 3 days after the item is marked delivered to tap "Report Problem" and upload photos in the app.'
          : 'Use the Report button on any listing or conversation if something seems wrong so moderation can review.',
      },
      {
        q: 'Why are phone numbers and digits blocked in chat?',
        a: 'Blocking phone numbers, number words, and contact links in chat helps protect youth users from spam and off-platform scams.',
      },
      {
        q: 'How do I delete my account and data?',
        a: `You can delete your account in Account Settings or email ${OPERATOR_INFO.supportEmail}. Account deletion requests are completed within 14 days.`,
      },
      {
        q: 'Is Shop It a registered company?',
        a: `Shop It is ${OPERATOR_INFO.operatedByLine.toLowerCase()}, an independent student venture. ${OPERATOR_INFO.registrationDisclosure}`,
      },
      {
        q: 'How fast does customer support respond?',
        a: `Our support team replies to messages sent to ${OPERATOR_INFO.supportEmail} within 3 working days.`,
      },
    ] as FaqItemCopy[],
    contact: {
      operatorLine: `${OPERATOR_INFO.operatorName} (Independent Student Venture)`,
      statusLine: `${OPERATOR_INFO.registrationDisclosure}`,
      supportOptionLabel: paymentsEnabled ? 'Order & Payment Support' : 'Order Support',
      submitNote: 'We aim to respond to your email within 3 working days.',
    },
  };
}
