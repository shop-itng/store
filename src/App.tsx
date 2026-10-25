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
import { Store, ShieldCheck, MapPin, Star, ArrowRight, PackageOpen, PlusCircle, ShoppingBag } from 'lucide-react';

const MarketplaceContent: React.FC = () => {
  const {
    activeView,
    setActiveView,
    selectedProductId,
    selectedSellerId,
    products,
    filteredProducts,
    sellers,
    openSellerShop,
    resetFilters,
    openQuickListModal,
    openAuthModal,
    userLocation,
    currentUser,
  } = useApp();

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <div className="min-h-screen flex flex-col bg-[#f9fafb] text-neutral-900 pb-20 md:pb-0">
      {/* Role Switcher Toolbar */}
      <RoleSwitcherBar />

      {/* Main Top Header with S Logo & Location */}
      <Header />

      {/* Low-data mode notice (if enabled) */}
      <LowDataBanner />

      {/* Main View Router */}
      <main className="flex-1">
        {activeView === 'catalog' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            {/* Search & Location Filter Bar (State > City > Area) */}
            <TypoSearchBar />

            {/* Product Feed Grid */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-neutral-900">
                    Items & Crafts For Sale
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {filteredProducts.length > 0
                      ? `Showing ${filteredProducts.length} items available in your location`
                      : 'Marketplace feed for Nigerian teens and youth'}
                  </p>
                </div>

                {filteredProducts.length > 0 && (
                  <span className="text-xs text-neutral-500 hidden sm:inline">
                    Location: <strong>{userLocation.area}</strong>
                  </span>
                )}
              </div>

              {products.length === 0 ? (
                /* Ready-Made Fresh Marketplace Launch State (Solid, Human-Made, No gradients) */
                <div className="bg-white rounded-3xl border-2 border-[#111111] p-8 sm:p-12 text-center max-w-xl mx-auto space-y-6 shadow-[0_4px_0_#111111]">
                  {/* The Official Shop It Logo */}
                  <img
                    src="/shopit-logo.png"
                    alt="Shop It"
                    className="w-16 h-16 rounded-2xl mx-auto object-contain shadow-sm border border-[#111111]"
                  />

                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#111111] text-[#9FE870] border border-[#FF6B00]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
                      <span>Safe Youth Marketplace</span>
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-[#111111] tracking-tight">
                      Welcome to Shop It
                    </h3>
                    <p className="text-xs sm:text-sm text-[#52525B] leading-relaxed max-w-md mx-auto">
                      Direct marketplace for Nigerian teens and youth to buy and sell handmade beads, scent oils, crochet wear, fashion, and crafts safely with escrow protection.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    {currentUser?.role === 'seller' ? (
                      <>
                        <button
                          onClick={openQuickListModal}
                          className="px-5 py-3 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] text-xs sm:text-sm font-black rounded-xl transition-all flex items-center gap-2 shadow-[0_3px_0_#111111] active:translate-y-0.5"
                        >
                          <span className="w-5 h-5 rounded-full bg-[#9FE870] text-[#111111] flex items-center justify-center text-xs font-black">
                            +
                          </span>
                          <span>Sell Your Product</span>
                        </button>
                        <button
                          onClick={() => setActiveView('seller_dashboard')}
                          className="px-5 py-3 bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] border-2 border-[#111111] text-xs sm:text-sm font-black rounded-xl transition-all shadow-[0_3px_0_#111111] active:translate-y-0.5"
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
                          className="px-5 py-3 bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] border-2 border-[#111111] text-xs sm:text-sm font-black rounded-xl transition-all flex items-center gap-2 shadow-[0_3px_0_#111111] active:translate-y-0.5"
                        >
                          <ShoppingBag className="w-4 h-4 text-[#111111]" />
                          <span>Buy Items Now</span>
                        </button>
                        <button
                          onClick={() => openAuthModal('seller_register')}
                          className="px-5 py-3 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] text-xs sm:text-sm font-black rounded-xl transition-all shadow-[0_3px_0_#111111] active:translate-y-0.5"
                        >
                          Sign Up as a Seller
                        </button>
                      </>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#E4E4E7] flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-[#71717A]">
                    <span className="flex items-center gap-1.5 font-bold text-[#111111]">
                      <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                      <span>Escrow payment protection</span>
                    </span>
                    <span className="hidden sm:inline">·</span>
                    <span className="flex items-center gap-1.5 font-bold text-[#111111]">
                      <MapPin className="w-4 h-4 text-[#FF6B00]" />
                      <span>Safe handoff in your area</span>
                    </span>
                  </div>
                </div>
              ) : filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
                  {filteredProducts.map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#E4E4E7] p-10 text-center max-w-md mx-auto space-y-3 shadow-xs">
                  <PackageOpen className="w-8 h-8 text-[#A1A1AA] mx-auto" />
                  <h3 className="text-sm font-bold text-[#111111]">No items match your filter</h3>
                  <p className="text-xs text-[#71717A] leading-relaxed">
                    We could not find items in this specific area or category. Try clearing filters to see items across Nigeria.
                  </p>
                  <button
                    onClick={resetFilters}
                    className="px-4 py-2 bg-[#111111] text-white text-xs font-bold rounded-xl hover:bg-[#27272A] transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </section>

            {/* Featured Sellers Section: Hides completely when empty (Rule: No fake sellers) */}
            {sellers.length > 0 && (
              <section className="pt-6 border-t border-[#E4E4E7] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#111111]">
                      Active Youth Shops
                    </h3>
                    <p className="text-xs text-[#71717A]">
                      Verified teen and youth makers in your region.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {sellers.map(seller => (
                    <div
                      key={seller.id}
                      onClick={() => openSellerShop(seller.id)}
                      className="bg-white p-4 rounded-2xl border border-[#E4E4E7] hover:border-[#FF6B00] transition-all cursor-pointer flex flex-col justify-between shadow-2xs hover:shadow-xs"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-[#F4F4F5] overflow-hidden shrink-0 border border-[#E4E4E7] flex items-center justify-center font-bold text-[#FF6B00]">
                            {seller.logoUrl ? (
                              <img
                                src={seller.logoUrl}
                                alt={seller.shopName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              seller.shopName[0]
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-[#111111] truncate">
                              {seller.shopName}
                            </h4>
                            <div className="text-[11px] text-[#111111] font-bold truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#FF6B00] shrink-0" />
                              <span className="bg-[#9FE870] px-1.5 py-0.2 rounded text-[10px]">
                                {seller.locationArea || seller.location?.area || 'Local Area'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-[#52525B] line-clamp-2 leading-relaxed">
                          {seller.bio}
                        </p>
                      </div>

                      <div className="pt-2.5 border-t border-[#F4F4F5] flex items-center justify-between text-xs mt-2">
                        <div className="flex items-center gap-1 font-bold text-[#111111]">
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
        {activeView === 'product_detail' && selectedProduct && (
          <ProductDetailView
            product={selectedProduct}
            onBack={() => setActiveView('catalog')}
          />
        )}

        {activeView === 'seller_shop' && selectedSellerId && (
          <SellerShopView
            sellerId={selectedSellerId}
            onBack={() => setActiveView('catalog')}
          />
        )}

        {activeView === 'seller_dashboard' && <SellerDashboard />}
        {activeView === 'wishlist' && <WishlistView />}
        {activeView === 'cart' && <CartView />}
        {activeView === 'orders' && <OrdersView />}
        {activeView === 'chat' && <LockedChatView />}
        {activeView === 'admin' && (
          currentUser?.role === 'admin' ? (
            <AdminPanel />
          ) : (
            <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF4EC] text-[#FF6B00] border border-[#FED7AA] flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black text-[#111111]">Access Restricted</h2>
              <p className="text-xs text-[#71717A] leading-relaxed">
                Please sign in with your account credentials to view this section.
              </p>
              <button
                onClick={() => openAuthModal('login')}
                className="px-5 py-2.5 bg-[#111111] hover:bg-[#27272A] text-white text-xs font-bold rounded-xl transition-all"
              >
                Sign In
              </button>
            </div>
          )
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

      {/* Paystack Escrow Checkout Modal */}
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
    <AppProvider>
      <MarketplaceContent />
    </AppProvider>
  );
}
