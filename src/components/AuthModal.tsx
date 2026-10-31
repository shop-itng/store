import React, { useState, useEffect } from 'react';
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
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  generateEmailOtp,
  verifyEmailOtp,
  isKnownDevice,
  recordKnownDevice,
  getDeviceId,
} from '../utils/emailOtpManager';

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
    emergencyControls,
  } = useApp();

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state (Email only - no phone number)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('buyer');

  // OTP state
  const [otpCode, setOtpCode] = useState('');

  // Cooldown countdown timers (60 seconds)
  const [signupCooldown, setSignupCooldown] = useState(0);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [newDeviceCooldown, setNewDeviceCooldown] = useState(0);

  // New Device Verification State
  const [pendingNewDeviceUser, setPendingNewDeviceUser] = useState<any>(null);
  const [deviceOtpInput, setDeviceOtpInput] = useState('');

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'otp_and_reset'>('email');
  const [forgotOtpInput, setForgotOtpInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);

  // Seller registration specifics (youth seller)
  const [shopName, setShopName] = useState('');
  const [stateName, setStateName] = useState('Lagos');
  const [cityName, setCityName] = useState('Lagos Mainland');
  const [areaName, setAreaName] = useState('Yaba');
  const [bio, setBio] = useState('');
  const [under18, setUnder18] = useState(false);
  const [guardianName, setGuardianName] = useState('');

  // Tick 1-second countdown for all active OTP resend cooldowns
  useEffect(() => {
    const timer = setInterval(() => {
      setSignupCooldown(prev => (prev > 0 ? prev - 1 : 0));
      setResetCooldown(prev => (prev > 0 ? prev - 1 : 0));
      setNewDeviceCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isAuthModalOpen) return null;

  // 1. Password Reset Flow (Email OTP, 10-min expiry, 3 attempts, 60s cooldown)
  const handleSendResetOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      notify('Please enter a valid email address.', 'error');
      return;
    }

    setIsSendingResetEmail(true);
    const otpResult = generateEmailOtp(cleanEmail, 'password_reset');
    setIsSendingResetEmail(false);

    if (!otpResult.success) {
      notify(otpResult.error || 'Failed to dispatch reset code.', 'error');
      return;
    }

    setForgotStep('otp_and_reset');
    setResetCooldown(60);
    notify(`[Password Reset] 4-digit code sent to ${cleanEmail}! (Code: ${otpResult.code}). Valid for 10 mins.`, 'success');
  };

  const handleResendResetOtp = () => {
    const cleanEmail = forgotEmail.trim().toLowerCase();
    const otpResult = generateEmailOtp(cleanEmail, 'password_reset');
    if (!otpResult.success) {
      notify(otpResult.error || 'Please wait before requesting a new code.', 'error');
      return;
    }
    setResetCooldown(60);
    notify(`[Password Reset] New code sent to ${cleanEmail}! (Code: ${otpResult.code}). Valid for 10 mins.`, 'info');
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = forgotEmail.trim().toLowerCase();

    const verifyResult = verifyEmailOtp(cleanEmail, 'password_reset', forgotOtpInput);
    if (!verifyResult.success) {
      notify(verifyResult.error || 'Invalid or expired reset code. Please request a new code.', 'error');
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
        password: newPassword,
        role: 'buyer',
        isVerifiedEmail: true,
      });
    }

    localStorage.setItem('shopit_registered_users', JSON.stringify(registeredUsers));

    notify('Password reset successfully! You can now sign in with your new password.', 'success');
    setLoginEmail(cleanEmail);
    setLoginPassword('');
    setForgotStep('email');
    setAuthTab('login');
  };

  // 2. Login Flow (Email & Password + New Device Challenge)
  const handleLoginFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = loginEmail.trim().toLowerCase();
    const cleanPass = loginPassword.trim();
    const currentDeviceId = getDeviceId();

    let matchedUser: any = null;

    // Check if logging in as Admin Moderator (Adeyinka Joseph)
    if (
      cleanEmail === ADMIN_CREDENTIALS.email.toLowerCase() &&
      cleanPass === ADMIN_CREDENTIALS.password
    ) {
      matchedUser = {
        id: 'admin_adeyinka_joseph',
        name: ADMIN_CREDENTIALS.name,
        email: ADMIN_CREDENTIALS.email,
        role: 'admin',
        adminSubRole: 'moderator',
        isVerifiedEmail: true,
      };
    } else {
      // Check localStorage registered users
      const registeredUsersStr = localStorage.getItem('shopit_registered_users');
      const registeredUsers: any[] = registeredUsersStr ? JSON.parse(registeredUsersStr) : [];
      const foundUser = registeredUsers.find(
        u => u.email.toLowerCase() === cleanEmail && u.password === cleanPass
      );
      if (foundUser) {
        matchedUser = foundUser;
      }
    }

    if (!matchedUser) {
      notify('Invalid login credentials. Please check your email and password.', 'error');
      return;
    }

    // New Device Security Check (Rule 3)
    const isDeviceKnown = isKnownDevice(cleanEmail, currentDeviceId);
    if (!isDeviceKnown) {
      const otpResult = generateEmailOtp(cleanEmail, 'new_device_login');
      if (!otpResult.success) {
        notify(otpResult.error || 'Could not dispatch device verification code.', 'error');
        return;
      }

      setPendingNewDeviceUser(matchedUser);
      setNewDeviceCooldown(60);
      setDeviceOtpInput(otpResult.code!);
      setAuthTab('new_device_otp' as any);
      notify(`[Security Alert] New device detected! Authorization code sent to ${cleanEmail}. (Code: ${otpResult.code}). Valid for 10 mins.`, 'info');
      return;
    }

    // Known device - complete login
    if (matchedUser.role === 'admin' || matchedUser.email?.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase()) {
      localStorage.setItem('shopit_admin_session_active', 'true');
    } else {
      localStorage.removeItem('shopit_admin_session_active');
    }
    login(matchedUser);
    closeAuthModal();
    notify(`Welcome back, ${matchedUser.name}!`, 'success');
  };

  const handleNewDeviceOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingNewDeviceUser) return;
    const cleanEmail = pendingNewDeviceUser.email.toLowerCase();
    const result = verifyEmailOtp(cleanEmail, 'new_device_login', deviceOtpInput);
    if (!result.success) {
      notify(result.error || 'Invalid or expired authorization code. Please request a new code.', 'error');
      return;
    }

    recordKnownDevice(cleanEmail, getDeviceId());
    if (pendingNewDeviceUser.role === 'admin' || pendingNewDeviceUser.email?.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase()) {
      localStorage.setItem('shopit_admin_session_active', 'true');
    } else {
      localStorage.removeItem('shopit_admin_session_active');
    }
    login(pendingNewDeviceUser);
    closeAuthModal();
    setPendingNewDeviceUser(null);
    notify(`New device authorized! Welcome back, ${pendingNewDeviceUser.name}.`, 'success');
  };

  const handleResendNewDeviceOtp = () => {
    if (!pendingNewDeviceUser) return;
    const cleanEmail = pendingNewDeviceUser.email.toLowerCase();
    const otpResult = generateEmailOtp(cleanEmail, 'new_device_login');
    if (!otpResult.success) {
      notify(otpResult.error || 'Please wait before requesting a new code.', 'error');
      return;
    }
    setNewDeviceCooldown(60);
    setDeviceOtpInput(otpResult.code!);
    notify(`[Security Alert] New code sent to ${cleanEmail}: ${otpResult.code}. Valid for 10 mins.`, 'info');
  };

  // 3. Initial Signup Flow (Email only - no phone number required)
  const handleInitialSignup = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      notify('Please enter a valid email address.', 'error');
      return;
    }

    if (password.length < 6) {
      notify('Password should be at least 6 characters.', 'error');
      return;
    }

    const otpResult = generateEmailOtp(cleanEmail, 'signup');
    if (!otpResult.success) {
      notify(otpResult.error || 'Could not send verification code.', 'error');
      return;
    }

    const authData = {
      id: `user_${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      password,
      role,
    };
    setPendingAuthData(authData);
    setSignupCooldown(60);
    setOtpCode(otpResult.code!);
    setAuthTab('otp');
    notify(`[Email Verification] A 4-digit code was sent to ${cleanEmail}! (Code: ${otpResult.code}). Valid for 10 mins.`, 'info');
  };

  const handleResendSignupCode = () => {
    if (!pendingAuthData?.email) return;
    const otpResult = generateEmailOtp(pendingAuthData.email, 'signup');
    if (!otpResult.success) {
      notify(otpResult.error || 'Please wait before requesting a new code.', 'error');
      return;
    }
    setSignupCooldown(60);
    setOtpCode(otpResult.code!);
    notify(`[Email Verification] A new 4-digit code was sent to ${pendingAuthData.email}! (Code: ${otpResult.code}). Valid for 10 mins.`, 'info');
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyOtp(otpCode);
  };

  // Location Selector
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

  // 4. Seller Registration Step (Under-18 Guardian Name, no phone number field)
  const handleSellerFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (under18 && !guardianName.trim()) {
      notify('Youth sellers under 18 require a verified guardian name for payouts.', 'error');
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
      guardianName: under18 ? guardianName.trim() : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-8 border-2 border-[#111111]">
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute right-5 top-5 text-slate-400 hover:text-slate-700 p-1"
          aria-label="Close authentication modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab Header: Sign In vs Sign Up */}
        {authTab !== 'seller_register' && authTab !== 'otp' && (authTab as any) !== 'new_device_otp' && (
          <div className="flex border-b border-slate-100 pb-3 gap-6">
            <button
              type="button"
              onClick={() => setAuthTab('login')}
              className={`text-sm sm:text-base font-bold pb-1 transition-colors relative ${
                authTab === 'login' || authTab === 'forgot_password'
                  ? 'text-[#111111] font-black'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Sign In
              {(authTab === 'login' || authTab === 'forgot_password') && (
                <span className="absolute bottom-[-13px] left-0 w-full h-0.5 bg-[#FF6B00]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setAuthTab('signup')}
              className={`text-sm sm:text-base font-bold pb-1 transition-colors relative ${
                authTab === 'signup'
                  ? 'text-[#111111] font-black'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Create Account
              {authTab === 'signup' && (
                <span className="absolute bottom-[-13px] left-0 w-full h-0.5 bg-[#FF6B00]" />
              )}
            </button>
          </div>
        )}

        {/* Tab 1: SIGN IN (Email & Password) */}
        {authTab === 'login' && (
          <form onSubmit={handleLoginFormSubmit} className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#111111]">Welcome Back</h2>
              <p className="text-xs text-[#71717A] mt-1">
                Enter your email address and password to sign in.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="name@gmail.com"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(loginEmail);
                    setForgotStep('email');
                    setAuthTab('forgot_password');
                  }}
                  className="text-[11px] font-semibold text-[#FF6B00] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
              />
            </div>

            <button
              type="submit"
              className="w-full h-12 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] font-black rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-[0_3px_0_#111111] active:translate-y-0.5"
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <span className="font-semibold text-slate-700">Test Moderator:</span>
              <button
                type="button"
                onClick={() => {
                  setLoginEmail(ADMIN_CREDENTIALS.email);
                  setLoginPassword(ADMIN_CREDENTIALS.password);
                }}
                className="text-[11px] font-black text-[#FF6B00] bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200 hover:bg-orange-100"
              >
                Autofill Credentials
              </button>
            </div>
          </form>
        )}

        {/* Tab 1b: NEW DEVICE LOGIN OTP CHALLENGE (Rule 3) */}
        {(authTab as any) === 'new_device_otp' && (
          <form onSubmit={handleNewDeviceOtpSubmit} className="space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 border-2 border-[#111111] flex items-center justify-center mx-auto shadow-xs">
                <Lock className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-xl font-black text-slate-900">New Device Verification</h2>
              <p className="text-xs text-slate-500">
                A 4-digit authorization code was sent to <strong className="text-slate-800">{pendingNewDeviceUser?.email}</strong>
              </p>
            </div>

            <div className="py-2">
              <input
                type="text"
                maxLength={4}
                autoFocus
                required
                value={deviceOtpInput}
                onChange={e => setDeviceOtpInput(e.target.value)}
                placeholder="••••"
                className="w-36 h-12 mx-auto tracking-widest text-center text-2xl font-black rounded-xl border-2 border-[#111111] text-slate-900 block focus:outline-none focus:ring-2 focus:ring-[#FF6B00] font-mono-numbers"
              />
              <span className="text-[11px] text-slate-500 text-center block mt-2">
                ⏱ Code expires in 10 minutes · 3 attempts allowed
              </span>
            </div>

            <button
              type="submit"
              className="w-full h-12 bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] border-2 border-[#111111] font-black rounded-xl text-xs sm:text-sm transition-all shadow-[0_3px_0_#111111] active:translate-y-0.5"
            >
              Authorize &amp; Sign In
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setAuthTab('login')}
                className="text-slate-500 hover:text-slate-800 underline"
              >
                Back to Login
              </button>
              <button
                type="button"
                disabled={newDeviceCooldown > 0}
                onClick={handleResendNewDeviceOtp}
                className={`font-bold ${
                  newDeviceCooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-[#FF6B00] hover:underline'
                }`}
              >
                {newDeviceCooldown > 0 ? `Resend code in ${newDeviceCooldown}s` : 'Resend Email Code'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 1c: FORGOT PASSWORD FLOW (Email OTP Only) */}
        {authTab === 'forgot_password' && (
          <div className="space-y-4">
            <div>
              <button
                type="button"
                onClick={() => setAuthTab('login')}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-2 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to sign in</span>
              </button>
              <h2 className="text-xl font-black text-[#111111]">Reset Password</h2>
              <p className="text-xs text-[#71717A] mt-1">
                {forgotStep === 'email'
                  ? 'Enter your registered email address to receive a 4-digit reset code.'
                  : `Enter the code sent to ${forgotEmail} and choose a new password.`}
              </p>
            </div>

            {forgotStep === 'email' ? (
              <form onSubmit={handleSendResetOtp} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSendingResetEmail}
                  className="w-full h-12 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] font-black rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-[0_3px_0_#111111] active:translate-y-0.5 disabled:opacity-70"
                >
                  <Mail className="w-4 h-4 text-[#111111]" />
                  <span>{isSendingResetEmail ? 'Sending Code...' : 'Send Reset Code to Email'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">4-Digit Email Code *</label>
                    <button
                      type="button"
                      disabled={resetCooldown > 0}
                      onClick={handleResendResetOtp}
                      className={`text-[11px] font-bold ${
                        resetCooldown > 0 ? 'text-slate-400' : 'text-[#FF6B00] hover:underline'
                      }`}
                    >
                      {resetCooldown > 0 ? `Resend in ${resetCooldown}s` : 'Resend Code'}
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    value={forgotOtpInput}
                    onChange={e => setForgotOtpInput(e.target.value)}
                    placeholder="••••"
                    className="w-full h-11 px-3.5 tracking-widest text-center text-lg font-black font-mono-numbers rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    ⏱ Valid for 10 minutes · 3 wrong attempts max
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">New Password (Min 6 chars)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full h-12 bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] border-2 border-[#111111] font-black rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-[0_3px_0_#111111] active:translate-y-0.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#111111]" />
                  <span>Update Password &amp; Sign In</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: SIGN UP (Email only - no phone number field) */}
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
                onClick={() => {
                  if (emergencyControls?.pauseSellerSignups) {
                    notify('New seller registrations are temporarily paused by platform moderation. Please join as a shopper for now.', 'info');
                    return;
                  }
                  setRole('seller');
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  emergencyControls?.pauseSellerSignups ? 'opacity-60 cursor-not-allowed' : ''
                } ${
                  role === 'seller'
                    ? 'bg-white text-[#111111] shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Store className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Youth Seller {emergencyControls?.pauseSellerSignups ? '(Paused)' : ''}</span>
              </button>
            </div>

            {emergencyControls?.pauseSellerSignups && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-tight">
                <strong>Safety Notice:</strong> New artisan seller registrations are temporarily paused for routine safety review. Buyer signups are fully open.
              </div>
            )}

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
              <span>Continue with Email OTP</span>
            </button>
          </form>
        )}

        {/* Tab 3: EMAIL OTP VERIFICATION (Rule 2 & 3) */}
        {authTab === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-[#F0FDF4] text-[#16A34A] border-2 border-[#111111] flex items-center justify-center mx-auto shadow-xs">
                <Mail className="w-6 h-6 text-[#16A34A]" />
              </div>
              <h2 className="text-xl font-black text-slate-900">Verify Your Email Address</h2>
              <p className="text-xs text-slate-500">
                Enter the 4-digit code sent to your inbox at <strong className="text-slate-800">{pendingAuthData?.email || email}</strong>
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
                placeholder="••••"
                className="w-36 h-12 mx-auto tracking-widest text-center text-2xl font-black rounded-xl border-2 border-[#111111] text-slate-900 block focus:outline-none focus:ring-2 focus:ring-[#FF6B00] font-mono-numbers"
              />
              <span className="text-[11px] text-slate-500 text-center block mt-2">
                ⏱ Code expires in 10 minutes · 3 attempts allowed
              </span>
            </div>

            <button
              type="submit"
              className="w-full h-12 bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] border-2 border-[#111111] font-black rounded-xl text-xs sm:text-sm transition-all shadow-[0_3px_0_#111111] active:translate-y-0.5"
            >
              Verify &amp; Complete Registration
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setAuthTab('signup')}
                className="text-slate-500 hover:text-slate-800 underline"
              >
                Change Email Address
              </button>
              <button
                type="button"
                disabled={signupCooldown > 0}
                onClick={handleResendSignupCode}
                className={`font-bold ${
                  signupCooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-[#FF6B00] hover:underline'
                }`}
              >
                {signupCooldown > 0 ? `Resend in ${signupCooldown}s` : 'Resend Email Code'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 4: SELLER ID & UNDER-18 GUARDIAN SETUP */}
        {authTab === 'seller_register' && (
          <form onSubmit={handleSellerFormSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B00]" />
                <h2 className="text-xl font-black text-[#111111]">Artisan Shop Setup</h2>
              </div>
              <p className="text-xs text-[#71717A] mt-1">
                Tell buyers about your handmade crafts, beads, or fashion brand.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Shop / Brand Name *
              </label>
              <input
                type="text"
                required
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                placeholder="e.g. Beads By Tiwa"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
              />
            </div>

            {/* Location Selector */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">State</label>
                <select
                  value={stateName}
                  onChange={e => handleStateChange(e.target.value)}
                  className="w-full h-11 px-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white"
                >
                  {NIGERIAN_STATES.map(s => (
                    <option key={s.state} value={s.state}>
                      {s.state}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">City / L.G.A</label>
                <select
                  value={cityName}
                  onChange={e => handleCityChange(e.target.value)}
                  className="w-full h-11 px-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white"
                >
                  {activeStateObj.cities.map(c => (
                    <option key={c.city} value={c.city}>
                      {c.city}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Neighborhood / Campus Area *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={areaName}
                  onChange={e => setAreaName(e.target.value)}
                  placeholder="e.g. Akoka / UNILAG / Yaba"
                  className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Artisan Bio &amp; Craft Specialty *
              </label>
              <textarea
                required
                rows={2}
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="What handmade products do you make? (crochet, beaded bags, fragrance oils, etc.)"
                className="w-full p-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
              />
            </div>

            {/* Youth Protection: Under 18 Checkbox */}
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={under18}
                  onChange={e => setUnder18(e.target.checked)}
                  className="mt-0.5 rounded text-[#FF6B00] focus:ring-[#FF6B00]"
                />
                <span className="text-xs font-bold text-amber-950">
                  I am a youth maker under 18 years old
                </span>
              </label>

              {under18 && (
                <div className="pt-2 border-t border-amber-200/60">
                  <label className="text-[11px] font-semibold text-amber-950 block mb-0.5">
                    Parent / Legal Guardian Full Name *
                  </label>
                  <input
                    type="text"
                    required={under18}
                    value={guardianName}
                    onChange={e => setGuardianName(e.target.value)}
                    placeholder="e.g. Mrs. Folashade Adeyemi"
                    className="w-full h-9 px-2.5 rounded-md border border-amber-300 bg-white text-xs text-slate-900"
                  />
                  <p className="text-[10px] text-amber-800 mt-1">
                    Under the Nigeria Data Protection Act, teen artisans under 18 operate with parent/guardian consent.
                  </p>
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
              className="w-full h-12 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] font-black rounded-xl text-xs sm:text-sm transition-all shadow-[0_3px_0_#111111] active:translate-y-0.5"
            >
              Launch My Shop On Campus
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
