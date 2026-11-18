import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Image as ImageIcon, Check, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CAMPUSES } from '../data/mockData';
import {
  PROFILE_INTERESTS,
  DEFAULT_AVATAR_PRESETS,
  clientContainsForbiddenContactInfo,
} from '../utils/profileConstants';
import { uploadFileToServer } from '../utils/fileUpload';
import { ImageCropperModal } from './ImageCropperModal';
import { PublicProfileData } from '../types';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProfile?: PublicProfileData | null;
  onSaved?: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  initialProfile,
  onSaved,
}) => {
  const { currentUser, currentSeller, updateMyProfile, notify } = useApp();

  const isSeller = Boolean(currentUser?.role === 'seller' || currentSeller || initialProfile?.seller);

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [campus, setCampus] = useState('');
  const [locationArea, setLocationArea] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [shopName, setShopName] = useState('');
  const [shopBio, setShopBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<'avatar' | 'cover' | null>(null);

  const [cropTarget, setCropTarget] = useState<{
    kind: 'avatar' | 'cover';
    fileUrl: string;
  } | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDisplayName(
      initialProfile?.displayName ||
        currentUser?.displayName ||
        (currentUser?.name ? currentUser.name.trim().split(/\s+/)[0] : '') ||
        ''
    );
    setAvatarUrl(initialProfile?.avatarUrl ?? currentUser?.avatarUrl ?? null);
    setCoverUrl(initialProfile?.coverUrl ?? currentUser?.coverUrl ?? null);
    setBio(initialProfile?.bio ?? currentUser?.bio ?? '');
    setCampus(initialProfile?.campus ?? currentUser?.campus ?? currentSeller?.campus ?? 'UNILAG (Akoka)');
    setLocationArea(
      initialProfile?.locationArea ??
        currentUser?.locationArea ??
        currentSeller?.locationArea ??
        'Yaba'
    );
    setInterests(initialProfile?.interests ?? currentUser?.interests ?? []);
    setShopName(initialProfile?.seller?.shopName ?? currentSeller?.shopName ?? '');
    setShopBio(initialProfile?.seller?.bio ?? currentSeller?.bio ?? '');
  }, [isOpen, initialProfile, currentUser, currentSeller]);

  if (!isOpen) return null;

  const getContactErr = (val: string): string | null => {
    const res = clientContainsForbiddenContactInfo(val);
    return res.blocked ? res.reason || 'Forbidden contact information is not allowed.' : null;
  };

  const nameError = displayName.trim() ? getContactErr(displayName) : null;
  const bioError = bio.trim() ? getContactErr(bio) : null;
  const areaError = locationArea.trim() ? getContactErr(locationArea) : null;
  const shopNameError = isSeller && shopName.trim() ? getContactErr(shopName) : null;
  const shopBioError = isSeller && shopBio.trim() ? getContactErr(shopBio) : null;

  const hasValidationError = Boolean(
    nameError || bioError || areaError || shopNameError || shopBioError || displayName.trim().length < 2
  );

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasValidationError) {
      notify('Please fix the highlighted fields before saving.', 'error');
      return;
    }

    setIsSaving(true);
    const res = await updateMyProfile({
      displayName: displayName.trim(),
      avatarUrl,
      coverUrl,
      bio: bio.trim(),
      campus: campus.trim(),
      locationArea: locationArea.trim(),
      interests,
      ...(isSeller
        ? {
            shopName: shopName.trim(),
            shopBio: shopBio.trim(),
          }
        : {}),
    });
    setIsSaving(false);

    if (res.status) {
      onSaved?.();
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-backdrop overflow-y-auto">
        <div className="bg-white dark:bg-[#15161C] rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col border border-[#E4E4E7] dark:border-[#27272A] shadow-2xl overflow-hidden my-auto animate-modal-enter">
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-[#111111] dark:text-white">Edit Profile</h2>
              <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
                All profile information stays inside Shop It. Phone numbers, links, and @handles are blocked.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#71717A] hover:text-[#111111] dark:hover:text-white hover:bg-[#F4F4F5] dark:hover:bg-[#1E2028]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
            {/* Cover Banner Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-[#111111] dark:text-white">Cover Banner (16:5)</label>
                {coverUrl && (
                  <button
                    type="button"
                    onClick={() => setCoverUrl(null)}
                    className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
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
                    <span className="font-semibold">Click to upload & crop a cover photo</span>
                  </div>
                )}
                <div className={`absolute inset-0 bg-black/45 flex items-center justify-center text-white font-bold gap-1.5 transition-opacity ${uploadingTarget === 'cover' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
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
              <div className="flex items-center justify-between">
                <label className="font-bold text-[#111111] dark:text-white">Profile Photo</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={uploadingTarget === 'avatar'}
                    onClick={() => avatarInputRef.current?.click()}
                    className="text-[11px] font-bold text-[#FF6B00] hover:underline flex items-center gap-1 disabled:opacity-60"
                  >
                    {uploadingTarget === 'avatar' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                    <span>{uploadingTarget === 'avatar' ? 'Uploading Photo...' : 'Upload & Crop Photo'}</span>
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(null)}
                      className="text-[11px] font-bold text-[#71717A] hover:text-rose-600"
                    >
                      Clear
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
                        className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all ${
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

            {/* Display Name */}
            <div className="space-y-1">
              <label className="font-bold text-[#111111] dark:text-white block">
                Display Name * (First name or nickname, shown publicly)
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={40}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="e.g. Amaka"
                className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white font-semibold focus:border-[#FF6B00] focus:outline-none"
              />
              {nameError && (
                <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{nameError}</span>
                </p>
              )}
            </div>

            {/* Bio */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-bold text-[#111111] dark:text-white">Short Bio</label>
                <span className={`text-[11px] font-mono-numbers ${bio.length > 200 ? 'text-rose-600 font-bold' : 'text-[#71717A]'}`}>
                  {bio.length}/200
                </span>
              </div>
              <textarea
                rows={3}
                maxLength={200}
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell campus shoppers what crafts you love or make..."
                className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
              />
              {bioError && (
                <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{bioError}</span>
                </p>
              )}
            </div>

            {/* Campus & Area */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-[#111111] dark:text-white block">Campus / University</label>
                <select
                  value={campus}
                  onChange={e => setCampus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
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
                <label className="font-bold text-[#111111] dark:text-white block">Public Area</label>
                <input
                  type="text"
                  maxLength={100}
                  value={locationArea}
                  onChange={e => setLocationArea(e.target.value)}
                  placeholder="e.g. Yaba, Akoka, Bodija"
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#1E2028] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
                />
                {areaError && <p className="text-[11px] text-rose-600 font-semibold">{areaError}</p>}
              </div>
            </div>

            {/* Interests (10 Fixed Tags) */}
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
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
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

            {/* Seller Shop Identity Fields */}
            {isSeller && (
              <div className="p-4 rounded-2xl bg-[#FAFAFA] dark:bg-[#1E2028] border border-[#E4E4E7] dark:border-[#27272A] space-y-3">
                <h3 className="font-black text-[#111111] dark:text-white">Seller Shop Details</h3>
                <div className="space-y-1">
                  <label className="font-bold text-[#52525B] dark:text-[#D4D4D8] block">Shop Name</label>
                  <input
                    type="text"
                    maxLength={120}
                    value={shopName}
                    onChange={e => setShopName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#15161C] text-[#111111] dark:text-white font-semibold focus:border-[#FF6B00] focus:outline-none"
                  />
                  {shopNameError && <p className="text-[11px] text-rose-600 font-semibold">{shopNameError}</p>}
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#52525B] dark:text-[#D4D4D8] block">Shop Description</label>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={shopBio}
                    onChange={e => setShopBio(e.target.value)}
                    placeholder="What makes your handmade items special?"
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#15161C] text-[#111111] dark:text-white focus:border-[#FF6B00] focus:outline-none"
                  />
                  {shopBioError && <p className="text-[11px] text-rose-600 font-semibold">{shopBioError}</p>}
                </div>
              </div>
            )}

            {/* Submit Bar */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] font-bold text-[#52525B] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || uploadingTarget !== null || hasValidationError}
                className="px-5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E55E00] disabled:opacity-50 text-[#111111] font-black border-2 border-[#111111] shadow-[0_2px_0_#111111] flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : uploadingTarget ? 'Uploading Image...' : 'Save Profile'}</span>
              </button>
            </div>
          </form>
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
