import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { PublicProfileData, Product } from '../types';
import { ProductCard } from './ProductCard';
import { ShareButtons } from './ShareButtons';
import { ReportModal, ReportTarget } from './ReportModal';
import { EditProfileModal } from './EditProfileModal';
import { UserIdentityBadge } from './UserIdentityBadge';
import { getProfileUrl, formatMemberSince, formatLastSeen } from '../utils/profileConstants';
import { formatNaira } from '../utils/pricing';
import {
  MapPin,
  Star,
  ShieldCheck,
  ArrowLeft,
  Calendar,
  ShoppingBag,
  Palmtree,
  Flag,
  MessageSquare,
  Edit3,
  Settings,
  Plus,
  Pin,
  PauseCircle,
  PlayCircle,
  Trash2,
  PackageCheck,
  Lock,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  Store,
  Heart,
  UserPlus,
  UserCheck,
  Users,
  Ban,
  X,
  Check,
  Bell,
  BellOff,
  Search,
} from 'lucide-react';
import { FollowRequestItem, FollowListUser } from '../types';

interface SellerShopViewProps {
  slugOrId: string;
  onBack: () => void;
}

type ProfileTab = 'products' | 'about' | 'reviews' | 'followers' | 'following' | 'drafts' | 'saved' | 'orders';

export const SellerShopView: React.FC<SellerShopViewProps> = ({ slugOrId, onBack }) => {
  const {
    currentUser,
    orders,
    openChat,
    openProduct,
    openProfile,
    openQuickListModal,
    openAccountSettings,
    openAuthModal,
    setActiveView,
    toggleProductPin,
    toggleProductPause,
    toggleProductStock,
    deleteProduct,
    updateProduct,
    followUser,
    unfollowUser,
    fetchFollowRequests,
    respondToFollowRequest,
    fetchFollowList,
    blockUser,
    muteUser,
    unmuteUser,
  } = useApp();

  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('products');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [coverError, setCoverError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

  // Social interaction states
  const [followBusy, setFollowBusy] = useState(false);
  const [muteBusy, setMuteBusy] = useState(false);
  const [followListModal, setFollowListModal] = useState<{
    mode: 'followers' | 'following';
    loading: boolean;
    users: FollowListUser[];
    error: string | null;
  } | null>(null);
  const [followTabSearch, setFollowTabSearch] = useState('');
  const [followTabLoading, setFollowTabLoading] = useState(false);
  const [followTabUsers, setFollowTabUsers] = useState<FollowListUser[]>([]);
  const [followTabError, setFollowTabError] = useState<string | null>(null);
  const [busyFollowRowId, setBusyFollowRowId] = useState<string | null>(null);
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [followRequests, setFollowRequests] = useState<FollowRequestItem[]>([]);
  const [busyRequestFollowerId, setBusyRequestFollowerId] = useState<string | null>(null);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [blockingUser, setBlockingUser] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!slugOrId) return;
    setLoading(true);
    setErrorMsg(null);
    setCoverError(false);
    setAvatarError(false);
    try {
      const token =
        typeof localStorage !== 'undefined' ? localStorage.getItem('shopit_session_token') : null;
      const res = await fetch(`/api/profiles/${encodeURIComponent(slugOrId)}`, {
        headers: token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {},
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status || !data.profile) {
        setProfile(null);
        setErrorMsg(data.message || 'Member profile could not be found.');
        return;
      }
      setProfile(data.profile);
      setIsOwner(Boolean(data.isOwner));
      setIsRestricted(Boolean(data.isRestricted));
      if (!data.isOwner) {
        setActiveTab(prev =>
          prev === 'drafts' || prev === 'saved' || prev === 'orders' ? 'products' : prev
        );
      }
    } catch {
      setErrorMsg('Network error loading profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [slugOrId, currentUser?.id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#FF6B00] animate-spin" />
        <p className="text-xs font-bold text-[#71717A] dark:text-[#A1A1AA]">Loading profile...</p>
      </div>
    );
  }

  if (errorMsg || !profile) {
    return (
      <div className="max-w-xl mx-auto px-4 py-14 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#FFF4EC] dark:bg-[#1E2028] text-[#FF6B00] flex items-center justify-center mx-auto border border-[#FED7AA] dark:border-[#27272A]">
          <ShoppingBag className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-[#111111] dark:text-white">Profile Unavailable</h2>
        <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">{errorMsg || 'Profile not found.'}</p>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => void loadProfile()}
            className="px-4 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-[#111111] dark:text-white"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 bg-[#111111] text-[#9FE870] text-xs font-black rounded-xl border border-[#FF6B00]"
          >
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  const allProducts = profile.products || [];
  const activeProducts = allProducts.filter(p => !p.isDraft && !p.isPaused);
  const draftOrPausedProducts = allProducts.filter(p => Boolean(p.isDraft || p.isPaused));
  const wishlistProducts = profile.wishlistProducts || [];
  const canonicalUrl = getProfileUrl(profile.profileSlug || profile.id);
  const lastSeenLabel = profile.lastSeenAt ? formatLastSeen(profile.lastSeenAt) : '';
  const hasSellerPresence = Boolean(profile.seller || profile.role === 'seller' || activeProducts.length > 0);
  const primaryTitle = profile.displayName || profile.seller?.shopName || 'Member';
  const subtitleShop =
    profile.seller?.shopName && profile.seller.shopName !== primaryTitle ? profile.seller.shopName : null;
  const coverSrc = profile.coverUrl || profile.seller?.bannerUrl || null;
  const avatarSrc = profile.avatarUrl || profile.seller?.logoUrl || null;

  const handlePinToggle = async (prod: Product) => {
    setBusyProductId(prod.id);
    const ok = await toggleProductPin(prod.id, !prod.isPinned);
    if (ok) await loadProfile();
    setBusyProductId(null);
  };

  const handlePauseToggle = async (prod: Product) => {
    setBusyProductId(prod.id);
    const ok = await toggleProductPause(prod.id, !prod.isPaused);
    if (ok) await loadProfile();
    setBusyProductId(null);
  };

  const handlePublishDraft = async (prod: Product) => {
    setBusyProductId(prod.id);
    await updateProduct(prod.id, { isDraft: false, isPaused: false });
    await loadProfile();
    setBusyProductId(null);
  };

  const handleSoldOutToggle = async (prod: Product) => {
    setBusyProductId(prod.id);
    await toggleProductStock(prod.id);
    await loadProfile();
    setBusyProductId(null);
  };

  const handleDeleteListing = async (prod: Product) => {
    setBusyProductId(prod.id);
    await deleteProduct(prod.id);
    await loadProfile();
    setBusyProductId(null);
  };

  const handleFollowToggle = async () => {
    if (!profile || followBusy) return;
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    setFollowBusy(true);
    const currentStatus = profile.followStatus || 'none';
    if (currentStatus === 'none') {
      const res = await followUser(profile.id);
      if (res.status) {
        setProfile(prev =>
          prev
            ? {
                ...prev,
                followStatus: res.followStatus || 'accepted',
                followersCount: res.followersCount ?? prev.followersCount,
              }
            : prev
        );
        if (res.followStatus === 'accepted' && isRestricted) {
          await loadProfile();
        }
      }
    } else {
      const res = await unfollowUser(profile.id);
      if (res.status) {
        setProfile(prev =>
          prev
            ? {
                ...prev,
                followStatus: 'none',
                followersCount: res.followersCount ?? prev.followersCount,
              }
            : prev
        );
      }
    }
    setFollowBusy(false);
  };

  const loadInlineFollowTab = useCallback(
    async (mode: 'followers' | 'following', q: string) => {
      if (!profile) return;
      setFollowTabLoading(true);
      setFollowTabError(null);
      const res = await fetchFollowList(profile.profileSlug || profile.id, mode, q);
      setFollowTabLoading(false);
      if (!res.status) {
        setFollowTabUsers([]);
        setFollowTabError(res.message || `Could not load ${mode}.`);
      } else {
        setFollowTabUsers(res.users);
      }
    },
    [profile, fetchFollowList]
  );

  useEffect(() => {
    if (activeTab === 'followers' || activeTab === 'following') {
      const timer = setTimeout(() => {
        void loadInlineFollowTab(activeTab, followTabSearch);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [activeTab, followTabSearch, loadInlineFollowTab]);

  const handleOpenFollowList = async (mode: 'followers' | 'following') => {
    if (!profile) return;
    setFollowTabSearch('');
    setActiveTab(mode);
  };

  const handleMuteToggle = async () => {
    if (!profile || muteBusy) return;
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    setMuteBusy(true);
    if (profile.isMuted) {
      const res = await unmuteUser(profile.id);
      if (res.status) {
        setProfile(prev => (prev ? { ...prev, isMuted: false } : prev));
      }
    } else {
      const res = await muteUser(profile.id);
      if (res.status) {
        setProfile(prev => (prev ? { ...prev, isMuted: true } : prev));
      }
    }
    setMuteBusy(false);
  };

  const handleRowFollowToggle = async (target: FollowListUser) => {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    if (busyFollowRowId || target.id === currentUser.id) return;
    setBusyFollowRowId(target.id);
    if (target.viewerFollowStatus === 'accepted' || target.viewerFollowStatus === 'pending') {
      const res = await unfollowUser(target.id);
      if (res.status) {
        setFollowTabUsers(prev =>
          prev.map(u => (u.id === target.id ? { ...u, viewerFollowStatus: 'none', isMutual: false } : u))
        );
      }
    } else {
      const res = await followUser(target.id);
      if (res.status) {
        const nextStatus = res.followStatus || 'accepted';
        setFollowTabUsers(prev =>
          prev.map(u =>
            u.id === target.id
              ? {
                  ...u,
                  viewerFollowStatus: nextStatus,
                  isMutual: activeTab === 'followers' && isOwner && nextStatus === 'accepted' ? true : u.isMutual,
                }
              : u
          )
        );
      }
    }
    setBusyFollowRowId(null);
  };

  const handleOpenFollowRequests = async () => {
    setRequestsModalOpen(true);
    setRequestsLoading(true);
    const list = await fetchFollowRequests();
    setFollowRequests(list);
    setRequestsLoading(false);
  };

  const handleRequestAction = async (followerId: string, action: 'accept' | 'decline') => {
    setBusyRequestFollowerId(followerId);
    const res = await respondToFollowRequest(followerId, action);
    if (res.status) {
      setFollowRequests(prev => prev.filter(r => r.followerId !== followerId));
      setProfile(prev =>
        prev
          ? {
              ...prev,
              followersCount: res.followersCount ?? prev.followersCount,
              pendingFollowRequestsCount: Math.max(0, (prev.pendingFollowRequestsCount || 1) - 1),
            }
          : prev
      );
    }
    setBusyRequestFollowerId(null);
  };

  const handleConfirmBlock = async () => {
    if (!profile || blockingUser) return;
    setBlockingUser(true);
    const res = await blockUser(profile.id);
    setBlockingUser(false);
    if (res.status) {
      setBlockConfirmOpen(false);
      onBack();
    }
  };

  const renderOwnerListingBar = (prod: Product, inDraftsTab = false) => {
    const busy = busyProductId === prod.id;
    return (
      <div className="mt-2 p-2 rounded-xl bg-white dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] flex flex-wrap items-center gap-1.5 text-[11px]">
        <button
          type="button"
          disabled={busy}
          onClick={() => openQuickListModal(prod)}
          className="px-2 py-1 rounded-lg bg-[#FAFAFA] dark:bg-[#1E2028] hover:border-[#FF6B00] border border-[#E4E4E7] dark:border-[#27272A] font-bold text-[#111111] dark:text-white flex items-center gap-1"
        >
          <Edit3 className="w-3 h-3 text-[#FF6B00]" />
          <span>Edit</span>
        </button>

        {inDraftsTab && prod.isDraft ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handlePublishDraft(prod)}
            className="px-2 py-1 rounded-lg bg-[#9FE870] text-[#111111] border border-[#111111] font-black flex items-center gap-1"
          >
            <PlayCircle className="w-3 h-3" />
            <span>Publish</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handlePinToggle(prod)}
              className={`px-2 py-1 rounded-lg border font-bold flex items-center gap-1 ${
                prod.isPinned
                  ? 'bg-[#111111] text-[#9FE870] border-[#FF6B00]'
                  : 'bg-[#FAFAFA] dark:bg-[#1E2028] text-[#52525B] dark:text-[#A1A1AA] border-[#E4E4E7] dark:border-[#27272A]'
              }`}
            >
              <Pin className="w-3 h-3" />
              <span>{prod.isPinned ? 'Pinned' : 'Pin'}</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handlePauseToggle(prod)}
              className="px-2 py-1 rounded-lg bg-[#FAFAFA] dark:bg-[#1E2028] border border-[#E4E4E7] dark:border-[#27272A] font-bold text-[#52525B] dark:text-[#A1A1AA] flex items-center gap-1"
            >
              {prod.isPaused ? <PlayCircle className="w-3 h-3 text-emerald-600" /> : <PauseCircle className="w-3 h-3 text-amber-600" />}
              <span>{prod.isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSoldOutToggle(prod)}
              className="px-2 py-1 rounded-lg bg-[#FAFAFA] dark:bg-[#1E2028] border border-[#E4E4E7] dark:border-[#27272A] font-bold text-[#52525B] dark:text-[#A1A1AA] flex items-center gap-1"
            >
              <PackageCheck className="w-3 h-3 text-[#FF6B00]" />
              <span>{prod.isSoldOut ? 'Restock' : 'Sold Out'}</span>
            </button>
          </>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void handleDeleteListing(prod)}
          className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1 ml-auto"
        >
          <Trash2 className="w-3 h-3" />
          <span>Delete</span>
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-white transition-colors min-h-[40px]"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Marketplace</span>
      </button>

      {/* Main Profile Hero Card */}
      <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] overflow-hidden shadow-xs">
        {/* Cover Banner (16:5 look) */}
        <div className="h-36 sm:h-52 w-full bg-[#111111] relative">
          {coverSrc && !coverError ? (
            <img
              src={coverSrc}
              alt={`${primaryTitle} cover`}
              referrerPolicy="no-referrer"
              onError={() => setCoverError(true)}
              className="w-full h-full object-cover opacity-85"
            />
          ) : (
            <div className="w-full h-full bg-[#18181B] flex items-center justify-center opacity-50">
              <span className="text-xs font-bold tracking-widest uppercase text-[#A1A1AA]">
                Shop It Youth Marketplace
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
        </div>

        <div className="px-5 sm:px-6 pb-6 pt-0 relative">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 -mt-12 sm:-mt-14 mb-4">
            <div className="flex items-end gap-4">
              {/* Circular Avatar */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white dark:border-[#15161C] bg-[#FFF4EC] dark:bg-[#1E2028] overflow-hidden shadow-md shrink-0 flex items-center justify-center text-3xl font-black text-[#FF6B00]">
                {avatarSrc && !avatarError ? (
                  <img
                    src={avatarSrc}
                    alt={primaryTitle}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{primaryTitle[0]?.toUpperCase() || 'M'}</span>
                )}
              </div>

              <div className="pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-[#111111] dark:text-white">
                    {primaryTitle}
                  </h1>
                  {profile.isMutualFollow && (
                    <span className="text-[11px] font-black text-[#111111] bg-[#9FE870] px-2 py-0.5 rounded-lg border border-[#111111] inline-flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>Friends</span>
                    </span>
                  )}
                  {profile.badges?.map(badge => (
                    <span
                      key={badge.id}
                      className="text-[11px] font-bold text-emerald-800 dark:text-[#9FE870] bg-emerald-50 dark:bg-[#1E2028] px-2 py-0.5 rounded-lg border border-emerald-300 dark:border-[#27272A] inline-flex items-center gap-1"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-[#9FE870]" />
                      <span>{badge.label}</span>
                    </span>
                  ))}
                </div>

                {subtitleShop && (
                  <p className="text-xs font-bold text-[#FF6B00] mt-0.5 flex items-center gap-1">
                    <Store className="w-3.5 h-3.5" />
                    <span>{subtitleShop}</span>
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 text-xs text-[#71717A] dark:text-[#A1A1AA] mt-1.5">
                  {(profile.campus || profile.locationArea) && (
                    <span className="flex items-center gap-1 font-semibold text-[#111111] dark:text-slate-200">
                      <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" />
                      <span>{[profile.campus, profile.locationArea].filter(Boolean).join(' · ')}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Member since {formatMemberSince(profile.memberSince)}</span>
                  </span>
                  {lastSeenLabel && (
                    <span className="flex items-center gap-1 text-emerald-700 dark:text-[#9FE870] font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{lastSeenLabel}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Primary Actions */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isOwner ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E55E00] text-[#111111] border-2 border-[#111111] font-black text-xs flex items-center gap-1.5 shadow-[0_2px_0_#111111]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                  {(profile.pendingFollowRequestsCount || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleOpenFollowRequests()}
                      className="px-3.5 py-2 rounded-xl bg-[#FFF4EC] hover:bg-[#FED7AA]/50 text-[#111111] border-2 border-[#FF6B00] font-black text-xs flex items-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5 text-[#FF6B00]" />
                      <span>Requests ({profile.pendingFollowRequestsCount})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openAccountSettings()}
                    className="px-3.5 py-2 rounded-xl bg-[#FAFAFA] dark:bg-[#1E2028] hover:border-[#FF6B00] text-[#111111] dark:text-white border border-[#E4E4E7] dark:border-[#27272A] font-bold text-xs flex items-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Settings</span>
                  </button>
                  {profile.role === 'seller' || profile.role === 'admin' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openQuickListModal()}
                        className="px-3.5 py-2 rounded-xl bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] border-2 border-[#111111] font-black text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Listing</span>
                      </button>
                      {profile.role === 'seller' && (
                        <button
                          type="button"
                          onClick={() => setActiveView('seller_dashboard')}
                          className="px-3.5 py-2 rounded-xl bg-[#111111] text-[#9FE870] border border-[#FF6B00] font-black text-xs"
                        >
                          Seller Dashboard
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openAuthModal('seller_register')}
                      className="px-3.5 py-2 rounded-xl bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] border-2 border-[#111111] font-black text-xs"
                    >
                      Open a Youth Shop
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={followBusy}
                    onClick={() => void handleFollowToggle()}
                    className={`px-4 py-2.5 rounded-xl border-2 font-black text-xs flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                      profile.followStatus === 'accepted'
                        ? 'bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] border-[#111111]'
                        : profile.followStatus === 'pending'
                        ? 'bg-[#FFF4EC] text-[#C2410C] border-[#FF6B00]'
                        : 'bg-[#FF6B00] hover:bg-[#E55E00] text-[#111111] border-[#111111] shadow-[0_2px_0_#111111]'
                    }`}
                  >
                    {profile.followStatus === 'accepted' ? (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>Following</span>
                      </>
                    ) : profile.followStatus === 'pending' ? (
                      <>
                        <Clock className="w-4 h-4" />
                        <span>Requested</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>{profile.whoCanFollow === 'approval' ? 'Request Follow' : 'Follow'}</span>
                      </>
                    )}
                  </button>

                  {hasSellerPresence && (
                    <button
                      type="button"
                      onClick={() =>
                        void openChat(undefined, {
                          sellerId: profile.id,
                          productId: activeProducts[0]?.id,
                        })
                      }
                      className="px-4 py-2.5 rounded-xl bg-[#111111] hover:bg-[#18181B] text-[#9FE870] border-2 border-[#111111] hover:border-[#FF6B00] font-black text-xs flex items-center gap-2 transition-all shadow-[0_2px_0_#FF6B00]"
                    >
                      <MessageSquare className="w-4 h-4 text-[#FF6B00]" />
                      <span>Message Seller</span>
                    </button>
                  )}

                  {currentUser && (
                    <button
                      type="button"
                      disabled={muteBusy}
                      onClick={() => void handleMuteToggle()}
                      title={profile.isMuted ? 'Unmute notifications from this user' : 'Mute notifications from this user'}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                        profile.isMuted
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                          : 'bg-[#FAFAFA] dark:bg-[#1E2028] border-[#E4E4E7] dark:border-[#27272A] text-[#52525B] dark:text-[#A1A1AA] hover:border-[#FF6B00]'
                      }`}
                    >
                      {profile.isMuted ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                      <span>{profile.isMuted ? 'Muted' : 'Mute'}</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Bio */}
          {!isRestricted && profile.bio && (
            <p className="text-sm text-[#3F3F46] dark:text-[#D4D4D8] max-w-3xl leading-relaxed">
              {profile.bio}
            </p>
          )}

          {/* Read-only DB Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-5 border-t border-[#E4E4E7] dark:border-[#27272A] text-xs">
            <button
              type="button"
              onClick={() => void handleOpenFollowList('followers')}
              className="text-left p-2 -m-2 rounded-xl hover:bg-[#FAFAFA] dark:hover:bg-[#1E2028] transition-colors cursor-pointer"
            >
              <div className="text-[#71717A] dark:text-[#A1A1AA] flex items-center gap-1">
                <span>Followers</span>
                <span className="text-[10px] text-[#FF6B00] font-bold">View</span>
              </div>
              <div className="text-lg font-black text-[#111111] dark:text-white font-mono-numbers mt-0.5">
                {profile.followersCount ?? 0}
              </div>
            </button>
            <button
              type="button"
              onClick={() => void handleOpenFollowList('following')}
              className="text-left p-2 -m-2 rounded-xl hover:bg-[#FAFAFA] dark:hover:bg-[#1E2028] transition-colors cursor-pointer"
            >
              <div className="text-[#71717A] dark:text-[#A1A1AA] flex items-center gap-1">
                <span>Following</span>
                <span className="text-[10px] text-[#FF6B00] font-bold">View</span>
              </div>
              <div className="text-lg font-black text-[#111111] dark:text-white font-mono-numbers mt-0.5">
                {profile.followingCount ?? 0}
              </div>
            </button>
            <div>
              <div className="text-[#71717A] dark:text-[#A1A1AA]">Active Listings</div>
              <div className="text-lg font-black text-emerald-700 dark:text-[#9FE870] font-mono-numbers mt-0.5">
                {profile.productsCount ?? activeProducts.length}
              </div>
            </div>
            <div>
              <div className="text-[#71717A] dark:text-[#A1A1AA]">Completed Orders</div>
              <div className="text-lg font-black text-[#111111] dark:text-white font-mono-numbers mt-0.5">
                {profile.completedOrdersCount ?? 0}
              </div>
            </div>
            <div>
              <div className="text-[#71717A] dark:text-[#A1A1AA]">Rating</div>
              <div className="text-lg font-black text-[#111111] dark:text-white font-mono-numbers flex items-center gap-1 mt-0.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                <span>{Number(profile.averageRating || 0).toFixed(1)}</span>
                <span className="text-xs text-[#71717A] font-normal">({profile.reviewCount ?? 0})</span>
              </div>
            </div>
          </div>

          {/* Share & Report Row */}
          <div className="mt-5 pt-4 border-t border-[#E4E4E7] dark:border-[#27272A] flex flex-wrap items-center justify-between gap-3">
            <ShareButtons
              title={`${primaryTitle} on Shop It`}
              sellerShopName={subtitleShop || primaryTitle}
              campus={profile.campus}
              imageUrl={coverSrc || avatarSrc || undefined}
              url={canonicalUrl}
            />

            {!isOwner && (
              <div className="flex items-center gap-4 ml-auto">
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => setBlockConfirmOpen(true)}
                    className="flex items-center gap-1.5 text-xs text-[#71717A] hover:text-rose-600 transition-colors"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Block User</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setReportTarget({
                      targetType: 'seller',
                      targetId: profile.id,
                      targetTitle: primaryTitle,
                    })
                  }
                  className="flex items-center gap-1.5 text-xs text-[#71717A] hover:text-rose-600 transition-colors"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Report Profile</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Own Profile Completeness Meter */}
      {isOwner && profile.completeness && profile.completeness.score < 100 && (
        <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-[#111111] dark:text-white">
                Complete Your Profile ({profile.completeness.score}%)
              </h2>
              <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
                Complete your details so campus shoppers trust and recognize you easily.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className="text-xs font-black text-[#FF6B00] hover:underline shrink-0"
            >
              Finish Profile &rarr;
            </button>
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#F4F4F5] dark:bg-[#1E2028] overflow-hidden">
            <div
              className="h-full bg-[#9FE870] border-r border-[#111111] transition-all duration-300"
              style={{ width: `${profile.completeness.score}%` }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
            {profile.completeness.items.map(item => (
              <button
                key={item.key}
                type="button"
                disabled={item.done}
                onClick={() => setIsEditOpen(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs ${
                  item.done
                    ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                    : 'border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#1E2028] text-[#111111] dark:text-white hover:border-[#FF6B00]'
                }`}
              >
                {item.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#FF6B00] shrink-0" />
                )}
                <span className="font-semibold truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Vacation Notice */}
      {profile.seller?.vacationMode && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-2xl flex items-center gap-3 text-amber-900 dark:text-amber-200 text-xs">
          <Palmtree className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong>This shop is currently on vacation mode.</strong> Items are paused for new orders while the maker is away.
          </div>
        </div>
      )}

      {/* Followers-Only Restriction */}
      {isRestricted ? (
        <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-10 text-center space-y-3">
          <Lock className="w-8 h-8 text-[#FF6B00] mx-auto" />
          <h2 className="text-base font-black text-[#111111] dark:text-white">This Profile Is Limited to Followers</h2>
          <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] max-w-md mx-auto">
            {primaryTitle} set their profile visibility to followers only. Only approved followers can view listings, bio, and activity.
          </p>
          {!isOwner && (
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                disabled={followBusy}
                onClick={() => void handleFollowToggle()}
                className="px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E55E00] text-[#111111] border-2 border-[#111111] font-black text-xs flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>
                  {profile.followStatus === 'pending'
                    ? 'Request Sent (Cancel)'
                    : 'Request to Follow'}
                </span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Profile Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#E4E4E7] dark:border-[#27272A]">
            {(
              [
                { id: 'products', label: `Listings (${activeProducts.length})` },
                { id: 'about', label: 'About' },
                { id: 'reviews', label: `Reviews (${profile.reviews?.length || 0})` },
                ...(isOwner || profile.showFollowersList !== false
                  ? [{ id: 'followers', label: `Followers (${profile.followersCount ?? 0})` }]
                  : []),
                ...(isOwner || profile.showFollowingList !== false
                  ? [{ id: 'following', label: `Following (${profile.followingCount ?? 0})` }]
                  : []),
                ...(isOwner
                  ? [
                      { id: 'drafts', label: `Drafts & Paused (${draftOrPausedProducts.length})` },
                      { id: 'saved', label: `Saved Items (${wishlistProducts.length})` },
                      { id: 'orders', label: `My Orders (${orders.length})` },
                    ]
                  : []),
              ] as Array<{ id: ProfileTab; label: string }>
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setFollowTabSearch('');
                  setActiveTab(tab.id);
                }}
                className={`px-4 py-2 rounded-t-xl text-xs font-black whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#FF6B00] text-[#FF6B00] bg-white dark:bg-[#15161C]'
                    : 'border-transparent text-[#71717A] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Active Products */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              {activeProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                  {activeProducts.map((p, idx) => (
                    <div key={p.id} className="flex flex-col">
                      <div className="relative flex-1">
                        {p.isPinned && (
                          <span className="absolute top-2.5 left-2.5 z-20 px-2 py-0.5 rounded-md bg-[#111111] text-[#9FE870] border border-[#FF6B00] text-[10px] font-black flex items-center gap-1">
                            <Pin className="w-3 h-3" />
                            <span>Pinned</span>
                          </span>
                        )}
                        <ProductCard product={p} index={idx} />
                      </div>
                      {isOwner && renderOwnerListingBar(p, false)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] space-y-3">
                  <ShoppingBag className="w-8 h-8 text-[#A1A1AA] mx-auto" />
                  <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
                    {isOwner ? 'You have no active listings published yet.' : 'No active listings right now.'}
                  </p>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => openQuickListModal()}
                      className="px-4 py-2 rounded-xl bg-[#FF6B00] text-[#111111] font-black text-xs border-2 border-[#111111]"
                    >
                      + Create First Listing
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: About */}
          {activeTab === 'about' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-5 space-y-3">
                <h3 className="text-sm font-black text-[#111111] dark:text-white">About {primaryTitle}</h3>
                <p className="text-xs text-[#52525B] dark:text-[#D4D4D8] leading-relaxed">
                  {profile.bio || profile.seller?.bio || 'No bio added yet.'}
                </p>
                {profile.seller?.bio && profile.bio && profile.seller.bio !== profile.bio && (
                  <div className="pt-3 border-t border-[#E4E4E7] dark:border-[#27272A]">
                    <span className="text-[11px] font-bold text-[#71717A] uppercase block mb-1">Shop Description</span>
                    <p className="text-xs text-[#52525B] dark:text-[#D4D4D8]">{profile.seller.bio}</p>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-5 space-y-3">
                <h3 className="text-sm font-black text-[#111111] dark:text-white">Craft Interests & Details</h3>
                {profile.interests && profile.interests.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.interests.map(tag => (
                      <span
                        key={tag}
                        className="px-3 py-1 rounded-xl bg-[#111111] text-[#9FE870] border border-[#FF6B00] text-[11px] font-bold"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">No craft interests selected yet.</p>
                )}
                <div className="pt-3 border-t border-[#E4E4E7] dark:border-[#27272A] text-xs space-y-1 text-[#52525B] dark:text-[#A1A1AA]">
                  <div><strong>Campus:</strong> {profile.campus || 'Not set'}</div>
                  <div><strong>Public Area:</strong> {profile.locationArea || 'Not set'}</div>
                  <div><strong>Joined:</strong> {formatMemberSince(profile.memberSince)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Reviews */}
          {activeTab === 'reviews' && (
            <div className="space-y-3">
              {profile.reviews && profile.reviews.length > 0 ? (
                profile.reviews.map(rev => (
                  <div
                    key={rev.id}
                    className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <UserIdentityBadge
                        userId={rev.reviewerId}
                        profileSlug={rev.reviewerProfileSlug}
                        displayName={rev.reviewerName}
                        avatarUrl={rev.reviewerAvatarUrl}
                        subtitle={rev.date}
                        size="sm"
                      />
                      <div className="flex items-center gap-1 text-xs font-black text-[#111111] dark:text-white">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                        <span>{rev.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#3F3F46] dark:text-[#D4D4D8] leading-relaxed">{rev.comment}</p>
                    {rev.productTitle && (
                      <button
                        type="button"
                        onClick={() => openProduct(rev.productId)}
                        className="text-[11px] font-bold text-[#FF6B00] hover:underline"
                      >
                        Item: {rev.productTitle} &rarr;
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-10 text-center bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] text-xs text-[#71717A] dark:text-[#A1A1AA]">
                  No buyer reviews yet.
                </div>
              )}
            </div>
          )}

          {/* Tab 3b / 3c: Followers & Following inline tabs with search & Follow Back */}
          {(activeTab === 'followers' || activeTab === 'following') && (
            <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-sm font-black text-[#111111] dark:text-white capitalize">
                  {activeTab} ({activeTab === 'followers' ? profile.followersCount ?? 0 : profile.followingCount ?? 0})
                </h3>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={followTabSearch}
                    onChange={e => setFollowTabSearch(e.target.value)}
                    placeholder={`Search ${activeTab}...`}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#1E2028] text-xs text-[#111111] dark:text-white focus:outline-none focus:border-[#FF6B00]"
                  />
                </div>
              </div>

              {followTabLoading ? (
                <div className="py-10 text-center">
                  <Loader2 className="w-6 h-6 text-[#FF6B00] animate-spin mx-auto" />
                </div>
              ) : followTabError ? (
                <p className="py-8 text-center text-xs text-rose-600 font-semibold">{followTabError}</p>
              ) : followTabUsers.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#71717A] dark:text-[#A1A1AA]">
                  {followTabSearch.trim()
                    ? `No ${activeTab} matched "${followTabSearch.trim()}".`
                    : `No ${activeTab} yet.`}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {followTabUsers.map(u => {
                    const isSelfRow = Boolean(currentUser && currentUser.id === u.id);
                    return (
                      <div
                        key={u.id}
                        className="p-3 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#1E2028] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <UserIdentityBadge
                            userId={u.id}
                            profileSlug={u.profileSlug}
                            displayName={u.displayName}
                            avatarUrl={u.avatarUrl}
                            subtitle={[u.shopName, u.campus].filter(Boolean).join(' · ') || 'Member'}
                            size="sm"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {u.isMutual && (
                            <span className="px-2 py-0.5 rounded-md bg-[#9FE870] text-[#111111] text-[10px] font-black border border-[#111111]">
                              Friends
                            </span>
                          )}
                          {!isSelfRow && (
                            <button
                              type="button"
                              disabled={busyFollowRowId === u.id}
                              onClick={() => void handleRowFollowToggle(u)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-colors ${
                                u.viewerFollowStatus === 'accepted'
                                  ? 'bg-white dark:bg-[#15161C] text-[#111111] dark:text-white border-[#E4E4E7] dark:border-[#27272A]'
                                  : u.viewerFollowStatus === 'pending'
                                  ? 'bg-[#FFF4EC] text-[#C2410C] border-[#FF6B00]'
                                  : 'bg-[#FF6B00] text-[#111111] border-[#111111]'
                              }`}
                            >
                              {u.viewerFollowStatus === 'accepted'
                                ? 'Following'
                                : u.viewerFollowStatus === 'pending'
                                ? 'Requested'
                                : activeTab === 'followers' && isOwner
                                ? 'Follow Back'
                                : 'Follow'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 4 (Owner): Drafts & Paused */}
          {isOwner && activeTab === 'drafts' && (
            <div className="space-y-4">
              {draftOrPausedProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                  {draftOrPausedProducts.map((p, idx) => (
                    <div key={p.id} className="flex flex-col">
                      <div className="relative flex-1">
                        <span className="absolute top-2.5 left-2.5 z-20 px-2 py-0.5 rounded-md bg-amber-500 text-[#111111] text-[10px] font-black uppercase">
                          {p.isDraft ? 'Draft' : 'Paused'}
                        </span>
                        <ProductCard product={p} index={idx} />
                      </div>
                      {renderOwnerListingBar(p, true)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] text-xs text-[#71717A] dark:text-[#A1A1AA]">
                  No drafts or paused listings right now.
                </div>
              )}
            </div>
          )}

          {/* Tab 5 (Owner): Saved Items */}
          {isOwner && activeTab === 'saved' && (
            <div className="space-y-4">
              {wishlistProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                  {wishlistProducts.map((p, idx) => (
                    <ProductCard key={p.id} product={p} index={idx} />
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] space-y-2">
                  <Heart className="w-7 h-7 text-[#A1A1AA] mx-auto" />
                  <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">No saved items in your wishlist yet.</p>
                </div>
              )}
            </div>
          )}

          {/* Tab 6 (Owner): My Orders */}
          {isOwner && activeTab === 'orders' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-[#111111] dark:text-white">Recent Escrow Orders</h3>
                <button
                  type="button"
                  onClick={() => setActiveView('orders')}
                  className="text-xs font-black text-[#FF6B00] hover:underline"
                >
                  Open Full Orders &amp; Escrow &rarr;
                </button>
              </div>
              {orders.length > 0 ? (
                <div className="space-y-2.5">
                  {orders.slice(0, 8).map(ord => (
                    <div
                      key={ord.id}
                      className="bg-white dark:bg-[#15161C] rounded-xl border border-[#E4E4E7] dark:border-[#27272A] p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <span className="font-black text-[#111111] dark:text-white">Order #{ord.id}</span>
                        <span className="text-[#71717A] dark:text-[#A1A1AA] block text-[11px]">
                          {ord.items.length} item(s) · {formatNaira(ord.grandTotal)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-[#9FE870] text-[#111111] font-black uppercase text-[10px]">
                          {ord.status.replace(/_/g, ' ')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveView('orders')}
                          className="px-3 py-1.5 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] font-bold text-[#111111] dark:text-white hover:border-[#FF6B00]"
                        >
                          Manage
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] text-xs text-[#71717A] dark:text-[#A1A1AA]">
                  You have no orders yet.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        initialProfile={profile}
        onSaved={() => void loadProfile()}
      />

      {/* Safety Report Modal */}
      <ReportModal
        target={reportTarget}
        isOpen={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
      />

      {/* Followers / Following List Modal */}
      {followListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-backdrop">
          <div className="bg-white dark:bg-[#15161C] rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col border border-[#E4E4E7] dark:border-[#27272A] shadow-2xl overflow-hidden animate-modal-enter">
            <div className="px-5 py-4 border-b border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between">
              <h3 className="text-sm font-black text-[#111111] dark:text-white capitalize">
                {followListModal.mode} · {primaryTitle}
              </h3>
              <button
                type="button"
                onClick={() => setFollowListModal(null)}
                className="p-1.5 rounded-lg text-[#71717A] hover:text-[#111111] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {followListModal.loading ? (
                <div className="py-10 text-center text-xs text-[#71717A]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#FF6B00] mx-auto mb-2" />
                  <span>Loading {followListModal.mode}...</span>
                </div>
              ) : followListModal.error ? (
                <div className="py-8 text-center text-xs text-[#71717A] dark:text-[#A1A1AA] space-y-1.5">
                  <Lock className="w-6 h-6 text-[#FF6B00] mx-auto" />
                  <p className="font-bold text-[#111111] dark:text-white">{followListModal.error}</p>
                </div>
              ) : followListModal.users.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#71717A] dark:text-[#A1A1AA]">
                  No {followListModal.mode} yet.
                </div>
              ) : (
                followListModal.users.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setFollowListModal(null);
                      openProfile(u.profileSlug || u.id);
                    }}
                    className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF6B00] bg-[#FAFAFA] dark:bg-[#1E2028] text-left transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-9 h-9 rounded-full overflow-hidden border border-[#FF6B00] bg-[#FFF4EC] flex items-center justify-center font-black text-xs text-[#FF6B00] shrink-0">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.displayName} className="w-full h-full object-cover" />
                        ) : (
                          u.displayName[0]?.toUpperCase() || 'M'
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-[#111111] dark:text-white truncate">
                          {u.displayName}
                        </div>
                        <div className="text-[11px] text-[#71717A] dark:text-[#A1A1AA] truncate">
                          {[u.shopName, u.campus].filter(Boolean).join(' · ') || 'Shop It Member'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#FF6B00] shrink-0">View</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Owner Follow Requests Modal */}
      {requestsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-backdrop">
          <div className="bg-white dark:bg-[#15161C] rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col border border-[#E4E4E7] dark:border-[#27272A] shadow-2xl overflow-hidden animate-modal-enter">
            <div className="px-5 py-4 border-b border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between">
              <h3 className="text-sm font-black text-[#111111] dark:text-white">
                Follow Requests
              </h3>
              <button
                type="button"
                onClick={() => setRequestsModalOpen(false)}
                className="p-1.5 rounded-lg text-[#71717A] hover:text-[#111111] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
              {requestsLoading ? (
                <div className="py-10 text-center text-xs text-[#71717A]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#FF6B00] mx-auto mb-2" />
                  <span>Loading requests...</span>
                </div>
              ) : followRequests.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#71717A] dark:text-[#A1A1AA]">
                  No pending follow requests.
                </div>
              ) : (
                followRequests.map(req => {
                  const busy = busyRequestFollowerId === req.followerId;
                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#1E2028]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setRequestsModalOpen(false);
                          openProfile(req.profileSlug || req.followerId);
                        }}
                        className="flex items-center gap-2.5 min-w-0 text-left"
                      >
                        <span className="w-9 h-9 rounded-full overflow-hidden border border-[#FF6B00] bg-[#FFF4EC] flex items-center justify-center font-black text-xs text-[#FF6B00] shrink-0">
                          {req.avatarUrl ? (
                            <img src={req.avatarUrl} alt={req.displayName} className="w-full h-full object-cover" />
                          ) : (
                            req.displayName[0]?.toUpperCase() || 'M'
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-[#111111] dark:text-white truncate">
                            {req.displayName}
                          </div>
                          <div className="text-[11px] text-[#71717A] dark:text-[#A1A1AA] truncate">
                            {req.campus || 'Shop It Member'}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleRequestAction(req.followerId, 'accept')}
                          className="px-2.5 py-1.5 rounded-lg bg-[#9FE870] text-[#111111] border border-[#111111] font-black text-[11px] flex items-center gap-1 disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleRequestAction(req.followerId, 'decline')}
                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#15161C] text-[#52525B] dark:text-[#A1A1AA] border border-[#E4E4E7] dark:border-[#27272A] font-bold text-[11px] disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Block User Confirmation Modal */}
      {blockConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-backdrop">
          <div className="bg-white dark:bg-[#15161C] rounded-2xl max-w-sm w-full border border-rose-300 dark:border-rose-900 p-5 space-y-4 shadow-2xl animate-modal-enter">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#111111] dark:text-white">Block {primaryTitle}?</h3>
                <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] mt-1 leading-relaxed">
                  They will no longer be able to follow you, view your profile, or message you. You can unblock anytime from Account Settings.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBlockConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] font-bold text-xs text-[#52525B] dark:text-[#A1A1AA]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={blockingUser}
                onClick={() => void handleConfirmBlock()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-xs"
              >
                {blockingUser ? 'Blocking...' : 'Block User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

