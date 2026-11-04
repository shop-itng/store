import React, { useState } from 'react';
import { Share2, Copy, Check, MessageCircle, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { formatNaira } from '../utils/pricing';

interface Props {
  title: string;
  price?: number;
  sellerShopName?: string;
  campus?: string;
  imageUrl?: string;
  url?: string;
}

export const ShareButtons: React.FC<Props> = ({
  title,
  price,
  sellerShopName,
  campus,
  imageUrl,
  url,
}) => {
  const [copied, setCopied] = useState(false);
  const [showStatusPreview, setShowStatusPreview] = useState(false);

  const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : 'https://shop-itng-pied.vercel.app');
  const priceText = price !== undefined ? `for ${formatNaira(price)}` : '';
  const sellerText = sellerShopName ? `by ${sellerShopName}` : '';
  const campusText = campus ? `at ${campus}` : '';

  const shareMessage = `Check out "${title}" ${priceText} ${sellerText} ${campusText} on Shop It! Safe escrow payments & campus delivery: ${currentUrl}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(currentUrl);
      } else {
        const input = document.createElement('input');
        input.value = currentUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* WhatsApp Share Button */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs active:translate-y-0.5"
        >
          <MessageCircle className="w-4 h-4 fill-white" />
          <span>Share to WhatsApp</span>
        </a>

        {/* Copy Link Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-stone-200 dark:border-stone-700"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Link Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Link</span>
            </>
          )}
        </button>

        {/* Status / Story Image Preview Button */}
        <button
          type="button"
          onClick={() => setShowStatusPreview(!showStatusPreview)}
          className="px-3 py-2 bg-stone-50 hover:bg-stone-100 dark:bg-stone-900 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-stone-200 dark:border-stone-800"
        >
          <ImageIcon className="w-3.5 h-3.5 text-[#FF6B00]" />
          <span>{showStatusPreview ? 'Hide Card Preview' : 'Status Preview Card'}</span>
        </button>
      </div>

      {/* Social / WhatsApp Status Preview Card */}
      {showStatusPreview && (
        <div className="p-4 bg-stone-900 text-white rounded-2xl border-2 border-[#111111] space-y-3 shadow-lg max-w-sm animate-fade-in-up">
          <div className="flex items-center justify-between text-[11px] text-stone-400">
            <span>WhatsApp Status & Story Card Preview</span>
            <span className="text-[#9FE870] font-black uppercase tracking-wider text-[10px]">Shop It Live</span>
          </div>

          <div className="relative rounded-xl overflow-hidden aspect-4/3 bg-stone-800 border border-stone-700 flex items-center justify-center">
            {imageUrl ? (
              <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
            ) : (
              <div className="text-stone-500 text-xs">Marketplace Item</div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3 text-left">
              <span className="text-[10px] text-[#9FE870] font-black uppercase tracking-wider bg-black/60 px-2 py-0.5 rounded w-max border border-stone-700">
                Escrow Protected
              </span>
              <h4 className="text-sm font-black text-white mt-1 leading-snug line-clamp-1">{title}</h4>
              <div className="flex items-center justify-between mt-1 text-xs">
                {price !== undefined && (
                  <span className="font-black text-[#9FE870] font-mono-numbers">{formatNaira(price)}</span>
                )}
                {campus && <span className="text-stone-300 text-[11px]">{campus}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1 border-t border-stone-800">
            <span>shop-itng-pied.vercel.app</span>
            <span className="text-white font-bold">Safe Youth Commerce</span>
          </div>
        </div>
      )}
    </div>
  );
};
