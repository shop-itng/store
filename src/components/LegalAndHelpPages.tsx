import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  Lock,
  Mail,
  AlertTriangle,
  FileText,
  HelpCircle,
  ShoppingBag,
  Store,
  CheckCircle2,
  Clock,
  Building2,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Send,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

export type LegalPageSlug =
  | 'terms'
  | 'privacy'
  | 'refunds'
  | 'prohibited-items'
  | 'seller-guide'
  | 'buyer-protection'
  | 'faq'
  | 'contact';

interface LegalPagesProps {
  initialSlug?: LegalPageSlug;
}

export function getSiteUrl(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'https://shop-itng-pied.vercel.app';
}

export const LegalAndHelpPages: React.FC<LegalPagesProps> = ({ initialSlug = 'terms' }) => {
  const { activeView, setActiveView, notify } = useApp();
  const currentSlug: LegalPageSlug = (
    activeView === 'terms' ||
    activeView === 'privacy' ||
    activeView === 'refunds' ||
    activeView === 'prohibited-items' ||
    activeView === 'seller-guide' ||
    activeView === 'buyer-protection' ||
    activeView === 'faq' ||
    activeView === 'contact'
      ? activeView
      : initialSlug
  ) as LegalPageSlug;

  const siteUrl = getSiteUrl();
  const lastUpdated = '3 November 2026';

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactCategory, setContactCategory] = useState('General Question');
  const [contactMessage, setContactMessage] = useState('');
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);

  // FAQ accordion state
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      notify('Please fill out all fields in the contact form.', 'error');
      return;
    }

    setIsSubmittingContact(true);
    try {
      const resp = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          category: contactCategory,
          message: contactMessage,
        }),
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        throw new Error(d.message || 'Could not send message right now.');
      }

      setIsSubmittingContact(false);
      setContactSubmitted(true);
      notify('Message sent! Our support team will reply to your email within 3 working days.', 'success');
    } catch (err: any) {
      setIsSubmittingContact(false);
      setContactSubmitted(false);
      notify(err?.message || 'Unable to send message right now. Please email shopitverified@gmail.com.', 'error');
    }
  };

  const navLinks: { slug: LegalPageSlug; label: string; icon: any }[] = [
    { slug: 'terms', label: 'Terms of Service', icon: FileText },
    { slug: 'privacy', label: 'Privacy Policy', icon: Lock },
    { slug: 'refunds', label: 'Refunds & Disputes', icon: ShieldCheck },
    { slug: 'prohibited-items', label: 'Prohibited Items', icon: AlertTriangle },
    { slug: 'seller-guide', label: 'Seller Guide', icon: Store },
    { slug: 'buyer-protection', label: 'Buyer Protection', icon: ShoppingBag },
    { slug: 'faq', label: 'FAQ', icon: HelpCircle },
    { slug: 'contact', label: 'Contact Us', icon: Mail },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 animate-fade-in-up">
      {/* Top back button */}
      <button
        onClick={() => setActiveView('catalog')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Marketplace</span>
      </button>

      {/* Navigation tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 border-b border-slate-200 dark:border-stone-800 scrollbar-none">
        {navLinks.map(tab => {
          const Icon = tab.icon;
          const isActive = currentSlug === tab.slug;
          return (
            <button
              key={tab.slug}
              onClick={() => setActiveView(tab.slug as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#111111] dark:bg-white text-white dark:text-[#111111] shadow-xs'
                  : 'bg-white dark:bg-[#15161C] text-slate-600 dark:text-stone-300 border border-slate-200 dark:border-stone-800 hover:border-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Card */}
      <div className="bg-white dark:bg-[#15161C] rounded-3xl border-2 border-[#111111] dark:border-stone-800 p-6 sm:p-10 shadow-[0_4px_0_#111111] dark:shadow-none space-y-8 text-slate-800 dark:text-stone-200 leading-relaxed text-sm">
        {/* ========================================================= */}
        {/* 1. TERMS OF SERVICE */}
        {/* ========================================================= */}
        {currentSlug === 'terms' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-stone-800 pb-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#FF6B00]">
                Official Agreement
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#111111] dark:text-white mt-1">
                Terms of Service
              </h1>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                Last updated: <strong>{lastUpdated}</strong> · Website: <strong>{siteUrl}</strong>
              </p>
            </div>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">1. Who We Are</h2>
              <p>
                Shop It is an online marketplace created for Nigerian students, teenagers, and young creators to buy and sell handmade crafts, beads, fashion, scent oils, crochet wear, and bespoke goods safely.
              </p>
              <p>
                Shop It is operated by TEEDS. TEEDS is an independent student enterprise and is not yet a registered company. We do not claim any Corporate Affairs Commission (CAC) registration.
              </p>
              <p>
                You can reach our team anytime by emailing <strong>shopitverified@gmail.com</strong>. We reply to all messages within 3 working days.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">2. Who Can Use Shop It</h2>
              <p>
                You must be at least <strong>10 years old</strong> to use Shop It. Anyone under the age of 10 is not allowed to register or use the service.
              </p>
              <p>
                If you are between <strong>10 and 17 years old</strong>, you need the consent of a parent or guardian before signing up. Your parent or guardian is responsible for your actions on the app.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">3. Your Account and Email Sign-In</h2>
              <p>
                You sign up for Shop It using your email address only. We verify your account by sending a 6-digit code to your inbox.
              </p>
              <p>
                We do not collect or ask for phone numbers. You are responsible for keeping your email account and Shop It password safe. Do not share your login details or verification codes with anyone. Shop It will never ask you for your password or codes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">4. Buyer and Seller Duties</h2>
              <p>
                <strong>Sellers must:</strong> List items honestly, provide real photos, state accurate descriptions, pack items securely, upload a photo of the packed order, and ship within reasonable time.
              </p>
              <p>
                <strong>Buyers must:</strong> Pay through Shop It escrow, provide clear delivery or pickup area instructions, inspect their item upon delivery, and tap &quot;Item received&quot; in the app once satisfied.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">5. Pricing, Service Fees, and Delivery</h2>
              <p>
                Sellers set their own item prices. Shop It adds a service fee to each order.
              </p>
              <p>
                The tiered service fee is calculated automatically by the website and is displayed clearly at checkout before you make any payment. Your total checkout price is always: <em>Item Price + Service Fee + Delivery Fee = Total</em>, with <strong>₦0 extra payment gateway surcharge</strong> for buyers and <strong>₦0 withdrawal transfer fee</strong> for sellers (Shop It absorbs Flutterwave processing fees out of its service fee).
              </p>
              <p>
                We do not use a single fixed fee for everything. Any change to fee formulas will never affect an order that has already been paid for.
              </p>
              <p>
                Sellers choose their delivery options: campus pickup spot, local delivery, or buyer-arranged rider. The delivery cost is shown before payment.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">6. How Escrow Protection Works</h2>
              <p>
                All payments on Shop It are processed securely through Flutterwave. We never see or store your debit card details or banking PINs.
              </p>
              <p>
                When a buyer pays, the money is held safely in escrow. The seller cannot withdraw it yet.
              </p>
              <p>
                Once the buyer receives the item and taps &quot;Item received&quot;, the payment is released into the seller&apos;s Available balance.
              </p>
              <p>
                <strong>5-Day Auto-Release &amp; Unshipped Order Rule:</strong> Once an order is dispatched (shipped or delivered) and 5 days pass after payment without an open dispute or buyer confirmation, the funds are automatically released to the seller. If a paid order has not been shipped after <strong>3 days</strong>, we remind the seller; if still unshipped after <strong>5 days</strong> (with no open dispute or admin hold), the order is automatically cancelled and 100% refunded to the buyer.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">7. Seller Wallets and Withdrawals</h2>
              <p>
                Every seller has two balances:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Pending Balance:</strong> Money held in escrow while orders are being made or delivered.</li>
                <li><strong>Available Balance:</strong> Earnings ready for withdrawal after buyer confirmation or 5-day auto-release.</li>
              </ul>
              <p>
                The minimum withdrawal amount is <strong>₦1,000</strong>. Withdrawals are sent to any supported Nigerian bank account listed by our payment partner.
              </p>
              <p>
                For safety, every withdrawal requires a 6-digit confirmation code sent to your registered email.
              </p>
              <p>
                <strong>24-Hour Payout Cooling Period:</strong> When you add or change a payout account, you must wait 24 hours before you can withdraw to it. This security measure prevents unauthorized fund drainage if your account is ever compromised.
              </p>
              <p>
                The legal name on your payout bank account must match your verified seller identity—or, for under-18 sellers, your parent or guardian&apos;s verified identity (approved once by Admin, with a ₦25,000 daily withdrawal limit for under-18 sellers).
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">8. Seller Verification (KYC)</h2>
              <p>
                To sell products and withdraw earnings, sellers must complete identity verification. This requires submitting a National Identification Number (NIN), a photo of your valid ID slip/card, and a live selfie.
              </p>
              <p>
                If the seller is under 18, a parent or guardian must provide consent and their verified ID, and all withdrawals must go to a bank account belonging to that parent/guardian after a one-time Admin approval (capped at ₦25,000 per day).
              </p>
              <p>
                Your ID photos and selfie are permanently deleted <strong>immediately after the admin verification decision</strong>. We retain only the last 4 digits of the NIN, a cryptographic hash, the decision status, and the review date.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">9. Banned Behaviour and Safety</h2>
              <p>
                Chat is strictly inside Shop It. Our safety system automatically blocks phone numbers, number words, emails, and external contact links in messages.
              </p>
              <p>
                <strong>Never pay or chat outside Shop It.</strong> Doing deals outside the app removes all buyer and seller escrow protection and can result in immediate account termination.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">10. Suspension and Account Closure</h2>
              <p>
                We may suspend or delete accounts that commit fraud, attempt off-platform payment bypass, harass other users, sell banned items, or break Nigerian law.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">11. Limits of Liability</h2>
              <p>
                We provide the Shop It marketplace and escrow technology in good faith to support student and teen makers. We are not responsible for courier delays or damages if you deal outside the app. Our total liability is limited to the amount held in escrow for the specific transaction in dispute.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">12. Governing Law and Disputes</h2>
              <p>
                These terms are governed by the laws of the Federal Republic of Nigeria. Any dispute that cannot be resolved amicably through our support team will be settled exclusively by the courts of Nigeria.
              </p>
            </section>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-stone-900 border border-slate-200 dark:border-stone-800 text-xs">
              <strong>Need help or have questions?</strong> Email us at <strong>shopitverified@gmail.com</strong>. We reply within 3 working days.
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. PRIVACY POLICY */}
        {/* ========================================================= */}
        {currentSlug === 'privacy' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-stone-800 pb-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#16A34A] dark:text-[#9FE870]">
                NDPA 2023 Compliant
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#111111] dark:text-white mt-1">
                Privacy Policy
              </h1>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                Last updated: <strong>{lastUpdated}</strong> · Governed by the <strong>Nigeria Data Protection Act 2023 (NDPA)</strong>
              </p>
            </div>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">1. Our Commitment to Your Privacy</h2>
              <p>
                Shop It (operated by TEEDS, an emerging student enterprise not yet registered with CAC) respects your personal privacy. We comply strictly with the Nigeria Data Protection Act 2023 (NDPA).
              </p>
              <p>
                This policy explains what information we collect, why we need it, how long we keep it, and how your rights are protected.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">2. What We Collect</h2>
              <p>We only collect the minimum information needed to operate a safe marketplace:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Account details:</strong> Your email address, full name, and chosen password.</li>
                <li><strong>Location area:</strong> Your campus, town, or local government area to show relevant items and delivery options.</li>
                <li><strong>Order &amp; transaction records:</strong> What you bought or sold, order reference numbers, and timestamps.</li>
                <li><strong>In-app chat messages:</strong> Messages sent between buyers and sellers to verify transaction details.</li>
                <li><strong>Seller verification data:</strong> National Identification Number (NIN), ID slip/card photo, live selfie, and parent/guardian contact for sellers under 18.</li>
              </ul>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200">
                <strong>What we NEVER collect:</strong> We do NOT collect your phone number. We do NOT store your bank card numbers, CVV codes, or card PINs (these are handled directly by Flutterwave).
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">3. Who Sees Your Information</h2>
              <p>
                <strong>Between users:</strong> Sellers see buyers only as a masked identifier (like &quot;Buyer #7821&quot;). Your real email address and personal contact details are never shown to the other party.
              </p>
              <p>
                <strong>Delivery information:</strong> Your delivery spot or landmark is shared only with the seller or delivery courier for the purpose of getting your order to you.
              </p>
              <p>
                <strong>Admin access:</strong> Real identities and verification records are visible only to authorized Shop It administrators to handle disputes, prevent fraud, or satisfy lawful government requests.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">4. Trusted Service Providers We Use</h2>
              <p>We use reputable industry services to run Shop It smoothly:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Vercel:</strong> Secure web hosting and serverless application delivery.</li>
                <li><strong>Neon:</strong> Secure cloud database storage.</li>
                <li><strong>Upstash:</strong> Temporary rate limiting and cache management.</li>
                <li><strong>Brevo:</strong> Transactional email dispatch for OTP codes and order receipts.</li>
                <li><strong>Payment Gateway Partner:</strong> Licensed third-party Nigerian payment processor for cards and bank transfers.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">5. How Long We Keep Your Data</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>ID photos and live selfies:</strong> Permanently deleted <strong>immediately</strong> after your verification decision is completed. Only the last 4 NIN digits, an encrypted hash, the decision, and the date are kept.
                </li>
                <li>
                  <strong>Full NIN:</strong> Your full NIN is never displayed to anyone and is only processed to verify identity.
                </li>
                <li>
                  <strong>Account information:</strong> Kept while your account is active. When you request account deletion, your profile, listings, and personal details are deleted within <strong>14 days</strong>, except financial transaction records we must retain under Nigerian financial law.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">6. Children and Teen Data Protection</h2>
              <p>
                Shop It is built for youth aged <strong>10 and older</strong>. We do not knowingly allow anyone under 10 to register.
              </p>
              <p>
                For users under 18, parent or guardian consent is required. Parents can request access to or deletion of their child&apos;s data at any time by contacting our support email.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">7. Your Rights Under the NDPA 2023</h2>
              <p>Under the Nigeria Data Protection Act 2023, you have the right to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Access:</strong> Ask for a copy of the personal data we hold about you.</li>
                <li><strong>Correction:</strong> Ask us to update or fix any inaccurate information.</li>
                <li><strong>Deletion:</strong> Ask us to erase your personal data (we process deletion requests within 14 days).</li>
                <li><strong>Withdraw Consent:</strong> Stop using the service and revoke permission for future processing.</li>
                <li><strong>Lodge a Complaint:</strong> File a complaint with the Nigeria Data Protection Commission (NDPC) if you believe your data has been handled improperly.</li>
              </ul>
              <p>
                To exercise any of these rights, email us at <strong>shopitverified@gmail.com</strong>.
              </p>
            </section>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. REFUND & DISPUTE POLICY */}
        {/* ========================================================= */}
        {currentSlug === 'refunds' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-stone-800 pb-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#FF6B00]">
                Escrow Rules
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#111111] dark:text-white mt-1">
                Refund and Dispute Policy
              </h1>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                Last updated: <strong>{lastUpdated}</strong>
              </p>
            </div>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">1. When You Can Get a Refund</h2>
              <p>You can request a full refund if:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Your item never arrived:</strong> The seller did not deliver your order.</li>
                <li><strong>Item not as described:</strong> The item you received is clearly different in material, color, size, or quality from the listing photos.</li>
                <li><strong>Item arrived damaged:</strong> The item was broken or ruined during packaging or transit.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">2. The 3-Day Reporting Window</h2>
              <p>
                You must report any issue within <strong>3 days</strong> after your item is marked delivered.
              </p>
              <p>
                To report a problem, go to your <strong>Orders</strong> page in the app and tap <strong>&quot;Report Problem&quot;</strong>.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">3. What Evidence to Upload</h2>
              <p>To help us resolve your issue fairly, please upload:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Clear photos of the package and item received.</li>
                <li>A short explanation of what is wrong.</li>
                <li>Any unboxing photos or videos if available.</li>
              </ul>
              <p>
                Sellers are also asked to provide their packing photo (taken before shipping) and proof of dispatch.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">4. How Shop It Decides Disputes</h2>
              <p>
                Our safety moderation team reviews the evidence from both the buyer and the seller within <strong>5 working days</strong>.
              </p>
              <p>
                While a dispute is open, the money remains safely frozen in escrow. The seller cannot withdraw it, and it will not auto-release.
              </p>
              <p>
                If the dispute is decided in the buyer&apos;s favour, <strong>100% of the payment</strong> is refunded to the buyer. If the dispute is resolved in the seller&apos;s favour (for example, proof of complete and intact delivery), the money is released to the seller&apos;s Available balance.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">5. What is NOT Covered</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Change of mind:</strong> We do not offer refunds if you simply changed your mind on custom-made, personalized, or made-to-order crafts.</li>
                <li><strong>Off-platform payments:</strong> If you paid a seller directly outside the app (via cash, bank transfer, WhatsApp, or phone call), Shop It cannot protect your money or issue a refund.</li>
                <li><strong>Reports made after the 3-day window:</strong> Once the 3-day window closes and funds have auto-released after 5 days, transactions are final.</li>
              </ul>
            </section>
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. PROHIBITED ITEMS */}
        {/* ========================================================= */}
        {currentSlug === 'prohibited-items' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-stone-800 pb-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-rose-600">
                Safety First
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#111111] dark:text-white mt-1">
                Prohibited Items Policy
              </h1>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                Last updated: <strong>{lastUpdated}</strong>
              </p>
            </div>

            <p>
              Shop It is a safe marketplace for young artisans, students, and teen makers. To protect all members of our community, the following items are strictly banned from being listed, sold, or promoted:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1.5">
                <h3 className="font-bold text-rose-900 dark:text-rose-200 text-xs">Illegal &amp; Regulated Goods</h3>
                <p className="text-xs text-rose-800 dark:text-rose-300">
                  Any product that breaks the laws of Nigeria. Weapons, firearms, knives, ammunition, explosives, fireworks, or hazardous chemicals.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1.5">
                <h3 className="font-bold text-rose-900 dark:text-rose-200 text-xs">Counterfeit &amp; Fake Brands</h3>
                <p className="text-xs text-rose-800 dark:text-rose-300">
                  Knock-off designer wear, replica shoes, fake branded perfumes, unauthorized logos, or pirated media.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1.5">
                <h3 className="font-bold text-rose-900 dark:text-rose-200 text-xs">Adult &amp; Explicit Content</h3>
                <p className="text-xs text-rose-800 dark:text-rose-300">
                  Pornography, adult toys, sexual services, or any sexually suggestive materials. Shop It is a youth marketplace with members starting at age 10.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1.5">
                <h3 className="font-bold text-rose-900 dark:text-rose-200 text-xs">Drugs &amp; Medicines</h3>
                <p className="text-xs text-rose-800 dark:text-rose-300">
                  Illegal drugs, prescription medicines, regulated herbs, cannabis, tobacco, cigarettes, vapes, and alcoholic drinks.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1.5">
                <h3 className="font-bold text-rose-900 dark:text-rose-200 text-xs">Stolen Property</h3>
                <p className="text-xs text-rose-800 dark:text-rose-300">
                  Goods you do not own or have authorization to sell. Stolen phones, gadgets, or campus property.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1.5">
                <h3 className="font-bold text-rose-900 dark:text-rose-200 text-xs">Contact Details in Listings</h3>
                <p className="text-xs text-rose-800 dark:text-rose-300">
                  Phone numbers, WhatsApp links, social media handles, email addresses, or external payment links in product titles, descriptions, or listing photos.
                </p>
              </div>
            </div>

            <section className="space-y-2 pt-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">Listing Review &amp; Removal</h2>
              <p>
                Listings on Shop It are monitored and reviewed by our moderation system.
              </p>
              <p>
                Any listing found violating these rules will be removed immediately without prior warning. Sellers who repeatedly post prohibited items will have their accounts permanently banned and remaining balances reviewed for fraud.
              </p>
            </section>
          </div>
        )}

        {/* ========================================================= */}
        {/* 5. SELLER GUIDE */}
        {/* ========================================================= */}
        {currentSlug === 'seller-guide' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-stone-800 pb-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#FF6B00]">
                Practical Tips
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#111111] dark:text-white mt-1">
                Seller Guide
              </h1>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                Simple, actionable advice for young makers and students · Last updated: <strong>{lastUpdated}</strong>
              </p>
            </div>

            <div className="space-y-5">
              <div className="flex gap-4 items-start">
                <span className="w-8 h-8 rounded-xl bg-[#111111] text-[#9FE870] font-black flex items-center justify-center shrink-0 text-sm">
                  1
                </span>
                <div className="space-y-1">
                  <h3 className="font-bold text-[#111111] dark:text-white text-base">Take Clear, Honest Photos</h3>
                  <p className="text-xs">
                    Snap photos in bright natural daylight. Show the front, back, and details of your item. Never use pictures downloaded from the internet—buyers want to see the real handmade item you made.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <span className="w-8 h-8 rounded-xl bg-[#111111] text-[#9FE870] font-black flex items-center justify-center shrink-0 text-sm">
                  2
                </span>
                <div className="space-y-1">
                  <h3 className="font-bold text-[#111111] dark:text-white text-base">Price Your Item Fairly</h3>
                  <p className="text-xs">
                    Calculate your cost of materials plus your time. You set your item price. Shop It adds the service fee automatically at checkout, so you always receive your full listed seller price upon delivery.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <span className="w-8 h-8 rounded-xl bg-[#111111] text-[#9FE870] font-black flex items-center justify-center shrink-0 text-sm">
                  3
                </span>
                <div className="space-y-1">
                  <h3 className="font-bold text-[#111111] dark:text-white text-base">Pack Securely</h3>
                  <p className="text-xs">
                    Wrap beads, bottles, or crochet items in bubble wrap or clean pouches so they survive campus transit and rainy weather. Good packaging prevents damage disputes!
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <span className="w-8 h-8 rounded-xl bg-[#111111] text-[#9FE870] font-black flex items-center justify-center shrink-0 text-sm">
                  4
                </span>
                <div className="space-y-1">
                  <h3 className="font-bold text-[#111111] dark:text-white text-base">Upload Your Packing Photo</h3>
                  <p className="text-xs">
                    Before marking an order as shipped, take a photo of the packed item. Uploading this photo protects you against false damage claims if a buyer opens a dispute later.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <span className="w-8 h-8 rounded-xl bg-[#111111] text-[#9FE870] font-black flex items-center justify-center shrink-0 text-sm">
                  5
                </span>
                <div className="space-y-1">
                  <h3 className="font-bold text-[#111111] dark:text-white text-base">Deliver Safely</h3>
                  <p className="text-xs">
                    For campus handoffs, meet at public, well-lit safe pickup spots (such as your hall porter desk or campus student union building). If sending via a rider, keep the waybill receipt.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <span className="w-8 h-8 rounded-xl bg-[#111111] text-[#9FE870] font-black flex items-center justify-center shrink-0 text-sm">
                  6
                </span>
                <div className="space-y-1">
                  <h3 className="font-bold text-[#111111] dark:text-white text-base">Get Paid in Your Wallet</h3>
                  <p className="text-xs">
                    When the buyer confirms receipt (or after 5 days once dispatched if they do not reply), your earnings move to your Available balance. You can withdraw anytime to any verified Nigerian bank account listed in your Wallet (minimum ₦1,000, ₦0 withdrawal transfer fee).
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <span className="w-8 h-8 rounded-xl bg-[#111111] text-[#9FE870] font-black flex items-center justify-center shrink-0 text-sm">
                  7
                </span>
                <div className="space-y-1">
                  <h3 className="font-bold text-[#111111] dark:text-white text-base">Avoid Scams</h3>
                  <p className="text-xs">
                    Never accept payments or chat outside Shop It. If a buyer says &quot;let me transfer to your Opay directly&quot; or asks for your phone number, refuse and report them. Payments made outside the app cannot be protected.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 6. BUYER PROTECTION EXPLAINER */}
        {/* ========================================================= */}
        {currentSlug === 'buyer-protection' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-stone-800 pb-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#16A34A] dark:text-[#9FE870]">
                100% Escrow Guarantee
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#111111] dark:text-white mt-1">
                Buyer Protection
              </h1>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                How Shop It keeps your money safe until your craft arrives · Last updated: <strong>{lastUpdated}</strong>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFF4EC] dark:bg-[#1E1B18] border-2 border-[#FF6B00] flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-[#FF6B00] shrink-0" />
              <p className="text-xs font-bold text-[#111111] dark:text-[#F4F4F5]">
                Your money is held safely until you confirm your item arrived. Never pay outside Shop It.
              </p>
            </div>

            <section className="space-y-3">
              <h2 className="text-base font-black text-[#111111] dark:text-white">How the Escrow Process Works</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-stone-900 border border-slate-200 dark:border-stone-800 space-y-1">
                  <span className="font-bold text-[#FF6B00] block text-sm">Step 1: Pay Securely</span>
                  <p className="text-slate-600 dark:text-stone-300">
                    You pay online through Flutterwave. Your money is logged in escrow protection—the seller cannot withdraw it yet.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-stone-900 border border-slate-200 dark:border-stone-800 space-y-1">
                  <span className="font-bold text-[#FF6B00] block text-sm">Step 2: Maker Delivers</span>
                  <p className="text-slate-600 dark:text-stone-300">
                    The artisan makes and packages your item, uploads proof, and delivers it to your campus spot or area.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-stone-900 border border-slate-200 dark:border-stone-800 space-y-1">
                  <span className="font-bold text-[#FF6B00] block text-sm">Step 3: You Confirm</span>
                  <p className="text-slate-600 dark:text-stone-300">
                    You inspect your item. Once you tap &quot;Item received&quot;, the funds are released to the maker.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">What is Covered</h2>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li>Items that never arrive.</li>
                <li>Items that arrive broken or damaged.</li>
                <li>Items that are significantly different from what was shown.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">How to Claim</h2>
              <p className="text-xs">
                If there is an issue with your order:
              </p>
              <ol className="list-decimal pl-5 space-y-1 text-xs">
                <li>Open your <strong>Orders</strong> tab in Shop It within <strong>3 days</strong> of delivery.</li>
                <li>Tap <strong>&quot;Report Problem&quot;</strong> on the order.</li>
                <li>Upload photos and write what went wrong.</li>
                <li>Our moderation team reviews and decides within 5 working days. If approved, you receive a 100% refund.</li>
              </ol>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">The Golden Rule</h2>
              <p className="text-xs">
                <strong>Always pay inside Shop It.</strong> If a seller asks you to pay into their personal bank account, Opay, or send airtime, refuse and report them. We cannot refund payments made outside the platform.
              </p>
            </section>
          </div>
        )}

        {/* ========================================================= */}
        {/* 7. FAQ */}
        {/* ========================================================= */}
        {currentSlug === 'faq' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-stone-800 pb-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#FF6B00]">
                Frequently Asked Questions
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#111111] dark:text-white mt-1">
                Frequently Asked Questions
              </h1>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                Real, straightforward answers in plain English · Last updated: <strong>{lastUpdated}</strong>
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  q: 'How old do I need to be to use Shop It?',
                  a: 'You must be at least 10 years old. If you are under 18, you need permission from a parent or guardian. Users under 10 are not permitted to register.',
                },
                {
                  q: 'How is the service fee worked out?',
                  a: 'Sellers set their own craft price. Shop It adds a service fee, which is calculated automatically by the website and shown clearly before you pay (Item Price + Service Fee + Delivery Fee = Total). We do not have a single fixed fee amount. A fee change never affects an order you have already paid for.',
                },
                {
                  q: 'Do you collect my phone number?',
                  a: 'No. Shop It uses email only. You sign up, log in, and verify all actions with 6-digit codes sent to your inbox. No phone numbers are collected.',
                },
                {
                  q: 'How does escrow keep my money safe?',
                  a: 'When you make a payment via Flutterwave, your order funds remain in escrow hold inside the platform ledger until you receive your order and tap "Item received" in the app.',
                },
                {
                  q: 'What happens if I forget to tap "Item received" or the seller never ships?',
                  a: 'Once the seller marks your order shipped or delivered and 5 days pass after payment with no open dispute, the escrow automatically releases to the seller. If a paid order is never marked shipped, we remind the seller at day 3, and at day 5 we automatically cancel and issue a 100% refund to you (unless there is an open dispute or an admin hold).',
                },
                {
                  q: 'How do I get verified as a seller?',
                  a: 'To sell and withdraw money, go to your seller profile and upload your National Identification Number (NIN), a photo of your ID slip or card, and a live selfie. Sellers under 18 also provide parent/guardian details.',
                },
                {
                  q: 'What happens to my ID photo and selfie after verification?',
                  a: 'Your ID photo and selfie are permanently deleted immediately after the admin verification decision. Only the last 4 NIN digits, a cryptographic hash, the decision, and the review date are kept.',
                },
                {
                  q: 'How do sellers withdraw their earnings?',
                  a: 'Sellers withdraw from their Available balance directly to any supported Nigerian bank account. The minimum withdrawal is ₦1,000, confirmed by an email code (₦0 transfer fee). For sellers under 18, the bank account must belong to the verified parent/guardian, requires a one-time Admin approval, and has a ₦25,000 daily withdrawal cap.',
                },
                {
                  q: 'Why is there a 24-hour wait on a new payout account?',
                  a: 'For your security, when you add or change a payout account, you must wait 24 hours before you can withdraw to it. This stops hackers from draining funds if your account is ever compromised.',
                },
                {
                  q: 'How long do I have to report a problem with an order?',
                  a: 'You have 3 days after the item is marked delivered to tap "Report Problem" and upload evidence in the app.',
                },
                {
                  q: 'Why are phone numbers and digits blocked in chat?',
                  a: 'All transactions must stay inside Shop It so escrow protection can protect you. Blocking phone numbers, number words, and contact links prevents off-platform scammers.',
                },
                {
                  q: 'How do I delete my account and data?',
                  a: 'You can request account deletion by emailing support at shopitverified@gmail.com. We complete account and data deletion within 14 days in compliance with the Nigeria Data Protection Act 2023 (NDPA).',
                },
                {
                  q: 'Is Shop It a registered company?',
                  a: 'Shop It is operated by TEEDS, an emerging student enterprise. TEEDS is not yet a registered company, and we do not claim any CAC registration.',
                },
                {
                  q: 'How fast does customer support respond?',
                  a: 'Our support team replies to all emails sent to shopitverified@gmail.com within 3 working days.',
                },
              ].map((item, idx) => {
                const isOpen = expandedFaq === idx;
                return (
                  <div
                    key={idx}
                    className="border border-slate-200 dark:border-stone-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-stone-900 transition-colors"
                  >
                    <button
                      onClick={() => setExpandedFaq(isOpen ? null : idx)}
                      className="w-full p-4 text-left font-bold text-xs sm:text-sm text-[#111111] dark:text-white flex items-center justify-between gap-3"
                    >
                      <span>{item.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-[#FF6B00] shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 text-xs text-slate-600 dark:text-stone-300 border-t border-slate-200 dark:border-stone-800/60 leading-relaxed">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 8. CONTACT PAGE */}
        {/* ========================================================= */}
        {currentSlug === 'contact' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-stone-800 pb-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#FF6B00]">
                We Are Here to Help
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#111111] dark:text-white mt-1">
                Contact Shop It Support
              </h1>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                Last updated: <strong>{lastUpdated}</strong> · Official Support Channel
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Left Column: Direct Info */}
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-stone-900 border border-slate-200 dark:border-stone-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#FF6B00]" />
                    <span className="font-bold text-xs text-[#111111] dark:text-white">Official Support Email</span>
                  </div>
                  <a
                    href="mailto:shopitverified@gmail.com"
                    className="text-sm sm:text-base font-black text-[#FF6B00] hover:underline block"
                  >
                    shopitverified@gmail.com
                  </a>
                  <p className="text-xs text-slate-500 dark:text-stone-400 flex items-center gap-1.5 pt-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Response time: <strong>We reply within 3 working days.</strong></span>
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-stone-900 border border-slate-200 dark:border-stone-800 space-y-2 text-xs">
                  <span className="font-bold text-[#111111] dark:text-white block">Operator Details</span>
                  <p>
                    <strong>Operator:</strong> TEEDS (Independent Student Venture)
                  </p>
                  <p>
                    <strong>Status:</strong> Not yet registered with CAC. Never claim CAC registration.
                  </p>
                  <p>
                    <strong>Jurisdiction:</strong> Federal Republic of Nigeria (disputes handled in Nigerian courts).
                  </p>
                  <p>
                    <strong>Privacy Compliance:</strong> Nigeria Data Protection Act 2023 (NDPA).
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <strong>Security Reminder:</strong> Shop It will never ask you for your account password or email verification codes. Never share your 6-digit codes with anyone.
                </div>
              </div>

              {/* Right Column: Contact Message Form */}
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-stone-900 border-2 border-slate-200 dark:border-stone-800 space-y-4">
                <h3 className="font-bold text-sm text-[#111111] dark:text-white">Send Us a Direct Message</h3>

                {contactSubmitted ? (
                  <div className="text-center py-8 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h4 className="font-black text-sm text-[#111111] dark:text-white">Message Received!</h4>
                    <p className="text-xs text-slate-600 dark:text-stone-300 max-w-xs mx-auto">
                      Thank you for reaching out. A confirmation has been logged, and our support team will reply to <strong>{contactEmail}</strong> within 3 working days.
                    </p>
                    <button
                      onClick={() => {
                        setContactSubmitted(false);
                        setContactMessage('');
                      }}
                      className="text-xs text-[#FF6B00] font-bold hover:underline pt-2 block mx-auto"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-3.5 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-stone-300 block mb-1">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={contactName}
                        onChange={e => setContactName(e.target.value)}
                        placeholder="e.g. Tobi Alabi"
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-stone-700 bg-white dark:bg-[#15161C] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 dark:text-stone-300 block mb-1">
                        Your Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={contactEmail}
                        onChange={e => setContactEmail(e.target.value)}
                        placeholder="e.g. tobi@gmail.com"
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-stone-700 bg-white dark:bg-[#15161C] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 dark:text-stone-300 block mb-1">
                        What Do You Need Help With? *
                      </label>
                      <select
                        value={contactCategory}
                        onChange={e => setContactCategory(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-stone-700 bg-white dark:bg-[#15161C] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                      >
                        <option value="General Question">General Question</option>
                        <option value="Order & Escrow Support">Order &amp; Escrow Support</option>
                        <option value="Seller Verification & KYC">Seller Verification &amp; KYC</option>
                        <option value="NDPA Data Deletion Request">NDPA Data Deletion Request (14 Days)</option>
                        <option value="Report Scam or Off-Platform Bypass">Report Scam or Off-Platform Bypass</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 dark:text-stone-300 block mb-1">
                        Message Details *
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={contactMessage}
                        onChange={e => setContactMessage(e.target.value)}
                        placeholder="Please describe your question or issue clearly..."
                        className="w-full p-3 rounded-xl border border-slate-300 dark:border-stone-700 bg-white dark:bg-[#15161C] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00] resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingContact}
                      className="w-full h-11 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] font-black rounded-xl text-xs flex items-center justify-center gap-2 border-2 border-[#111111] shadow-[0_2px_0_#111111] active:translate-y-0.5 transition-all disabled:opacity-60"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmittingContact ? 'Sending Message...' : 'Send Message to Support'}</span>
                    </button>
                    <span className="text-[10px] text-slate-500 block text-center">
                      Guaranteed response within 3 working days to your email.
                    </span>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
