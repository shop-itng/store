import React, { useState } from 'react';
import { Flag, X, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';

export interface ReportTarget {
  targetType: 'product' | 'seller' | 'review' | 'chat';
  targetId: string;
  targetTitle: string;
}

interface Props {
  target: ReportTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onReportSuccess?: () => void;
}

export const ReportModal: React.FC<Props> = ({
  target,
  isOpen,
  onClose,
  onReportSuccess,
}) => {
  const [reason, setReason] = useState('Prohibited item or counterfeit');
  const [details, setDetails] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !target) return null;

  const REASONS_MAP: Record<string, string[]> = {
    product: [
      'Prohibited item or counterfeit',
      'Misleading description or inaccurate photos',
      'Suspiciously low price / possible scam',
      'Hazardous or dangerous material',
      'Off-platform payment requested',
    ],
    seller: [
      'Suspected scammer or fraudulent shop',
      'Impersonating another artisan or brand',
      'Demanding direct bank transfer outside Shop It',
      'Refusing to ship after receiving order',
      'Harassment or abusive conduct',
    ],
    review: [
      'Fake or manipulated review',
      'Offensive or abusive language',
      'Extortion or blackmailed rating',
      'Contains private phone number or address',
    ],
    chat: [
      'Soliciting off-platform payment (anti-bypass)',
      'Threatening, aggressive or unsafe messages',
      'Sharing contact numbers to evade escrow',
      'Spam or advertising unrelated links',
    ],
  };

  const currentReasons = REASONS_MAP[target.targetType] || REASONS_MAP.product;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: target.targetType,
          targetId: target.targetId,
          targetTitle: target.targetTitle,
          reporterEmail: reporterEmail.trim() || undefined,
          reason,
          details,
        }),
      });

      const data = await res.json();
      if (data.status) {
        setIsSubmitted(true);
        setTimeout(() => {
          setIsSubmitted(false);
          setDetails('');
          onReportSuccess?.();
          onClose();
        }, 1800);
      } else {
        setErrorMsg(data.message || 'Failed to submit report. Please try again.');
      }
    } catch {
      setErrorMsg('Network error submitting report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-backdrop">
      <div className="bg-white dark:bg-[#15161C] rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl relative my-6 border-2 border-[#111111] dark:border-[#27272A] transition-colors animate-modal-enter">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272A] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center border border-rose-200 dark:border-rose-800">
              <Flag className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white capitalize">
                Report {target.targetType}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-stone-400">
                Help keep the youth marketplace honest & safe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-stone-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Report Submitted</h3>
            <p className="text-xs text-slate-500 dark:text-stone-400 max-w-xs mx-auto">
              Our safety and moderation team has been notified. Thank you for protecting the community.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Target Card */}
            <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wide block">
                Flagging:
              </span>
              <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                {target.targetTitle}
              </p>
            </div>

            {/* Reason selector */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                Reason for report:
              </label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full p-2.5 rounded-xl border-2 border-slate-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-900 dark:text-white font-medium focus:border-[#FF6B00] outline-hidden text-xs"
              >
                {currentReasons.map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Details */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                Specific details or context:
              </label>
              <textarea
                rows={3}
                required
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder="Describe what occurred or why this is suspicious..."
                className="w-full p-2.5 rounded-xl border-2 border-slate-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-900 dark:text-white focus:border-[#FF6B00] outline-hidden text-xs"
              />
            </div>

            {/* Optional Email */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                Your email (optional, for follow-up):
              </label>
              <input
                type="email"
                value={reporterEmail}
                onChange={e => setReporterEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full p-2.5 rounded-xl border-2 border-slate-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-900 dark:text-white focus:border-[#FF6B00] outline-hidden text-xs"
              />
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-stone-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !details.trim()}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black rounded-xl transition-all shadow-md active:translate-y-0.5 flex items-center gap-1.5"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Report'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
