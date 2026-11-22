import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface ProfileQrCodeProps {
  url: string;
  label: string;
  slug: string;
  compact?: boolean;
}

export const ProfileQrCode: React.FC<ProfileQrCodeProps> = ({
  url,
  label,
  slug,
  compact = false,
}) => {
  const { notify } = useApp();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrError, setQrError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setQrError(false);
    QRCode.toDataURL(url, {
      width: 240,
      margin: 2,
      color: { dark: '#111111', light: '#FFFFFF' },
    })
      .then(dataUrl => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      notify('Profile link copied!', 'success');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notify('Could not copy link automatically. Please copy it manually.', 'error');
    }
  };

  const safeSlug = (slug || 'profile').replace(/[^a-z0-9-_]/gi, '-').toLowerCase();

  return (
    <div className={`flex ${compact ? 'flex-col sm:flex-row items-center gap-4' : 'flex-col items-center text-center gap-3'}`}>
      <div className="p-2.5 bg-white rounded-xl border border-[#E4E4E7] inline-flex items-center justify-center shrink-0">
        {qrDataUrl && !qrError ? (
          <img
            src={qrDataUrl}
            alt={`QR code for ${label}`}
            className={compact ? 'w-32 h-32 object-contain' : 'w-44 h-44 object-contain'}
          />
        ) : (
          <div className={`${compact ? 'w-32 h-32' : 'w-44 h-44'} flex flex-col items-center justify-center bg-[#FAFAFA] text-[#71717A] rounded-lg`}>
            <QrCode className="w-8 h-8 mb-1 text-[#FF6B00]" />
            <span className="text-[11px] font-medium">
              {qrError ? 'QR unavailable' : 'Generating QR...'}
            </span>
          </div>
        )}
      </div>

      <div className={`min-w-0 ${compact ? 'flex-1 text-center sm:text-left' : 'w-full'} space-y-2.5`}>
        <div>
          <p className="text-xs font-bold text-[#111111] dark:text-white truncate">{label}</p>
          <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA] font-mono break-all">
            /?profile={slug}
          </p>
        </div>

        <div className={`flex flex-wrap items-center gap-2 ${compact ? 'justify-center sm:justify-start' : 'justify-center'}`}>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FAFAFA] dark:bg-[#1E2028] hover:border-[#FF6B00] border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-[#111111] dark:text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          {qrDataUrl && !qrError && (
            <a
              href={qrDataUrl}
              download={`shopit-${safeSlug}-qr.png`}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#18181B] text-[#9FE870] border border-[#FF6B00] text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download QR</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
