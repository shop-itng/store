import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatNaira } from '../utils/pricing';
import { NIGERIAN_BANKS } from '../data/mockData';
import {
  Wallet,
  ArrowUpRight,
  ShieldCheck,
  Clock,
  Plus,
  AlertCircle,
  CheckCircle2,
  Lock,
  Building2,
  Info,
  ShieldAlert,
  ArrowDownLeft,
  X,
  FileText,
  KeyRound,
  RotateCcw,
} from 'lucide-react';
import { isPayoutAccountCooled, validateAccountNameMatch } from '../utils/paystackService';
import { LedgerEntryType } from '../types';

export const SellerWalletView: React.FC = () => {
  const {
    currentWallet,
    currentSeller,
    currentUser,
    requestWithdrawal,
    addPayoutAccount,
    sendWithdrawalOtp,
    sendPayoutAccountOtp,
    activeWithdrawalOtp,
    securityProfile,
    toggleTwoFactor,
    notify,
  } = useApp();

  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);

  // Withdrawal form
  const [withdrawAmount, setWithdrawAmount] = useState<number>(5000);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    currentWallet?.activePayoutAccountId || currentWallet?.payoutAccounts[0]?.id || ''
  );
  const [withdrawalOtp, setWithdrawalOtp] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [withdrawCooldown, setWithdrawCooldown] = useState(0);

  // Ledger Filter
  const [ledgerFilter, setLedgerFilter] = useState<'all' | LedgerEntryType>('all');

  // New payout account form
  const verifiedIdName = currentUser?.name || currentSeller?.shopName || 'ADE YINKA';
  const [selectedBankCode, setSelectedBankCode] = useState('999992'); // OPay default
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState(verifiedIdName.toUpperCase());
  const [accountOtp, setAccountOtp] = useState('');
  const [accountCooldown, setAccountCooldown] = useState(0);
  const [accountOtpSent, setAccountOtpSent] = useState(false);

  // 1-second interval for cooldown timers
  useEffect(() => {
    const timer = setInterval(() => {
      setWithdrawCooldown(prev => (prev > 0 ? prev - 1 : 0));
      setAccountCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-select first account when available
  useEffect(() => {
    if (currentWallet?.payoutAccounts.length && !selectedAccountId) {
      setSelectedAccountId(currentWallet.activePayoutAccountId || currentWallet.payoutAccounts[0].id);
    }
  }, [currentWallet, selectedAccountId]);

  if (!currentWallet) {
    return (
      <div className="p-8 text-center text-slate-500">
        Wallet data not initialized. Register your shop to access your youth seller wallet.
      </div>
    );
  }

  const selectedAccount = currentWallet.payoutAccounts.find(
    p => p.id === (selectedAccountId || currentWallet.activePayoutAccountId)
  );

  const isSelectedAccountCooled = selectedAccount ? isPayoutAccountCooled(selectedAccount) : { isCooled: true, hoursRemaining: 0 };

  const withdrawalFee = withdrawAmount >= 5000 ? 0 : 50;
  const totalDeducted = withdrawAmount + withdrawalFee;

  const handleOpenWithdrawModal = () => {
    setIsWithdrawModalOpen(true);
    setWithdrawalOtp('');
    setOtpSent(false);
  };

  const handleSendOtpClick = () => {
    if (withdrawCooldown > 0) return;
    const res = sendWithdrawalOtp(withdrawAmount);
    setOtpSent(true);
    setWithdrawCooldown(60);
    if (typeof res === 'string') {
      setWithdrawalOtp(res);
    } else if (res.code) {
      setWithdrawalOtp(res.code);
    }
  };

  const handleSendAccountOtpClick = () => {
    if (accountCooldown > 0) return;
    const res = sendPayoutAccountOtp();
    if (res.success && res.code) {
      setAccountOtpSent(true);
      setAccountCooldown(60);
      setAccountOtp(res.code);
    }
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) {
      notify('Please select or add a payout bank account / OPay first.', 'error');
      return;
    }

    if (!isSelectedAccountCooled.isCooled) {
      notify(`This payout account is in a 24-hour security cooling period (${isSelectedAccountCooled.hoursRemaining}h remaining).`, 'error');
      return;
    }

    if (!withdrawalOtp.trim()) {
      notify('Please request and enter the 4-digit Email OTP sent to your registered email address.', 'error');
      return;
    }

    setIsWithdrawing(true);
    setTimeout(() => {
      setIsWithdrawing(false);
      const success = requestWithdrawal(withdrawAmount, selectedAccount.id, withdrawalOtp);
      if (success) {
        setIsWithdrawModalOpen(false);
        setWithdrawalOtp('');
        setOtpSent(false);
      }
    }, 1200);
  };

  const handleAddAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bank = NIGERIAN_BANKS.find(b => b.code === selectedBankCode) || {
      code: selectedBankCode,
      name: 'OPay Digital Services',
    };

    if (accountNumber.trim().length !== 10) {
      notify('Nigerian bank/OPay account numbers must be exactly 10 digits.', 'error');
      return;
    }

    // Name match rule
    const nameCheck = validateAccountNameMatch(accountName, verifiedIdName);
    if (!nameCheck.isMatch) {
      notify(nameCheck.reason || 'Account name does not match verified seller ID.', 'error');
      return;
    }

    if (!accountOtp.trim() || accountOtp.trim().length !== 4) {
      notify('Please request and enter the 4-digit Email OTP sent to your inbox to link this payout account.', 'error');
      return;
    }

    const success = addPayoutAccount(bank.code, bank.name, accountNumber, accountName, accountOtp);
    if (success) {
      setIsAddAccountModalOpen(false);
      setAccountNumber('');
      setAccountOtp('');
      setAccountOtpSent(false);
    }
  };

  const filteredLedger = currentWallet.ledger.filter(entry => {
    if (ledgerFilter === 'all') return true;
    return entry.type === ledgerFilter;
  });

  return (
    <div className="space-y-6">
      {/* Test Mode & Rules Banner */}
      <div className="bg-[#111111] text-white p-4 rounded-2xl border-2 border-[#111111] shadow-[0_3px_0_#111111] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#9FE870] animate-pulse shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[#9FE870] uppercase tracking-wider">
                Paystack Test Mode Active
              </span>
              <span className="text-[10px] bg-[#27272A] px-2 py-0.5 rounded text-white font-mono">
                Transfers API v2
              </span>
            </div>
            <p className="text-[11px] text-[#A1A1AA] mt-0.5">
              Append-only double-entry ledger. Two balances: Pending (held in escrow) and Available (withdrawable to OPay/Banks).
            </p>
          </div>
        </div>

        <div className="text-[11px] font-bold text-[#9FE870] bg-[#18181B] px-3 py-1 rounded-lg border border-[#27272A] shrink-0">
          No Buyer Wallet · Paystack Direct Checkout
        </div>
      </div>

      {/* Wallet Status Notice (Frozen by Admin) */}
      {currentWallet.isFrozen && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl flex items-center gap-3 text-red-900 text-xs shadow-sm">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <strong className="font-black">Wallet Frozen by Administrator: </strong>
            {currentWallet.freezeReason || 'Temporary administrative review'}. All payouts and withdrawals are paused until cleared.
          </div>
        </div>
      )}

      {/* Two Wallet Balances (Rule 2: Sellers only have a wallet, with two balances: Pending and Available) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Balance 1: Available Balance (Withdrawable) */}
        <div className="bg-[#111111] text-white rounded-3xl p-6 sm:p-7 relative overflow-hidden shadow-[0_4px_0_#111111] border-2 border-[#111111]">
          <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#9FE870] text-[#111111] flex items-center justify-center font-black">
                ₦
              </div>
              <span className="text-xs font-bold text-white">Available Balance</span>
            </div>
            <span className="text-[11px] font-black text-[#111111] bg-[#9FE870] px-2.5 py-0.5 rounded-md border border-[#111111]">
              Ready to Withdraw
            </span>
          </div>

          <div className="py-4">
            <div className="text-3xl sm:text-4xl font-black font-mono-numbers tracking-tight text-white">
              {formatNaira(currentWallet.availableBalance)}
            </div>
            <p className="text-xs text-[#A1A1AA] mt-1">
              Released upon buyer confirmation or 5-day auto-release. Minimum withdrawal: ₦1,000.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenWithdrawModal}
              disabled={currentWallet.availableBalance < 1000 || currentWallet.isFrozen}
              className="px-5 py-2.5 bg-[#FF6B00] hover:bg-[#ff7a1a] disabled:bg-stone-700 disabled:text-stone-400 text-[#111111] font-black rounded-xl text-xs sm:text-sm transition-all border-2 border-[#111111] shadow-[0_3px_0_#9FE870] active:translate-y-0.5 flex items-center gap-2"
            >
              <div className="w-5 h-5 rounded-md bg-[#9FE870] border border-[#111111] flex items-center justify-center text-[#111111]">
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span>Withdraw Funds</span>
            </button>

            <button
              onClick={() => setIsAddAccountModalOpen(true)}
              className="px-4 py-2.5 bg-[#18181B] hover:bg-black text-[#9FE870] rounded-xl text-xs font-black transition-all border-2 border-[#FF6B00] shadow-[0_2px_0_#FF6B00] flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-[#FF6B00]" />
              <span>Add Bank / OPay</span>
            </button>
          </div>
        </div>

        {/* Balance 2: Pending Balance (Held in Escrow) */}
        <div className="bg-white dark:bg-[#15161C] rounded-3xl p-6 sm:p-7 border-2 border-[#111111] dark:border-[#27272A] shadow-[0_4px_0_#111111] dark:shadow-none flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#27272A]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#FF6B00]" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">Pending in Escrow</span>
              </div>
              <span className="text-[11px] font-bold text-[#111111] dark:text-[#FF6B00] bg-[#FF6B00]/20 px-2.5 py-0.5 rounded-md border border-[#FF6B00]">
                Awaiting Buyer Confirmation
              </span>
            </div>

            <div className="py-4">
              <div className="text-3xl sm:text-4xl font-black font-mono-numbers tracking-tight text-slate-900 dark:text-white">
                {formatNaira(currentWallet.pendingBalance)}
              </div>
              <p className="text-xs text-slate-500 dark:text-[#A1A1AA] mt-1">
                Held safely until the buyer taps <strong>"Item received"</strong> or 5 days elapse without an open dispute.
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-[#1E2028] rounded-xl border border-slate-200 dark:border-[#27272A] text-xs text-slate-700 dark:text-[#E4E4E7] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#16A34A] dark:text-[#9FE870] shrink-0" />
            <span>
              <strong>Rule 2: </strong>
              Money moves to Available only after delivery confirmation or after the 5-day auto-release (if no open dispute).
            </span>
          </div>
        </div>
      </div>

      {/* Verified Payout Accounts Strip (Rule 4: OPay or Nigerian Bank via Paystack Transfers API) */}
      <div className="bg-white dark:bg-[#15161C] rounded-2xl border-2 border-[#111111] dark:border-[#27272A] p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-900 dark:text-white" />
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Verified Payout Accounts (OPay / Banks)</h3>
          </div>
          <button
            onClick={() => setIsAddAccountModalOpen(true)}
            className="text-xs font-black text-[#FF6B00] hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Payout Account</span>
          </button>
        </div>

        {currentWallet.payoutAccounts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {currentWallet.payoutAccounts.map(acc => {
              const cooled = isPayoutAccountCooled(acc);
              return (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-xl border-2 border-slate-200 dark:border-[#27272A] bg-slate-50 dark:bg-[#1E2028] flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-black text-slate-900">
                      <span>{acc.bankName}</span>
                      <span className="text-[10px] bg-[#9FE870] text-[#111111] border border-[#111111] px-1.5 py-0.2 rounded font-bold">
                        Verified Name Match
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 font-mono-numbers mt-0.5">
                      {acc.accountNumber} · <strong>{acc.accountName}</strong>
                    </div>
                    {!cooled.isCooled ? (
                      <span className="text-[11px] text-amber-800 font-bold block mt-1">
                        ⏳ 24-hr cooling active ({cooled.hoursRemaining}h remaining)
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-800 font-bold block mt-1">
                        ✓ Ready for Paystack Transfer
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                    Default
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic py-2">
            No payout accounts linked yet. Link your OPay or Nigerian bank account to withdraw sales.
          </div>
        )}
      </div>

      {/* Append-Only Financial Ledger & Audit Trail (Rule 5: All balances come from an append-only ledger) */}
      <div className="bg-white rounded-2xl border-2 border-[#111111] overflow-hidden shadow-xs space-y-0">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#FF6B00]" />
              <span>Append-Only Financial Ledger & Audit Trail</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Rule 5: Balances are strictly computed from immutable ledger events (sale, fee, withdrawal, refund).
            </p>
          </div>

          {/* Ledger Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs overflow-x-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'sale_pending', label: 'Escrow Deposits' },
              { id: 'escrow_release', label: 'Releases' },
              { id: 'withdrawal', label: 'Withdrawals' },
              { id: 'refund', label: 'Refunds' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setLedgerFilter(tab.id as any)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                  ledgerFilter === tab.id
                    ? 'bg-[#111111] text-[#9FE870] border border-[#111111]'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredLedger.length > 0 ? (
          <div className="divide-y divide-slate-100 text-xs">
            {filteredLedger.map(entry => {
              const isCredit = entry.type === 'escrow_release';
              const isDebit = entry.type === 'withdrawal';
              const isPending = entry.type === 'sale_pending';
              const isRefund = entry.type === 'refund';

              return (
                <div key={entry.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 border ${
                        isCredit
                          ? 'bg-[#9FE870]/20 text-[#111111] border-[#9FE870]'
                          : isDebit
                          ? 'bg-slate-100 text-slate-900 border-slate-300'
                          : isRefund
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-[#FF6B00]/15 text-[#FF6B00] border-[#FF6B00]/30'
                      }`}
                    >
                      {isCredit && <ArrowDownLeft className="w-4 h-4 text-[#16A34A] stroke-[2.5]" />}
                      {isDebit && <ArrowUpRight className="w-4 h-4 text-slate-800 stroke-[2.5]" />}
                      {isPending && <Clock className="w-4 h-4 text-[#FF6B00]" />}
                      {isRefund && <RotateCcw className="w-4 h-4 text-rose-600" />}
                    </div>

                    <div>
                      <div className="font-bold text-slate-900">{entry.description}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-slate-600 font-semibold">{entry.id}</span>
                        <span>·</span>
                        <span>Ref: {entry.reference}</span>
                        <span>·</span>
                        <span>{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {entry.fee > 0 && <span className="text-amber-800">· Paystack Fee: {formatNaira(entry.fee)}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`font-black font-mono-numbers text-sm ${
                        isCredit
                          ? 'text-[#16A34A]'
                          : isDebit
                          ? 'text-slate-900'
                          : isRefund
                          ? 'text-rose-600'
                          : 'text-[#FF6B00]'
                      }`}
                    >
                      {isDebit || isRefund ? '-' : '+'}
                      {formatNaira(entry.amount)}
                    </div>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {entry.balanceType === 'pending' ? 'Pending Escrow' : 'Available Bal'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400 space-y-1">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">No ledger entries match this filter</p>
            <p className="text-[11px]">When orders are paid or confirmed, immutable records appear here.</p>
          </div>
        )}
      </div>

      {/* WITHDRAW MODAL (Rule 4: Paystack Transfers API, ₦1,000 min, OTP, 24-hr cooling) */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl relative my-6 border-2 border-[#111111]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#FF6B00] flex items-center justify-center text-[#111111]">
                  <ArrowUpRight className="w-4 h-4 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Withdraw to OPay / Bank
                  </h3>
                  <span className="text-[10px] text-slate-500">Paystack Transfers API (Test Mode)</span>
                </div>
              </div>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4 text-xs">
              {/* Amount (Rule 4: Minimum ₦1,000) */}
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Withdrawal Amount (₦) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    ₦
                  </span>
                  <input
                    type="number"
                    step={100}
                    min={1000}
                    max={currentWallet.availableBalance}
                    required
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(Number(e.target.value))}
                    className="w-full h-11 pl-9 pr-3 rounded-xl border-2 border-slate-200 text-sm font-bold font-mono-numbers text-slate-900 focus:outline-none focus:border-[#FF6B00]"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Available: {formatNaira(currentWallet.availableBalance)}</span>
                  <span className="text-slate-700 font-bold">
                    Min: ₦1,000 · {withdrawAmount >= 5000 ? 'Free Transfer' : '₦50 network fee'}
                  </span>
                </div>
              </div>

              {/* Select Payout Destination */}
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Select Payout Account *
                </label>
                {currentWallet.payoutAccounts.length > 0 ? (
                  <select
                    value={selectedAccountId}
                    onChange={e => setSelectedAccountId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border-2 border-slate-200 bg-white text-xs font-bold text-slate-900"
                  >
                    {currentWallet.payoutAccounts.map(acc => {
                      const cooled = isPayoutAccountCooled(acc);
                      return (
                        <option key={acc.id} value={acc.id}>
                          {acc.bankName} - {acc.accountNumber} ({acc.accountName}) {!cooled.isCooled ? `[Cooling: ${cooled.hoursRemaining}h left]` : ''}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsWithdrawModalOpen(false);
                      setIsAddAccountModalOpen(true);
                    }}
                    className="w-full p-3 border-2 border-dashed border-[#FF6B00] rounded-xl text-center text-[#111111] font-bold hover:bg-[#FF6B00]/10"
                  >
                    + Add OPay or Bank Account First
                  </button>
                )}
              </div>

              {/* Cooling Period Warning */}
              {selectedAccount && !isSelectedAccountCooled.isCooled && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-900 text-[11px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>24-Hour Cooling Period: </strong>
                    This account was linked recently and cannot receive payouts until {isSelectedAccountCooled.hoursRemaining} hour(s) have passed.
                  </span>
                </div>
              )}

              {/* Rule 4: Send an Email OTP before every withdrawal */}
              <div className="p-3 bg-slate-50 rounded-xl border-2 border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Security Email OTP *</span>
                  </span>
                  <button
                    type="button"
                    disabled={withdrawCooldown > 0}
                    onClick={handleSendOtpClick}
                    className={`text-[11px] font-black ${
                      withdrawCooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-[#FF6B00] hover:underline'
                    }`}
                  >
                    {withdrawCooldown > 0
                      ? `Resend in ${withdrawCooldown}s`
                      : otpSent
                      ? 'Resend Email OTP'
                      : 'Send Email OTP'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={4}
                    required
                    value={withdrawalOtp}
                    onChange={e => setWithdrawalOtp(e.target.value)}
                    placeholder="Enter 4-digit OTP"
                    className="flex-1 h-10 px-3 tracking-widest text-center text-base font-black font-mono-numbers rounded-lg border-2 border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#FF6B00]"
                  />
                  {!otpSent && (
                    <button
                      type="button"
                      onClick={handleSendOtpClick}
                      className="px-3 h-10 bg-[#111111] text-[#9FE870] font-black rounded-lg text-xs border border-[#111111]"
                    >
                      Request Code
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 block text-center">
                  Rule 4: Security OTP sent to your registered email ({currentUser?.email || 'artisan@campus.ng'}). Valid for 10 mins (3 attempts max).
                </span>
              </div>

              {/* Fee and Payout Summary */}
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Transfer Amount</span>
                  <span className="font-mono-numbers font-medium text-slate-900">{formatNaira(withdrawAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paystack Transfer Network Fee</span>
                  <span className="font-mono-numbers font-medium text-emerald-800">
                    {withdrawalFee === 0 ? '₦0 (Free above ₦5k)' : formatNaira(withdrawalFee)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-100">
                  <span>Total Deducted from Available Balance</span>
                  <span className="font-mono-numbers text-sm">{formatNaira(totalDeducted)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isWithdrawing || !isSelectedAccountCooled.isCooled}
                  className="px-6 py-2.5 bg-[#FF6B00] hover:bg-[#ff7a1a] disabled:bg-stone-300 disabled:text-stone-500 text-[#111111] font-black rounded-xl border-2 border-[#111111] shadow-[0_3px_0_#111111] active:translate-y-0.5 transition-all flex items-center gap-2 text-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-[#9FE870] border border-[#111111]" />
                  <span>{isWithdrawing ? 'Dispatching Paystack Transfer...' : `Authorize & Withdraw ${formatNaira(withdrawAmount)}`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PAYOUT ACCOUNT MODAL (Rule 4: Account name must match verified ID name; 24-hr cooling) */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl relative my-6 border-2 border-[#111111]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#111111] flex items-center justify-center text-[#9FE870]">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Link Payout Account
                  </h3>
                  <span className="text-[10px] text-slate-500">Paystack KYC Verification</span>
                </div>
              </div>
              <button
                onClick={() => setIsAddAccountModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAccountSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-800 block mb-1">Select Bank / Fintech *</label>
                <select
                  value={selectedBankCode}
                  onChange={e => setSelectedBankCode(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border-2 border-slate-200 bg-white text-xs font-bold text-slate-900"
                >
                  {NIGERIAN_BANKS.map(b => (
                    <option key={b.code} value={b.code}>
                      {b.icon} {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  10-Digit Account Number *
                </label>
                <input
                  type="text"
                  maxLength={10}
                  required
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 8098765432"
                  className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 text-sm font-bold font-mono-numbers text-slate-900 focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              {/* Rule 4: Account name must match verified ID name */}
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Account Holder Name *
                </label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={e => setAccountName(e.target.value.toUpperCase())}
                  className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-xs font-black text-slate-900 uppercase focus:outline-none focus:border-[#FF6B00]"
                />
                <span className="text-[11px] text-slate-600 mt-1 block">
                  Rule 4: Must match your verified seller identity: <strong>{verifiedIdName.toUpperCase()}</strong>.
                </span>
              </div>

              {/* Security Rule: Email Authorization OTP to add/change payout account */}
              <div className="p-3 bg-slate-50 rounded-xl border-2 border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Email Authorization Code *</span>
                  </span>
                  <button
                    type="button"
                    disabled={accountCooldown > 0}
                    onClick={handleSendAccountOtpClick}
                    className={`text-[11px] font-black ${
                      accountCooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-[#FF6B00] hover:underline'
                    }`}
                  >
                    {accountCooldown > 0
                      ? `Resend in ${accountCooldown}s`
                      : accountOtpSent
                      ? 'Resend Code'
                      : 'Send Email Code'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={4}
                    required
                    value={accountOtp}
                    onChange={e => setAccountOtp(e.target.value)}
                    placeholder="Enter 4-digit code"
                    className="flex-1 h-10 px-3 tracking-widest text-center text-base font-black font-mono-numbers rounded-lg border-2 border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#FF6B00]"
                  />
                  {!accountOtpSent && (
                    <button
                      type="button"
                      onClick={handleSendAccountOtpClick}
                      className="px-3 h-10 bg-[#111111] text-[#9FE870] font-black rounded-lg text-xs border border-[#111111]"
                    >
                      Send Code
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 block text-center">
                  Paystack security code sent to your registered email ({currentUser?.email || 'artisan@campus.ng'}). Valid for 10 mins (3 attempts max).
                </span>
              </div>

              {/* Rule 4: 24-Hour Cooling Period Notice */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-xs text-amber-950 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>24-Hour Security Cooling Period: </strong>
                  Newly added accounts wait 24 hours before withdrawals can be initiated, preventing unauthorized drain in case of compromised credentials.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#FF6B00] hover:bg-[#ff7a1a] text-[#111111] font-black rounded-xl border-2 border-[#111111] shadow-[0_3px_0_#111111] active:translate-y-0.5 transition-all text-xs"
                >
                  Verify & Link Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
