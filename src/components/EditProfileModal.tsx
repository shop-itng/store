import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Camera,
  Image as ImageIcon,
  Check,
  AlertTriangle,
  Trash2,
  Loader2,
  Eye,
  Edit3,
  Plus,
  Lock,
  MapPin,
  Store,
  Palmtree,
  Clock,
  Shield,
  QrCode,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CAMPUSES } from '../data/mockData';
import { NIGERIAN_STATES } from '../data/nigerianLocations';
import {
  PROFILE_INTERESTS,
  ALLOWED_LANGUAGES,
  PROCESSING_TIME_OPTIONS,
  DEFAULT_AVATAR_PRESETS,
  MAX_TAGLINE_LENGTH,
  MAX_BIO_LENGTH,
  MAX_SHOP_STORY_LENGTH,
  MAX_CRAFT_MATERIALS_LENGTH,
  DEFAULT_PRIVACY_SETTINGS,
  UNDER_18_PRIVACY_SETTINGS,
  clientContainsForbiddenContactInfo,
  getProfileUrl,
} from '../utils/profileConstants';
import { uploadFileToServer } from '../utils/fileUpload';
import { ImageCropperModal } from './ImageCropperModal';
import { ProfileQrCode } from './ProfileQrCode';
import { PrivacySettings, PublicProfileData } from '../types';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProfile?: PublicProfileData | null;
  onSaved?: () => void;
  initialFocusField?: string | null;
}

type SectionKey =
  | 'photos'
  | 'basics'
  | 'location'
  | 'interests'
  | 'seller'
  | 'privacy'
  | 'link';

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  initialProfile,
  onSaved,
  initialFocusField,
}) => {
  const { currentUser, currentSeller, updateMyProfile, notify } = useApp();

  const isSeller = Boolean(currentUser?.role === 'seller' || currentSeller || initialProfile?.seller);
  const isUnder18 = Boolean(currentUser?.age && currentUser.age < 18) || Boolean(initialProfile?.isUnder18);

  const [displayName, setDisplayName] = useState('');
  const [tagline, setTagline] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [locationState, setLocationState] = useState('');
  const [campus, setCampus] = useState('');
  const [locationArea, setLocationArea] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(['English']);

  // Seller-only fields
  const [shopName, setShopName] = useState('');
  const [shopBio, setShopBio] = useState('');
  const [shopStory, setShopStory] = useState('');
  const [craftMaterials, setCraftMaterials] = useState('');
  const [processingTime, setProcessingTime] = useState('');
  const [allowsPickup, setAllowsPickup] = useState(true);
  const [allowsLocalDelivery, setAllowsLocalDelivery] = useState(false);
  const [pickupSpots, setPickupSpots] = useState<string[]>([]);
  const [newPickupSpot, setNewPickupSpot] = useState('');
  const [vacationMode, setVacationMode] = useState(false);

  // Privacy controls inside Edit Profile
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(DEFAULT_PRIVACY_SETTINGS);

  // UI & dirty state
  const [previewAsVisitor, setPreviewAsVisitor] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<'avatar' | 'cover' | null>(null);
  const [cropTarget, setCropTarget] = useState<{
    kind: 'avatar' | 'cover';
    fileUrl: string;
  } | null>(null);

  const initialSnapshotRef = useRef<string>('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const sectionRefs = useRef<Record<SectionKey, HTMLDivElement | null>>({
    photos: null,
    basics: null,
    location: null,
    interests: null,
    seller: null,
    privacy: null,
    link: null,
  });
  const taglineInputRef = useRef<HTMLInputElement>(null);
  const bioInputRef = useRef<HTMLTextAreaElement>(null);
  const areaInputRef = useRef<HTMLInputElement>(null);
  const shopStoryInputRef = useRef<HTMLTextAreaElement>(null);

  const serializeState = (state: {
    displayName: string;
    tagline: string;
    avatarUrl: string | null;
    coverUrl: string | null;
    bio: string;
    locationState: string;
    campus: string;
    locationArea: string;
    interests: string[];
    languages: string[];
    shopName: string;
    shopBio: string;
    shopStory: string;
    craftMaterials: string;
    processingTime: string;
    allowsPickup: boolean;
    allowsLocalDelivery: boolean;
    pickupSpots: string[];
    vacationMode: boolean;
    privacySettings: PrivacySettings;
  }) => JSON.stringify(state);

  useEffect(() => {
    if (!isOpen) return;

    const initDisplayName =
      initialProfile?.displayName ||
      currentUser?.displayName ||
      (currentUser?.name ? currentUser.name.trim().split(/\s+/)[0] : '') ||
      '';
    const initTagline = initialProfile?.tagline ?? currentUser?.tagline ?? '';
    const initAvatar = initialProfile?.avatarUrl ?? currentUser?.avatarUrl ?? null;
    const initCover = initialProfile?.coverUrl ?? currentUser?.coverUrl ?? null;
    const initBio = initialProfile?.bio ?? currentUser?.bio ?? '';
    const initState =
      initialProfile?.locationState ??
      initialProfile?.seller?.locationState ??
      currentUser?.locationState ??
      currentSeller?.locationState ??
      'Lagos';
    const initCampus =
      initialProfile?.campus ?? currentUser?.campus ?? currentSeller?.campus ?? 'UNILAG (Akoka)';
    const initArea =
      initialProfile?.locationArea ??
      currentUser?.locationArea ??
      currentSeller?.locationArea ??
      'Yaba';
    const initInterests = initialProfile?.interests ?? currentUser?.interests ?? [];
    const initLanguages =
      (initialProfile?.languages && initialProfile.languages.length > 0
        ? initialProfile.languages
        : currentUser?.languages && currentUser.languages.length > 0
        ? currentUser.languages
        : ['English']);

    const initShopName = initialProfile?.seller?.shopName ?? currentSeller?.shopName ?? '';
    const initShopBio = initialProfile?.seller?.bio ?? currentSeller?.bio ?? '';
    const initShopStory = initialProfile?.seller?.shopStory ?? currentSeller?.shopStory ?? '';
    const initCraftMaterials =
      initialProfile?.seller?.craftMaterials ?? currentSeller?.craftMaterials ?? '';
    const initProcessingTime =
      initialProfile?.seller?.processingTime ?? currentSeller?.processingTime ?? '';
    const initDelivery = initialProfile?.seller?.deliveryOptions ??
      currentSeller?.deliveryOptions ?? {
        allowsPickup: true,
        allowsLocalDelivery: false,
        pickupSpots: [],
      };
    const initVacationMode = Boolean(
      initialProfile?.seller?.vacationMode ?? currentSeller?.vacationMode
    );

    const basePrivacy = isUnder18 ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS;
    const srcPrivacy = initialProfile?.privacySettings ?? currentUser?.privacySettings;
    const initPrivacy: PrivacySettings = {
      profileVisibility: srcPrivacy?.profileVisibility || basePrivacy.profileVisibility,
      showLastSeen: isUnder18
        ? false
        : typeof srcPrivacy?.showLastSeen === 'boolean'
        ? srcPrivacy.showLastSeen
        : basePrivacy.showLastSeen,
      showFollowersList:
        typeof srcPrivacy?.showFollowersList === 'boolean'
          ? srcPrivacy.showFollowersList
          : basePrivacy.showFollowersList,
      showFollowingList:
        typeof srcPrivacy?.showFollowingList === 'boolean'
          ? srcPrivacy.showFollowingList
          : basePrivacy.showFollowingList,
      whoCanFollow: isUnder18 ? 'approval' : srcPrivacy?.whoCanFollow || basePrivacy.whoCanFollow,
      whoCanMessage: isUnder18 ? 'mutual' : srcPrivacy?.whoCanMessage || basePrivacy.whoCanMessage,
    };

    setDisplayName(initDisplayName);
    setTagline(initTagline);
    setAvatarUrl(initAvatar);
    setCoverUrl(initCover);
    setBio(initBio);
    setLocationState(initState);
    setCampus(initCampus);
    setLocationArea(initArea);
    setInterests(initInterests);
    setLanguages(initLanguages);
    setShopName(initShopName);
    setShopBio(initShopBio);
    setShopStory(initShopStory);
    setCraftMaterials(initCraftMaterials);
    setProcessingTime(initProcessingTime);
    setAllowsPickup(Boolean(initDelivery.allowsPickup));
    setAllowsLocalDelivery(Boolean(initDelivery.allowsLocalDelivery));
    setPickupSpots(Array.isArray(initDelivery.pickupSpots) ? initDelivery.pickupSpots : []);
    setNewPickupSpot('');
    setVacationMode(initVacationMode);
    setPrivacySettings(initPrivacy);
    setPreviewAsVisitor(false);
    setShowDiscardConfirm(false);

    initialSnapshotRef.current = serializeState({
      displayName: initDisplayName,
      tagline: initTagline,
      avatarUrl: initAvatar,
      coverUrl: initCover,
      bio: initBio,
      locationState: initState,
      campus: initCampus,
      locationArea: initArea,
      interests: initInterests,
      languages: initLanguages,
      shopName: initShopName,
      shopBio: initShopBio,
      shopStory: initShopStory,
      craftMaterials: initCraftMaterials,
      processingTime: initProcessingTime,
      allowsPickup: Boolean(initDelivery.allowsPickup),
      allowsLocalDelivery: Boolean(initDelivery.allowsLocalDelivery),
      pickupSpots: Array.isArray(initDelivery.pickupSpots) ? initDelivery.pickupSpots : [],
      vacationMode: initVacationMode,
      privacySettings: initPrivacy,
    });
  }, [isOpen, initialProfile, currentUser, currentSeller, isUnder18]);

  // Jump cleanly to targeted section/field from completeness checklist
  useEffect(() => {
    if (!isOpen || !initialFocusField) return;
    const timer = window.setTimeout(() => {
      const targetSectionMap: Record<string, SectionKey> = {
        avatar: 'photos',
        cover: 'photos',
        tagline: 'basics',
        bio: 'basics',
        location: 'location',
        interests: 'interests',
        languages: 'interests',
        shopStory: 'seller',
        seller: 'seller',
        privacy: 'privacy',
        link: 'link',
      };
      const sec = targetSectionMap[initialFocusField];
      if (sec && sectionRefs.current[sec]) {
        sectionRefs.current[sec]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (initialFocusField === 'tagline') taglineInputRef.current?.focus();
      if (initialFocusField === 'bio') bioInputRef.current?.focus();
      if (initialFocusField === 'location') areaInputRef.current?.focus();
      if (initialFocusField === 'shopStory') shopStoryInputRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [isOpen, initialFocusField]);

  const currentSnapshot = useMemo(
    () =>
      serializeState({
        displayName,
        tagline,
        avatarUrl,
        coverUrl,
        bio,
        locationState,
        campus,
        locationArea,
        interests,
        languages,
        shopName,
        shopBio,
        shopStory,
        craftMaterials,
        processingTime,
        allowsPickup,
        allowsLocalDelivery,
        pickupSpots,
        vacationMode,
        privacySettings,
      }),
    [
      displayName,
      tagline,
      avatarUrl,
      coverUrl,
      bio,
      locationState,
      campus,
      locationArea,
      interests,
      languages,
      shopName,
      shopBio,
      shopStory,
      craftMaterials,
      processingTime,
      allowsPickup,
      allowsLocalDelivery,
      pickupSpots,
      vacationMode,
      privacySettings,
    ]
  );

  const isDirty = Boolean(initialSnapshotRef.current && currentSnapshot !== initialSnapshotRef.current);

  if (!isOpen) return null;

  const getContactErr = (val: string): string | null => {
    const res = clientContainsForbiddenContactInfo(val);
    return res.blocked ? res.reason || 'Contact details and links are not allowed.' : null;
  };

  const nameError = displayName.trim() ? getContactErr(displayName) : null;
  const taglineError = tagline.trim() ? getContactErr(tagline) : null;
  const bioError = bio.trim() ? getContactErr(bio) : null;
  const areaError = locationArea.trim() ? getContactErr(locationArea) : null;
  const shopNameError = isSeller && shopName.trim() ? getContactErr(shopName) : null;
  const shopBioError = isSeller && shopBio.trim() ? getContactErr(shopBio) : null;
  const shopStoryError = isSeller && shopStory.trim() ? getContactErr(shopStory) : null;
  const craftMaterialsError = isSeller && craftMaterials.trim() ? getContactErr(craftMaterials) : null;
  const newSpotError = newPickupSpot.trim() ? getContactErr(newPickupSpot) : null;
  const spotsError = pickupSpots.map(s => getContactErr(s)).find(Boolean) || null;

  const hasValidationError = Boolean(
    nameError ||
      taglineError ||
      bioError ||
      areaError ||
      shopNameError ||
      shopBioError ||
      shopStoryError ||
      craftMaterialsError ||
      spotsError ||
      displayName.trim().length < 2
  );

  const attemptClose = () => {
    if (isSaving || uploadingTarget) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  };

  const scrollToSection = (key: SectionKey) => {
    setPreviewAsVisitor(false);
    window.setTimeout(() => {
      sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  };

  const handleFilePick = (kind: 'avatar' | 'cover') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Please pick an image file (PNG, JPG, WEBP).', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      notify('Image file is larger than 10MB. Please choose a smaller image.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      if (typeof ev.target?.result === 'string') {
        setCropTarget({ kind, fileUrl: ev.target.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleInterest = (tag: string) => {
    setInterests(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  };

  const toggleLanguage = (lang: string) => {
    setLanguages(prev => {
      if (prev.includes(lang)) {
        if (prev.length === 1) {
          notify('Keep at least one language selected.', 'error');
          return prev;
        }
        return prev.filter(l => l !== lang);
      }
      return prev.length >= 6 ? prev : [...prev, lang];
    });
  };

  const handleAddPickupSpot = () => {
    const cleaned = newPickupSpot.trim().slice(0, 60);
    if (!cleaned) return;
    const contactErr = getContactErr(cleaned);
    if (contactErr) {
      notify(contactErr, 'error');
      return;
    }
    if (pickupSpots.length >= 6) {
      notify('You can add up to 6 public pickup spots.', 'error');
      return;
    }
    if (!pickupSpots.some(s => s.toLowerCase() === cleaned.toLowerCase())) {
      setPickupSpots(prev => [...prev, cleaned]);
    }
    setNewPickupSpot('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasValidationError) {
      notify('Please fix the highlighted fields before saving.', 'error');
      return;
    }

    setIsSaving(true);
    const res = await updateMyProfile({
      displayName: displayName.trim(),
      tagline: tagline.trim(),
      avatarUrl,
      coverUrl,
      bio: bio.trim(),
      locationState: locationState.trim(),
      campus: campus.trim(),
      locationArea: locationArea.trim(),
      interests,
      languages,
      privacySettings,
      ...(isSeller
        ? {
            shopName: shopName.trim(),
            shopBio: shopBio.trim(),
            shopStory: shopStory.trim(),
            craftMaterials: craftMaterials.trim(),
            processingTime: processingTime.trim(),
            deliveryOptions: {
              allowsPickup,
              allowsLocalDelivery,
              pickupSpots,
            },
            vacationMode,
          }
        : {}),
    });
    setIsSaving(false);

    if (res.status) {
      onSaved?.();
      onClose();
    }
  };

  const activeSlug = initialProfile?.canonicalSlug || initialProfile?.profileSlug || currentUser?.profileSlug || initialProfile?.id || currentUser?.id || '';
  const profileUrl = getProfileUrl(activeSlug || 'profile');
  const previewTitle = displayName.trim() || shopName.trim() || 'Shop It Member';
  const previewLocation = [locationState.trim(), campus.trim(), locationArea.trim()].filter(Boolean).join(' · ');

  const sectionLinks: Array<{ key: SectionKey; label: string }> = [
    { key: 'photos', label: 'Photos' },
    { key: 'basics', label: 'Basics' },
    { key: 'location', label: 'Location' },
    { key: 'interests', label: 'Interests & Languages' },
    ...(isSeller ? [{ key: 'seller' as SectionKey, label: 'Craft & Delivery' }] : []),
    { key: 'privacy', label: 'Privacy' },
    { key: 'link', label: 'Link & QR' },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-xs animate-backdrop overflow-y-auto"
        onClick={e => {
          if (e.target === e.currentTarget) attemptClose();
        }}
      >
        <div className="bg-white dark:bg-[#15161C] rounded-2xl max-w-2xl w-full max-h-[94vh] flex flex-col border border-[#E4E4E7] dark:border-[#27272A] shadow-2xl overflow-hidden my-auto animate-modal-enter">
          {/* Header */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-[#111111] dark:text-white truncate">
                  Edit Profile
                </h2>
                {isDirty && (
                  <span className="text-[11px] font-bold text-[#C2410C] dark:text-[#FF6B00] shrink-0">
                    Unsaved changes
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
                Phone numbers, links, emails, and @handles are blocked across all fields.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewAsVisitor(v => !v)}
                className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  previewAsVisitor
                    ? 'bg-[#111111] text-[#9FE870] border-[#FF6B00]'
                    : 'bg-[#FAFAFA] dark:bg-[#1E2028] text-[#111111] dark:text-white border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF6B00]'
                }`}
              >
                {previewAsVisitor ? (
                  <>
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Back to Edit</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>View as Visitor</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={attemptClose}
                aria-label="Close edit profile"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#71717A] hover:text-[#111111] dark:hover:text-white hover:bg-[#F4F4F5] dark:hover:bg-[#1E2028]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Unsaved Changes Confirmation Banner */}
          {showDiscardConfirm && (
            <div className="px-4 sm:px-5 py-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>You have unsaved profile changes. Discard them?</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] font-bold text-[#111111] dark:text-white"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                  }}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  Discard Changes
                </button>
              </div>
            </div>
          )}

          {/* Quick Section Jump Bar */}
          {!previewAsVisitor && (
            <div className="px-4 sm:px-5 py-2 border-b border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#111217] flex items-center gap-1.5 overflow-x-auto">
              {sectionLinks.map(sec => (
                <button
                  key={sec.key}
                  type="button"
                  onClick={() => scrollToSection(sec.key)}
                  className="min-h-[44px] px-3 py-1.5 rounded-lg text-[11px] font-bold text-[#52525B] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white hover:bg-white dark:hover:bg-[#1E2028] whitespace-nowrap shrink-0 transition-colors"
                >
                  {sec.label}
                </button>
              ))}
            </div>
          )}

          {previewAsVisitor ? (
            /* Live Visitor Preview */
            <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              <div className="flex items-center justify-between gap-2 text-[11px] text-[#52525B] dark:text-[#A1A1AA]">
                <span>Previewing how other Shop It members see your profile</span>
                <span>
                  Visibility:{' '}
                  <strong className="text-[#111111] dark:text-white">
                    {privacySettings.profileVisibility === 'followers' ? 'Followers only' : 'Public'}
                  </strong>
                </span>
              </div>

              <div className="rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#1E2028] overflow-hidden">
                <div className="h-32 sm:h-40 bg-[#18181B] relative">
                  {coverUrl ? (
                    <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#A1A1AA] text-xs font-semibold">
                      No cover banner uploaded
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>

                <div className="px-4 sm:px-5 pb-5">
                  <div className="flex items-end gap-3.5 -mt-10 mb-3 relative">
                    <div className="w-20 h-20 rounded-full border-4 border-white dark:border-[#1E2028] bg-[#FFF4EC] overflow-hidden flex items-center justify-center font-black text-2xl text-[#FF6B00] shrink-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={previewTitle} className="w-full h-full object-cover" />
                      ) : (
                        <span>{(previewTitle[0] || 'M').toUpperCase()}</span>
                      )}
                    </div>
                    <div className="pb-1 min-w-0">
                      <h3 className="text-lg font-black text-[#111111] dark:text-white truncate">
                        {previewTitle}
                      </h3>
                      {tagline.trim() && (
                        <p className="text-xs font-medium text-[#52525B] dark:text-[#D4D4D8]">
                          {tagline.trim()}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSeller && shopName.trim() && shopName.trim() !== previewTitle && (
                    <p className="text-xs font-bold text-[#FF6B00] mb-1.5 flex items-center gap-1">
                      <Store className="w-3.5 h-3.5" />
                      <span>{shopName.trim()}</span>
                    </p>
                  )}

                  <div className="text-xs text-[#52525B] dark:text-[#A1A1AA] space-y-1">
                    {previewLocation && (
                      <p className="font-semibold text-[#111111] dark:text-slate-200">
                        {previewLocation}
                      </p>
                    )}
                    <p>
                      Languages: {languages.join(' · ')}
                      <span aria-hidden="true"> · </span>
                      Activity status:{' '}
                      {privacySettings.showLastSeen ? 'Visible to visitors' : 'Hidden from visitors'}
                    </p>
                  </div>

                  {bio.trim() && (
                    <p className="mt-3 text-sm text-[#3F3F46] dark:text-[#D4D4D8] leading-relaxed">
                      {bio.trim()}
                    </p>
                  )}

                  {interests.length > 0 && (
                    <p className="mt-3 text-xs text-[#52525B] dark:text-[#A1A1AA]">
                      <strong className="text-[#111111] dark:text-white">Craft interests: </strong>
                      {interests.join(' · ')}
                    </p>
                  )}

                  {isSeller && vacationMode && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center gap-2">
                      <Palmtree className="w-4 h-4 shrink-0" />
                      <span>Vacation Mode is on — new orders are paused while away.</span>
                    </div>
                  )}

                  {isSeller && (shopStory.trim() || craftMaterials.trim() || processingTime || allowsPickup || allowsLocalDelivery) && (
                    <div className="mt-4 pt-4 border-t border-[#E4E4E7] dark:border-[#27272A] space-y-2.5 text-xs">
                      {shopStory.trim() && (
                        <div>
                          <span className="font-bold text-[#111111] dark:text-white block">About my craft</span>
                          <p className="text-[#52525B] dark:text-[#D4D4D8] mt-0.5 leading-relaxed">
                            {shopStory.trim()}
                          </p>
                        </div>
                      )}
                      {craftMaterials.trim() && (
                        <div>
                          <span className="font-bold text-[#111111] dark:text-white block">
                            What I make &amp; materials used
                          </span>
                          <p className="text-[#52525B] dark:text-[#D4D4D8] mt-0.5">{craftMaterials.trim()}</p>
                        </div>
                      )}
                      {processingTime && (
                        <p className="text-[#52525B] dark:text-[#D4D4D8]">
                          <strong className="text-[#111111] dark:text-white">Usual processing time: </strong>
                          {processingTime}
                        </p>
                      )}
                      <p className="text-[#52525B] dark:text-[#D4D4D8]">
                        <strong className="text-[#111111] dark:text-white">Delivery &amp; pickup: </strong>
                        {[
                          allowsPickup ? 'Public meetup / pickup available' : null,
                          allowsLocalDelivery ? 'Local delivery available' : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Arrange in Shop It chat'}
                      </p>
                      {allowsPickup && pickupSpots.length > 0 && (
                        <p className="text-[#52525B] dark:text-[#D4D4D8]">
                          <strong className="text-[#111111] dark:text-white">Pickup spots: </strong>
                          {pickupSpots.join(' · ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewAsVisitor(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] font-bold text-[#111111] dark:text-white"
                >
                  Continue Editing
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Group 1: Photos */}
              <div
                ref={el => {
                  sectionRefs.current.photos = el;
                }}
                className="space-y-4 scroll-mt-3"
              >
                <div className="border-b border-[#E4E4E7] dark:border-[#27272A] pb-1.5">
                  <h3 className="text-sm font-black text-[#111111] dark:text-white">Photos</h3>
                </div>

                {/* Cover Banner Editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[#111111] dark:text-white">Cover Banner (16:5)</label>
                    {coverUrl && (
                      <button
                        type="button"
                        onClick={() => setCoverUrl(null)}
                        className="min-h-[44px] px-2 text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Cover</span>
                      </button>
                    )}
                  </div>
                  <div
                    onClick={() => coverInputRef.current?.click()}
                    className="relative h-28 rounded-xl overflow-hidden border-2 border-dashed border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF6B00] bg-[#F4F4F5] dark:bg-[#1E2028] cursor-pointer flex items-center justify-center group"
                  >
                    {coverUrl ? (
                      <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-[#71717A] dark:text-[#A1A1AA]">
                        <ImageIcon className="w-6 h-6 mx-auto mb-1 text-[#FF6B00]" />
                        <span className="font-semibold">Tap to upload &amp; crop a cover photo</span>
                      </div>
                    )}
                    <div
                      className={`absolute inset-0 bg-black/45 flex items-center justify-center text-white font-bold gap-1.5 transition-opacity ${
                        uploadingTarget === 'cover' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {uploadingTarget === 'cover' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Uploading Cover...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          <span>Change Cover</span>
                        </>
                      )}
                    </div>
                  </div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFilePick('cover')}
                    className="hidden"
                  />
                </div>

                {/* Avatar Presets + Upload */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="font-bold text-[#111111] dark:text-white">Profile Photo</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={uploadingTarget === 'avatar'}
                        onClick={() => avatarInputRef.current?.click()}
                        className="min-h-[44px] px-2.5 text-[11px] font-bold text-[#FF6B00] hover:underline flex items-center gap-1 disabled:opacity-60"
                      >
                        {uploadingTarget === 'avatar' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Camera className="w-3.5 h-3.5" />
                        )}
                        <span>{uploadingTarget === 'avatar' ? 'Uploading...' : 'Upload & Crop Photo'}</span>
                      </button>
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setAvatarUrl(null)}
                          className="min-h-[44px] px-2 text-[11px] font-bold text-[#71717A] hover:text-rose-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFilePick('avatar')}
                    className="hidden"
                  />

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#FF6B00] bg-[#FFF4EC] dark:bg-[#1E2028] flex items-center justify-center font-black text-lg text-[#FF6B00] shrink-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Current avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span>{(displayName[0] || 'M').toUpperCase()}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {DEFAULT_AVATAR_PRESETS.map(preset => {
                        const selected = avatarUrl === preset.url;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setAvatarUrl(preset.url)}
                            title={preset.label}
                            className={`w-11 h-11 rounded-full overflow-hidden border-2 transition-all ${
                              selected
                                ? 'border-[#FF6B00] scale-105 ring-2 ring-[#FF6B00]/30'
                                : 'border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF6B00]'
                            }`}
                          >
                            <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 2: Basics */}
              <div
                ref={el => {
                  sectionRefs.current.basics = el;
                }}
                className="space-y-4 scroll-mt-3"
              >
                <div className="border-b border-[#E4E4E7] dark:border-[#27272A] pb-1.5">
                  <h3 className="text-sm font-black text-[#111111] dark:text-white">Basics</h3>
                </div>

                {/* Display Name */}
                <div className="space-y-1">
                  <label className="font-bold text-[#111111] dark:text-white block">
                    Display Name * (shown publicly)
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={40}
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="e.g. Amaka"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white font-semibold focus:border-[#FF6B00] focus:outline-none"
                  />
                  {nameError && (
                    <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{nameError}</span>
                    </p>
                  )}
                </div>

                {/* Tagline */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[#111111] dark:text-white">Tagline</label>
                    <span
                      className={`text-[11px] tabular-nums ${
                        tagline.length >= MAX_TAGLINE_LENGTH ? 'text-rose-600 font-bold' : 'text-[#71717A]'
                      }`}
                    >
                      {tagline.length}/{MAX_TAGLINE_LENGTH}
                    </span>
                  </div>
                  <input
                    ref={taglineInputRef}
                    type="text"
                    maxLength={MAX_TAGLINE_LENGTH}
                    value={tagline}
                    onChange={e => setTagline(e.target.value)}
                    placeholder="e.g. Handmade beaded bags & campus wristlets"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
                  />
                  {taglineError && (
                    <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{taglineError}</span>
                    </p>
                  )}
                </div>

                {/* Bio */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[#111111] dark:text-white">Bio</label>
                    <span
                      className={`text-[11px] tabular-nums ${
                        bio.length >= MAX_BIO_LENGTH ? 'text-rose-600 font-bold' : 'text-[#71717A]'
                      }`}
                    >
                      {bio.length}/{MAX_BIO_LENGTH}
                    </span>
                  </div>
                  <textarea
                    ref={bioInputRef}
                    rows={3}
                    maxLength={MAX_BIO_LENGTH}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Share a short introduction, your favorite styles, or how long you have been crafting..."
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
                  />
                  {bioError && (
                    <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{bioError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Group 3: Location */}
              <div
                ref={el => {
                  sectionRefs.current.location = el;
                }}
                className="space-y-3 scroll-mt-3"
              >
                <div className="border-b border-[#E4E4E7] dark:border-[#27272A] pb-1.5 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-[#111111] dark:text-white flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#FF6B00]" />
                    <span>Location</span>
                  </h3>
                  <span className="text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
                    State + Campus or Area only (never exact street address)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-[#111111] dark:text-white block">State</label>
                    <select
                      value={locationState}
                      onChange={e => setLocationState(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
                    >
                      <option value="">Select state</option>
                      {NIGERIAN_STATES.map(s => (
                        <option key={s.state} value={s.state}>
                          {s.state}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-[#111111] dark:text-white block">Campus / Hub</label>
                    <select
                      value={campus}
                      onChange={e => setCampus(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
                    >
                      <option value="">Select campus (optional)</option>
                      {CAMPUSES.filter(c => c !== 'All Campuses').map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="Lagos Mainland">Lagos Mainland</option>
                      <option value="Off-Campus / Nationwide">Off-Campus / Nationwide</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-[#111111] dark:text-white block">Area / Neighborhood</label>
                    <input
                      ref={areaInputRef}
                      type="text"
                      maxLength={100}
                      value={locationArea}
                      onChange={e => setLocationArea(e.target.value)}
                      placeholder="e.g. Yaba, Akoka, Bodija"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
                    />
                  </div>
                </div>
                {areaError && (
                  <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{areaError}</span>
                  </p>
                )}
              </div>

              {/* Group 4: Craft Interests & Languages */}
              <div
                ref={el => {
                  sectionRefs.current.interests = el;
                }}
                className="space-y-4 scroll-mt-3"
              >
                <div className="border-b border-[#E4E4E7] dark:border-[#27272A] pb-1.5">
                  <h3 className="text-sm font-black text-[#111111] dark:text-white">
                    Interests &amp; Languages
                  </h3>
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-[#111111] dark:text-white block">
                    Craft Interests ({interests.length}/{PROFILE_INTERESTS.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PROFILE_INTERESTS.map(tag => {
                      const active = interests.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleInterest(tag)}
                          className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                            active
                              ? 'bg-[#111111] text-[#9FE870] border-[#FF6B00]'
                              : 'bg-[#FAFAFA] dark:bg-[#1E2028] text-[#52525B] dark:text-[#A1A1AA] border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF6B00]'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-[#111111] dark:text-white block">
                    Languages Spoken ({languages.length}/6)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ALLOWED_LANGUAGES.map(lang => {
                      const active = languages.includes(lang);
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => toggleLanguage(lang)}
                          className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                            active
                              ? 'bg-[#FFF4EC] dark:bg-[#1E2028] text-[#C2410C] dark:text-[#FF6B00] border-[#FF6B00]'
                              : 'bg-[#FAFAFA] dark:bg-[#1E2028] text-[#52525B] dark:text-[#A1A1AA] border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF6B00]'
                          }`}
                        >
                          {lang}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Group 5: Seller Craft & Delivery (Sellers only) */}
              {isSeller && (
                <div
                  ref={el => {
                    sectionRefs.current.seller = el;
                  }}
                  className="space-y-4 scroll-mt-3 pt-2 border-t border-[#E4E4E7] dark:border-[#27272A]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-[#111111] dark:text-white flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-[#FF6B00]" />
                      <span>Seller Shop, Story &amp; Delivery</span>
                    </h3>
                  </div>

                  {/* Vacation Mode Toggle */}
                  <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/70 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Palmtree className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#111111] dark:text-white block">
                          Vacation Mode
                        </span>
                        <span className="text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
                          Show a notice on your shop and pause new orders while you are away.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={vacationMode}
                      onClick={() => setVacationMode(v => !v)}
                      className={`min-h-[44px] min-w-[72px] px-3 rounded-xl font-black text-xs border transition-colors shrink-0 ${
                        vacationMode
                          ? 'bg-amber-500 text-[#111111] border-[#111111]'
                          : 'bg-white dark:bg-[#15161C] text-[#52525B] dark:text-[#A1A1AA] border-[#E4E4E7] dark:border-[#27272A]'
                      }`}
                    >
                      {vacationMode ? 'On' : 'Off'}
                    </button>
                  </div>

                  {/* Shop Name & Short Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-[#111111] dark:text-white block">Shop Name</label>
                      <input
                        type="text"
                        maxLength={120}
                        value={shopName}
                        onChange={e => setShopName(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white font-semibold focus:border-[#FF6B00] focus:outline-none"
                      />
                      {shopNameError && (
                        <p className="text-[11px] text-rose-600 font-semibold">{shopNameError}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-[#111111] dark:text-white flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#FF6B00]" />
                        <span>Usual Processing Time</span>
                      </label>
                      <select
                        value={processingTime}
                        onChange={e => setProcessingTime(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
                      >
                        <option value="">Select processing window</option>
                        {PROCESSING_TIME_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Shop Story (About My Craft, max 600) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-[#111111] dark:text-white">
                        Shop Story (About my craft)
                      </label>
                      <span
                        className={`text-[11px] tabular-nums ${
                          shopStory.length >= MAX_SHOP_STORY_LENGTH
                            ? 'text-rose-600 font-bold'
                            : 'text-[#71717A]'
                        }`}
                      >
                        {shopStory.length}/{MAX_SHOP_STORY_LENGTH}
                      </span>
                    </div>
                    <textarea
                      ref={shopStoryInputRef}
                      rows={3}
                      maxLength={MAX_SHOP_STORY_LENGTH}
                      value={shopStory}
                      onChange={e => setShopStory(e.target.value)}
                      placeholder="How did you start your craft, and what inspires your handmade pieces?"
                      className="w-full px-3 py-2.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
                    />
                    {shopStoryError && (
                      <p className="text-[11px] text-rose-600 font-semibold">{shopStoryError}</p>
                    )}
                  </div>

                  {/* What I make & materials used (max 300) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-[#111111] dark:text-white">
                        What I make &amp; materials used
                      </label>
                      <span
                        className={`text-[11px] tabular-nums ${
                          craftMaterials.length >= MAX_CRAFT_MATERIALS_LENGTH
                            ? 'text-rose-600 font-bold'
                            : 'text-[#71717A]'
                        }`}
                      >
                        {craftMaterials.length}/{MAX_CRAFT_MATERIALS_LENGTH}
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      maxLength={MAX_CRAFT_MATERIALS_LENGTH}
                      value={craftMaterials}
                      onChange={e => setCraftMaterials(e.target.value)}
                      placeholder="e.g. Glass seed beads, braided nylon cord, soy wax, natural essential oils"
                      className="w-full px-3 py-2.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
                    />
                    {craftMaterialsError && (
                      <p className="text-[11px] text-rose-600 font-semibold">{craftMaterialsError}</p>
                    )}
                  </div>

                  {/* Short Shop Description */}
                  <div className="space-y-1">
                    <label className="font-bold text-[#111111] dark:text-white block">
                      Shop Bio / Quick Note
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      value={shopBio}
                      onChange={e => setShopBio(e.target.value)}
                      placeholder="Short one-line summary for product pages"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
                    />
                    {shopBioError && (
                      <p className="text-[11px] text-rose-600 font-semibold">{shopBioError}</p>
                    )}
                  </div>

                  {/* Delivery & Pickup Options */}
                  <div className="space-y-3 pt-1">
                    <label className="font-bold text-[#111111] dark:text-white block">
                      Delivery &amp; Pickup Options
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setAllowsPickup(v => !v)}
                        className={`min-h-[44px] px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                          allowsPickup
                            ? 'bg-[#111111] text-[#9FE870] border-[#FF6B00]'
                            : 'bg-[#FAFAFA] dark:bg-[#1E2028] text-[#52525B] dark:text-[#A1A1AA] border-[#E4E4E7] dark:border-[#27272A]'
                        }`}
                      >
                        <span className="font-bold">Campus / Public Pickup</span>
                        <span className="text-[11px] font-black">{allowsPickup ? 'Yes' : 'No'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAllowsLocalDelivery(v => !v)}
                        className={`min-h-[44px] px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                          allowsLocalDelivery
                            ? 'bg-[#111111] text-[#9FE870] border-[#FF6B00]'
                            : 'bg-[#FAFAFA] dark:bg-[#1E2028] text-[#52525B] dark:text-[#A1A1AA] border-[#E4E4E7] dark:border-[#27272A]'
                        }`}
                      >
                        <span className="font-bold">Local Delivery</span>
                        <span className="text-[11px] font-black">{allowsLocalDelivery ? 'Yes' : 'No'}</span>
                      </button>
                    </div>

                    {allowsPickup && (
                      <div className="space-y-2">
                        <label className="font-semibold text-[#52525B] dark:text-[#D4D4D8] block">
                          Public Pickup Spots (no exact home addresses or phone numbers)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            maxLength={60}
                            value={newPickupSpot}
                            onChange={e => setNewPickupSpot(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddPickupSpot();
                              }
                            }}
                            placeholder="e.g. UNILAG Main Gate, Moremi Hall Car Park"
                            className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleAddPickupSpot}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FAFAFA] dark:bg-[#1E2028] hover:border-[#FF6B00] border border-[#E4E4E7] dark:border-[#27272A] font-bold text-[#111111] dark:text-white flex items-center gap-1 shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5 text-[#FF6B00]" />
                            <span>Add Spot</span>
                          </button>
                        </div>
                        {(newSpotError || spotsError) && (
                          <p className="text-[11px] text-rose-600 font-semibold">
                            {newSpotError || spotsError}
                          </p>
                        )}
                        {pickupSpots.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {pickupSpots.map(spot => (
                              <button
                                key={spot}
                                type="button"
                                onClick={() => setPickupSpots(prev => prev.filter(s => s !== spot))}
                                className="min-h-[44px] px-3 py-1.5 rounded-xl bg-[#FAFAFA] dark:bg-[#1E2028] border border-[#E4E4E7] dark:border-[#27272A] text-[#111111] dark:text-white font-semibold flex items-center gap-1.5 hover:border-rose-400"
                              >
                                <span>{spot}</span>
                                <X className="w-3.5 h-3.5 text-[#71717A]" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Group 6: Privacy */}
              <div
                ref={el => {
                  sectionRefs.current.privacy = el;
                }}
                className="space-y-3 scroll-mt-3 pt-2 border-t border-[#E4E4E7] dark:border-[#27272A]"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-[#111111] dark:text-white flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-[#FF6B00]" />
                    <span>Privacy Controls</span>
                  </h3>
                  {isUnder18 && (
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-[#9FE870] flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>Youth Safety Defaults Active</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-[#111111] dark:text-white block">
                      Profile Visibility
                    </label>
                    <select
                      value={privacySettings.profileVisibility}
                      onChange={e =>
                        setPrivacySettings(prev => ({
                          ...prev,
                          profileVisibility: e.target.value as PrivacySettings['profileVisibility'],
                        }))
                      }
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
                    >
                      <option value="public">Public (Everyone)</option>
                      <option value="followers">Followers Only</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-[#111111] dark:text-white block">
                      Who Can Follow Me
                    </label>
                    <select
                      disabled={isUnder18}
                      value={isUnder18 ? 'approval' : privacySettings.whoCanFollow}
                      onChange={e =>
                        setPrivacySettings(prev => ({
                          ...prev,
                          whoCanFollow: e.target.value as PrivacySettings['whoCanFollow'],
                        }))
                      }
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white disabled:opacity-60 focus:border-[#FF6B00] focus:outline-none"
                    >
                      <option value="everyone">Anyone</option>
                      <option value="approval">Approval Required</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-[#111111] dark:text-white block">
                      Who Can Message Me
                    </label>
                    <select
                      disabled={isUnder18}
                      value={isUnder18 ? 'mutual' : privacySettings.whoCanMessage}
                      onChange={e =>
                        setPrivacySettings(prev => ({
                          ...prev,
                          whoCanMessage: e.target.value as PrivacySettings['whoCanMessage'],
                        }))
                      }
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white disabled:opacity-60 focus:border-[#FF6B00] focus:outline-none"
                    >
                      <option value="everyone">Anyone on Shop It</option>
                      <option value="followers">My Followers</option>
                      <option value="mutual">Mutual Followers Only</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={isUnder18}
                    onClick={() =>
                      setPrivacySettings(prev => ({ ...prev, showLastSeen: !prev.showLastSeen }))
                    }
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 disabled:opacity-60 ${
                      privacySettings.showLastSeen && !isUnder18
                        ? 'bg-[#FAFAFA] dark:bg-[#1E2028] border-[#FF6B00] text-[#111111] dark:text-white'
                        : 'bg-[#FAFAFA] dark:bg-[#1E2028] border-[#E4E4E7] dark:border-[#27272A] text-[#71717A]'
                    }`}
                  >
                    <span className="font-semibold">Show Last Seen</span>
                    <span className="font-black text-[11px]">
                      {privacySettings.showLastSeen && !isUnder18 ? 'On' : 'Off'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPrivacySettings(prev => ({
                        ...prev,
                        showFollowersList: !prev.showFollowersList,
                      }))
                    }
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 ${
                      privacySettings.showFollowersList
                        ? 'bg-[#FAFAFA] dark:bg-[#1E2028] border-[#FF6B00] text-[#111111] dark:text-white'
                        : 'bg-[#FAFAFA] dark:bg-[#1E2028] border-[#E4E4E7] dark:border-[#27272A] text-[#71717A]'
                    }`}
                  >
                    <span className="font-semibold">Show Followers List</span>
                    <span className="font-black text-[11px]">
                      {privacySettings.showFollowersList ? 'On' : 'Off'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPrivacySettings(prev => ({
                        ...prev,
                        showFollowingList: !prev.showFollowingList,
                      }))
                    }
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 ${
                      privacySettings.showFollowingList
                        ? 'bg-[#FAFAFA] dark:bg-[#1E2028] border-[#FF6B00] text-[#111111] dark:text-white'
                        : 'bg-[#FAFAFA] dark:bg-[#1E2028] border-[#E4E4E7] dark:border-[#27272A] text-[#71717A]'
                    }`}
                  >
                    <span className="font-semibold">Show Following List</span>
                    <span className="font-black text-[11px]">
                      {privacySettings.showFollowingList ? 'On' : 'Off'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Group 7: Public Link & QR Code */}
              <div
                ref={el => {
                  sectionRefs.current.link = el;
                }}
                className="space-y-3 scroll-mt-3 pt-2 border-t border-[#E4E4E7] dark:border-[#27272A]"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-[#111111] dark:text-white flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-[#FF6B00]" />
                    <span>Public Profile Link &amp; QR Code</span>
                  </h3>
                </div>
                <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
                  Changing your display name updates your readable profile link while old links automatically forward here.
                </p>
                <div className="p-4 rounded-xl bg-[#FAFAFA] dark:bg-[#1E2028] border border-[#E4E4E7] dark:border-[#27272A]">
                  <ProfileQrCode
                    url={profileUrl}
                    label={previewTitle}
                    slug={activeSlug || 'profile'}
                    compact
                  />
                </div>
              </div>

              {/* Submit Bar */}
              <div className="pt-3 border-t border-[#E4E4E7] dark:border-[#27272A] flex flex-wrap items-center justify-between gap-2 sticky bottom-0 bg-white dark:bg-[#15161C] pb-1">
                <button
                  type="button"
                  onClick={() => setPreviewAsVisitor(true)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] font-bold text-[#111111] dark:text-white hover:border-[#FF6B00] inline-flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>Preview Visitor View</span>
                </button>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={attemptClose}
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] font-bold text-[#52525B] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || uploadingTarget !== null || hasValidationError}
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E55E00] disabled:opacity-50 text-[#111111] font-black border-2 border-[#111111] shadow-[0_2px_0_#111111] flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSaving ? 'Saving...' : uploadingTarget ? 'Uploading Image...' : 'Save Profile'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      <ImageCropperModal
        isOpen={Boolean(cropTarget)}
        fileUrl={cropTarget?.fileUrl || ''}
        aspectRatio={cropTarget?.kind === 'cover' ? '16:5' : '1:1'}
        title={cropTarget?.kind === 'cover' ? 'Crop Cover Banner (16:5)' : 'Crop Profile Photo (1:1)'}
        onCancel={() => setCropTarget(null)}
        onSave={dataUrl => {
          const kind = cropTarget?.kind === 'cover' ? 'cover' : 'avatar';
          setCropTarget(null);
          setUploadingTarget(kind);
          void uploadFileToServer(dataUrl, kind, { fileName: `${kind}.jpg` })
            .then(uploaded => {
              if (kind === 'cover') {
                setCoverUrl(uploaded.url);
              } else {
                setAvatarUrl(uploaded.url);
              }
              notify(kind === 'cover' ? 'Cover banner uploaded!' : 'Profile photo uploaded!', 'success');
            })
            .catch(err => {
              notify(err instanceof Error ? err.message : 'Failed to upload image.', 'error');
            })
            .finally(() => {
              setUploadingTarget(null);
            });
        }}
      />
    </>
  );
};
