import React from 'react';
import { CheckCircle2, Circle, ArrowRight, ShieldCheck, CreditCard, PlusCircle, MapPin, Sparkles } from 'lucide-react';
import { SellerProfile, SellerWallet } from '../types';

interface Props {
  seller: SellerProfile;
  wallet?: SellerWallet;
  productCount: number;
  onOpenVerification: () => void;
  onOpenAddProduct: () => void;
  onOpenWallet: () => void;
}

export const SellerOnboardingChecklist: React.FC<Props> = ({
  seller,
  wallet,
  productCount,
  onOpenVerification,
  onOpenAddProduct,
  onOpenWallet,
}) => {
  const isIdentityVerified = seller.isVerifiedSeller || seller.verificationStatus === 'verified';
  const hasPayoutAccount = Boolean(wallet?.payoutAccounts && wallet.payoutAccounts.length > 0);
  const hasListedProduct = productCount > 0;
  const hasSetDelivery = Boolean(seller.campus || seller.locationArea || seller.location?.area);

  const steps = [
    {
      id: 'verify_id',
      label: 'Verify your identity (NIN Slip)',
      desc: 'Get your Verified Maker badge and unlock full buyer trust',
      done: isIdentityVerified,
      action: onOpenVerification,
      actionText: isIdentityVerified ? 'Verified' : 'Verify NIN',
      icon: ShieldCheck,
    },
    {
      id: 'payout_account',
      label: 'Add your bank or payout account',
      desc: 'Where you receive escrow payments after delivery',
      done: hasPayoutAccount,
      action: onOpenWallet,
      actionText: hasPayoutAccount ? 'Account Added' : 'Add Bank',
      icon: CreditCard,
    },
    {
      id: 'first_product',
      label: 'List your first handmade item',
      desc: 'Takes 60 seconds with photo, price, and campus delivery',
      done: hasListedProduct,
      action: onOpenAddProduct,
      actionText: hasListedProduct ? 'Listed' : 'List Item',
      icon: PlusCircle,
    },
    {
      id: 'delivery_area',
      label: 'Set your campus & pickup area',
      desc: 'Students near you can order with safe campus handoff',
      done: hasSetDelivery,
      action: onOpenVerification,
      actionText: hasSetDelivery ? 'Location Set' : 'Set Area',
      icon: MapPin,
    },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const isAllComplete = completedCount === steps.length;

  // Auto-hides when complete!
  if (isAllComplete) return null;

  return (
    <div className="bg-white dark:bg-[#15161C] border-2 border-[#111111] dark:border-[#27272A] rounded-2xl p-4 sm:p-5 shadow-[0_3px_0_#111111] dark:shadow-none space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#FFF4EC] dark:bg-stone-800 text-[#FF6B00] border border-[#FF6B00]/40 flex items-center justify-center font-black">
            <Sparkles className="w-4 h-4 text-[#FF6B00]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Seller Quick Start Checklist
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-stone-400">
              Complete these {steps.length} steps to launch your youth artisan shop
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-32 bg-stone-100 dark:bg-stone-800 rounded-full h-2 overflow-hidden border border-stone-200 dark:border-stone-700">
            <div
              className="bg-[#9FE870] h-full transition-all duration-300"
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
            {completedCount}/{steps.length}
          </span>
        </div>
      </div>

      {/* Checklist items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {steps.map(step => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-2.5 ${
                step.done
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/40'
                  : 'bg-stone-50/70 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800 hover:border-[#FF6B00]/40'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {step.done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300 dark:text-stone-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4
                    className={`text-xs font-bold ${
                      step.done
                        ? 'text-emerald-950 dark:text-emerald-200 line-through opacity-80'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {step.label}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-stone-400 mt-0.5">
                    {step.desc}
                  </p>
                </div>
              </div>

              {!step.done && (
                <button
                  type="button"
                  onClick={step.action}
                  className="px-2.5 py-1 text-[11px] font-black rounded-lg bg-[#111111] hover:bg-[#FF6B00] text-white hover:text-[#111111] transition-all shrink-0 flex items-center gap-1 shadow-xs"
                >
                  <span>{step.actionText}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
