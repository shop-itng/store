import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle, X, ShieldAlert, Upload, CheckCircle2, Lock } from 'lucide-react';

export const ReportProblemModal: React.FC = () => {
  const {
    isReportProblemModalOpen,
    closeReportProblemModal,
    activeReportOrderId,
    orders,
    openDispute,
    notify,
  } = useApp();

  const [reasonCategory, setReasonCategory] = useState<string>('damaged_in_transit');
  const [description, setDescription] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState<'refund' | 'replacement'>('refund');
  const [evidencePhoto, setEvidencePhoto] = useState<string>('');
  const [evidenceFileName, setEvidenceFileName] = useState<string>('');

  if (!isReportProblemModalOpen || !activeReportOrderId) return null;

  const order = orders.find(o => o.id === activeReportOrderId);
  if (!order) return null;

  const handleEvidenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Please select a valid image file (PNG, JPG, WEBP).', 'error');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      notify('Evidence photo must be under 3MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      if (typeof ev.target?.result === 'string') {
        setEvidencePhoto(ev.target.result);
        setEvidenceFileName(file.name);
        notify('Evidence photo attached to dispute.', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    const fullReason = `[${reasonCategory.toUpperCase()}] ${description.trim()} (Desired outcome: ${desiredOutcome})`;
    openDispute(order.id, fullReason, evidencePhoto || undefined);
    closeReportProblemModal();
    setDescription('');
    setEvidencePhoto('');
    setEvidenceFileName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-backdrop">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] animate-modal-enter">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#0c0d10] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-heading leading-tight text-white">
                Open Escrow Dispute
              </h3>
              <p className="text-xs text-stone-300">
                Order #{order.id} · ₦{order.grandTotal.toLocaleString()}
              </p>
            </div>
          </div>
          <button
            onClick={closeReportProblemModal}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Protection Banner */}
        <div className="px-4 py-2.5 bg-[#ecf5f0] border-b border-[#bce0cc] flex items-center gap-2 text-xs text-[#123524] font-medium">
          <Lock className="w-4 h-4 text-[#123524] shrink-0" />
          <span>
            Escrow protection active: Funds are frozen immediately and will not be released to the seller until Admin Support resolves this dispute.
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* Reason Category */}
          <div>
            <label className="block font-semibold text-stone-900 mb-1.5">
              What is the issue with your order?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: 'damaged_in_transit', label: 'Damaged in transit' },
                { id: 'wrong_color_size', label: 'Wrong color, bead, or size' },
                { id: 'not_as_described', label: 'Item not as described' },
                { id: 'never_arrived', label: 'Package never arrived at pickup' },
              ].map(opt => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setReasonCategory(opt.id)}
                  className={`p-3 rounded-xl text-left border transition-all flex items-center justify-between ${
                    reasonCategory === opt.id
                      ? 'border-[#f95700] bg-[#fff2ea] text-stone-900 font-semibold'
                      : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                  }`}
                >
                  <span className="text-xs">{opt.label}</span>
                  {reasonCategory === opt.id && (
                    <CheckCircle2 className="w-4 h-4 text-[#f95700] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-stone-900 mb-1.5">
              Describe the issue in detail
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. When I picked up the beaded bag, one strap was torn and colors do not match..."
              className="w-full p-3 rounded-xl border border-stone-200 focus:outline-none focus:border-[#f95700] focus:ring-1 focus:ring-[#f95700] text-xs sm:text-sm resize-none bg-stone-50/50"
            />
          </div>

          {/* Evidence photo upload */}
          <div>
            <label className="block font-semibold text-stone-900 mb-1.5">
              Evidence Photo (Admin inspects this against seller packed photo)
            </label>
            <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-dashed border-stone-300">
              {evidencePhoto ? (
                <img
                  src={evidencePhoto}
                  alt="Evidence preview"
                  className="w-16 h-16 rounded-lg object-cover border border-stone-200 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-stone-200/70 flex items-center justify-center text-stone-500 shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
              )}
              <div className="flex-1 text-xs text-stone-600">
                <p className="font-semibold text-stone-800">
                  {evidenceFileName || 'Upload photo of package or item issue (optional)'}
                </p>
                <label className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1 bg-white border border-stone-300 rounded-lg font-bold text-stone-800 hover:bg-stone-100 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{evidencePhoto ? 'Replace Photo' : 'Choose Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEvidenceFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Desired Outcome */}
          <div>
            <label className="block font-semibold text-stone-900 mb-1.5">
              Desired Resolution
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm text-stone-800">
                <input
                  type="radio"
                  name="outcome"
                  checked={desiredOutcome === 'refund'}
                  onChange={() => setDesiredOutcome('refund')}
                  className="accent-[#f95700]"
                />
                <span>Full Escrow Refund (₦{order.grandTotal.toLocaleString()})</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm text-stone-800">
                <input
                  type="radio"
                  name="outcome"
                  checked={desiredOutcome === 'replacement'}
                  onChange={() => setDesiredOutcome('replacement')}
                  className="accent-[#f95700]"
                />
                <span>Seller Remake / Exchange</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeReportProblemModal}
              className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-semibold hover:bg-stone-50 text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!description.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#f95700] hover:bg-[#e04b00] text-white font-semibold text-xs transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
            >
              Submit & Freeze Escrow
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
