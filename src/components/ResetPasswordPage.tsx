import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff, ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const { setActiveView, openAuthModal, notify } = useApp();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Read URL parameters on mount (?code=123456&email=user%40example.com)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlEmail = params.get('email');
      const urlCode = params.get('code');
      if (urlEmail) setEmail(urlEmail.trim().toLowerCase());
      if (urlCode) setCode(urlCode.trim().replace(/\D/g, ''));
    }
  }, []);

  // 1-second countdown for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResendCode = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      notify('Please enter a valid email address first.', 'error');
      return;
    }

    setIsResending(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          purpose: 'password_reset',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.status) {
        setErrorMessage(data.message || 'Failed to dispatch reset code.');
        notify(data.message || 'Failed to dispatch reset code.', 'error');
        setIsResending(false);
        return;
      }

      setResendCooldown(60);
      notify(`A new 6-digit code has been sent to ${cleanEmail}. Valid for 10 minutes.`, 'success');
    } catch {
      notify('Unable to reach server. Please check your connection.', 'error');
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim().replace(/\D/g, '');
    const cleanPass = newPassword.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid registered email address.');
      return;
    }

    if (cleanCode.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    if (cleanPass.length < 6) {
      setErrorMessage('Your new password must be at least 6 characters long.');
      return;
    }

    if (cleanPass !== confirmPassword.trim()) {
      setErrorMessage('Passwords do not match. Please re-enter them carefully.');
      return;
    }

    setIsSubmitting(true);

    try {
      const resp = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          code: cleanCode,
          newPassword: cleanPass,
        }),
      });

      const data = await resp.json();

      if (!resp.ok || !data.status) {
        setErrorMessage(data.message || 'Unable to update password. Please verify your code.');
        notify(data.message || 'Failed to update password.', 'error');
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      notify('Password reset successfully in database!', 'success');
    } catch {
      setErrorMessage('Network or server error updating password. Please try again.');
      notify('Unable to connect to server. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-md bg-white dark:bg-[#15161C] rounded-3xl border-2 border-[#111111] dark:border-[#27272A] p-6 sm:p-8 shadow-[0_6px_0_#111111] dark:shadow-none transition-all">
        {/* Brand header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-stone-800">
          <button
            onClick={() => setActiveView('catalog')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-stone-400 hover:text-black dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Marketplace</span>
          </button>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FF6B00]/10 text-[#FF6B00] border border-[#FF6B00]/30">
            Account Security
          </span>
        </div>

        {isSuccess ? (
          <div className="text-center space-y-5 py-4">
            <div className="w-16 h-16 rounded-2xl bg-[#9FE870]/20 text-[#16A34A] border-2 border-[#16A34A] flex items-center justify-center mx-auto shadow-[0_3px_0_#16A34A]">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-black text-[#111111] dark:text-white">
                Password Updated!
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-stone-300 leading-relaxed max-w-xs mx-auto">
                Your password has been securely updated in the database. You can now sign in with your new credentials.
              </p>
            </div>

            <div className="pt-4 space-y-3">
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="w-full h-12 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] font-black rounded-xl text-sm transition-all shadow-[0_3px_0_#111111] active:translate-y-0.5"
              >
                Sign In to Your Account
              </button>

              <button
                type="button"
                onClick={() => setActiveView('catalog')}
                className="w-full text-xs font-bold text-slate-500 dark:text-stone-400 hover:text-black dark:hover:text-white transition-colors py-1"
              >
                Continue Browsing Items
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-6 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#FF6B00]/15 text-[#FF6B00] border-2 border-[#FF6B00] flex items-center justify-center mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black text-[#111111] dark:text-white tracking-tight">
                Set a New Password
              </h1>
              <p className="text-xs text-slate-600 dark:text-stone-400 leading-relaxed">
                Enter your registered email, the 6-digit code sent to your inbox, and choose a new password.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span className="font-medium leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email field */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-stone-300 block mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 dark:border-stone-700 bg-white dark:bg-[#1A1C24] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              {/* 6-Digit Code field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-stone-300">
                    6-Digit Verification Code
                  </label>
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isResending}
                    onClick={handleResendCode}
                    className={`text-[11px] font-bold inline-flex items-center gap-1 ${
                      resendCooldown > 0
                        ? 'text-slate-400 dark:text-stone-500 cursor-not-allowed'
                        : 'text-[#FF6B00] hover:underline cursor-pointer'
                    }`}
                  >
                    <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                    <span>
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                    </span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full h-12 px-3.5 rounded-xl border-2 border-slate-200 dark:border-stone-700 bg-white dark:bg-[#1A1C24] text-center font-mono text-xl font-black tracking-[0.5em] text-slate-900 dark:text-white focus:outline-none focus:border-[#FF6B00]"
                />
                <span className="text-[10px] text-slate-500 dark:text-stone-400 block text-center mt-1">
                  ⏱ Valid for 10 minutes · 3 wrong attempts max
                </span>
              </div>

              {/* New Password field */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-stone-300 block mb-1.5">
                  New Password (at least 6 characters)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full h-11 pl-3.5 pr-10 rounded-xl border-2 border-slate-200 dark:border-stone-700 bg-white dark:bg-[#1A1C24] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#FF6B00]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-stone-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password field */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-stone-300 block mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your new password"
                    className="w-full h-11 pl-3.5 pr-10 rounded-xl border-2 border-slate-200 dark:border-stone-700 bg-white dark:bg-[#1A1C24] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#FF6B00]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-stone-200"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 mt-2 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] font-black rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-[0_3px_0_#111111] active:translate-y-0.5 disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#111111]" />
                    <span>Updating Password in Database...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#111111]" />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-stone-800 text-center">
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="text-xs text-slate-500 dark:text-stone-400 hover:text-black dark:hover:text-white font-bold underline decoration-slate-300 dark:decoration-stone-700"
              >
                Already remember your password? Sign in
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
