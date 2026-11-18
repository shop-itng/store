import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Lock,
  Mail,
  Bell,
  Shield,
  Download,
  Trash2,
  Check,
  AlertTriangle,
  KeyRound,
  User as UserIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NotificationPrefs, PrivacySettings } from '../types';
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_PRIVACY_SETTINGS,
  UNDER_18_PRIVACY_SETTINGS,
} from '../utils/profileConstants';

export const AccountSettingsView: React.FC = () => {
  const {
    currentUser,
    setActiveView,
    openProfile,
    openAuthModal,
    refreshCurrentUser,
    updateMySettings,
    requestEmailChangeOtp,
    confirmEmailChange,
    exportMyData,
    deleteMyAccount,
    notify,
  } = useApp();

  const [isUnder18, setIsUnder18] = useState(Boolean(currentUser?.age !== undefined && currentUser.age < 18));
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(
    currentUser?.notificationPrefs || DEFAULT_NOTIFICATION_PREFS
  );
  const [privacy, setPrivacy] = useState<PrivacySettings>(
    currentUser?.privacySettings || (isUnder18 ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS)
  );
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Password Change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Email Change state (2-step OTP)
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailStep, setEmailStep] = useState<'request' | 'confirm'>('request');
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [confirmingEmail, setConfirmingEmail] = useState(false);

  // Data Export & Account Deletion state
  const [exporting, setExporting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Hydrate latest notification & privacy preferences from /api/profiles/me
  useEffect(() => {
    if (!currentUser?.id) return;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('shopit_session_token') : null;
    fetch('/api/profiles/me', {
      headers: token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {},
      credentials: 'include',
    })
      .then(r => r.json())
      .then(data => {
        if (data.status && data.profile) {
          setIsUnder18(Boolean(data.profile.isUnder18));
          if (data.profile.notificationPrefs) setNotifPrefs(data.profile.notificationPrefs);
          if (data.profile.privacySettings) setPrivacy(data.profile.privacySettings);
        }
      })
      .catch(() => {});
  }, [currentUser?.id]);

  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#FFF4EC] dark:bg-[#1E2028] text-[#FF6B00] flex items-center justify-center mx-auto border border-[#FED7AA] dark:border-[#27272A]">
          <Shield className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-black text-[#111111] dark:text-white">Sign In Required</h2>
        <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
          Sign in to manage your security, notifications, privacy, or account data.
        </p>
        <button
          type="button"
          onClick={() => openAuthModal('login')}
          className="px-5 py-2.5 rounded-xl bg-[#FF6B00] text-[#111111] font-black text-xs border-2 border-[#111111]"
        >
          Sign In
        </button>
      </div>
    );
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.trim().length < 8) {
      notify('New password must be at least 8 characters.', 'error');
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      notify('New password and confirmation do not match.', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('shopit_session_token') : null;
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        notify(data.message || 'Failed to update password.', 'error');
        return;
      }
      if (data.sessionToken && typeof localStorage !== 'undefined') {
        localStorage.setItem('shopit_session_token', data.sessionToken);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refreshCurrentUser();
      notify('Password updated and older sessions signed out!', 'success');
    } catch {
      notify('Network error updating password.', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleRequestEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingEmailOtp(true);
    const res = await requestEmailChangeOtp(newEmail.trim(), emailPassword.trim());
    setSendingEmailOtp(false);
    if (res.status) {
      setEmailStep('confirm');
    }
  };

  const handleConfirmEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmingEmail(true);
    const res = await confirmEmailChange(newEmail.trim(), emailOtpCode.trim(), emailPassword.trim());
    setConfirmingEmail(false);
    if (res.status) {
      setNewEmail('');
      setEmailPassword('');
      setEmailOtpCode('');
      setEmailStep('request');
    }
  };

  const handleSaveNotifs = async () => {
    setSavingNotifs(true);
    await updateMySettings({ notificationPrefs: notifPrefs });
    setSavingNotifs(false);
  };

  const handleSavePrivacy = async () => {
    setSavingPrivacy(true);
    const res = await updateMySettings({ privacySettings: privacy });
    if (res.privacySettings) setPrivacy(res.privacySettings);
    setSavingPrivacy(false);
  };

  const handleExport = async () => {
    setExporting(true);
    await exportMyData();
    setExporting(false);
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmText.trim() !== 'DELETE') {
      notify('Type DELETE in all caps to confirm.', 'error');
      return;
    }
    setDeletingAccount(true);
    const res = await deleteMyAccount(deletePassword.trim(), deleteConfirmText.trim());
    setDeletingAccount(false);
    if (res.status) {
      setIsDeleteModalOpen(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-fade-in-up">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => setActiveView('catalog')}
            className="flex items-center gap-1.5 text-xs font-bold text-[#71717A] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white mb-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Marketplace</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-black text-[#111111] dark:text-white">Account Settings</h1>
          <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
            Manage your password, email address, privacy controls, and personal data.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openProfile(currentUser.profileSlug || currentUser.id)}
          className="px-4 py-2 rounded-xl bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] font-black text-xs border-2 border-[#111111] flex items-center gap-1.5"
        >
          <UserIcon className="w-3.5 h-3.5" />
          <span>View My Profile</span>
        </button>
      </div>

      {/* Section 1: Change Password */}
      <section className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFF4EC] dark:bg-[#1E2028] text-[#FF6B00] flex items-center justify-center">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#111111] dark:text-white">Change Password</h2>
            <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
              Changing your password signs out all other active sessions.
            </p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <input
            type="password"
            required={!currentUser.mustChangePassword}
            placeholder="Current Password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="New Password (min 8 chars)"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
          />
          <div className="sm:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={changingPassword}
              className="px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#27272A] text-[#9FE870] font-black text-xs border border-[#FF6B00] disabled:opacity-50"
            >
              {changingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>

      {/* Section 2: Change Email (2-step OTP) */}
      <section className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFF4EC] dark:bg-[#1E2028] text-[#FF6B00] flex items-center justify-center">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#111111] dark:text-white">Email Address</h2>
            <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
              Current login email: <strong className="text-[#111111] dark:text-white">{currentUser.email}</strong>
            </p>
          </div>
        </div>

        {emailStep === 'request' ? (
          <form onSubmit={handleRequestEmailOtp} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <input
              type="email"
              required
              placeholder="New Email Address"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
            />
            <input
              type="password"
              required
              placeholder="Current Password to Authorize"
              value={emailPassword}
              onChange={e => setEmailPassword(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
            />
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={sendingEmailOtp}
                className="px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E55E00] text-[#111111] font-black text-xs border-2 border-[#111111] disabled:opacity-50"
              >
                {sendingEmailOtp ? 'Sending Code...' : 'Send 6-Digit Verification Code'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleConfirmEmailChange} className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
              Enter the 6-digit verification code sent to <strong>{newEmail}</strong>.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                maxLength={6}
                placeholder="6-Digit Code"
                value={emailOtpCode}
                onChange={e => setEmailOtpCode(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white font-mono-numbers tracking-widest focus:border-[#FF6B00] focus:outline-none"
              />
              <input
                type="password"
                required
                placeholder="Current Password"
                value={emailPassword}
                onChange={e => setEmailPassword(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEmailStep('request')}
                className="px-3.5 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] font-bold text-[#52525B] dark:text-[#A1A1AA]"
              >
                Change Email
              </button>
              <button
                type="submit"
                disabled={confirmingEmail}
                className="px-4 py-2 rounded-xl bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] font-black border-2 border-[#111111] disabled:opacity-50"
              >
                {confirmingEmail ? 'Confirming...' : 'Confirm Email Change'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Section 3: Notification Preferences */}
      <section className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFF4EC] dark:bg-[#1E2028] text-[#FF6B00] flex items-center justify-center">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#111111] dark:text-white">Email Notifications</h2>
            <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
              Choose which real email alerts Shop It sends to {currentUser.email}.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {[
            { key: 'emailOrders' as const, label: 'Order & Escrow Updates', desc: 'Confirmations, dispatch & PIN release alerts' },
            { key: 'emailMessages' as const, label: 'Escrow Chat Messages', desc: 'Alerts when a buyer or seller replies' },
            { key: 'emailFollowers' as const, label: 'New Followers & Requests', desc: 'Updates when members follow your shop/profile' },
            { key: 'emailRestock' as const, label: 'Restock Alerts', desc: 'Notifications when saved sold-out items return' },
          ].map(item => (
            <label
              key={item.key}
              className="flex items-start justify-between gap-3 p-3 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#1E2028] cursor-pointer"
            >
              <div>
                <span className="font-bold text-[#111111] dark:text-white block">{item.label}</span>
                <span className="text-[11px] text-[#71717A] dark:text-[#A1A1AA]">{item.desc}</span>
              </div>
              <input
                type="checkbox"
                checked={Boolean(notifPrefs[item.key])}
                onChange={e => setNotifPrefs(prev => ({ ...prev, [item.key]: e.target.checked }))}
                className="mt-1 w-4 h-4 accent-[#FF6B00]"
              />
            </label>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={savingNotifs}
            onClick={handleSaveNotifs}
            className="px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#27272A] text-[#9FE870] font-black text-xs border border-[#FF6B00] flex items-center gap-1.5 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{savingNotifs ? 'Saving...' : 'Save Notification Preferences'}</span>
          </button>
        </div>
      </section>

      {/* Section 4: Privacy Settings */}
      <section className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFF4EC] dark:bg-[#1E2028] text-[#FF6B00] flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#111111] dark:text-white">Privacy & Safety Controls</h2>
            <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
              Control who can view your profile activity and contact you inside Shop It.
            </p>
          </div>
        </div>

        {isUnder18 && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
            <Shield className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong>Under-18 Youth Protection Active:</strong> For safety, last-seen status, public follower lists, approval-required follows, and mutual-only messages are enforced automatically by the server.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-[#111111] dark:text-white block">Profile Visibility</label>
            <select
              value={privacy.profileVisibility}
              onChange={e =>
                setPrivacy(prev => ({ ...prev, profileVisibility: e.target.value as PrivacySettings['profileVisibility'] }))
              }
              className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
            >
              <option value="public">Public (Anyone on Shop It)</option>
              <option value="followers">Followers Only</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-[#111111] dark:text-white block">Who Can Follow Me</label>
            <select
              disabled={isUnder18}
              value={isUnder18 ? 'approval' : privacy.whoCanFollow}
              onChange={e =>
                setPrivacy(prev => ({ ...prev, whoCanFollow: e.target.value as PrivacySettings['whoCanFollow'] }))
              }
              className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white disabled:opacity-60 focus:border-[#FF6B00] focus:outline-none"
            >
              <option value="everyone">Everyone</option>
              <option value="approval">Require My Approval</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-[#111111] dark:text-white block">Who Can Message Me</label>
            <select
              disabled={isUnder18}
              value={isUnder18 ? 'mutual' : privacy.whoCanMessage}
              onChange={e =>
                setPrivacy(prev => ({ ...prev, whoCanMessage: e.target.value as PrivacySettings['whoCanMessage'] }))
              }
              className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white disabled:opacity-60 focus:border-[#FF6B00] focus:outline-none"
            >
              <option value="everyone">Everyone</option>
              <option value="followers">Followers</option>
              <option value="mutual">Mutual Follows Only</option>
            </select>
          </div>

          <div className="flex flex-col justify-center gap-2 p-3 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#1E2028]">
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="font-semibold text-[#111111] dark:text-white">Show Last Active Time</span>
              <input
                type="checkbox"
                disabled={isUnder18}
                checked={isUnder18 ? false : privacy.showLastSeen}
                onChange={e => setPrivacy(prev => ({ ...prev, showLastSeen: e.target.checked }))}
                className="w-4 h-4 accent-[#FF6B00]"
              />
            </label>
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="font-semibold text-[#111111] dark:text-white">Show Followers List</span>
              <input
                type="checkbox"
                disabled={isUnder18}
                checked={isUnder18 ? false : privacy.showFollowersList}
                onChange={e => setPrivacy(prev => ({ ...prev, showFollowersList: e.target.checked }))}
                className="w-4 h-4 accent-[#FF6B00]"
              />
            </label>
            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="font-semibold text-[#111111] dark:text-white">Show Following List</span>
              <input
                type="checkbox"
                disabled={isUnder18}
                checked={isUnder18 ? false : privacy.showFollowingList}
                onChange={e => setPrivacy(prev => ({ ...prev, showFollowingList: e.target.checked }))}
                className="w-4 h-4 accent-[#FF6B00]"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={savingPrivacy}
            onClick={handleSavePrivacy}
            className="px-4 py-2 rounded-xl bg-[#111111] hover:bg-[#27272A] text-[#9FE870] font-black text-xs border border-[#FF6B00] flex items-center gap-1.5 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{savingPrivacy ? 'Saving...' : 'Save Privacy Settings'}</span>
          </button>
        </div>
      </section>

      {/* Section 5: Data Portability & Delete Account */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-black text-[#111111] dark:text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-[#FF6B00]" />
              <span>Download My Data</span>
            </h2>
            <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] leading-relaxed">
              Download a sanitized JSON copy of your profile, listings, orders, wishlist, and account history (NDPA 2023 portability right).
            </p>
          </div>
          <button
            type="button"
            disabled={exporting}
            onClick={handleExport}
            className="px-4 py-2.5 rounded-xl bg-[#FAFAFA] hover:bg-[#FFF4EC] dark:bg-[#1E2028] dark:hover:bg-[#27272A] text-[#111111] dark:text-white border border-[#E4E4E7] dark:border-[#27272A] font-black text-xs flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4 text-[#FF6B00]" />
            <span>{exporting ? 'Preparing Export...' : 'Download JSON Data'}</span>
          </button>
        </div>

        <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-rose-200 dark:border-rose-900/50 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-black text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              <span>Delete Account</span>
            </h2>
            <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] leading-relaxed">
              Permanently deactivate your account, pause all listings, and anonymize your personal details across orders and reviews.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-black text-xs flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete My Account</span>
          </button>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-backdrop">
          <div className="bg-white dark:bg-[#15161C] rounded-2xl max-w-md w-full border border-rose-300 dark:border-rose-900 p-5 space-y-4 shadow-2xl animate-modal-enter">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#111111] dark:text-white">Confirm Permanent Deletion</h3>
                <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] mt-0.5">
                  This action anonymizes your account and signs you out immediately. It cannot be undone.
                </p>
              </div>
            </div>

            <form onSubmit={handleDeleteAccount} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#111111] dark:text-white block mb-1">
                  Enter Your Current Password *
                </label>
                <input
                  type="password"
                  required
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white"
                />
              </div>
              <div>
                <label className="font-bold text-[#111111] dark:text-white block mb-1">
                  Type <span className="font-mono text-rose-600">DELETE</span> to confirm *
                </label>
                <input
                  type="text"
                  required
                  placeholder="DELETE"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] font-bold text-[#52525B] dark:text-[#A1A1AA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deletingAccount || deleteConfirmText.trim() !== 'DELETE'}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black"
                >
                  {deletingAccount ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
