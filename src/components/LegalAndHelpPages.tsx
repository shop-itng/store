import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { OPERATOR_INFO, getLegalAndHelpCopy } from '../../shared/trustAndLegalCopy';
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
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Send,
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
  return 'https://shopitng.vercel.app';
}

export const LegalAndHelpPages: React.FC<LegalPagesProps> = ({ initialSlug = 'terms' }) => {
  const { activeView, setActiveView, notify, paymentsEnabled } = useApp();
  const legalCopy = getLegalAndHelpCopy(paymentsEnabled);
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
  const lastUpdated = legalCopy.lastUpdated;

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
      notify(`Message sent! ${OPERATOR_INFO.supportSlaLine}`, 'success');
    } catch (err: any) {
      setIsSubmittingContact(false);
      setContactSubmitted(false);
      notify(err?.message || `Unable to send message right now. Please email ${OPERATOR_INFO.supportEmail}.`, 'error');
    }
  };

  const navLinks: { slug: LegalPageSlug; label: string; icon: any }[] = [
    { slug: 'terms', label: 'Terms of Service', icon: FileText },
    { slug: 'privacy', label: 'Privacy Policy', icon: Lock },
    { slug: 'refunds', label: 'Refunds & Disputes', icon: ShieldCheck },
    { slug: 'prohibited-items', label: 'Prohibited Items', icon: AlertTriangle },
    { slug: 'seller-guide', label: 'Seller Guide', icon: Store },
    { slug: 'buyer-protection', label: legalCopy.buyerProtection.title, icon: ShoppingBag },
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
                {legalCopy.terms.eyebrow}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#111111] dark:text-white mt-1">
                {legalCopy.terms.title}
              </h1>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                Last updated: <strong>{lastUpdated}</strong> · Website: <strong>{siteUrl}</strong>
              </p>
            </div>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">1. Who We Are</h2>
              {legalCopy.terms.whoWeAreParagraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
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
                <strong>Sellers must:</strong> List items honestly, provide real photos, state accurate descriptions, pack items securely, upload a packing photo when dispatching orders, and ship within reasonable time.
              </p>
              <p>
                <strong>Buyers must:</strong> {legalCopy.terms.buyerDuty}
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">5. Pricing, Service Fees, and Delivery</h2>
              {legalCopy.terms.pricingParagraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">
                {legalCopy.terms.paymentHandlingTitle}
              </h2>
              {legalCopy.terms.paymentHandlingParagraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">7. Seller Wallets and Withdrawals</h2>
              {legalCopy.terms.walletParagraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">8. Seller Verification (KYC)</h2>
              <p>
                To sell products and withdraw earnings, sellers must complete identity verification. This requires submitting a National Identification Number (NIN), a photo of your valid ID slip/card, and a live selfie.
              </p>
              <p>
                If the seller is under 18, a parent or guardian must provide consent and their verified ID, and any withdrawals must go to a bank account belonging to that parent/guardian after a one-time Admin approval (capped at ₦25,000 per day).
              </p>
              <p>
                Your ID photos and selfie are permanently deleted immediately after the admin verification decision. We retain only the last 4 digits of the NIN, a cryptographic hash, the decision status, and the review date.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">9. Banned Behaviour and Chat Rules</h2>
              <p>{legalCopy.terms.bannedRuleParagraph}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">10. Suspension and Account Closure</h2>
              <p>
                We may suspend or delete accounts that commit fraud, attempt off-platform payment bypass, harass other users, sell banned items, or break Nigerian law.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">11. Limits of Liability</h2>
              <p>{legalCopy.terms.liabilityParagraph}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">12. Governing Law and Disputes</h2>
              <p>
                These terms are governed by the laws of the Federal Republic of Nigeria. Any dispute that cannot be resolved through our support team will be handled by the courts of Nigeria.
              </p>
            </section>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-stone-900 border border-slate-200 dark:border-stone-800 text-xs">
              <strong>Need help or have questions?</strong> Email us at <strong>{OPERATOR_INFO.supportEmail}</strong>. {OPERATOR_INFO.supportSlaLine}
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
                {legalCopy.privacy.eyebrow}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#111111] dark:text-white mt-1">
                Privacy Policy
              </h1>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                Last updated: <strong>{lastUpdated}</strong> · {legalCopy.privacy.subtitleSuffix}
              </p>
            </div>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">1. Our Privacy Practices</h2>
              <p>{legalCopy.privacy.intro}</p>
              <p>
                This notice explains what information we collect, why we need it, how long we keep it, and how to contact us about your data.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">2. What We Collect</h2>
              <p>We collect the minimum information needed to run the marketplace:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Account details:</strong> Your email address, display name, and hashed password.</li>
                <li><strong>Location area:</strong> Your campus, town, or local government area to show relevant items and delivery options.</li>
                <li><strong>Order &amp; transaction records:</strong> What you listed, ordered, order reference numbers, and timestamps.</li>
                <li><strong>In-app chat messages:</strong> Messages sent between buyers and sellers inside Shop It.</li>
                <li><strong>Seller verification data:</strong> National Identification Number (NIN), ID slip/card photo, live selfie, and parent/guardian consent details for sellers under 18.</li>
              </ul>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200">
                <strong>What we do NOT collect:</strong> We do not collect your phone number, and we do not store debit card numbers, CVV codes, or banking PINs on Shop It servers.
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">3. Who Sees Your Information</h2>
              <p>
                <strong>Between users:</strong> Members see each other&apos;s public display name, avatar, campus/area (subject to your privacy settings), and shop profile. Your email address is never shown publicly.
              </p>
              <p>
                <strong>Delivery information:</strong> Your pickup landmark or delivery area is shared only with the seller or courier handling your order.
              </p>
              <p>
                <strong>Admin access:</strong> Verification records are accessible only to authorized Shop It administrators to review disputes, prevent fraud, or respond to lawful requests.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">4. Third-Party Infrastructure Providers</h2>
              <p>We use infrastructure providers to host and operate Shop It:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Vercel:</strong> Web hosting and serverless application runtime.</li>
                <li><strong>Neon:</strong> Cloud database storage.</li>
                <li><strong>Upstash:</strong> Rate limiting and temporary security state.</li>
                <li><strong>Brevo:</strong> Transactional email dispatch for verification codes and order notices.</li>
                <li><strong>{legalCopy.privacy.providersBulletPayment}</strong></li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">5. How Long We Keep Your Data</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>ID photos and live selfies:</strong> Permanently deleted immediately after your verification decision is completed. Only the last 4 NIN digits, a cryptographic hash, the decision, and the date are kept.
                </li>
                <li>
                  <strong>Full NIN:</strong> Your full NIN is never displayed publicly and is processed only for identity verification.
                </li>
                <li>
                  <strong>Account information:</strong> Kept while your account is active. When you request account deletion, your profile, listings, and personal details are removed within <strong>14 days</strong>, except records required for financial audit or legal obligations.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">6. Children and Teen Data</h2>
              <p>
                Shop It is built for youth aged <strong>10 and older</strong>. We do not knowingly allow anyone under 10 to register.
              </p>
              <p>
                For users under 18, parent or guardian consent is required. Parents can request access to or deletion of their child&apos;s data at any time by contacting our support email.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">7. Your Data Requests</h2>
              <p>You can ask us to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Access:</strong> Download a JSON copy of your profile and account data from Account Settings.</li>
                <li><strong>Correction:</strong> Update or fix inaccurate profile details.</li>
                <li><strong>Deletion:</strong> Delete your account in Account Settings or email us (processed within 14 days).</li>
                <li><strong>Lodge a Complaint:</strong> Contact us first, or reach the Nigeria Data Protection Commission (NDPC) regarding data concerns.</li>
              </ul>
              <p>
                To submit a request, email <strong>{OPERATOR_INFO.supportEmail}</strong>.
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
                {legalCopy.refunds.eyebrow}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#111111] dark:text-white mt-1">
                Refund and Dispute Policy
              </h1>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                Last updated: <strong>{lastUpdated}</strong>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFF4EC] dark:bg-[#1E1B18] border border-[#FF6B00] text-xs font-semibold text-[#111111] dark:text-[#F4F4F5]">
              {legalCopy.refunds.bodyBanner}
            </div>

            {paymentsEnabled ? (
              <>
                <section className="space-y-2">
                  <h2 className="text-base font-black text-[#111111] dark:text-white">1. When You Can Request a Refund</h2>
                  <p>You can request a refund for a Shop It checkout order if:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Your item never arrived:</strong> The seller did not deliver your order.</li>
                    <li><strong>Item not as described:</strong> The item you received differs clearly in material, color, size, or quality from the listing photos.</li>
                    <li><strong>Item arrived damaged:</strong> The item arrived broken or damaged during transit.</li>
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
                  <h2 className="text-base font-black text-[#111111] dark:text-white">3. Evidence to Upload</h2>
                  <p>To help moderation review your dispute fairly, please upload:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Clear photos of the package and item received.</li>
                    <li>A short explanation of what is wrong.</li>
                  </ul>
                  <p>
                    Sellers may also provide their packing photo and dispatch proof for review.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-base font-black text-[#111111] dark:text-white">4. How Disputes Are Reviewed</h2>
                  <p>
                    Our moderation team reviews evidence from both buyer and seller within <strong>5 working days</strong>.
                  </p>
                  <p>
                    While a dispute is open, held order funds do not release to the seller. Depending on the review outcome, moderation may refund the buyer in full, split partially, or release the order amount to the seller.
                  </p>
                </section>
              </>
            ) : (
              <section className="space-y-2">
                <h2 className="text-base font-black text-[#111111] dark:text-white">How Ordering Works While Online Payments Are Off</h2>
                <p>
                  Online payments are currently turned off on Shop It. Buyers and sellers arrange directly with each other via Shop It chat, meet at public campus pickup spots, and inspect items carefully before completing a purchase.
                </p>
                <p>
                  You can report suspicious listings, harassment, or policy violations anytime using the Report button on any listing or conversation.
                </p>
              </section>
            )}

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">Important Notes</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Custom-made items:</strong> Change of mind on personalized or custom-beaded items is not covered once production matches your request.</li>
                <li><strong>Platform boundaries:</strong> {legalCopy.refunds.offPlatformRule}</li>
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
                Marketplace Rules
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#111111] dark:text-white mt-1">
                Prohibited Items Policy
              </h1>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                Last updated: <strong>{lastUpdated}</strong>
              </p>
            </div>

            <p>{legalCopy.prohibited.intro}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1.5">
                <h3 className="font-bold text-rose-900 dark:text-rose-200 text-xs">Illegal &amp; Hazardous Goods</h3>
                <p className="text-xs text-rose-800 dark:text-rose-300">
                  Any product that breaks the laws of Nigeria, including weapons, knives, ammunition, explosives, fireworks, or hazardous chemicals.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1.5">
                <h3 className="font-bold text-rose-900 dark:text-rose-200 text-xs">Counterfeit &amp; Replica Goods</h3>
                <p className="text-xs text-rose-800 dark:text-rose-300">
                  Knock-off designer wear, replica shoes, fake branded perfumes, unauthorized logos, or pirated media.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1.5">
                <h3 className="font-bold text-rose-900 dark:text-rose-200 text-xs">Adult &amp; Explicit Content</h3>
                <p className="text-xs text-rose-800 dark:text-rose-300">
                  Pornography, adult items, sexual services, or sexually explicit material. Shop It is a youth marketplace with members starting at age 10.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1.5">
                <h3 className="font-bold text-rose-900 dark:text-rose-200 text-xs">Drugs, Alcohol &amp; Medicines</h3>
                <p className="text-xs text-rose-800 dark:text-rose-300">
                  Illegal drugs, prescription medicines, cannabis, tobacco, cigarettes, vapes, and alcoholic drinks.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1.5">
                <h3 className="font-bold text-rose-900 dark:text-rose-200 text-xs">Stolen Property</h3>
                <p className="text-xs text-rose-800 dark:text-rose-300">
                  Goods you do not own or have authorization to sell, including stolen phones, gadgets, or campus property.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1.5">
                <h3 className="font-bold text-rose-900 dark:text-rose-200 text-xs">Contact Details in Listings</h3>
                <p className="text-xs text-rose-800 dark:text-rose-300">
                  Phone numbers, WhatsApp links, social media handles, email addresses, or external payment links in titles, descriptions, or listing photos.
                </p>
              </div>
            </div>

            <section className="space-y-2 pt-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">Listing Review &amp; Removal</h2>
              <p>
                Listings on Shop It may be reviewed by moderation. Items violating these rules are removed, and repeat violators face account suspension or termination.
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
                Simple advice for young makers and students · Last updated: <strong>{lastUpdated}</strong>
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
                    Snap photos in bright natural daylight showing the real handmade item you crafted. Avoid stock photos from the internet.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <span className="w-8 h-8 rounded-xl bg-[#111111] text-[#9FE870] font-black flex items-center justify-center shrink-0 text-sm">
                  2
                </span>
                <div className="space-y-1">
                  <h3 className="font-bold text-[#111111] dark:text-white text-base">Price Your Item Fairly</h3>
                  <p className="text-xs">{legalCopy.sellerGuide.priceDesc}</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <span className="w-8 h-8 rounded-xl bg-[#111111] text-[#9FE870] font-black flex items-center justify-center shrink-0 text-sm">
                  3
                </span>
                <div className="space-y-1">
                  <h3 className="font-bold text-[#111111] dark:text-white text-base">Pack Carefully</h3>
                  <p className="text-xs">
                    Wrap beads, bottles, or crochet items in clean pouches or protective wrapping so they arrive undamaged.
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
                    When dispatching an order in the app, take a clear photo of the packed item to document condition before handover.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <span className="w-8 h-8 rounded-xl bg-[#111111] text-[#9FE870] font-black flex items-center justify-center shrink-0 text-sm">
                  5
                </span>
                <div className="space-y-1">
                  <h3 className="font-bold text-[#111111] dark:text-white text-base">Meet at Public Campus Pickup Spots</h3>
                  <p className="text-xs">
                    For campus handovers, meet in public, well-lit daytime locations such as a hall porter desk or student union building.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <span className="w-8 h-8 rounded-xl bg-[#111111] text-[#9FE870] font-black flex items-center justify-center shrink-0 text-sm">
                  6
                </span>
                <div className="space-y-1">
                  <h3 className="font-bold text-[#111111] dark:text-white text-base">{legalCopy.sellerGuide.step6Title}</h3>
                  <p className="text-xs">{legalCopy.sellerGuide.step6Desc}</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <span className="w-8 h-8 rounded-xl bg-[#111111] text-[#9FE870] font-black flex items-center justify-center shrink-0 text-sm">
                  7
                </span>
                <div className="space-y-1">
                  <h3 className="font-bold text-[#111111] dark:text-white text-base">Stay Inside Shop It Chat</h3>
                  <p className="text-xs">{legalCopy.sellerGuide.step7Desc}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 6. BUYER PROTECTION / ORDERING GUIDE */}
        {/* ========================================================= */}
        {currentSlug === 'buyer-protection' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-stone-800 pb-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#16A34A] dark:text-[#9FE870]">
                {legalCopy.buyerProtection.eyebrow}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#111111] dark:text-white mt-1">
                {legalCopy.buyerProtection.title}
              </h1>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-1">
                {legalCopy.buyerProtection.subtitle} · Last updated: <strong>{lastUpdated}</strong>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFF4EC] dark:bg-[#1E1B18] border-2 border-[#FF6B00] flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-[#FF6B00] shrink-0" />
              <p className="text-xs font-bold text-[#111111] dark:text-[#F4F4F5]">
                {legalCopy.buyerProtection.bannerText}
              </p>
            </div>

            <section className="space-y-3">
              <h2 className="text-base font-black text-[#111111] dark:text-white">
                {legalCopy.buyerProtection.processTitle}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {legalCopy.buyerProtection.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-stone-900 border border-slate-200 dark:border-stone-800 space-y-1"
                  >
                    <span className="font-bold text-[#FF6B00] block text-sm">{step.title}</span>
                    <p className="text-slate-600 dark:text-stone-300">{step.body}</p>
                  </div>
                ))}
              </div>
            </section>

            {paymentsEnabled && (
              <>
                <section className="space-y-2">
                  <h2 className="text-base font-black text-[#111111] dark:text-white">Eligible Order Issues</h2>
                  <ul className="list-disc pl-5 space-y-1 text-xs">
                    <li>Items that never arrive.</li>
                    <li>Items that arrive broken or damaged.</li>
                    <li>Items that are significantly different from what was shown.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h2 className="text-base font-black text-[#111111] dark:text-white">How to Report an Issue</h2>
                  <ol className="list-decimal pl-5 space-y-1 text-xs">
                    <li>Open your <strong>Orders</strong> tab in Shop It within <strong>3 days</strong> of delivery.</li>
                    <li>Tap <strong>&quot;Report Problem&quot;</strong> on the order.</li>
                    <li>Upload photos and describe what went wrong.</li>
                    <li>Our moderation team reviews both sides within 5 working days before any payout or refund decision.</li>
                  </ol>
                </section>
              </>
            )}

            <section className="space-y-2">
              <h2 className="text-base font-black text-[#111111] dark:text-white">Reminder</h2>
              <p className="text-xs">{legalCopy.buyerProtection.goldenRule}</p>
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
                Plain answers about how Shop It works · Last updated: <strong>{lastUpdated}</strong>
              </p>
            </div>

            <div className="space-y-3">
              {legalCopy.faqs.map((item, idx) => {
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
                Last updated: <strong>{lastUpdated}</strong> · Support Channel
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Left Column: Direct Info */}
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-stone-900 border border-slate-200 dark:border-stone-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#FF6B00]" />
                    <span className="font-bold text-xs text-[#111111] dark:text-white">Support Email</span>
                  </div>
                  <a
                    href={`mailto:${OPERATOR_INFO.supportEmail}`}
                    className="text-sm sm:text-base font-black text-[#FF6B00] hover:underline block"
                  >
                    {OPERATOR_INFO.supportEmail}
                  </a>
                  <p className="text-xs text-slate-500 dark:text-stone-400 flex items-center gap-1.5 pt-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{OPERATOR_INFO.supportSlaLine}</span>
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-stone-900 border border-slate-200 dark:border-stone-800 space-y-2 text-xs">
                  <span className="font-bold text-[#111111] dark:text-white block">Operator Details</span>
                  <p>
                    <strong>Operator:</strong> {legalCopy.contact.operatorLine}
                  </p>
                  <p>
                    <strong>Status:</strong> {legalCopy.contact.statusLine}
                  </p>
                  <p>
                    <strong>Jurisdiction:</strong> Federal Republic of Nigeria (disputes handled in Nigerian courts).
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
                      Thank you for reaching out. Our team will reply to <strong>{contactEmail}</strong> within 3 working days.
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
                        <option value={legalCopy.contact.supportOptionLabel}>{legalCopy.contact.supportOptionLabel}</option>
                        <option value="Seller Verification & KYC">Seller Verification &amp; KYC</option>
                        <option value="Data Deletion Request">Account &amp; Data Deletion Request (14 Days)</option>
                        <option value="Report Scam or Off-Platform Bypass">Report Scam or Policy Violation</option>
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
                      {legalCopy.contact.submitNote}
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

