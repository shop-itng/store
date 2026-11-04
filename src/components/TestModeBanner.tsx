import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export const TestModeBanner: React.FC = () => {
  const [isTestMode, setIsTestMode] = useState<boolean>(() => {
    const clientKey = (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY || '';
    return clientKey.startsWith('pk_test_');
  });

  useEffect(() => {
    fetch('/api/paystack/config')
      .then(res => res.json())
      .then(data => {
        if (data.publicKey && typeof data.publicKey === 'string') {
          setIsTestMode(data.publicKey.startsWith('pk_test_'));
        }
      })
      .catch(() => {});
  }, []);

  if (!isTestMode) return null;

  return (
    <div className="w-full bg-[#FEF08A] dark:bg-[#713F12] text-[#854D0E] dark:text-[#FEF08A] border-b-2 border-[#EAB308] px-3 sm:px-4 py-2 flex items-center justify-center gap-2 text-xs font-black z-40 sticky top-0 shadow-xs">
      <AlertCircle className="w-4 h-4 shrink-0 text-[#CA8A04] dark:text-[#FEF08A]" />
      <span>
        PAYSTACK TEST MODE ACTIVE — No real money will be charged. Use test cards (e.g. 4084 0840 8408 4081) or test transfer simulations.
      </span>
    </div>
  );
};
