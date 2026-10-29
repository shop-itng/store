import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { NIGERIAN_STATES } from '../data/nigerianLocations';
import { ProductCategory } from '../types';
import { getPricingBreakdown, formatNaira } from '../utils/pricing';
import {
  X,
  Upload,
  Camera,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export const QuickListModal: React.FC = () => {
  const {
    isQuickListModalOpen,
    closeQuickListModal,
    addProduct,
    currentSeller,
    currentUser,
    sellers,
    setActiveView,
    userLocation,
    notify,
  } = useApp();

  // Location selector (State > City > Area)
  const [stateName, setStateName] = useState(userLocation.state || 'Lagos');
  const [cityName, setCityName] = useState(userLocation.city || 'Lagos Mainland');
  const [areaName, setAreaName] = useState(userLocation.area || 'Yaba');

  // Custom craft state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ProductCategory>('beads');
  const [sellerPrice, setSellerPrice] = useState<number>(3500);
  const [stock, setStock] = useState<number>(5);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [pickupFee, setPickupFee] = useState<number>(200);
  const [localDeliveryFee, setLocalDeliveryFee] = useState<number>(500);
  const [isCompressing, setIsCompressing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isQuickListModalOpen) return null;

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

  const pricing = getPricingBreakdown(sellerPrice);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        notify('Please select an image file (PNG, JPG, WEBP).', 'error');
        return;
      }
      setIsCompressing(true);
      const reader = new FileReader();
      reader.onload = event => {
        setIsCompressing(false);
        if (event.target?.result) {
          setImageUrl(event.target.result as string);
          notify('Your product photo has been loaded successfully!', 'success');
        }
      };
      reader.onerror = () => {
        setIsCompressing(false);
        notify('Could not load image. Please try again.', 'error');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageUrl) {
      notify('Please upload a real picture of your product. Preset/stock images are not allowed.', 'error');
      return;
    }

    if (!title.trim()) {
      notify('Please enter a title for your product.', 'error');
      return;
    }

    if (sellerPrice < 100) {
      notify('Minimum price is ₦100.', 'error');
      return;
    }

    const seller = currentSeller || sellers[0];
    const sId = seller?.id || currentUser?.id || `seller_${Date.now()}`;
    const sName = seller?.shopName || currentUser?.name || 'Independent Maker';

    addProduct({
      sellerId: sId,
      sellerShopName: sName,
      location: {
        state: stateName,
        city: cityName,
        area: areaName,
      },
      locationArea: areaName, // Only area is shown publicly
      sellerBadges: ['verified'],
      title: title.trim(),
      description: description.trim() || `${title} crafted with care in ${areaName}.`,
      category,
      sellerPrice,
      images: [imageUrl],
      stock,
      delivery: {
        allowsPickup: true,
        pickupLocation: `${areaName} Safe Handoff Spot`,
        pickupFee,
        allowsLocalDelivery: true,
        localDeliveryFee,
        minOrderForDelivery: 1000,
      },
    });

    notify(`Your craft "${title}" was published in ${areaName}!`, 'success');
    closeQuickListModal();
    setActiveView('catalog');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto animate-backdrop">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col border border-[#E4E4E7] shadow-2xl overflow-hidden my-auto animate-modal-enter">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E4E4E7] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <img
              src="/shopit-logo.png"
              alt="Shop It"
              className="w-10 h-10 rounded-xl object-contain shadow-xs"
            />
            <div>
              <h3 className="text-base font-black text-[#111111]">
                List Your Product
              </h3>
              <p className="text-[11px] text-[#71717A] font-medium">
                Upload your real craft photo and set your price
              </p>
            </div>
          </div>
          <button
            onClick={closeQuickListModal}
            className="text-[#71717A] hover:text-[#111111] p-1.5 rounded-lg hover:bg-[#F4F4F5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Location Selector (State > City > Area) */}
        <div className="px-4 py-3 bg-[#FAFAFA] border-b border-[#E4E4E7]">
          <span className="block text-[11px] font-bold text-[#111111] mb-1.5 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>Product Location: State &gt; City &gt; Area (Only Area is shown publicly)</span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={stateName}
              onChange={e => handleStateChange(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-[#E4E4E7] rounded-lg text-xs font-medium focus:border-[#FF6B00] focus:outline-none"
            >
              {NIGERIAN_STATES.map(s => (
                <option key={s.state} value={s.state}>
                  {s.state}
                </option>
              ))}
            </select>

            <select
              value={cityName}
              onChange={e => handleCityChange(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-[#E4E4E7] rounded-lg text-xs font-medium focus:border-[#FF6B00] focus:outline-none"
            >
              {activeStateObj.cities.map(c => (
                <option key={c.city} value={c.city}>
                  {c.city}
                </option>
              ))}
            </select>

            <select
              value={areaName}
              onChange={e => setAreaName(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-[#E4E4E7] rounded-lg text-xs font-bold text-[#FF6B00] focus:border-[#FF6B00] focus:outline-none"
            >
              {activeCityObj?.areas.map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Real Photo Upload Requirement Notice */}
          <div className="p-3 bg-[#FFF4EC] border border-[#FED7AA] rounded-xl flex items-start gap-2 text-[#C2410C]">
            <Camera className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong>Real Product Photo Required: </strong>
              Per Shop It policy, sellers must upload pictures of the actual product they crafted or own. No stock photos or preset templates.
            </div>
          </div>

          {/* Photo Upload Area */}
          <div>
            <label className="block text-xs font-bold text-[#111111] mb-1.5">
              Product Picture *
            </label>

            {imageUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-[#E4E4E7] bg-[#F4F4F5] aspect-video sm:aspect-2/1 flex items-center justify-center">
                <img
                  src={imageUrl}
                  alt="Product preview"
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 px-2.5 py-1 bg-black/75 hover:bg-black text-white text-[11px] font-bold rounded-lg"
                >
                  Change Photo
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#E4E4E7] hover:border-[#FF6B00] rounded-2xl p-6 text-center cursor-pointer transition-colors bg-[#FAFAFA]"
              >
                <Upload className="w-8 h-8 text-[#FF6B00] mx-auto mb-2" />
                <span className="text-xs font-bold text-[#111111] block">
                  {isCompressing ? 'Loading photo...' : 'Tap to Upload Product Photo from Phone/PC'}
                </span>
                <span className="text-[11px] text-[#71717A] mt-1 block">
                  PNG, JPG, or WEBP · Clear photo of your real item
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-[#111111] mb-1">
              Product Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Handmade Blue Crystal Waist Beads (Set of 2)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-[#E4E4E7] rounded-xl text-xs sm:text-sm text-[#111111] focus:border-[#FF6B00] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#111111] mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as ProductCategory)}
                className="w-full px-3 py-2 border border-[#E4E4E7] rounded-xl text-xs bg-white text-[#111111] focus:border-[#FF6B00] focus:outline-none"
              >
                <option value="beads">Waist Beads & Jewelry</option>
                <option value="fragrance">Perfume Oils & Scents</option>
                <option value="bags">Crochet Bags & Totes</option>
                <option value="fashion">Fashion & Wearables</option>
                <option value="decor">Room Decor & Candles</option>
                <option value="crafts">Art & Handmade Crafts</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#111111] mb-1">
                Stock Quantity *
              </label>
              <input
                type="number"
                required
                min={1}
                value={stock}
                onChange={e => setStock(Number(e.target.value))}
                className="w-full px-3 py-2 border border-[#E4E4E7] rounded-xl text-xs font-bold font-mono-numbers focus:border-[#FF6B00] focus:outline-none"
              />
            </div>
          </div>

          {/* Pricing Box */}
          <div className="p-3.5 bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#14532D]">
                Your Price (₦ You Earn) *
              </label>
              <span className="text-[11px] text-[#166534] font-semibold">
                Buyer sees {formatNaira(pricing.displayPrice)}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#166534]">
                ₦
              </span>
              <input
                type="number"
                required
                min={100}
                step={50}
                value={sellerPrice}
                onChange={e => setSellerPrice(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-2 bg-white border border-[#86EFAC] rounded-xl text-xs sm:text-sm font-black font-mono-numbers text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
              />
            </div>
            <div className="flex justify-between text-[11px] text-[#166534] pt-1">
              <span>Includes Shop It Escrow Protection:</span>
              <span>+{formatNaira(pricing.serviceFee)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#111111] mb-1">
              Description & Craft Details
            </label>
            <textarea
              rows={2}
              placeholder="Describe materials, sizing, color variants, or how you make it..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-[#E4E4E7] rounded-xl text-xs focus:border-[#FF6B00] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#71717A] mb-1 font-semibold">
                Area Pickup Fee (₦)
              </label>
              <input
                type="number"
                value={pickupFee}
                onChange={e => setPickupFee(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-[#E4E4E7] rounded-lg text-xs font-mono-numbers"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#71717A] mb-1 font-semibold">
                Local Dispatch Fee (₦)
              </label>
              <input
                type="number"
                value={localDeliveryFee}
                onChange={e => setLocalDeliveryFee(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-[#E4E4E7] rounded-lg text-xs font-mono-numbers"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] font-black text-xs sm:text-sm rounded-xl shadow-[0_3px_0_#111111] transition-all flex items-center justify-center gap-2 active:translate-y-0.5"
            >
              <span className="w-5 h-5 rounded-full bg-[#9FE870] text-[#111111] flex items-center justify-center font-black">
                ✓
              </span>
              <span>Publish Product in {areaName}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
