import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { ADMIN_CREDENTIALS } from '../data/mockData';
import { NIGERIAN_STATES } from '../data/nigerianLocations';
import {
  X,
  ShieldCheck,
  Store,
  User,
  Lock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  MapPin,
  KeyRound,
  Mail,
  CheckCircle2,
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    authTab,
    setAuthTab,
    pendingAuthData,
    setPendingAuthData,
    verifyOtp,
    submitSellerRegistration,
    login,
    notify,
  } = useApp();

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('buyer');

  // OTP state
  const [otpCode, setOtpCode] = useState('1234');

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'otp_and_reset'>('email');
  const [forgotOtpSent, setForgotOtpSent] = useState('');
  const [forgotOtpInput, setForgotOtpInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);

  // Seller registration specifics
  const [shopName, setShopName] = useState('');
  const [stateName, setStateName] = useState('Lagos');
  const [cityName, setCityName] = useState('Lagos Mainland');
  const [areaName, setAreaName] = useState('Yaba');
  const [bio, setBio] = useState('');
  const [under18, setUnder18] = useState(false);
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');

  if (!isAuthModalOpen) return null;

  const handleSendResetOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) {
      notify('Please enter your email address.', 'error');
      return;
    }

    setIsSendingResetEmail(true);

    setTimeout(() => {
      setIsSendingResetEmail(false);
      // Generate real 4-digit numeric OTP
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setForgotOtpSent(code);
      setForgotStep('otp_and_reset');
      notify(`Verification code sent to ${cleanEmail}! (Your reset OTP: ${code})`, 'success');
    }, 400);
  };

  const handleResendResetOtp = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setForgotOtpSent(code);
    notify(`New reset code sent to ${forgotEmail}! (Your OTP: ${code})`, 'info');
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = forgotEmail.trim().toLowerCase();

    if (forgotOtpInput.trim() !== forgotOtpSent) {
      notify('Invalid 4-digit reset code. Please check your email or request a new code.', 'error');
      return;
    }

    if (newPassword.length < 6) {
      notify('Password must be at least 6 characters long.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      notify('Passwords do not match. Please re-enter carefully.', 'error');
      return;
    }

    // Update password in localStorage registered users
    const registeredUsersStr = localStorage.getItem('shopit_registered_users');
    let registeredUsers: any[] = registeredUsersStr ? JSON.parse(registeredUsersStr) : [];
    const existingIndex = registeredUsers.findIndex(u => u.email?.toLowerCase() === cleanEmail);

    if (existingIndex >= 0) {
      registeredUsers[existingIndex].password = newPassword;
    } else {
      registeredUsers.push({
        id: `user_${Date.now()}`,
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: '+2348000000000',
        password: newPassword,
        role: 'buyer',
      });
    }

    localStorage.setItem('shopit_registered_users', JSON.stringify(registeredUsers));

    notify('Password reset successfully! You can now sign in with your new password.', 'success');
    setLoginEmail(cleanEmail);
    setLoginPassword('');
    setForgotStep('email');
    setAuthTab('login');
  };

  const handleLoginFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = loginEmail.trim().toLowerCase();
    const cleanPass = loginPassword.trim();

    // Check if logging in as Admin Moderator (Adeyinka Joseph)
    if (
      cleanEmail === ADMIN_CREDENTIALS.email.toLowerCase() &&
      cleanPass === ADMIN_CREDENTIALS.password
    ) {
      login({
        id: 'admin_adeyinka_joseph',
        name: ADMIN_CREDENTIALS.name,
        email: ADMIN_CREDENTIALS.email,
        phone: '+2348000000000',
        role: 'admin',
        adminSubRole: 'moderator',
        isVerifiedEmail: true,
        isVerifiedPhone: true,
      });
      closeAuthModal();
      notify(`Welcome back, ${ADMIN_CREDENTIALS.name}!`, 'success');
      return;
    }

    // Check localStorage registered users
    const registeredUsersStr = localStorage.getItem('shopit_registered_users');
    const registeredUsers: any[] = registeredUsersStr ? JSON.parse(registeredUsersStr) : [];
    const foundUser = registeredUsers.find(
      u => u.email.toLowerCase() === cleanEmail && u.password === cleanPass
    );

    if (foundUser) {
      login(foundUser);
      closeAuthModal();
      notify(`Welcome back, ${foundUser.name}!`, 'success');
      return;
    }

    // If no match found
    notify('Invalid login credentials. Please check your email and password.', 'error');
  };

  const handleInitialSignup = (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone.startsWith('+234') && !phone.startsWith('0')) {
      notify('Please enter a valid Nigerian phone number (e.g., 08123456789 or +234...)', 'error');
      return;
    }

    if (password.length < 6) {
      notify('Password should be at least 6 characters.', 'error');
      return;
    }

    const authData = {
      id: `user_${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password,
      role,
    };
    setPendingAuthData(authData);
    setAuthTab('otp');
    notify(`SMS verification OTP sent to ${phone}`, 'info');
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyOtp(otpCode);
  };

  const activeStateObj = NIGERIAN_STATES.find(s => s.state === stateName) || NIGERIAN_STATES[0];
  const activeCityObj = activeStateObj.cities.find(c => c.city === cityName) || activeStateObj.cities[0];

  const handleStateChange = (newVal: string) => {
    setStateName(newVal);
    const foundState = NIGERIAN_STATES.find(s => s.state === newVal) || NIGERIAN_STATES[0];
    const defCity = foundState.cities[0]?.city || '';
    setCityName(defCity);
    setAreaName(foundState.cities[0]?.areas[0] || '');
  };

  const handleCityChange = (newVal: string) => {
    setCityName(newVal);
    const foundCity = activeStateObj.cities.find(c => c.city === newVal);
    setAreaName(foundCity?.areas[0] || '');
  };

  const handleSellerFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (under18 && (!guardianName || !guardianPhone)) {
      notify('Youth sellers under 18 require a verified guardian name and phone number for payouts.', 'error');
      return;
    }

    submitSellerRegistration({
      shopName,
      location: {
        state: stateName,
        city: cityName,
        area: areaName,
      },
      locationArea: areaName,
      bio,
      under18,
      guardianName: under18 ? guardianName : undefined,
      guardianPhone: under18 ? guardianPhone : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Tabs */}
        {authTab !== 'otp' && authTab !== 'seller_register' && authTab !== 'forgot_password' && (
          <div className="flex border-b border-[#E4E4E7] pb-2">
            <button
              onClick={() => setAuthTab('login')}
              className={`flex-1 text-center py-2 text-sm font-bold border-b-2 transition-all ${
                authTab === 'login'
                  ? 'border-[#FF6B00] text-[#111111]'
                  : 'border-transparent text-[#71717A] hover:text-[#111111]'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthTab('signup')}
              className={`flex-1 text-center py-2 text-sm font-bold border-b-2 transition-all ${
                authTab === 'signup'
                  ? 'border-[#FF6B00] text-[#111111]'
                  : 'border-transparent text-[#71717A] hover:text-[#111111]'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Tab 1: SIGN IN (Real authentication - moderator and customer accounts) */}
        {authTab === 'login' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#111111]">Sign In to Shop It</h2>
              <p className="text-xs text-[#71717A] mt-1">
                Enter your email and password to access your account.
              </p>
            </div>

            <form onSubmit={handleLoginFormSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. yourname@gmail.com"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(loginEmail);
                      setForgotStep('email');
                      setAuthTab('forgot_password');
                    }}
                    className="text-xs font-bold text-[#FF6B00] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 bg-[#111111] hover:bg-[#18181B] text-[#9FE870] border-2 border-[#FF6B00] font-black rounded-xl text-xs sm:text-sm transition-all shadow-[0_3px_0_#111111] flex items-center justify-center gap-2 active:translate-y-0.5"
              >
                <Lock className="w-4 h-4 text-[#FF6B00]" />
                <span>Sign In Securely</span>
              </button>
            </form>

            <div className="pt-3 border-t border-slate-100 text-center">
              <p className="text-xs text-[#71717A]">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setAuthTab('signup')}
                  className="text-[#FF6B00] font-bold hover:underline"
                >
                  Create one now
                </button>
              </p>
            </div>
          </div>
        )}

        {/* Tab 1.5: FORGOT PASSWORD & OTP RESET */}
        {authTab === 'forgot_password' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setForgotStep('email');
                  setAuthTab('login');
                }}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                title="Back to Sign In"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-black text-[#111111]">
                  {forgotStep === 'email' ? 'Forgot Password' : 'Reset Your Password'}
                </h2>
                <p className="text-xs text-[#71717A] mt-0.5">
                  {forgotStep === 'email'
                    ? 'Enter your registered email to receive a 4-digit verification code.'
                    : `Verification code dispatched to ${forgotEmail}. Enter it below.`}
                </p>
              </div>
            </div>

            {forgotStep === 'email' ? (
              <form onSubmit={handleSendResetOtp} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Your Registered Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. yourname@gmail.com"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSendingResetEmail}
                  className="w-full h-12 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] font-black rounded-xl text-xs sm:text-sm transition-all shadow-[0_3px_0_#111111] flex items-center justify-center gap-2 active:translate-y-0.5 disabled:opacity-50"
                >
                  <Mail className="w-4 h-4 text-[#111111]" />
                  <span>{isSendingResetEmail ? 'Sending Reset Code...' : 'Send Reset Code'}</span>
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setAuthTab('login')}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900"
                  >
                    Remember your password? Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
                {/* OTP Input */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    4-Digit Verification Code (OTP) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={forgotOtpInput}
                    onChange={e => setForgotOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 4921"
                    className="w-full h-12 text-center text-xl font-bold tracking-widest rounded-xl border-2 border-[#111111] text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                  />
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                    <span>Check your email inbox/notifications</span>
                    <button
                      type="button"
                      onClick={handleResendResetOtp}
                      className="text-[#FF6B00] font-bold hover:underline"
                    >
                      Resend Code
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    New Password (at least 6 characters) *
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                  />
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Confirm New Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full h-12 bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] border-2 border-[#111111] font-black rounded-xl text-xs sm:text-sm transition-all shadow-[0_3px_0_#111111] flex items-center justify-center gap-2 active:translate-y-0.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#111111]" />
                  <span>Update Password & Sign In</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: SIGN UP (For new buyers and sellers) */}
        {authTab === 'signup' && (
          <form onSubmit={handleInitialSignup} className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#111111]">Join Shop It</h2>
              <p className="text-xs text-[#71717A] mt-1">
                Marketplace for Nigerian teens and youth with escrow payment protection.
              </p>
            </div>

            {/* Account Type Selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setRole('buyer')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  role === 'buyer'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Shopper / Buyer</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('seller')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  role === 'seller'
                    ? 'bg-white text-[#111111] shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Store className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Youth Seller</span>
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Damilola Adeyemi"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@gmail.com"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nigerian Phone Number (+234)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                  🇳🇬
                </span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="080 1234 5678"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] font-mono-numbers"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Create Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
              />
            </div>

            <button
              type="submit"
              className="w-full h-12 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] font-black rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-[0_3px_0_#111111] active:translate-y-0.5"
            >
              <span className="w-5 h-5 rounded-full bg-[#9FE870] text-[#111111] flex items-center justify-center font-black">
                →
              </span>
              <span>Continue with Phone OTP</span>
            </button>
          </form>
        )}

        {/* Tab 3: OTP VERIFICATION */}
        {authTab === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-[#F0FDF4] text-[#16A34A] border-2 border-[#111111] flex items-center justify-center mx-auto shadow-xs">
                <ShieldCheck className="w-6 h-6 text-[#16A34A]" />
              </div>
              <h2 className="text-xl font-black text-slate-900">Verify Phone Number</h2>
              <p className="text-xs text-slate-500">
                Enter the 4-digit code sent to <strong className="text-slate-800">{pendingAuthData?.phone || phone}</strong>
              </p>
            </div>

            <div className="py-2">
              <input
                type="text"
                maxLength={4}
                autoFocus
                required
                value={otpCode}
                onChange={e => setOtpCode(e.target.value)}
                placeholder="1234"
                className="w-36 h-12 mx-auto tracking-widest text-center text-2xl font-black rounded-xl border-2 border-[#111111] text-slate-900 block focus:outline-none focus:ring-2 focus:ring-[#FF6B00] font-mono-numbers"
              />
              <span className="text-[11px] text-slate-400 text-center block mt-2">
                Verification code is <strong>1234</strong>
              </span>
            </div>

            <button
              type="submit"
              className="w-full h-12 bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] border-2 border-[#111111] font-black rounded-xl text-xs sm:text-sm transition-all shadow-[0_3px_0_#111111] active:translate-y-0.5"
            >
              Verify & Complete Registration
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setAuthTab('signup')}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Change Phone Number
              </button>
            </div>
          </form>
        )}

        {/* Tab 4: SELLER ID & UNDER-18 GUARDIAN SETUP */}
        {authTab === 'seller_register' && (
          <form onSubmit={handleSellerFormSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div>
              <div className="flex items-center gap-1.5 text-[#FF6B00] text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Youth Seller Onboarding</span>
              </div>
              <h2 className="text-xl font-black text-[#111111]">Set Up Your Shop</h2>
              <p className="text-xs text-[#71717A] mt-1">
                Handmade marketplace for Nigerian teens and youth.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#111111] block mb-1">
                Shop Brand Name *
              </label>
              <input
                type="text"
                required
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                placeholder="e.g. Sparkle Crafts & Beads"
                className="w-full h-10 px-3 rounded-xl border border-[#E4E4E7] text-xs sm:text-sm text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
              />
            </div>

            {/* Location Selector: State > City > Area (All 36 States + FCT) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#111111] block flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Your Location (State &gt; City &gt; Area) *</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-[#71717A] block mb-0.5">State</label>
                  <select
                    value={stateName}
                    onChange={e => handleStateChange(e.target.value)}
                    className="w-full h-9 px-2 rounded-xl border border-[#E4E4E7] text-xs bg-white text-[#111111] font-medium"
                  >
                    {NIGERIAN_STATES.map(s => (
                      <option key={s.state} value={s.state}>
                        {s.state}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-[#71717A] block mb-0.5">City</label>
                  <select
                    value={cityName}
                    onChange={e => handleCityChange(e.target.value)}
                    className="w-full h-9 px-2 rounded-xl border border-[#E4E4E7] text-xs bg-white text-[#111111] font-medium"
                  >
                    {activeStateObj.cities.map(c => (
                      <option key={c.city} value={c.city}>
                        {c.city}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-[#71717A] block mb-0.5">Area (Public)</label>
                  <select
                    value={areaName}
                    onChange={e => setAreaName(e.target.value)}
                    className="w-full h-9 px-2 rounded-xl border border-[#E4E4E7] text-xs bg-white font-bold text-[#FF6B00]"
                  >
                    {activeCityObj.areas.map(a => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-[#71717A]">
                Buyers will only see your Area (<strong>📍 {areaName}</strong>) publicly for safe delivery.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Shop Bio / Speciality
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Describe your handmade products (e.g. customized crystal beads, scent oils, crochet pieces)..."
                className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Under-18 Guardian Consent Module */}
            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={under18}
                  onChange={e => setUnder18(e.target.checked)}
                  className="mt-0.5 rounded text-amber-700"
                />
                <span className="text-xs text-amber-950 font-medium">
                  <strong>I am a teenager under 18 years old.</strong> (Requires parent or legal guardian consent. Payouts are made directly to a verified guardian bank/Opay account).
                </span>
              </label>

              {under18 && (
                <div className="space-y-2 pt-2 border-t border-amber-200/80">
                  <div>
                    <label className="text-[11px] font-semibold text-amber-950 block mb-0.5">
                      Parent / Guardian Full Legal Name *
                    </label>
                    <input
                      type="text"
                      required={under18}
                      value={guardianName}
                      onChange={e => setGuardianName(e.target.value)}
                      placeholder="e.g. Mrs. Folashade Adeyemi"
                      className="w-full h-9 px-2.5 rounded-md border border-amber-300 bg-white text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-amber-950 block mb-0.5">
                      Guardian Phone / BVN Linked Phone *
                    </label>
                    <input
                      type="tel"
                      required={under18}
                      value={guardianPhone}
                      onChange={e => setGuardianPhone(e.target.value)}
                      placeholder="+2348033001122"
                      className="w-full h-9 px-2.5 rounded-md border border-amber-300 bg-white text-xs text-slate-900 font-mono-numbers"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>ID Verification:</strong> Shop profile is reviewed by our moderator team to guarantee buyer trust.
              </span>
            </div>

            <button
              type="submit"
              className="w-full h-12 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] font-black rounded-xl text-xs sm:text-sm transition-all shadow-[0_3px_0_#111111] flex items-center justify-center gap-2 active:translate-y-0.5"
            >
              <span className="w-5 h-5 rounded-full bg-[#9FE870] text-[#111111] flex items-center justify-center font-black">
                ✓
              </span>
              <span>Launch My Shop</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
