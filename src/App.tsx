import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { RoleSwitcherBar } from './components/RoleSwitcherBar';
import { LowDataBanner } from './components/LowDataBanner';
import { TypoSearchBar } from './components/TypoSearchBar';
import { ProductCard } from './components/ProductCard';
import { ProductDetailView } from './components/ProductDetailView';
import { SellerShopView } from './components/SellerShopView';
import { SellerDashboard } from './components/SellerDashboard';
import { WishlistView } from './components/WishlistView';
import { CartView } from './components/CartView';
import { OrdersView } from './components/OrdersView';
import { AdminPanel } from './components/AdminPanel';
import { LockedChatView } from './components/LockedChatView';
import { QuickListModal } from './components/QuickListModal';
import { ReportProblemModal } from './components/ReportProblemModal';
import { CheckoutModal } from './components/CheckoutModal';
import { AuthModal } from './components/AuthModal';
import { ToastContainer } from './components/ToastContainer';
import { Footer } from './components/Footer';
import { LegalAndHelpPages } from './components/LegalAndHelpPages';
import { BroadcastBanner } from './components/BroadcastBanner';
import { Analytics } from '@vercel/analytics/react';
import { Loading } from './components/Loading';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotFoundView } from './components/NotFoundView';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { AccountSettingsView } from './components/AccountSettingsView';
import { Store, ShieldCheck, MapPin, Star, ArrowRight, PackageOpen, ShoppingBag, ShieldAlert, ArrowLeft, Clock, Loader2, Users } from 'lucide-react';
import { Product, SuggestedSellerItem, ProfileSearchResult } from './types';
import { getTrustCopy } from '../shared/trustAndLegalCopy';


const MarketplaceContent: React.FC = () => {
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [selectedSpotCampus, setSelectedSpotCampus] = React.useState<string>('All');
  const [feedTab, setFeedTab] = React.useState<'all' | 'following'>('all');
  const [followingProducts, setFollowingProducts] = React.useState<Product[]>([]);
  const [followingTotal, setFollowingTotal] = React.useState(0);
  const [followingShopsCount, setFollowingShopsCount] = React.useState(0);
  const [followingPage, setFollowingPage] = React.useState(1);
  const [followingLoading, setFollowingLoading] = React.useState(false);
  const [followingLoadingMore, setFollowingLoadingMore] = React.useState(false);
  const [followingError, setFollowingError] = React.useState<string | null>(null);
  const [suggestedSellers, setSuggestedSellers] = React.useState<SuggestedSellerItem[]>([]);
  const [profileResults, setProfileResults] = React.useState<ProfileSearchResult[]>([]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 350);
    return () => clearTimeout(timer);
  }, []);
  const {
    activeView,
    setActiveView,
    selectedProductId,
    activeProfileSlug,
    isCatalogLoading,
    catalogError,
    sellersError,
    isProductDetailLoading,
    productDetailError,
    suggestedSellersError,
    retryMarketplaceLoad,
    retryProductDetail,
    products,
    filteredProducts,
    searchQuery,
    sellers,
    safePickupSpots,
    setSelectedCampus,
    openProfile,
    resetFilters,
    openQuickListModal,
    openAuthModal,
    userLocation,
    currentUser,
    paymentsEnabled,
    emergencyControls,
    fetchFollowingFeed,
    fetchSuggestedSellers,
    searchProfiles,
  } = useApp();
  const trustCopy = getTrustCopy(paymentsEnabled);

  const loadFollowingFeed = React.useCallback(async () => {
    if (!currentUser?.id) return;
    setFollowingLoading(true);
    setFollowingError(null);
    setFollowingPage(1);
    const res = await fetchFollowingFeed(1);
    setFollowingLoading(false);
    if (!res.status) {
      setFollowingError(res.message || 'Could not load Following feed.');
      return;
    }
    setFollowingProducts(res.products);
    setFollowingTotal(res.total);
    setFollowingShopsCount(res.followingCount);
  }, [currentUser?.id, fetchFollowingFeed]);

  const loadMoreFollowingFeed = React.useCallback(async () => {
    if (!currentUser?.id || followingLoadingMore) return;
    const nextPage = followingPage + 1;
    setFollowingLoadingMore(true);
    const res = await fetchFollowingFeed(nextPage);
    setFollowingLoadingMore(false);
    if (res.status && res.products.length > 0) {
      setFollowingProducts(prev => {
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...res.products.filter(p => !seen.has(p.id))];
      });
      setFollowingPage(nextPage);
      setFollowingTotal(res.total);
    }
  }, [currentUser?.id, followingPage, followingLoadingMore, fetchFollowingFeed]);

  React.useEffect(() => {
    if (!currentUser?.id && feedTab === 'following') {
      setFeedTab('all');
    } else if (currentUser?.id && feedTab === 'following' && activeView === 'catalog') {
      void loadFollowingFeed();
    }
  }, [currentUser?.id, feedTab, activeView, loadFollowingFeed]);

  React.useEffect(() => {
    if (activeView !== 'catalog') return;
    void fetchSuggestedSellers(8).then(setSuggestedSellers);
  }, [activeView, currentUser?.id, fetchSuggestedSellers]);

  React.useEffect(() => {
    const clean = searchQuery.trim();
    if (clean.length < 2) {
      setProfileResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchProfiles(clean, 8).then(setProfileResults);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, searchProfiles]);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Full-page initial loader with smooth fade-out
  if (isInitialLoading) {
    return <Loading fullPage text="Starting Shop It..." />;
  }

  // If maintenanceMode is active and user is not admin, show emergency maintenance splash
  if (emergencyControls?.maintenanceMode && currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-stone-900 text-white flex flex-col justify-between p-6">
        <BroadcastBanner />
        <div className="max-w-md mx-auto text-center space-y-6 my-auto py-12">
          <div className="w-16 h-16 rounded-2xl bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#9FE870] bg-black/40 px-3 py-1 rounded-full border border-stone-800">
              System Maintenance Active
            </span>
            <h1 className="text-2xl font-black">Shop It Under Maintenance</h1>
            <p className="text-stone-400 text-xs sm:text-sm leading-relaxed">
              Our safety moderation team is conducting a routine security and maintenance check. Active orders and wallet records are preserved.
            </p>
          </div>
          <div className="pt-4 border-t border-stone-800 flex items-center justify-center gap-3">
            <button
              onClick={() => openAuthModal('login')}
              className="text-xs text-stone-400 hover:text-white transition-colors underline decoration-stone-600"
            >
              Sign in to Account
            </button>
          </div>
        </div>
        <div className="text-center text-[11px] text-stone-500 pb-4">
          Shop It · Nigerian Youth Artisanal Marketplace
        </div>
        <AuthModal />
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden flex flex-col bg-[#f9fafb] dark:bg-[#0D0E12] text-neutral-900 dark:text-[#F4F4F5] pb-20 md:pb-0 transition-colors duration-200">
      {/* Role Switcher Toolbar */}
      <RoleSwitcherBar />

      {/* Moderator Live Site Broadcast Banner */}
      <BroadcastBanner />

      {/* Main Top Header with S Logo & Location */}
      <Header />

      {/* Low-data mode notice (if enabled) */}
      <LowDataBanner />

      {/* Main View Router */}
      <main className="flex-1">
        {activeView === 'catalog' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in-up">
            {/* Search & Location Filter Bar (State > City > Area) */}
            <TypoSearchBar />

            {/* Product Feed Grid */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                    {feedTab === 'following' ? 'Following Feed' : 'Items & Crafts For Sale'}
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-[#A1A1AA] mt-0.5">
                    {feedTab === 'following'
                      ? followingTotal > 0
                        ? `Showing ${followingTotal} item(s) from shops you follow`
                        : 'Latest crafts from makers you follow'
                      : filteredProducts.length > 0
                      ? `Showing ${filteredProducts.length} items available in your location`
                      : 'Marketplace feed for Nigerian teens and youth'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {currentUser?.id && (
                    <div className="inline-flex p-1 rounded-xl bg-white dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A]">
                      <button
                        type="button"
                        onClick={() => setFeedTab('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors whitespace-nowrap ${
                          feedTab === 'all'
                            ? 'bg-[#111111] text-[#9FE870]'
                            : 'text-[#71717A] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
                        }`}
                      >
                        All Crafts
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedTab('following')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors whitespace-nowrap flex items-center gap-1 ${
                          feedTab === 'following'
                            ? 'bg-[#FF6B00] text-[#111111]'
                            : 'text-[#71717A] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Following</span>
                      </button>
                    </div>
                  )}

                  {feedTab === 'all' && filteredProducts.length > 0 && (
                    <span className="text-xs text-neutral-500 dark:text-[#A1A1AA] hidden sm:inline">
                      Location: <strong className="text-neutral-900 dark:text-white">{userLocation.area}</strong>
                    </span>
                  )}
                </div>
              </div>

              {feedTab === 'following' ? (
                followingLoading ? (
                  <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-12 text-center space-y-2">
                    <Loader2 className="w-7 h-7 animate-spin text-[#FF6B00] mx-auto" />
                    <p className="text-xs font-bold text-[#71717A] dark:text-[#A1A1AA]">
                      Loading crafts from shops you follow...
                    </p>
                  </div>
                ) : followingError ? (
                  <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-10 text-center max-w-md mx-auto space-y-3">
                    <p className="text-xs font-bold text-rose-600">{followingError}</p>
                    <button
                      type="button"
                      onClick={() => void loadFollowingFeed()}
                      className="px-4 py-2 bg-[#111111] text-[#9FE870] text-xs font-black rounded-xl border border-[#FF6B00]"
                    >
                      Try Again
                    </button>
                  </div>
                ) : followingProducts.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
                      {followingProducts.map((product, idx) => (
                        <ProductCard key={product.id} product={product} index={idx} />
                      ))}
                    </div>
                    {followingProducts.length < followingTotal && (
                      <div className="flex justify-center pt-2">
                        <button
                          type="button"
                          disabled={followingLoadingMore}
                          onClick={() => void loadMoreFollowingFeed()}
                          className="px-5 py-2.5 rounded-xl bg-white dark:bg-[#15161C] border-2 border-[#111111] dark:border-[#27272A] hover:border-[#FF6B00] text-xs font-black text-[#111111] dark:text-white flex items-center gap-2"
                        >
                          {followingLoadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>
                            {followingLoadingMore
                              ? 'Loading more...'
                              : `Load More (${followingProducts.length} of ${followingTotal})`}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-10 text-center max-w-md mx-auto space-y-3 shadow-xs">
                    <Users className="w-8 h-8 text-[#FF6B00] mx-auto" />
                    <h3 className="text-sm font-black text-[#111111] dark:text-white">
                      {followingShopsCount === 0
                        ? "You're not following any shops yet"
                        : "Followed shops haven't listed items yet"}
                    </h3>
                    <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] leading-relaxed">
                      {followingShopsCount === 0
                        ? 'Follow your favorite campus makers from any listing or shop profile to see their newest crafts here.'
                        : 'Check back soon or browse All Crafts across the marketplace.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setFeedTab('all')}
                      className="px-4 py-2 bg-[#FF6B00] text-[#111111] border-2 border-[#111111] text-xs font-black rounded-xl"
                    >
                      Browse All Crafts
                    </button>
                  </div>
                )
              ) : isCatalogLoading && products.length === 0 ? (
                <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-12 text-center space-y-2">
                  <Loader2 className="w-7 h-7 animate-spin text-[#FF6B00] mx-auto" />
                  <p className="text-xs font-bold text-[#71717A] dark:text-[#A1A1AA]">
                    Loading marketplace crafts...
                  </p>
                </div>
              ) : catalogError && products.length === 0 ? (
                <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-rose-200 dark:border-rose-900/50 p-10 text-center max-w-md mx-auto space-y-3 shadow-xs">
                  <ShieldAlert className="w-8 h-8 text-rose-500 mx-auto" />
                  <h3 className="text-sm font-black text-[#111111] dark:text-white">
                    Could Not Load Marketplace
                  </h3>
                  <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] leading-relaxed">
                    {catalogError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void retryMarketplaceLoad()}
                    className="px-4 py-2 bg-[#111111] text-[#9FE870] text-xs font-black rounded-xl border border-[#FF6B00]"
                  >
                    Retry
                  </button>
                </div>
              ) : products.length === 0 ? (
                /* Ready-Made Fresh Marketplace Launch State (Solid, Human-Made, No gradients) */
                <div className="bg-white dark:bg-[#15161C] rounded-3xl border-2 border-[#111111] dark:border-[#27272A] p-8 sm:p-12 text-center max-w-xl mx-auto space-y-6 shadow-[0_4px_0_#111111] dark:shadow-none transition-colors">
                  {/* The Official Shop It Logo */}
                  <img
                    src="/shopit-logo.png"
                    alt="Shop It"
                    className="w-16 h-16 rounded-2xl mx-auto object-contain shadow-sm border border-[#111111] dark:border-[#27272A]"
                  />

                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#111111] text-[#9FE870] border border-[#FF6B00]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
                      <span>{trustCopy.homeWelcomeBadge}</span>
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-[#111111] dark:text-white tracking-tight">
                      Welcome to Shop It
                    </h3>
                    <p className="text-xs sm:text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed max-w-md mx-auto">
                      {trustCopy.homeWelcomeSubtitle}
                    </p>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    {currentUser?.role === 'seller' ? (
                      <>
                        <button
                          onClick={() => openQuickListModal()}
                          className="px-5 py-3 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] dark:border-stone-800 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center gap-2 shadow-[0_3px_0_#111111] dark:shadow-none active:translate-y-0.5"
                        >
                          <span className="w-5 h-5 rounded-full bg-[#9FE870] text-[#111111] flex items-center justify-center text-xs font-black">
                            +
                          </span>
                          <span>Sell Your Product</span>
                        </button>
                        <button
                          onClick={() => setActiveView('seller_dashboard')}
                          className="px-5 py-3 bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] border-2 border-[#111111] dark:border-stone-800 text-xs sm:text-sm font-black rounded-xl transition-all shadow-[0_3px_0_#111111] dark:shadow-none active:translate-y-0.5"
                        >
                          Go to My Shop
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setActiveView('catalog');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-5 py-3 bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] border-2 border-[#111111] dark:border-stone-800 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center gap-2 shadow-[0_3px_0_#111111] dark:shadow-none active:translate-y-0.5"
                        >
                          <ShoppingBag className="w-4 h-4 text-[#111111]" />
                          <span>Buy Items Now</span>
                        </button>
                        <button
                          onClick={() => openAuthModal('seller_register')}
                          className="px-5 py-3 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] dark:border-stone-800 text-xs sm:text-sm font-black rounded-xl transition-all shadow-[0_3px_0_#111111] dark:shadow-none active:translate-y-0.5"
                        >
                          Sign Up as a Seller
                        </button>
                      </>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#E4E4E7] dark:border-[#27272A] flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-[#71717A] dark:text-[#A1A1AA]">
                    <span className="flex items-center gap-1.5 font-bold text-[#111111] dark:text-white text-center">
                      <ShieldCheck className="w-4 h-4 text-[#16A34A] dark:text-[#9FE870] shrink-0" />
                      <span>{trustCopy.homeTrustPrimary}</span>
                    </span>
                    <span className="hidden sm:inline">·</span>
                    <span className="flex items-center gap-1.5 font-bold text-[#111111] dark:text-white">
                      <MapPin className="w-4 h-4 text-[#FF6B00] shrink-0" />
                      <span>{trustCopy.homeTrustSecondary}</span>
                    </span>
                  </div>
                </div>
              ) : filteredProducts.length > 0 ? (
                <div className="space-y-4">
                  {catalogError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-rose-700 dark:text-rose-300">{catalogError}</span>
                      <button
                        type="button"
                        onClick={() => void retryMarketplaceLoad()}
                        className="px-3 py-1.5 rounded-lg bg-[#111111] text-[#9FE870] font-black shrink-0"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
                    {filteredProducts.map((product, idx) => (
                      <ProductCard key={product.id} product={product} index={idx} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-10 text-center max-w-md mx-auto space-y-3 shadow-xs">
                  <PackageOpen className="w-8 h-8 text-[#A1A1AA] mx-auto" />
                  <h3 className="text-sm font-bold text-[#111111] dark:text-white">No items match your filter</h3>
                  <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] leading-relaxed">
                    We could not find items in this specific area or category. Try clearing filters to see items across Nigeria.
                  </p>
                  <button
                    onClick={resetFilters}
                    className="px-4 py-2 bg-[#111111] dark:bg-[#27272A] text-white text-xs font-bold rounded-xl hover:bg-[#27272A] dark:hover:bg-[#3F3F46] transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
              {feedTab === 'all' && profileResults.length > 0 && (
                <div className="pt-2 space-y-2.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#71717A] dark:text-[#A1A1AA]">
                    People &amp; Shops Matching &ldquo;{searchQuery.trim()}&rdquo;
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {profileResults.map(prof => (
                      <button
                        key={prof.id}
                        type="button"
                        onClick={() => openProfile(prof.profileSlug || prof.id)}
                        className="text-left p-3 rounded-2xl bg-white dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF6B00] transition-colors flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-full bg-[#FFF4EC] dark:bg-[#1E2028] border border-[#FED7AA] dark:border-[#27272A] overflow-hidden shrink-0 flex items-center justify-center font-black text-xs text-[#FF6B00]">
                          {prof.avatarUrl ? (
                            <img src={prof.avatarUrl} alt={prof.displayName} className="w-full h-full object-cover" />
                          ) : (
                            prof.displayName[0]?.toUpperCase() || 'M'
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black text-[#111111] dark:text-white truncate flex items-center gap-1">
                            <span className="truncate">{prof.shopName || prof.displayName}</span>
                            {prof.isVerifiedSeller && (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-[#71717A] dark:text-[#A1A1AA] truncate">
                            {prof.displayName}
                            {prof.campus ? ` · ${prof.campus}` : ''}
                            {` · ${prof.followersCount} followers`}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {feedTab === 'all' && !searchQuery.trim() && suggestedSellersError && suggestedSellers.length === 0 && (
                <div className="pt-4">
                  <div className="p-3 rounded-xl bg-white dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between gap-3 text-xs">
                    <span className="text-[#71717A] dark:text-[#A1A1AA] font-semibold">
                      {suggestedSellersError}
                    </span>
                    <button
                      type="button"
                      onClick={() => void fetchSuggestedSellers(8).then(setSuggestedSellers)}
                      className="px-3 py-1.5 rounded-lg bg-[#111111] text-[#9FE870] font-black shrink-0"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {feedTab === 'all' && !searchQuery.trim() && suggestedSellers.length > 0 && (
                <div className="pt-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs sm:text-sm font-black text-[#111111] dark:text-white">
                      Suggested Makers &amp; Shops
                    </h3>
                    <span className="text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
                      Real campus makers to follow
                    </span>
                  </div>
                  <div className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-none">
                    {suggestedSellers.map(sel => (
                      <button
                        key={sel.id}
                        type="button"
                        onClick={() => openProfile(sel.profileSlug || sel.id)}
                        className="min-w-[210px] max-w-[230px] shrink-0 text-left p-3.5 rounded-2xl bg-white dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF6B00] transition-colors flex flex-col justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-[#FFF4EC] dark:bg-[#1E2028] border border-[#FED7AA] dark:border-[#27272A] overflow-hidden shrink-0 flex items-center justify-center font-black text-xs text-[#FF6B00]">
                            {sel.avatarUrl ? (
                              <img src={sel.avatarUrl} alt={sel.shopName} className="w-full h-full object-cover" />
                            ) : (
                              sel.shopName[0]?.toUpperCase() || 'S'
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-[#111111] dark:text-white truncate flex items-center gap-1">
                              <span className="truncate">{sel.shopName}</span>
                              {sel.isVerifiedSeller && (
                                <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                              )}
                            </div>
                            <div className="text-[10px] text-[#71717A] dark:text-[#A1A1AA] truncate">
                              {sel.campus || sel.displayName}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-[#52525B] dark:text-[#A1A1AA] pt-1 border-t border-[#F4F4F5] dark:border-[#27272A]">
                          <span>{sel.productCount} item(s)</span>
                          <span className="text-[#FF6B00]">Visit &rarr;</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Featured Sellers Section: Hides when empty, shows retry if API fails */}
            {sellersError && sellers.length === 0 ? (
              <section className="pt-6 border-t border-[#E4E4E7] dark:border-[#27272A]">
                <div className="p-4 rounded-2xl bg-white dark:bg-[#15161C] border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-[#71717A] dark:text-[#A1A1AA]">{sellersError}</span>
                  <button
                    type="button"
                    onClick={() => void retryMarketplaceLoad()}
                    className="px-3.5 py-1.5 rounded-xl bg-[#111111] text-[#9FE870] font-black shrink-0"
                  >
                    Retry
                  </button>
                </div>
              </section>
            ) : sellers.length > 0 && (
              <section className="pt-6 border-t border-[#E4E4E7] dark:border-[#27272A] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#111111] dark:text-white">
                      Active Youth Shops
                    </h3>
                    <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
                      Verified teen and youth makers in your region.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {sellers.map((seller, idx) => (
                    <div
                      key={seller.id}
                      onClick={() => openProfile(seller.profileSlug || seller.id)}
                      style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}
                      className="card-lift card-stagger bg-white dark:bg-[#15161C] p-4 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF6B00] dark:hover:border-[#FF6B00] transition-all cursor-pointer flex flex-col justify-between shadow-2xs hover:shadow-xs"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-[#F4F4F5] dark:bg-[#1E2028] overflow-hidden shrink-0 border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-center font-bold text-[#FF6B00]">
                            {seller.logoUrl ? (
                              <img
                                src={seller.logoUrl}
                                alt={seller.shopName}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              seller.shopName[0]
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-[#111111] dark:text-white truncate">
                              {seller.shopName}
                            </h4>
                            <div className="text-[11px] text-[#111111] font-bold truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#FF6B00] shrink-0" />
                              <span className="bg-[#9FE870] text-[#111111] px-1.5 py-0.2 rounded text-[10px]">
                                {seller.locationArea || seller.location?.area || 'Local Area'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] line-clamp-2 leading-relaxed">
                          {seller.bio}
                        </p>
                      </div>

                      <div className="pt-2.5 border-t border-[#F4F4F5] dark:border-[#27272A] flex items-center justify-between text-xs mt-2">
                        <div className="flex items-center gap-1 font-bold text-[#111111] dark:text-white">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                          <span>{seller.rating.toFixed(1)}</span>
                          <span className="text-[11px] text-[#A1A1AA] font-normal">
                            ({seller.salesCount} sales)
                          </span>
                        </div>
                        <span className="text-[#FF6B00] font-bold text-[11px] flex items-center gap-0.5">
                          <span>Visit Shop</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Other view routers */}
        {activeView === 'product_detail' && (
          selectedProduct ? (
            <div className="animate-fade-in-up">
              <ProductDetailView
                product={selectedProduct}
                onBack={() => setActiveView('catalog')}
              />
            </div>
          ) : isCatalogLoading || isProductDetailLoading ? (
            <Loading fullPage text="Loading craft details..." />
          ) : productDetailError && selectedProductId ? (
            <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-[#111111] dark:text-white">
                Item Unavailable Right Now
              </h2>
              <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">{productDetailError}</p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void retryProductDetail(selectedProductId)}
                  className="px-4 py-2 bg-[#111111] text-[#9FE870] text-xs font-black rounded-xl border border-[#FF6B00]"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('catalog')}
                  className="px-4 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-[#111111] dark:text-white"
                >
                  Back to Marketplace
                </button>
              </div>
            </div>
          ) : (
            <NotFoundView
              title="Product Listing Not Found"
              message="This crafted item may have already been purchased, deleted by the seller, or removed by moderation."
            />
          )
        )}

        {(activeView === 'profile' || activeView === 'seller_shop') && (
          activeProfileSlug ? (
            <div className="animate-fade-in-up">
              <SellerShopView
                slugOrId={activeProfileSlug}
                onBack={() => setActiveView('catalog')}
              />
            </div>
          ) : (
            <NotFoundView
              title="Profile Not Found"
              message="We could not find this member profile or shop."
            />
          )
        )}

        {activeView === 'account_settings' && (
          <div className="animate-fade-in-up">
            <AccountSettingsView />
          </div>
        )}

        {activeView === 'campus_logistics' && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <button
                  onClick={() => setActiveView('catalog')}
                  className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-[#A1A1AA] hover:text-slate-900 dark:hover:text-white transition-colors mb-2 min-h-[38px]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Marketplace</span>
                </button>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {trustCopy.pickupDirectoryTitle}
                </h1>
                <p className="text-xs text-slate-500 dark:text-[#A1A1AA] mt-0.5">
                  {trustCopy.pickupDirectorySubtitle}
                </p>
              </div>

              <div className="shrink-0">
                <select
                  value={selectedSpotCampus}
                  onChange={e => setSelectedSpotCampus(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#15161C] text-xs font-bold text-[#111111] dark:text-white"
                >
                  <option value="All">All Campuses ({safePickupSpots.length})</option>
                  {Array.from(new Set(safePickupSpots.map(s => s.campus))).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {safePickupSpots
                .filter(spot => selectedSpotCampus === 'All' || spot.campus === selectedSpotCampus)
                .map(spot => (
                  <div
                    key={spot.id}
                    className="bg-white dark:bg-[#15161C] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-5 space-y-3 shadow-xs flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[#9FE870] text-[#111111]">
                            {spot.campus}
                          </span>
                          <h2 className="text-base font-black text-[#111111] dark:text-white mt-1.5">
                            {spot.name}
                          </h2>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap shrink-0">
                          {spot.securityBadgeText || spot.securityLevel.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="text-xs text-[#52525B] dark:text-[#A1A1AA] space-y-1">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                          <span>{spot.landmark}{spot.contactPorterTitle ? ` · ${spot.contactPorterTitle}` : ''}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                          <span>Hours: {spot.operatingHours}</span>
                        </div>
                      </div>

                      {spot.directionsTip && (
                        <p className="text-[11px] bg-[#FAFAFA] dark:bg-[#1E2028] border border-[#E4E4E7] dark:border-[#27272A] rounded-xl p-2.5 text-[#52525B] dark:text-[#D4D4D8]">
                          <strong>Tip:</strong> {spot.directionsTip}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        resetFilters();
                        setSelectedCampus(spot.campus);
                        setActiveView('catalog');
                      }}
                      className="w-full py-2 rounded-xl bg-[#111111] hover:bg-[#18181B] text-[#9FE870] font-black text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>Browse Crafts at {spot.campus}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeView === 'seller_dashboard' && (
          <div className="animate-fade-in-up">
            <SellerDashboard />
          </div>
        )}

        {activeView === 'wishlist' && (
          <div className="animate-fade-in-up">
            <WishlistView />
          </div>
        )}

        {activeView === 'cart' && (
          <div className="animate-fade-in-up">
            <CartView />
          </div>
        )}

        {activeView === 'orders' && (
          <div className="animate-fade-in-up">
            <OrdersView />
          </div>
        )}

        {activeView === 'chat' && (
          <div className="animate-fade-in-up">
            <LockedChatView />
          </div>
        )}

        {activeView === 'admin' && (
          <div className="animate-fade-in-up">
            {currentUser?.role === 'admin' ? (
              <AdminPanel />
            ) : (
              <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#FFF4EC] dark:bg-[#1E2028] text-[#FF6B00] border border-[#FED7AA] dark:border-[#27272A] flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-[#111111] dark:text-white">Access Restricted</h2>
                <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] leading-relaxed">
                  Please sign in with your account credentials to view this section.
                </p>
                <button
                  onClick={() => openAuthModal('login')}
                  className="px-5 py-2.5 bg-[#111111] hover:bg-[#27272A] text-white text-xs font-bold rounded-xl transition-all"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        )}

        {(activeView === 'terms' ||
          activeView === 'privacy' ||
          activeView === 'refunds' ||
          activeView === 'prohibited-items' ||
          activeView === 'seller-guide' ||
          activeView === 'buyer-protection' ||
          activeView === 'faq' ||
          activeView === 'contact') && (
          <LegalAndHelpPages initialSlug={activeView as any} />
        )}

        {activeView === 'reset-password' && (
          <div className="animate-fade-in-up">
            <ResetPasswordPage />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Mobile Bottom Thumb Navigation */}
      <MobileBottomNav />

      {/* Quick 60-Second Item Upload Modal */}
      <QuickListModal />

      {/* Authentication and Onboarding Modal */}
      <AuthModal />

      {/* Flutterwave Escrow Checkout Modal */}
      <CheckoutModal />

      {/* Escrow Dispute & Problem Modal */}
      <ReportProblemModal />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MarketplaceContent />
        <Analytics />
      </AppProvider>
    </ErrorBoundary>
  );
}
