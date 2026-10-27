import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  DollarSign,
  Headphones,
  UserCheck,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  Eye,
  Sliders,
  Wallet,
  ArrowRight,
  Sparkles,
  FileText,
  Phone,
  Calendar,
  AlertCircle,
  Check,
  RefreshCw,
  Search,
  Hash,
  Activity,
  ArrowUpRight,
  Users,
  Trash2,
  Key,
  Ban,
  UserX,
  Store,
  Package,
  X,
  Megaphone,
  Radio,
  Power,
  ShieldAlert,
  History,
} from 'lucide-react';
import { formatNaira, calculateServiceFee, getPricingBreakdown } from '../utils/pricing';
import { AdminSubRole, LedgerEntryType, Order } from '../types';
import { PAYSTACK_CONFIG } from '../utils/paystackService';
import { EscrowReceiptModal } from './EscrowReceiptModal';

export const AdminPanel: React.FC = () => {
  const {
    adminSubRole,
    setAdminSubRole,
    verificationRequests,
    updateVerificationRequest,
    antiBypassFlags,
    updateFlagStatus,
    disputes,
    resolveDispute,
    feeSettings,
    updateFeeSettings,
    orders,
    wallets,
    ledgerEntries,
    paystackWebhooks,
    toggleWalletFreeze,
    sellers,
    products,
    deleteProduct,
    toggleProductStock,
    openChat,
    notify,
    // Moderator Super-Powers & Account Governance
    registeredUsers,
    deleteUserAccount,
    banUserAccount,
    adminResetUserPassword,
    adminToggleSellerVerification,
    adminForceDeleteProduct,
    adminForceReleaseEscrow,
    adminForceRefundOrder,
    broadcastAnnouncement,
    updateBroadcastAnnouncement,
    emergencyControls,
    updateEmergencyControls,
    adminAuditLogs,
    clearMarketplaceDatabase,
  } = useApp();

  const [isClearDbModalOpen, setIsClearDbModalOpen] = useState(false);
  const [clearDbConfirmText, setClearDbConfirmText] = useState('');

  const [activeTab, setActiveTab] = useState<AdminSubRole>(adminSubRole || 'moderator');
  const [selectedVerificationDoc, setSelectedVerificationDoc] = useState<string | null>(null);
  const [selectedDisputeEvidence, setSelectedDisputeEvidence] = useState<{
    buyerPhoto?: string;
    sellerPhoto?: string;
  } | null>(null);

  // Fee simulator sandbox state
  const [testItemPrice, setTestItemPrice] = useState<number>(4500);

  // Ledger audit state
  const [ledgerFilter, setLedgerFilter] = useState<'all' | LedgerEntryType>('all');
  const [freezeModal, setFreezeModal] = useState<{
    isOpen: boolean;
    sellerId: string;
    shopName: string;
    isCurrentlyFrozen: boolean;
    reason: string;
  }>({
    isOpen: false,
    sellerId: '',
    shopName: '',
    isCurrentlyFrozen: false,
    reason: '',
  });

  // Moderator Account Governance & Override states
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [filterUserRole, setFilterUserRole] = useState<'all' | 'seller' | 'buyer' | 'admin'>('all');
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    userId: string;
    userName: string;
    userEmail: string;
    role: string;
  }>({
    isOpen: false,
    userId: '',
    userName: '',
    userEmail: '',
    role: '',
  });
  const [resetPasswordModal, setResetPasswordModal] = useState<{
    isOpen: boolean;
    userId: string;
    userName: string;
    newPassword: string;
  }>({
    isOpen: false,
    userId: '',
    userName: '',
    newPassword: '',
  });
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [broadcastForm, setBroadcastForm] = useState({
    title: broadcastAnnouncement.title,
    message: broadcastAnnouncement.message,
    tone: broadcastAnnouncement.tone,
    isActive: broadcastAnnouncement.isActive,
  });
  const [selectedAdminReceiptOrder, setSelectedAdminReceiptOrder] = useState<Order | null>(null);

  // Calculate live financial figures
  const pendingOrders = orders.filter(o => o.status === 'paid' || o.status === 'packed' || o.status === 'shipped' || o.status === 'delivered');
  const totalHeldInEscrow = pendingOrders.reduce((sum, o) => sum + o.grandTotal, 0);
  const disputedOrders = orders.filter(o => o.status === 'disputed');
  const totalDisputedEscrow = disputedOrders.reduce((sum, o) => sum + o.grandTotal, 0);
  const totalServiceFeesEarned = orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + o.serviceFeeTotal, 0);

  const testBreakdown = getPricingBreakdown(testItemPrice, feeSettings);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Top Header */}
      <div className="bg-[#0c0d10] text-white p-5 sm:p-6 rounded-2xl border border-stone-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-[#FF6B00] text-white text-[11px] font-bold tracking-wide uppercase">
              Moderator Command Center
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-[#18181B] text-[#9FE870] border border-[#27272A] text-[11px] font-bold">
              Adeyinka Joseph (Admin)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-2">
            Shop It Trust, Escrow & Governance
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 mt-1">
            Oversee Nigerian youth seller approvals, chat safety, escrow transactions, and dispute resolutions.
          </p>
        </div>

        {/* Sub-role selector tabs and Quick Database Wipe */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center bg-stone-900 p-1.5 rounded-xl border border-stone-800 shrink-0 overflow-x-auto gap-1">
            {[
              { id: 'moderator', label: 'NIN & Safety', icon: ShieldCheck, badge: verificationRequests.filter(r => r.status === 'pending').length },
              { id: 'accounts', label: 'All Accounts & Powers', icon: Users, badge: registeredUsers.length },
              { id: 'finance', label: 'Finance & Escrow', icon: DollarSign, badge: undefined },
              { id: 'support', label: 'Support & Disputes', icon: Headphones, badge: disputes.filter(d => d.status === 'open').length },
              { id: 'emergency', label: 'Broadcast & Killswitches', icon: Megaphone, badge: broadcastAnnouncement.isActive ? 1 : undefined },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as AdminSubRole);
                    setAdminSubRole(tab.id as AdminSubRole);
                  }}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                    isActive
                      ? 'bg-[#FF6B00] text-[#111111] border-2 border-[#111111] shadow-[0_2px_0_#9FE870]'
                      : 'text-stone-400 hover:text-white hover:bg-stone-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#111111]' : ''}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="w-5 h-5 rounded-full bg-[#9FE870] text-[#111111] border border-[#111111] text-[10px] font-black flex items-center justify-center shrink-0">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setClearDbConfirmText('');
              setIsClearDbModalOpen(true);
            }}
            className="px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 border border-red-500 shadow-md shrink-0 active:scale-95"
            title="Wipe database: removes all sellers, businesses, and accounts except Moderator"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Database</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. MODERATOR TAB                                         */}
      {/* ========================================================= */}
      {activeTab === 'moderator' && (
        <div className="space-y-6">
          {/* Moderator Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 bg-white rounded-xl border border-stone-200">
              <span className="text-xs text-stone-500 font-medium">Pending Verifications</span>
              <p className="text-xl sm:text-2xl font-bold font-mono-numbers text-stone-900 mt-1">
                {verificationRequests.filter(r => r.status === 'pending').length}
              </p>
              <span className="text-[11px] text-amber-600 font-medium">Requires ID & Guardian check</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-stone-200">
              <span className="text-xs text-stone-500 font-medium">Anti-Bypass Flags</span>
              <p className="text-xl sm:text-2xl font-bold font-mono-numbers text-stone-900 mt-1">
                {antiBypassFlags.length}
              </p>
              <span className="text-[11px] text-[#f95700] font-medium">Evasion attempts masked</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-stone-200">
              <span className="text-xs text-stone-500 font-medium">Verified Campus Makers</span>
              <p className="text-xl sm:text-2xl font-bold font-mono-numbers text-[#123524] mt-1">
                {sellers.filter(s => s.isVerifiedSeller).length}
              </p>
              <span className="text-[11px] text-stone-500">Across UNILAG, UI, OAU</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-stone-200">
              <span className="text-xs text-stone-500 font-medium">Under-18 Sellers</span>
              <p className="text-xl sm:text-2xl font-bold font-mono-numbers text-stone-900 mt-1">
                {verificationRequests.filter(r => r.under18).length}
              </p>
              <span className="text-[11px] text-stone-500">Guardian consent enforced</span>
            </div>
          </div>

          {/* Seller Verification Queue */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/60 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-heading text-stone-900">
                  Seller NIMC NIN Slip Verification Queue
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Verify Nigerian NIMC 11-digit NIN slips and legal identity before shops can list handmade crafts.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-[#fff2ea] text-[#f95700] border border-[#fed7aa] text-xs font-semibold">
                {verificationRequests.filter(r => r.status === 'pending').length} In Review
              </span>
            </div>

            <div className="divide-y divide-stone-200">
              {verificationRequests.map(req => (
                <div key={req.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-stone-50/40 transition-colors">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-stone-900">{req.shopName}</h4>
                      <span className="text-xs text-stone-500">· {req.ownerName}</span>
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 text-[11px] font-semibold text-stone-700">
                        {req.campus}
                      </span>
                      {req.under18 ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold">
                          Under 18 (Guardian Consent Required)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[11px]">
                          Adult 18+
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        req.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : (req.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800')
                      }`}>
                        {req.status === 'approved' ? 'NIN APPROVED' : req.status.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-xs text-stone-600">
                      <strong>Document:</strong> National ID (NIN Slip) · <strong>11-Digit NIN:</strong> <span className="font-mono font-bold text-stone-900 bg-stone-100 px-1.5 py-0.5 rounded tracking-wider">{req.idNumber}</span> · Submitted: {req.submittedAt}
                    </p>

                    {req.under18 && (
                      <p className="text-xs text-stone-700 bg-amber-50/80 p-2 rounded-lg border border-amber-200/80">
                        <strong>Guardian Name:</strong> {req.guardianName} · <strong>Phone:</strong> {req.guardianPhone}
                      </p>
                    )}

                    {req.notes && (
                      <p className="text-xs text-stone-500 italic">
                        Notes: {req.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedVerificationDoc(req.idCardPhotoUrl)}
                      className="px-3 py-2 rounded-xl border border-stone-300 hover:bg-stone-100 text-xs font-semibold text-stone-800 flex items-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-stone-600" />
                      <span>View NIN Slip</span>
                    </button>

                    {req.under18 && req.guardianConsentLetterUrl && (
                      <button
                        onClick={() => setSelectedVerificationDoc(req.guardianConsentLetterUrl!)}
                        className="px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-900 flex items-center gap-1.5 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Guardian Letter</span>
                      </button>
                    )}

                    {req.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateVerificationRequest(req.id, 'approved')}
                          className="px-3.5 py-2 rounded-xl bg-[#123524] hover:bg-[#1b4330] text-white text-xs font-semibold transition-all flex items-center gap-1 active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Seller</span>
                        </button>
                        <button
                          onClick={() => updateVerificationRequest(req.id, 'rejected')}
                          className="px-3 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Anti-Bypass Flags Log */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/60 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-heading text-stone-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#f95700]" />
                  <span>Real-Time Anti-Bypass Filter Incident Log</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Automated scanner intercepts phone numbers, Opay/bank accounts, WhatsApp, and off-platform links.
                </p>
              </div>
            </div>

            <div className="divide-y divide-stone-200">
              {antiBypassFlags.map(flag => (
                <div key={flag.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900">{flag.senderMaskedName}</span>
                      <span className="text-stone-400">· {flag.timestamp}</span>
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold uppercase">
                        {flag.senderRole}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        flag.status === 'chat_locked' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {flag.status.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-stone-500 line-through">
                      "{flag.offendingText}"
                    </p>
                    <p className="text-stone-900 font-mono text-[11px] bg-stone-50 p-1.5 rounded-md border border-stone-200">
                      Masked as: "{flag.maskedText}"
                    </p>

                    <div className="flex items-center gap-1 text-[11px] text-red-600 font-medium">
                      <span>Detected: {flag.detectedPatterns.join(', ')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openChat(flag.conversationId)}
                      className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      Inspect Chat
                    </button>
                    <button
                      onClick={() => updateFlagStatus(flag.id, 'lock_chat')}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
                    >
                      Lock Chat
                    </button>
                    <button
                      onClick={() => updateFlagStatus(flag.id, 'freeze_account')}
                      className="px-3 py-1.5 rounded-lg bg-black hover:bg-stone-800 text-white text-xs font-semibold transition-colors"
                    >
                      Freeze Wallet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Moderator Listings Governance & Pruning */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold font-heading text-stone-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#FF6B00]" />
                  <span>Marketplace Listings Oversight & Instant Pruning</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Permanently delete counterfeit, inappropriate, or prohibited crafts listed by sellers.
                </p>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchProductQuery}
                  onChange={e => setSearchProductQuery(e.target.value)}
                  placeholder="Search craft title..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-stone-300 text-xs bg-white"
                />
              </div>
            </div>

            {products.length > 0 ? (
              <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto">
                {products
                  .filter(p => !searchProductQuery || p.title.toLowerCase().includes(searchProductQuery.toLowerCase()))
                  .map(product => (
                    <div key={product.id} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-stone-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-stone-100 overflow-hidden border border-stone-200 shrink-0">
                          <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-stone-900 line-clamp-1">{product.title}</h4>
                          <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                            <span>Shop: <strong>{product.sellerShopName}</strong></span>
                            <span>·</span>
                            <span>Price: <strong className="text-stone-800">{formatNaira(product.displayPrice)}</strong></span>
                            <span>·</span>
                            <span>Stock: {product.stock}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleProductStock(product.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                            product.stock > 0
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                        </button>
                        <button
                          type="button"
                          onClick={() => adminForceDeleteProduct(product.id)}
                          className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                          title="Permanently remove listing from marketplace"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-stone-500">
                No active listings on the marketplace.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1.5 ACCOUNTS & GOVERNANCE TAB (MODERATOR SUPER-POWERS)    */}
      {/* ========================================================= */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
              <span className="text-xs text-stone-500 font-medium">Registered Accounts</span>
              <p className="text-xl sm:text-2xl font-bold font-mono-numbers text-stone-900 mt-1">
                {registeredUsers.length}
              </p>
              <span className="text-[11px] text-stone-500">Live platform accounts</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
              <span className="text-xs text-stone-500 font-medium">Youth Sellers</span>
              <p className="text-xl sm:text-2xl font-bold font-mono-numbers text-[#f95700] mt-1">
                {registeredUsers.filter(u => u.role === 'seller').length}
              </p>
              <span className="text-[11px] text-stone-500">Store owners</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
              <span className="text-xs text-stone-500 font-medium">Campus Shoppers</span>
              <p className="text-xl sm:text-2xl font-bold font-mono-numbers text-blue-600 mt-1">
                {registeredUsers.filter(u => u.role === 'buyer').length}
              </p>
              <span className="text-[11px] text-stone-500">Buyer profiles</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs">
              <span className="text-xs text-stone-500 font-medium">Suspended Accounts</span>
              <p className="text-xl sm:text-2xl font-bold font-mono-numbers text-red-600 mt-1">
                {registeredUsers.filter(u => u.isBanned).length}
              </p>
              <span className="text-[11px] text-red-500 font-medium">Moderator restricted</span>
            </div>
          </div>

          {/* Accounts Governance Table Card */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold font-heading text-stone-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#FF6B00]" />
                  <span>Platform Account Governance & Moderator Control</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Full administrative authority: delete bad accounts, ban violators, reset passwords, and toggle NIN verification badges.
                </p>
              </div>

              {/* Search & Role Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchUserQuery}
                    onChange={e => setSearchUserQuery(e.target.value)}
                    placeholder="Search name or email..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-stone-300 text-xs bg-white focus:outline-hidden focus:border-[#FF6B00]"
                  />
                </div>

                <div className="flex items-center bg-stone-200/70 p-1 rounded-xl text-xs font-bold">
                  {(['all', 'seller', 'buyer'] as const).map(role => (
                    <button
                      key={role}
                      onClick={() => setFilterUserRole(role)}
                      className={`px-2.5 py-1 rounded-lg capitalize transition-all ${
                        filterUserRole === role
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setClearDbConfirmText('');
                    setIsClearDbModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition-all flex items-center gap-1.5 border border-red-700 shadow-2xs active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Wipe All Other Accounts</span>
                </button>
              </div>
            </div>

            {/* List of Users */}
            {(() => {
              const filteredUsers = registeredUsers.filter(u => {
                if (filterUserRole !== 'all' && u.role !== filterUserRole) return false;
                if (!searchUserQuery) return true;
                const q = searchUserQuery.toLowerCase();
                return (
                  u.name.toLowerCase().includes(q) ||
                  u.email.toLowerCase().includes(q) ||
                  u.id.toLowerCase().includes(q)
                );
              });

              if (filteredUsers.length === 0) {
                return (
                  <div className="p-12 text-center text-stone-500 space-y-2">
                    <UserX className="w-8 h-8 text-stone-300 mx-auto" />
                    <p className="text-sm font-semibold">No registered accounts found matching your filters.</p>
                  </div>
                );
              }

              return (
                <div className="divide-y divide-stone-100">
                  {filteredUsers.map(user => {
                    const isMasterAdmin = user.id === 'admin_adeyinka_joseph';
                    const sellerObj = sellers.find(s => s.id === user.id);
                    const userProductsCount = products.filter(p => p.sellerId === user.id).length;

                    return (
                      <div
                        key={user.id}
                        className={`p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                          user.isBanned ? 'bg-red-50/50' : 'hover:bg-stone-50/50'
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                            user.role === 'admin'
                              ? 'bg-black text-[#9FE870] border-black'
                              : user.role === 'seller'
                              ? 'bg-amber-100 text-[#FF6B00] border-amber-200'
                              : 'bg-blue-100 text-blue-700 border-blue-200'
                          }`}>
                            {user.name[0]?.toUpperCase() || 'U'}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-stone-900">{user.name}</h4>
                              <span className="text-xs text-stone-500">({user.email})</span>

                              {/* Role Badge */}
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                user.role === 'admin'
                                  ? 'bg-black text-[#9FE870] border-black'
                                  : user.role === 'seller'
                                  ? 'bg-[#FF6B00] text-white border-[#FF6B00]'
                                  : 'bg-blue-100 text-blue-800 border-blue-200'
                              }`}>
                                {user.role === 'admin' ? 'MODERATOR' : user.role.toUpperCase()}
                              </span>

                              {/* Status Badge */}
                              {user.isBanned ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-800 border border-red-200">
                                  SUSPENDED
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ACTIVE
                                </span>
                              )}

                              {isMasterAdmin && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-stone-900 text-stone-200 border border-stone-700">
                                  PROTECTED ROOT ADMIN
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-stone-500 flex-wrap">
                              <span>ID: <code className="text-stone-700 font-mono">{user.id}</code></span>
                              {user.phone && <span>· Phone: <strong className="text-stone-700">{user.phone}</strong></span>}
                              {user.locationArea && <span>· Area: <strong className="text-stone-700">{user.locationArea}</strong></span>}
                              {user.role === 'seller' && (
                                <span className="text-[#FF6B00] font-semibold">
                                  · Shop: "{sellerObj?.shopName || user.name}" ({userProductsCount} listings)
                                </span>
                              )}
                            </div>

                            {user.role === 'seller' && (
                              <div className="pt-1 flex items-center gap-2 text-xs">
                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                  sellerObj?.isVerifiedSeller
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-stone-100 text-stone-600'
                                }`}>
                                  {sellerObj?.isVerifiedSeller ? '✓ NIN Verified Maker' : 'Unverified NIN'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Moderator Action Buttons for this user */}
                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                          {user.role === 'seller' && (
                            <button
                              type="button"
                              onClick={() => adminToggleSellerVerification(user.id, !sellerObj?.isVerifiedSeller)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1 ${
                                sellerObj?.isVerifiedSeller
                                  ? 'border-stone-300 text-stone-700 hover:bg-stone-100'
                                  : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              }`}
                              title="Toggle NIN verified trust badge"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>{sellerObj?.isVerifiedSeller ? 'Revoke NIN' : 'Grant NIN Badge'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setResetPasswordModal({
                              isOpen: true,
                              userId: user.id,
                              userName: user.name,
                              newPassword: '',
                            })}
                            className="px-3 py-1.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-bold transition-colors flex items-center gap-1"
                            title="Reset password for user"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>Reset Pass</span>
                          </button>

                          {!isMasterAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => banUserAccount(user.id, !user.isBanned)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1 ${
                                  user.isBanned
                                    ? 'border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                                    : 'border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100'
                                }`}
                                title={user.isBanned ? 'Unsuspend account' : 'Suspend account and freeze wallet'}
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>{user.isBanned ? 'Unsuspend' : 'Suspend'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeleteConfirmModal({
                                  isOpen: true,
                                  userId: user.id,
                                  userName: user.name,
                                  userEmail: user.email,
                                  role: user.role,
                                })}
                                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1 active:translate-y-0.5"
                                title="Permanently delete user account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete Account</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. FINANCE TAB                                           */}
      {/* ========================================================= */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          {/* Finance Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 bg-white rounded-xl border border-stone-200">
              <span className="text-xs text-stone-500 font-medium">Active Escrow Vault</span>
              <p className="text-xl sm:text-2xl font-bold font-mono-numbers text-stone-900 mt-1">
                {formatNaira(totalHeldInEscrow)}
              </p>
              <span className="text-[11px] text-[#123524] font-semibold">Held across {pendingOrders.length} orders</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-stone-200">
              <span className="text-xs text-stone-500 font-medium">Frozen in Dispute</span>
              <p className="text-xl sm:text-2xl font-bold font-mono-numbers text-red-600 mt-1">
                {formatNaira(totalDisputedEscrow)}
              </p>
              <span className="text-[11px] text-red-600 font-medium">{disputedOrders.length} disputes active</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-stone-200">
              <span className="text-xs text-stone-500 font-medium">Service Fees Collected</span>
              <p className="text-xl sm:text-2xl font-bold font-mono-numbers text-[#f95700] mt-1">
                {formatNaira(totalServiceFeesEarned)}
              </p>
              <span className="text-[11px] text-stone-500">Shop It protection fee</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-stone-200">
              <span className="text-xs text-stone-500 font-medium">Fee Model Active</span>
              <p className="text-lg font-bold text-stone-900 mt-1 capitalize">
                {feeSettings.firstMonthPromoFree ? '0% Promo (Free)' : `${feeSettings.tierMode} Rates`}
              </p>
              <span className="text-[11px] text-stone-500">Configured server-side</span>
            </div>
          </div>

          {/* Fee Configuration Studio */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-200 gap-2">
              <div>
                <h3 className="text-base font-bold font-heading text-stone-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#f95700]" />
                  <span>Shop It Platform Fee Policy Studio</span>
                </h3>
                <p className="text-xs text-stone-500">
                  Configure buyer protection service fees and withdrawal threshold rules. Calculations run server-side only.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-stone-700">First-Month Zero-Fee Promo:</span>
                <button
                  type="button"
                  onClick={() => updateFeeSettings({ firstMonthPromoFree: !feeSettings.firstMonthPromoFree })}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    feeSettings.firstMonthPromoFree
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {feeSettings.firstMonthPromoFree ? 'ACTIVE (0% Fees)' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Fee Tiers Form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <span className="text-xs font-bold text-stone-800">Under ₦2,000 (Low Tier)</span>
                <div className="flex items-center gap-2">
                  <span className="text-stone-400 font-mono-numbers">₦</span>
                  <input
                    type="number"
                    value={feeSettings.tierLowFee}
                    onChange={e => updateFeeSettings({ tierLowFee: Number(e.target.value) })}
                    className="w-full p-2 rounded-lg bg-white border border-stone-300 font-mono-numbers text-sm font-bold"
                  />
                </div>
                <p className="text-[11px] text-stone-500">Affordable flat fee for cheap bead bracelets</p>
              </div>

              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <span className="text-xs font-bold text-stone-800">₦2,000 to ₦10,000 (Mid Tier)</span>
                <div className="flex items-center gap-2">
                  <span className="text-stone-400 font-mono-numbers">₦</span>
                  <input
                    type="number"
                    value={feeSettings.tierMidFee}
                    onChange={e => updateFeeSettings({ tierMidFee: Number(e.target.value) })}
                    className="w-full p-2 rounded-lg bg-white border border-stone-300 font-mono-numbers text-sm font-bold"
                  />
                </div>
                <p className="text-[11px] text-stone-500">Standard protection fee for bags & diffusers</p>
              </div>

              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <span className="text-xs font-bold text-stone-800">Above ₦10,000 (High Tier)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={feeSettings.tierHighPercentage * 100}
                    onChange={e => updateFeeSettings({ tierHighPercentage: Number(e.target.value) / 100 })}
                    className="w-full p-2 rounded-lg bg-white border border-stone-300 font-mono-numbers text-sm font-bold"
                  />
                  <span className="text-stone-500 font-bold">%</span>
                </div>
                <p className="text-[11px] text-stone-500">Percentage fee for luxury artisanal collections</p>
              </div>
            </div>

            {/* Live Interactive Fee Sandbox */}
            <div className="p-4 bg-[#fff2ea] rounded-xl border border-[#fed7aa] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#f95700]" />
                  <span>Live Fee Calculation Sandbox</span>
                </h4>
                <div className="flex items-center gap-2">
                  {[1500, 5000, 15000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setTestItemPrice(amt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        testItemPrice === amt
                          ? 'bg-[#f95700] text-white'
                          : 'bg-white text-stone-700 border border-stone-200'
                      }`}
                    >
                      {formatNaira(amt)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-stone-200">
                  <span className="text-stone-500 text-[11px]">Seller Price</span>
                  <p className="font-bold font-mono-numbers text-sm text-stone-900 mt-0.5">
                    {formatNaira(testBreakdown.sellerPrice)}
                  </p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-stone-200">
                  <span className="text-stone-500 text-[11px]">Shop It Protection Fee</span>
                  <p className="font-bold font-mono-numbers text-sm text-[#f95700] mt-0.5">
                    +{formatNaira(testBreakdown.serviceFee)} ({testBreakdown.feePercentageDisplay})
                  </p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-stone-200">
                  <span className="text-stone-500 text-[11px]">Display Price on Storefront</span>
                  <p className="font-bold font-mono-numbers text-sm text-stone-900 mt-0.5">
                    {formatNaira(testBreakdown.displayPrice)}
                  </p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-stone-200">
                  <span className="text-stone-500 text-[11px]">Seller Payout / Earnings</span>
                  <p className="font-bold font-mono-numbers text-sm text-[#123524] mt-0.5">
                    {formatNaira(testBreakdown.sellerPrice)} (100% of base)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Paystack Test Mode System Overview */}
          <div className="bg-[#111111] text-white p-5 rounded-2xl border-2 border-[#111111] shadow-[0_3px_0_#9FE870] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-800 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#9FE870] text-[#111111] font-black flex items-center justify-center text-xs">
                  P
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-white">Paystack Integration Status</h3>
                    <span className="text-[10px] font-black text-[#111111] bg-[#9FE870] px-2 py-0.5 rounded-full border border-[#111111]">
                      TEST MODE ACTIVE (Rule 6)
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Rule 6: Use Paystack test mode only until instructed otherwise.
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-mono text-stone-400">Public Key:</span>
                <span className="text-xs font-mono font-bold text-[#9FE870] ml-1.5">
                  {PAYSTACK_CONFIG.publicKey.slice(0, 14)}...
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-stone-900/90 p-3 rounded-xl border border-stone-800">
                <span className="text-stone-400 text-[10px] uppercase font-bold tracking-wider">Rule 1 · Buyer Wallet</span>
                <p className="font-bold text-white text-xs mt-1">None (Direct Checkout)</p>
                <span className="text-[10px] text-stone-400">Refunds back to source</span>
              </div>

              <div className="bg-stone-900/90 p-3 rounded-xl border border-stone-800">
                <span className="text-stone-400 text-[10px] uppercase font-bold tracking-wider">Rule 2 · Seller Balances</span>
                <p className="font-bold text-white text-xs mt-1">Pending & Available</p>
                <span className="text-[10px] text-stone-400">5-day or buyer confirm</span>
              </div>

              <div className="bg-stone-900/90 p-3 rounded-xl border border-stone-800">
                <span className="text-stone-400 text-[10px] uppercase font-bold tracking-wider">Rule 3 · Webhook Verification</span>
                <p className="font-bold text-[#9FE870] text-xs mt-1">HMAC SHA-512 Strict</p>
                <span className="text-[10px] text-stone-400">Idempotent (processed 1x)</span>
              </div>

              <div className="bg-stone-900/90 p-3 rounded-xl border border-stone-800">
                <span className="text-stone-400 text-[10px] uppercase font-bold tracking-wider">Rule 4 · Payout Rules</span>
                <p className="font-bold text-white text-xs mt-1">Min ₦1,000 · OTP Required</p>
                <span className="text-[10px] text-stone-400">24-hr account cooling</span>
              </div>
            </div>
          </div>

          {/* Orders & Escrow Financial Super-Powers (Moderator Authority) */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold font-heading text-stone-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Escrow Vault Authority & Direct Intervention</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Moderator authority over every transaction: bypass the 5-day release timer to instantly credit a seller, or force-refund a buyer immediately.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                {orders.length} Total Marketplace Orders
              </span>
            </div>

            {orders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100/70 border-b border-stone-200 text-stone-700 font-semibold">
                    <tr>
                      <th className="p-3.5">Order ID & Date</th>
                      <th className="p-3.5">Customer</th>
                      <th className="p-3.5">Artisan Shop</th>
                      <th className="p-3.5">Grand Total</th>
                      <th className="p-3.5">Escrow Status</th>
                      <th className="p-3.5">Auto-Release Due</th>
                      <th className="p-3.5 text-right">Moderator Super-Powers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {orders.map(order => {
                      const canRelease = order.status !== 'completed' && order.status !== 'cancelled';
                      const canRefund = order.status !== 'completed' && order.status !== 'cancelled';

                      return (
                        <tr key={order.id} className="hover:bg-stone-50/50">
                          <td className="p-3.5">
                            <span className="font-mono font-bold text-stone-900 block">{order.id}</span>
                            <span className="text-[11px] text-stone-400">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="font-medium text-stone-900 block">{order.buyerName || order.buyerMaskedId}</span>
                            <span className="text-[11px] text-stone-500">{order.deliveryArea}</span>
                          </td>
                          <td className="p-3.5">
                            <span className="font-semibold text-[#FF6B00] block">{order.items[0]?.sellerShopName || 'Artisan'}</span>
                            <span className="text-[11px] text-stone-400">{order.items.length} item(s)</span>
                          </td>
                          <td className="p-3.5 font-mono-numbers font-bold text-stone-900">
                            {formatNaira(order.grandTotal)}
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${
                              order.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : order.status === 'disputed'
                                ? 'bg-rose-100 text-rose-800'
                                : order.status === 'cancelled'
                                ? 'bg-stone-200 text-stone-700'
                                : 'bg-amber-100 text-amber-900'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-[11px] font-mono text-stone-500">
                            {order.status === 'completed'
                              ? 'Funds Released'
                              : order.status === 'cancelled'
                              ? 'Refunded'
                              : new Date(order.autoReleaseAt).toLocaleDateString()}
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedAdminReceiptOrder(order)}
                                className="px-2.5 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-700 font-bold text-[11px] transition-colors"
                                title="Inspect official safe pass, 4-digit OTP, and cryptographic receipt"
                              >
                                Safe Pass
                              </button>
                              {canRelease && (
                                <button
                                  type="button"
                                  onClick={() => adminForceReleaseEscrow(order.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors shadow-2xs"
                                  title="Bypass 5-day timer and immediately credit seller available balance"
                                >
                                  Release Escrow
                                </button>
                              )}
                              {canRefund && (
                                <button
                                  type="button"
                                  onClick={() => adminForceRefundOrder(order.id, 'Moderator direct intervention')}
                                  className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] transition-colors shadow-2xs"
                                  title="Immediately cancel order and refund buyer in full"
                                >
                                  Force Refund
                                </button>
                              )}
                              {!canRelease && !canRefund && (
                                <span className="text-stone-400 text-xs italic">Settled</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-stone-500">
                No orders placed yet. Orders will appear here with live escrow intervention controls.
              </div>
            )}
          </div>

          {/* Seller Wallets Audit Table (Rule 2 & Rule 5) */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold font-heading text-stone-900 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#FF6B00]" />
                  <span>Seller Wallets & Dual-Balance Governance</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Rule 2 & 5: Balances derived strictly from ledger. Admin can freeze any wallet immediately.
                </p>
              </div>
              <span className="text-xs text-stone-500 font-mono">
                {sellers.length} active artisan stores
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100/70 border-b border-stone-200 text-stone-700 font-semibold">
                  <tr>
                    <th className="p-3.5">Seller / Shop</th>
                    <th className="p-3.5">Campus</th>
                    <th className="p-3.5">Pending (Escrow)</th>
                    <th className="p-3.5">Available (Withdrawable)</th>
                    <th className="p-3.5">Total Withdrawn</th>
                    <th className="p-3.5">Wallet Status</th>
                    <th className="p-3.5 text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {sellers.map(seller => {
                    const wallet = wallets[seller.id] || wallets['seller_amaka'];
                    const isFrozen = wallet?.isFrozen;
                    return (
                      <tr key={seller.id} className="hover:bg-stone-50/50">
                        <td className="p-3.5">
                          <strong className="text-stone-900 block">{seller.shopName}</strong>
                          <span className="text-[11px] text-stone-400 font-mono">{seller.id}</span>
                        </td>
                        <td className="p-3.5 text-stone-600">{seller.campus}</td>
                        <td className="p-3.5 font-mono-numbers font-semibold text-[#FF6B00]">
                          {formatNaira(wallet?.pendingBalance || 0)}
                        </td>
                        <td className="p-3.5 font-mono-numbers font-bold text-[#111111]">
                          {formatNaira(wallet?.availableBalance || 0)}
                        </td>
                        <td className="p-3.5 font-mono-numbers text-stone-500">
                          {formatNaira(wallet?.totalWithdrawn || 0)}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-md font-black text-[10px] ${
                            isFrozen ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {isFrozen ? 'FROZEN' : 'ACTIVE'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => {
                              setFreezeModal({
                                isOpen: true,
                                sellerId: seller.id,
                                shopName: seller.shopName,
                                isCurrentlyFrozen: !!isFrozen,
                                reason: isFrozen ? '' : 'Compliance review or dispute hold',
                              });
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                              isFrozen
                                ? 'bg-[#9FE870] hover:bg-[#8fd860] text-[#111111] border-[#111111]'
                                : 'border-red-300 text-red-700 hover:bg-red-50'
                            }`}
                          >
                            {isFrozen ? 'Unfreeze Wallet' : 'Freeze Wallet'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Global Append-Only Financial Ledger (Rule 5) */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs space-y-0">
            <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold font-heading text-stone-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-700" />
                  <span>Shop It Append-Only Financial Ledger (Rule 5)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Immutable double-entry log. Every sale, escrow release, withdrawal, fee, and refund creates an append-only entry.
                </p>
              </div>

              {/* Filter chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {(
                  [
                    { id: 'all', label: 'All Entries' },
                    { id: 'sale_pending', label: 'Pending Sales' },
                    { id: 'escrow_release', label: 'Escrow Releases' },
                    { id: 'withdrawal', label: 'Withdrawals' },
                    { id: 'refund', label: 'Refunds' },
                    { id: 'fee_deduction', label: 'Fees' },
                  ] as const
                ).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setLedgerFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                      ledgerFilter === tab.id
                        ? 'bg-[#111111] text-[#9FE870] border border-[#111111]'
                        : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100/70 border-b border-stone-200 text-stone-700 font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="p-3">Entry ID & Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Wallet / Seller</th>
                    <th className="p-3">Reference</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Balance Affected</th>
                    <th className="p-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-mono text-[11px]">
                  {ledgerEntries
                    .filter(entry => ledgerFilter === 'all' || entry.type === ledgerFilter)
                    .map(entry => {
                      const isCredit = entry.type === 'sale_pending' || entry.type === 'escrow_release';
                      const isDebit = entry.type === 'withdrawal' || entry.type === 'refund';

                      return (
                        <tr key={entry.id} className="hover:bg-stone-50/50">
                          <td className="p-3">
                            <span className="font-bold text-stone-900 block">{entry.id}</span>
                            <span className="text-stone-400 text-[10px]">
                              {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(entry.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                entry.type === 'sale_pending'
                                  ? 'bg-amber-100 text-amber-900'
                                  : entry.type === 'escrow_release'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : entry.type === 'withdrawal'
                                  ? 'bg-stone-200 text-stone-800'
                                  : entry.type === 'refund'
                                  ? 'bg-rose-100 text-rose-900'
                                  : 'bg-purple-100 text-purple-900'
                              }`}
                            >
                              {entry.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-3 font-sans text-stone-800">
                            <strong>{entry.walletId}</strong>
                          </td>
                          <td className="p-3 text-stone-500 truncate max-w-[120px]">
                            {entry.reference}
                          </td>
                          <td className="p-3 font-bold font-mono-numbers">
                            <span className={isDebit ? 'text-rose-600' : 'text-emerald-700'}>
                              {isDebit ? '-' : '+'}{formatNaira(entry.amount)}
                            </span>
                          </td>
                          <td className="p-3 uppercase text-[10px] font-bold text-stone-600">
                            {entry.balanceType}
                          </td>
                          <td className="p-3 font-sans text-stone-700 text-xs">
                            {entry.description}
                          </td>
                        </tr>
                      );
                    })}

                  {ledgerEntries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-stone-400 font-sans">
                        No ledger transactions recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-500">
              <span className="flex items-center gap-1.5 font-sans">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Append-only verification: Ledgers cannot be deleted or edited. Audit matches 100%.</span>
              </span>
              <span className="font-mono">{ledgerEntries.length} immutable records</span>
            </div>
          </div>

          {/* Paystack Webhook Ingestion Log (Rule 3) */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold font-heading text-stone-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#FF6B00]" />
                  <span>Paystack Webhook Verification & Idempotency Log (Rule 3)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Rule 3: Payment status changes only when Paystack's webhook confirms it, verified by signature and processed once per payment. Never trust the browser.
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                100% Signature Verification
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100/70 border-b border-stone-200 text-stone-700 font-semibold">
                  <tr>
                    <th className="p-3">Processed At</th>
                    <th className="p-3">Event</th>
                    <th className="p-3">Paystack Reference</th>
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Channel</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">HMAC SHA-512 Signature Check</th>
                    <th className="p-3">Idempotency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-mono text-[11px]">
                  {paystackWebhooks.map(webhook => (
                    <tr key={webhook.id} className="hover:bg-stone-50/50">
                      <td className="p-3 text-stone-500">
                        {new Date(webhook.processedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                          {webhook.event}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-stone-900">{webhook.reference}</td>
                      <td className="p-3 text-stone-600">{webhook.orderId}</td>
                      <td className="p-3 font-sans capitalize text-stone-700">{webhook.channel}</td>
                      <td className="p-3 font-bold text-stone-900">{formatNaira(webhook.amount)}</td>
                      <td className="p-3">
                        <span className="flex items-center gap-1 text-emerald-700 font-semibold text-[10px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{webhook.signature.slice(0, 14)}... (Valid)</span>
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                          PROCESSED ONCE
                        </span>
                      </td>
                    </tr>
                  ))}

                  {paystackWebhooks.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-stone-400 font-sans">
                        No webhooks received yet. Make a checkout purchase to trigger live webhook ingestion.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. SUPPORT & DISPUTES TAB                                */}
      {/* ========================================================= */}
      {activeTab === 'support' && (
        <div className="space-y-6">
          <div className="p-4 bg-stone-100 rounded-xl border border-stone-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold font-heading text-stone-900">
                Dispute Resolution Portal
              </h3>
              <p className="text-xs text-stone-600 mt-0.5">
                Side-by-side evidence inspection: compare buyer's complaint against the seller's packed item photo.
              </p>
            </div>
            <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-md">
              {disputes.filter(d => d.status === 'open').length} Open Tickets
            </span>
          </div>

          <div className="space-y-4">
            {disputes.map(disp => (
              <div key={disp.id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
                {/* Header */}
                <div className="p-4 bg-stone-50/80 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-stone-200 px-2 py-0.5 rounded text-stone-800">
                      {disp.orderId}
                    </span>
                    <span className="text-xs text-stone-500">· Opened {disp.createdAt}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      disp.status === 'open' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {disp.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-stone-800">
                    Held in Escrow: <span className="font-mono-numbers text-[#f95700] text-sm font-bold">{formatNaira(disp.amountHeldInEscrow)}</span>
                  </div>
                </div>

                {/* Dispute Body */}
                <div className="p-4 sm:p-5 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-stone-900">{disp.reason}</h4>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">{disp.description}</p>
                    <div className="mt-2 text-[11px] text-stone-500">
                      <strong>Parties:</strong> {disp.buyerMaskedId} ({disp.buyerName}) vs {disp.sellerShopName}
                    </div>
                  </div>

                  {/* Side-by-Side Photo Comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                      <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        <span>Buyer's Evidence Photo</span>
                      </span>
                      {disp.evidencePhotoUrl ? (
                        <img
                          src={disp.evidencePhotoUrl}
                          alt="Buyer evidence"
                          className="w-full h-44 object-cover rounded-lg border border-stone-300"
                        />
                      ) : (
                        <div className="h-44 bg-stone-100 rounded-lg flex items-center justify-center text-xs text-stone-400">
                          No buyer photo uploaded
                        </div>
                      )}
                    </div>

                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                      <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5 mb-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#123524]" />
                        <span>Seller's Packed Item Photo (Pre-dispatch)</span>
                      </span>
                      {disp.sellerPackedPhotoUrl ? (
                        <img
                          src={disp.sellerPackedPhotoUrl}
                          alt="Seller packed photo"
                          className="w-full h-44 object-cover rounded-lg border border-stone-300"
                        />
                      ) : (
                        <div className="h-44 bg-stone-100 rounded-lg flex items-center justify-center text-xs text-stone-400">
                          Seller did not upload pre-dispatch photo
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dispute Actions */}
                  {disp.status === 'open' ? (
                    <div className="pt-3 border-t border-stone-200 flex flex-wrap items-center justify-end gap-2">
                      <button
                        onClick={() => resolveDispute(disp.id, 'refund_full', undefined, 'Courier damage verified; full refund issued')}
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-xs active:scale-95 transition-all"
                      >
                        Refund Buyer in Full ({formatNaira(disp.amountHeldInEscrow)})
                      </button>
                      <button
                        onClick={() => resolveDispute(disp.id, 'partial', Math.round(disp.amountHeldInEscrow / 2), '50/50 compromise reached')}
                        className="px-4 py-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-800 font-semibold text-xs transition-colors"
                      >
                        50% Compromise Refund
                      </button>
                      <button
                        onClick={() => resolveDispute(disp.id, 'release_seller', undefined, 'Seller packed properly; claim rejected')}
                        className="px-4 py-2 rounded-xl bg-[#123524] hover:bg-[#1b4330] text-white font-semibold text-xs shadow-xs active:scale-95 transition-all"
                      >
                        Release Escrow to Seller
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
                      <span>
                        <strong>Resolved:</strong> {disp.resolutionNotes || 'Dispute closed by Admin Support.'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. EMERGENCY BROADCAST & PLATFORM KILLSWITCHES           */}
      {/* ========================================================= */}
      {activeTab === 'emergency' && (
        <div className="space-y-6">
          {/* Emergency Metrics & Master Status */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className={`p-4 rounded-xl border ${
              broadcastAnnouncement.isActive
                ? 'bg-amber-50 border-amber-300'
                : 'bg-white border-stone-200'
            }`}>
              <span className="text-xs text-stone-500 font-medium">Broadcast Banner</span>
              <p className={`text-xl sm:text-2xl font-bold font-mono-numbers mt-1 ${
                broadcastAnnouncement.isActive ? 'text-amber-800' : 'text-stone-900'
              }`}>
                {broadcastAnnouncement.isActive ? 'LIVE ON SITE' : 'INACTIVE'}
              </p>
              <span className="text-[11px] text-stone-500">
                {broadcastAnnouncement.isActive ? `Tone: ${broadcastAnnouncement.tone.toUpperCase()}` : 'Draft ready to publish'}
              </span>
            </div>

            <div className={`p-4 rounded-xl border ${
              emergencyControls.maintenanceMode
                ? 'bg-red-50 border-red-300'
                : 'bg-white border-stone-200'
            }`}>
              <span className="text-xs text-stone-500 font-medium">Maintenance Mode</span>
              <p className={`text-xl sm:text-2xl font-bold font-mono-numbers mt-1 ${
                emergencyControls.maintenanceMode ? 'text-red-700' : 'text-emerald-700'
              }`}>
                {emergencyControls.maintenanceMode ? 'LOCKDOWN ACTIVE' : 'DISABLED'}
              </p>
              <span className="text-[11px] text-stone-500">
                {emergencyControls.maintenanceMode ? 'Visitors blocked from feed' : 'Public marketplace open'}
              </span>
            </div>

            <div className={`p-4 rounded-xl border ${
              emergencyControls.pauseNewOrders
                ? 'bg-rose-50 border-rose-300'
                : 'bg-white border-stone-200'
            }`}>
              <span className="text-xs text-stone-500 font-medium">Checkout Engine</span>
              <p className={`text-xl sm:text-2xl font-bold font-mono-numbers mt-1 ${
                emergencyControls.pauseNewOrders ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                {emergencyControls.pauseNewOrders ? 'ORDERS PAUSED' : 'OPERATIONAL'}
              </p>
              <span className="text-[11px] text-stone-500">
                {emergencyControls.pauseNewOrders ? 'New checkouts blocked' : 'Paystack escrow live'}
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-stone-200">
              <span className="text-xs text-stone-500 font-medium">Moderator Audit Trail</span>
              <p className="text-xl sm:text-2xl font-bold font-mono-numbers text-stone-900 mt-1">
                {adminAuditLogs.length}
              </p>
              <span className="text-[11px] text-stone-500">Actions logged this session</span>
            </div>
          </div>

          {/* Broadcast Studio */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold font-heading text-stone-900 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-[#FF6B00]" />
                  <span>Site-Wide Emergency & Advisory Broadcast Studio</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Broadcast an immediate official notice to all visitors and sellers across every page of Shop It.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-stone-700">Broadcast Status:</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextActive = !broadcastForm.isActive;
                    setBroadcastForm(prev => ({ ...prev, isActive: nextActive }));
                    updateBroadcastAnnouncement({ isActive: nextActive, title: broadcastForm.title, message: broadcastForm.message, tone: broadcastForm.tone });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${
                    broadcastForm.isActive
                      ? 'bg-red-600 hover:bg-red-700 text-white border-red-700 shadow-xs'
                      : 'bg-stone-200 hover:bg-stone-300 text-stone-700 border-stone-300'
                  }`}
                >
                  {broadcastForm.isActive ? 'DEACTIVATE BANNER' : 'ACTIVATE LIVE ON SITE'}
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-5">
              {/* Quick Presets */}
              <div>
                <span className="text-xs font-bold text-stone-700 block mb-2">
                  Quick 1-Tap Advisory Templates:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastForm({
                        title: 'Campus Safe Handshake Protocol',
                        message: 'Always verify your 4-digit Handshake OTP in person at a daylight porter station before accepting orders.',
                        tone: 'warning',
                        isActive: true,
                      });
                      updateBroadcastAnnouncement({
                        title: 'Campus Safe Handshake Protocol',
                        message: 'Always verify your 4-digit Handshake OTP in person at a daylight porter station before accepting orders.',
                        tone: 'warning',
                        isActive: true,
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-950 transition-colors"
                  >
                    Handshake OTP Safety Protocol
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastForm({
                        title: 'Banking Network Advisory',
                        message: 'Paystack bank transfers are experiencing slight delays. Card payments clear immediately into safe escrow.',
                        tone: 'info',
                        isActive: true,
                      });
                      updateBroadcastAnnouncement({
                        title: 'Banking Network Advisory',
                        message: 'Paystack bank transfers are experiencing slight delays. Card payments clear immediately into safe escrow.',
                        tone: 'info',
                        isActive: true,
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-950 transition-colors"
                  >
                    Bank Network Notice
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBroadcastForm({
                        title: 'Urgent Safety Advisory',
                        message: 'Moderator Notice: Deliveries after 7:00 PM are suspended. Please reschedule handoffs for daylight hours.',
                        tone: 'emergency',
                        isActive: true,
                      });
                      updateBroadcastAnnouncement({
                        title: 'Urgent Safety Advisory',
                        message: 'Moderator Notice: Deliveries after 7:00 PM are suspended. Please reschedule handoffs for daylight hours.',
                        tone: 'emergency',
                        isActive: true,
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-950 transition-colors"
                  >
                    Night Delivery Restriction
                  </button>
                </div>
              </div>

              {/* Form Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-stone-800">
                    Broadcast Headline
                  </label>
                  <input
                    type="text"
                    value={broadcastForm.title}
                    onChange={e => setBroadcastForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Campus Safety Advisory"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 bg-stone-50 focus:bg-white focus:outline-hidden focus:border-[#FF6B00]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-800">
                    Banner Tone & Urgency
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['info', 'warning', 'emergency', 'promo'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setBroadcastForm(prev => ({ ...prev, tone: t }))}
                        className={`px-2.5 py-2 rounded-xl text-xs font-bold capitalize transition-all border ${
                          broadcastForm.tone === t
                            ? 'bg-stone-950 text-white border-stone-950 shadow-xs'
                            : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-800">
                  Broadcast Message Body
                </label>
                <textarea
                  rows={3}
                  value={broadcastForm.message}
                  onChange={e => setBroadcastForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Enter the full announcement text visible to buyers and sellers..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 bg-stone-50 focus:bg-white focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>

              {/* Live Preview Card */}
              <div className="p-4 rounded-xl bg-stone-100 border border-stone-200 space-y-2">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                  Live Banner Preview (Exactly how visitors see it)
                </span>
                <div className={`p-3 rounded-xl text-xs flex items-center justify-between gap-3 text-white ${
                  broadcastForm.tone === 'emergency'
                    ? 'bg-red-700 border border-red-900'
                    : broadcastForm.tone === 'warning'
                    ? 'bg-amber-500 text-stone-950 border border-amber-600'
                    : broadcastForm.tone === 'promo'
                    ? 'bg-[#123524] text-white border border-[#1b4330]'
                    : 'bg-stone-900 text-white border border-stone-800'
                }`}>
                  <div className="flex items-center gap-2 truncate">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/30">
                      {broadcastForm.tone.toUpperCase()}
                    </span>
                    <strong className="underline decoration-white/40">{broadcastForm.title || 'Broadcast Title'}</strong>
                    <span className="hidden sm:inline opacity-75">·</span>
                    <span className="truncate opacity-90">{broadcastForm.message || 'Broadcast message description will appear here.'}</span>
                  </div>
                  <span className="text-[10px] opacity-75 shrink-0 hidden md:inline">
                    By Adeyinka Joseph (Moderator)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    updateBroadcastAnnouncement({
                      title: broadcastForm.title,
                      message: broadcastForm.message,
                      tone: broadcastForm.tone,
                      isActive: broadcastForm.isActive,
                    });
                  }}
                  className="px-5 py-2.5 rounded-xl bg-stone-950 hover:bg-black text-[#9FE870] font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-2"
                >
                  <Megaphone className="w-4 h-4" />
                  <span>Save & Push Broadcast</span>
                </button>
              </div>
            </div>
          </div>

          {/* Platform Killswitches Hub */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/60">
              <h3 className="text-base font-bold font-heading text-stone-900 flex items-center gap-2">
                <Power className="w-4 h-4 text-red-600" />
                <span>Marketplace Emergency Killswitches</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Instant operational controls to protect campus marketplace integrity during emergencies.
              </p>
            </div>

            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Killswitch 1: Maintenance Mode */}
              <div className={`p-4 rounded-2xl border-2 transition-all space-y-3 ${
                emergencyControls.maintenanceMode
                  ? 'border-red-600 bg-red-50/70'
                  : 'border-stone-200 bg-stone-50/50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    emergencyControls.maintenanceMode ? 'bg-red-600 text-white' : 'bg-stone-200 text-stone-700'
                  }`}>
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => updateEmergencyControls({ maintenanceMode: !emergencyControls.maintenanceMode })}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all border ${
                      emergencyControls.maintenanceMode
                        ? 'bg-red-600 text-white border-red-700 shadow-xs'
                        : 'bg-white text-stone-800 border-stone-300'
                    }`}
                  >
                    {emergencyControls.maintenanceMode ? 'ACTIVE' : 'OFF'}
                  </button>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-950">Maintenance Lockdown</h4>
                  <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                    Directs all non-admin visitors to an emergency security maintenance splash screen. Only you (the moderator) can navigate the store.
                  </p>
                </div>
              </div>

              {/* Killswitch 2: Pause Orders */}
              <div className={`p-4 rounded-2xl border-2 transition-all space-y-3 ${
                emergencyControls.pauseNewOrders
                  ? 'border-amber-600 bg-amber-50/70'
                  : 'border-stone-200 bg-stone-50/50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    emergencyControls.pauseNewOrders ? 'bg-amber-600 text-white' : 'bg-stone-200 text-stone-700'
                  }`}>
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => updateEmergencyControls({ pauseNewOrders: !emergencyControls.pauseNewOrders })}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all border ${
                      emergencyControls.pauseNewOrders
                        ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                        : 'bg-white text-stone-800 border-stone-300'
                    }`}
                  >
                    {emergencyControls.pauseNewOrders ? 'PAUSED' : 'ACTIVE'}
                  </button>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-950">Pause New Orders</h4>
                  <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                    Temporarily halts new Paystack checkout sessions if courier networks or campus banking has widespread downtime.
                  </p>
                </div>
              </div>

              {/* Killswitch 3: Pause Seller Signups */}
              <div className={`p-4 rounded-2xl border-2 transition-all space-y-3 ${
                emergencyControls.pauseSellerSignups
                  ? 'border-stone-900 bg-stone-100'
                  : 'border-stone-200 bg-stone-50/50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    emergencyControls.pauseSellerSignups ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-700'
                  }`}>
                    <Store className="w-5 h-5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => updateEmergencyControls({ pauseSellerSignups: !emergencyControls.pauseSellerSignups })}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all border ${
                      emergencyControls.pauseSellerSignups
                        ? 'bg-stone-900 text-white border-stone-950 shadow-xs'
                        : 'bg-white text-stone-800 border-stone-300'
                    }`}
                  >
                    {emergencyControls.pauseSellerSignups ? 'CLOSED' : 'OPEN'}
                  </button>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-950">Pause Seller Signups</h4>
                  <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                    Temporarily freezes new artisan registrations during spam waves or manual NIN verification backlogs.
                  </p>
                </div>
              </div>

              {/* Killswitch 4: Nuclear Database Wipe */}
              <div className="p-4 rounded-2xl border-2 border-red-300 bg-red-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setClearDbConfirmText('');
                      setIsClearDbModalOpen(true);
                    }}
                    className="px-3 py-1 rounded-xl text-xs font-black transition-all border bg-red-600 hover:bg-red-700 text-white border-red-700 shadow-xs active:scale-95"
                  >
                    WIPE DB
                  </button>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-red-950">Nuclear Database Wipe</h4>
                  <p className="text-[11px] text-red-700 mt-1 leading-relaxed">
                    Instantly wipes all sellers, shops, products, and buyer accounts, leaving only Adeyinka Joseph (Moderator).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Live Moderator Security Audit Log */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/60 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-heading text-stone-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-700" />
                  <span>Moderator Action Security Audit Trail</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Chronological, non-editable audit trail of high-power actions executed by Adeyinka Joseph.
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {adminAuditLogs.length} Events Logged
              </span>
            </div>

            <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto font-mono text-xs">
              {adminAuditLogs.map(log => (
                <div key={log.id} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-stone-50/60">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        log.action.includes('DELETED') || log.action.includes('SUSPENDED')
                          ? 'bg-red-100 text-red-800'
                          : log.action.includes('GRANTED') || log.action.includes('RELEASED')
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-200 text-stone-800'
                      }`}>
                        {log.action}
                      </span>
                      <span className="font-sans text-stone-900 font-medium">
                        {log.details}
                      </span>
                    </div>
                    {log.targetId && (
                      <span className="text-[11px] text-stone-400 block font-mono">
                        Target ID: {log.targetId}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0 text-[11px] text-stone-400 font-sans">
                    <span className="text-stone-700 font-semibold block">{log.moderatorName}</span>
                    <span>{log.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Document Inspection Lightbox Modal */}
      {selectedVerificationDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200">
              <h4 className="text-sm font-bold text-stone-900">Document Verification Viewer</h4>
              <button
                onClick={() => setSelectedVerificationDoc(null)}
                className="text-stone-400 hover:text-black font-bold text-lg"
              >
                ✕
              </button>
            </div>
            <img
              src={selectedVerificationDoc}
              alt="Verification document preview"
              className="w-full max-h-[70vh] object-contain rounded-lg border border-stone-200"
            />
            <div className="text-right">
              <button
                onClick={() => setSelectedVerificationDoc(null)}
                className="px-4 py-2 rounded-xl bg-[#0c0d10] text-white text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Admin Wallet Freeze/Unfreeze Modal (Rule 5) */}
      {freezeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border-2 border-[#111111]">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  freezeModal.isCurrentlyFrozen ? 'bg-[#9FE870] text-[#111111]' : 'bg-red-100 text-red-700'
                }`}>
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-base font-black text-stone-950">
                    {freezeModal.isCurrentlyFrozen ? 'Unfreeze Seller Wallet' : 'Freeze Seller Wallet'}
                  </h4>
                  <span className="text-xs text-stone-500">
                    {freezeModal.shopName} ({freezeModal.sellerId})
                  </span>
                </div>
              </div>

              <button
                onClick={() => setFreezeModal(prev => ({ ...prev, isOpen: false }))}
                className="text-stone-400 hover:text-stone-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              {freezeModal.isCurrentlyFrozen
                ? 'Unfreezing this wallet will re-enable withdrawals via Paystack Transfers API and restore automated escrow releases.'
                : 'Freezing this wallet halts all Paystack withdrawals immediately and prevents pending escrow release until cleared by an admin.'}
            </p>

            {!freezeModal.isCurrentlyFrozen && (
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">
                  Reason for Freeze (Logged to audit trail)
                </label>
                <input
                  type="text"
                  value={freezeModal.reason}
                  onChange={e => setFreezeModal(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Under-18 verification check or dispute review"
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs text-stone-900 bg-stone-50 focus:bg-white focus:outline-hidden"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFreezeModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleWalletFreeze(
                    freezeModal.sellerId,
                    !freezeModal.isCurrentlyFrozen,
                    freezeModal.reason || 'Admin Safety Audit'
                  );
                  setFreezeModal(prev => ({ ...prev, isOpen: false }));
                  notify(
                    freezeModal.isCurrentlyFrozen
                      ? `Wallet for ${freezeModal.shopName} has been unfrozen.`
                      : `Wallet for ${freezeModal.shopName} has been frozen.`,
                    'info'
                  );
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all border-2 border-[#111111] shadow-[0_2px_0_#111111] active:translate-y-0.5 ${
                  freezeModal.isCurrentlyFrozen
                    ? 'bg-[#9FE870] hover:bg-[#8fd860] text-[#111111]'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {freezeModal.isCurrentlyFrozen ? 'Confirm Unfreeze' : 'Confirm Freeze'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Moderator Delete Account Confirmation Modal */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border-2 border-red-600 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-stone-950">
                    Delete User Account
                  </h4>
                  <span className="text-xs text-red-600 font-bold">
                    Irreversible Moderator Action
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="text-stone-400 hover:text-stone-700 p-1 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-red-50 rounded-2xl border border-red-200 space-y-1.5 text-xs text-red-950">
              <p className="font-bold">Are you sure you want to delete this account?</p>
              <div className="text-[11px] space-y-0.5 text-red-900">
                <p><strong>Name:</strong> {deleteConfirmModal.userName}</p>
                <p><strong>Email:</strong> {deleteConfirmModal.userEmail}</p>
                <p><strong>Account ID:</strong> <code className="font-mono">{deleteConfirmModal.userId}</code></p>
                <p><strong>Role:</strong> {deleteConfirmModal.role.toUpperCase()}</p>
              </div>
            </div>

            <div className="text-xs text-stone-600 space-y-1 bg-stone-50 p-3 rounded-xl border border-stone-200">
              <p className="font-bold text-stone-900">Cascading Deletions Executed:</p>
              <ul className="list-disc list-inside text-[11px] text-stone-600 space-y-0.5">
                <li>Permanently removes profile from registered database</li>
                {deleteConfirmModal.role === 'seller' && (
                  <>
                    <li>Deletes artisan store profile and branding</li>
                    <li>Wipes all craft products from the public storefront</li>
                    <li>Cancels pending verification requests</li>
                    <li>Zeroes out and archives seller wallet</li>
                  </>
                )}
                <li>Revokes authentication tokens and login sessions</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteUserAccount(deleteConfirmModal.userId);
                  setDeleteConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Moderator Reset Password Modal */}
      {resetPasswordModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border-2 border-stone-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-[#FF6B00] flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-stone-950">
                    Reset User Password
                  </h4>
                  <span className="text-xs text-stone-500">
                    Moderator Override Authority
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetPasswordModal(prev => ({ ...prev, isOpen: false }))}
                className="text-stone-400 hover:text-stone-700 p-1 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-stone-600 space-y-1">
              <p>
                Resetting password for: <strong className="text-stone-900">{resetPasswordModal.userName}</strong>
              </p>
              <p className="text-[11px] text-stone-400">
                User ID: <code className="font-mono">{resetPasswordModal.userId}</code>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-800 block">
                New Password
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={resetPasswordModal.newPassword}
                  onChange={e => setResetPasswordModal(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter temporary or new secure password..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 bg-stone-50 focus:bg-white focus:outline-hidden focus:border-[#FF6B00]"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-stone-500">Min 6 characters</span>
                <button
                  type="button"
                  onClick={() => {
                    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                    setResetPasswordModal(prev => ({ ...prev, newPassword: `ShopIt#${randomSuffix}` }));
                  }}
                  className="text-[#FF6B00] font-bold hover:underline"
                >
                  Generate Safe Password
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetPasswordModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetPasswordModal.newPassword.trim().length < 6}
                onClick={() => {
                  adminResetUserPassword(resetPasswordModal.userId, resetPasswordModal.newPassword.trim());
                  setResetPasswordModal(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-[#9FE870] font-black text-xs transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Update Password</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Moderator Clear Entire Database Modal */}
      {isClearDbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#18181B] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border-2 border-red-600 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-stone-950 dark:text-white">
                    Clear Marketplace Database
                  </h4>
                  <span className="text-xs text-red-600 dark:text-red-400 font-bold">
                    Irreversible Master Moderator Action
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsClearDbModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-900/60 space-y-2 text-xs text-red-950 dark:text-red-200">
              <p className="font-bold flex items-center gap-1.5 text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Are you sure you want to completely clear the database?</span>
              </p>
              <p className="text-[11px] leading-relaxed text-red-900 dark:text-red-300">
                This action will completely wipe all registered sellers, businesses, craft listings, orders, buyer accounts, and wallet records across the platform.
              </p>
            </div>

            <div className="text-xs space-y-2 bg-stone-50 dark:bg-[#27272A]/50 p-4 rounded-2xl border border-stone-200 dark:border-stone-800">
              <p className="font-bold text-stone-900 dark:text-stone-100">Database Purge Summary:</p>
              <ul className="list-disc list-inside text-[11px] text-stone-600 dark:text-stone-400 space-y-1">
                <li><strong className="text-stone-800 dark:text-stone-200">Sellers & Businesses:</strong> All shops, artisan profiles, and NIN verifications deleted.</li>
                <li><strong className="text-stone-800 dark:text-stone-200">Product Listings:</strong> All crafts, catalogs, and listings wiped (0 items).</li>
                <li><strong className="text-stone-800 dark:text-stone-200">User Accounts:</strong> All non-moderator accounts removed.</li>
                <li><strong className="text-stone-800 dark:text-stone-200">Orders & Wallets:</strong> All transactions, escrows, and balances cleared.</li>
                <li className="text-emerald-700 dark:text-emerald-400 font-bold">
                  ✓ Protected: Adeyinka Joseph (joeadeyinka12@gmail.com) is preserved as the sole Moderator.
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsClearDbModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearMarketplaceDatabase();
                  setIsClearDbModalOpen(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Clear Everything Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Moderator Escrow Safe Pass & Digital Receipt Modal */}
      <EscrowReceiptModal
        order={selectedAdminReceiptOrder}
        isOpen={!!selectedAdminReceiptOrder}
        onClose={() => setSelectedAdminReceiptOrder(null)}
      />
    </div>
  );
};
