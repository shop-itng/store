import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, MapPin, Zap, Lock, LogOut, User, Sun, Moon } from 'lucide-react';

export const RoleSwitcherBar: React.FC = () => {
  const {
    currentUser,
    logout,
    lowDataMode,
    toggleLowDataMode,
    activeView,
    setActiveView,
    userLocation,
    openAuthModal,
    theme,
    toggleTheme,
  } = useApp();

  return (
    <div className="bg-[#111111] text-[#A1A1AA] text-xs py-1.5 px-4 sm:px-6 border-b border-[#27272A]">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-white font-bold text-[11px]">
            <span className="w-2 h-2 rounded-full bg-[#9FE870] animate-pulse" />
            <span>Shop It Escrow Protected</span>
          </span>

          <span className="text-[#3F3F46] hidden sm:inline">|</span>

          {/* Current Location Badge */}
          <span className="text-[#71717A] text-[11px] hidden sm:flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#FF6B00]" />
            <span>Location: <strong className="text-white">{userLocation.area}</strong>, {userLocation.state}</span>
          </span>

          {/* Admin Indicator: ONLY shown when Adeyinka Joseph is logged in! */}
          {currentUser?.role === 'admin' && (
            <span className="bg-[#FF6B00] text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Admin: {currentUser.name}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentUser?.role === 'admin' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveView('admin')}
                className={`px-2.5 py-0.5 rounded text-xs font-bold transition-all ${
                  activeView === 'admin'
                    ? 'bg-white text-[#111111]'
                    : 'text-white hover:text-[#9FE870]'
                }`}
              >
                Moderator Panel
              </button>
              <button
                onClick={logout}
                className="text-[#71717A] hover:text-white flex items-center gap-1 text-[11px]"
                title="Log out from moderator account"
              >
                <LogOut className="w-3 h-3" />
                <span>Exit</span>
              </button>
            </div>
          ) : currentUser ? (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-white font-semibold">
                {currentUser.name} {currentUser.role === 'seller' ? '(Seller)' : ''}
              </span>
              <button
                onClick={logout}
                className="text-[#71717A] hover:text-white underline"
              >
                Log Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('login')}
              className="text-[#A1A1AA] hover:text-white font-semibold text-[11px] flex items-center gap-1.5"
            >
              <User className="w-3 h-3 text-[#71717A]" />
              <span>Sign In</span>
            </button>
          )}

          {/* Dark / Light Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
              theme === 'dark'
                ? 'bg-[#1E2028] text-[#9FE870] border border-[#27272A]'
                : 'text-[#A1A1AA] hover:text-white bg-[#18181B]'
            }`}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Night/Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3 h-3 text-[#9FE870]" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3 h-3 text-[#FF6B00]" />
                <span>Dark</span>
              </>
            )}
          </button>

          {/* Low-data toggle */}
          <button
            onClick={toggleLowDataMode}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors ${
              lowDataMode
                ? 'bg-[#18181B] text-[#9FE870] border border-[#3F3F46] font-bold'
                : 'text-[#71717A] hover:text-[#A1A1AA]'
            }`}
          >
            <Zap className="w-3 h-3 text-[#FF6B00]" />
            <span>{lowDataMode ? 'Low-Data: ON' : 'Save Data'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
