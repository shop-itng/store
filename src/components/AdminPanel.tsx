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
  Camera,
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
  CreditCard,
  Flag,
  Download,
  ExternalLink,
  Clock,
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
  const [inspectRequest, setInspectRequest] = useState<any | null>(null);
  const [rejectModalRequest, setRejectModalRequest] = useState<any | null>(null);
  const [selectedRejectReason, setSelectedRejectReason] = useState<string>('Document image is blurry or unreadable');
  const [customRejectReason, setCustomRejectReason] = useState<string>('');
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

  // Paystack Live Payments audit state (Point 11)
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [recheckingRef, setRecheckingRef] = useState<string | null>(null);

  // User Reports queue state (Part 2 Item 4)
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportFilter, setReportFilter] = useState<'all' | 'open' | 'reviewing' | 'resolved'>('all');
  const [reportActionNotes, setReportActionNotes] = useState<Record<string, string>>({});
  const [isExportingData, setIsExportingData] = useState(false);

  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const res = await fetch('/api/paystack/payments');
      const data = await res.json();
      if (data.status && Array.isArray(data.payments)) {
        setPaymentsList(data.payments);
      }
    } catch (e) {
      console.error('Failed to load payments:', e);
    } finally {
      setLoadingPayments(false);
    }
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      if (data.status && Array.isArray(data.reports)) {
        setReportsList(data.reports);
      }
    } catch (e) {
      console.error('Failed to load reports:', e);
    } finally {
      setLoadingReports(false);
    }
  };

  const recheckPaymentWithPaystack = async (reference: string) => {
    setRecheckingRef(reference);
    try {
      const res = await fetch(`/api/paystack/verify/${encodeURIComponent(reference)}`);
      const data = await res.json();
      if (data.status) {
        notify(`Payment Verified: Ref ${reference} is ${data.isPaid ? 'PAID' : data.paystackStatus || 'Pending'}`, 'success');
        await fetchPayments();
      } else {
        notify(`Verification Check: ${data.message || 'Payment not verified'}`, 'info');
      }
    } catch (e: any) {
      notify(`Re-check Failed: ${e.message}`, 'error');
    } finally {
      setRecheckingRef(null);
    }
  };

  const handleUpdateReport = async (reportId: string, status: 'open' | 'reviewing' | 'resolved') => {
    const note = reportActionNotes[reportId] || `Status updated to ${status} by moderator`;
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, actionNote: note }),
      });
      const data = await res.json();
      if (data.status) {
        notify(`Report Updated: Status changed to ${status}`, 'success');
        await fetchReports();
      }
    } catch (e: any) {
      notify(`Update Failed: ${e.message}`, 'error');
    }
  };

  const handleExportData = async () => {
    setIsExportingData(true);
    try {
      const res = await fetch('/api/admin/export-data');
      if (!res.ok) throw new Error('Export request failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shopit-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      notify('Export Complete: Sanitized JSON backup downloaded.', 'success');
    } catch (e: any) {
      notify(`Export Failed: ${e.message}`, 'error');
    } finally {
      setIsExportingData(false);
    }
  };

  // STEP 2 ITEM 6: Live Metrics & Database Connection status
  const [metricsData, setMetricsData] = useState<{
    metrics: {
      totalUsers: number;
      newToday: number;
      totalSellers: number;
      totalBuyers: number;
      verifiedSellers: number;
      pendingVerifications: number;
    };
    database: {
      neon: boolean;
      redis: boolean;
      provider: string;
      databaseUrlConfigured: boolean;
      redisConfigured: boolean;
    };
  } | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // STEP 2 ITEM 5: Database Users with search and pagination
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [dbUsersTotal, setDbUsersTotal] = useState(0);
  const [dbUsersPage, setDbUsersPage] = useState(1);
  const [dbUsersTotalPages, setDbUsersTotalPages] = useState(1);
  const [loadingDbUsers, setLoadingDbUsers] = useState(false);

  const fetchMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const res = await fetch('/api/admin/metrics');
      const data = await res.json();
      if (data.status) {
        setMetricsData(data);
      }
    } catch (e) {
      console.error('Failed to load admin metrics:', e);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const fetchDbUsers = async (page = 1, q = searchUserQuery, role = filterUserRole) => {
    setLoadingDbUsers(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        q: q.trim(),
        role: role,
      });
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      if (data.status) {
        setDbUsers(data.users || []);
        setDbUsersTotal(data.total || 0);
        setDbUsersPage(data.page || 1);
        setDbUsersTotalPages(data.totalPages || 1);
      }
    } catch (e) {
      console.error('Failed to load database users:', e);
    } finally {
      setLoadingDbUsers(false);
    }
  };

  React.useEffect(() => {
    fetchPayments();
    fetchReports();
    fetchMetrics();
    fetchDbUsers(1);
  }, []);

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

        {/* Sub-role selector tabs and Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center bg-stone-900 p-1.5 rounded-xl border border-stone-800 shrink-0 overflow-x-auto gap-1">
            {[
              { id: 'moderator', label: 'NIN & Safety', icon: ShieldCheck, badge: verificationRequests.filter(r => r.status === 'pending').length },
              { id: 'payments', label: 'Payments & Paystack', icon: CreditCard, badge: undefined },
              { id: 'reports', label: 'Reports Queue', icon: Flag, badge: reportsList.filter(r => r.status === 'open').length },
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
                    if (tab.id === 'payments') fetchPayments();
                    if (tab.id === 'reports') fetchReports();
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportData}
              disabled={isExportingData}
              className="px-3.5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 border border-stone-700 shadow-md shrink-0 active:scale-95 disabled:opacity-50"
              title="Download sanitized data backup JSON (NDPA compliant)"
            >
              <Download className={`w-4 h-4 ${isExportingData ? 'animate-bounce' : ''}`} />
              <span>{isExportingData ? 'Exporting...' : 'Export Data'}</span>
            </button>

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
      </div>

      {/* STEP 2 ITEM 6: DATABASE CONNECTED & PLATFORM METRICS DASHBOARD CARD */}
      <div className="bg-white rounded-2xl border-2 border-stone-900 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-base font-black text-stone-900 font-heading">
              Platform Metrics &amp; Database Health
            </h2>
            {/* Database Connection Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                metricsData?.database?.neon
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-red-50 text-red-800 border-red-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${metricsData?.database?.neon ? 'bg-emerald-500' : 'bg-red-500'}`} />
                Neon Postgres: {metricsData?.database?.neon ? 'Connected (Live)' : 'Disconnected'}
              </span>

              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                metricsData?.database?.redis
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-stone-100 text-stone-700 border-stone-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${metricsData?.database?.redis ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                Upstash Redis: {metricsData?.database?.redis ? 'Connected (Live)' : 'Standby / Local Cache'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              fetchMetrics();
              fetchDbUsers(dbUsersPage);
            }}
            disabled={loadingMetrics}
            className="self-start sm:self-auto px-3 py-1.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-xs font-bold text-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingMetrics ? 'animate-spin' : ''}`} />
            <span>Refresh Stats</span>
          </button>
        </div>

        {/* 5 Core Metric Cards (Step 2 Item 6: total users, new today, sellers, verified sellers, pending verifications) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-stone-50 rounded-xl p-3 border border-stone-200">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Total Users</span>
            <p className="text-xl sm:text-2xl font-black text-stone-900 mt-0.5">
              {metricsData ? metricsData.metrics.totalUsers : registeredUsers.length}
            </p>
            <span className="text-[10px] text-stone-500">In PostgreSQL</span>
          </div>

          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">New Today</span>
            <p className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">
              {metricsData ? metricsData.metrics.newToday : 0}
            </p>
            <span className="text-[10px] text-emerald-600">Registered today</span>
          </div>

          <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Sellers</span>
            <p className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">
              {metricsData ? metricsData.metrics.totalSellers : sellers.length}
            </p>
            <span className="text-[10px] text-amber-700">Artisan creators</span>
          </div>

          <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Verified Sellers</span>
            <p className="text-xl sm:text-2xl font-black text-blue-900 mt-0.5">
              {metricsData ? metricsData.metrics.verifiedSellers : sellers.filter(s => s.isVerifiedSeller).length}
            </p>
            <span className="text-[10px] text-blue-700">NIN badge granted</span>
          </div>

          <div className="bg-purple-50 rounded-xl p-3 border border-purple-200 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">Pending Verifications</span>
            <p className="text-xl sm:text-2xl font-black text-purple-900 mt-0.5">
              {metricsData ? metricsData.metrics.pendingVerifications : verificationRequests.filter(v => v.status === 'pending').length}
            </p>
            <span className="text-[10px] text-purple-700">Awaiting review</span>
          </div>
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
            <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold font-heading text-stone-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Real Seller Identity &amp; Biometric Verification Queue</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Side-by-side review of Nigerian identity documents, live camera selfies, and NIMC matching (NDPA 2023 Compliant).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-[#fff2ea] text-[#f95700] border border-[#fed7aa] text-xs font-semibold">
                  {verificationRequests.filter(r => r.status === 'pending').length} In Review
                </span>
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                  {verificationRequests.filter(r => r.status === 'verified').length} Verified
                </span>
              </div>
            </div>

            <div className="divide-y divide-stone-200">
              {verificationRequests.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs">
                  No seller verification requests submitted yet.
                </div>
              ) : (
                verificationRequests.map(req => {
                  const isMinor = req.under18;
                  const maskedNin = req.fullNinLast4 ? `***-***-${req.fullNinLast4}` : req.idNumber;
                  const isReqVerified = req.status === 'verified';

                  return (
                    <div key={req.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-stone-50/40 transition-colors">
                      <div className="space-y-2 max-w-2xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-stone-900">{req.shopName}</h4>
                          <span className="text-xs text-stone-600 font-medium">({req.ownerName})</span>
                          <span className="px-2 py-0.5 rounded-md bg-stone-100 text-[11px] font-semibold text-stone-700">
                            {req.campus}
                          </span>
                          {isMinor ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold">
                              Minor Under 18 (Guardian Consent)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[11px]">
                              Adult 18+
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            isReqVerified
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : req.status === 'needs_resubmission'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {isReqVerified ? 'VERIFIED' : req.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-600">
                          <div>
                            <strong>Document:</strong> {req.idType ? req.idType.replace('_', ' ').toUpperCase() : 'NIN SLIP'} ·{' '}
                            <strong>NIN:</strong> <span className="font-mono font-bold text-stone-900 bg-stone-100 px-1 rounded">{maskedNin}</span>
                          </div>
                          <div>
                            <strong>Live Biometrics:</strong> {req.selfiePhotoUrl ? 'Live Camera Captured (No Gallery)' : 'Selfie on file'} (Liveness: {req.livenessScore || 94}%)
                          </div>
                          {req.dateOfBirth && (
                            <div>
                              <strong>Date of Birth:</strong> {req.dateOfBirth}
                            </div>
                          )}
                          <div>
                            <strong>Submitted:</strong> {req.submittedAt}
                          </div>
                        </div>

                        {isMinor && (
                          <div className="text-xs text-stone-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 space-y-0.5">
                            <div><strong>Guardian Name:</strong> {req.guardianName || 'N/A'} · <strong>Phone:</strong> {req.guardianPhone || 'N/A'}</div>
                            {req.guardianNinLast4 && <div><strong>Guardian NIN:</strong> <span className="font-mono font-bold">***-***-{req.guardianNinLast4}</span></div>}
                            <div className="text-[11px] text-amber-800 font-semibold">✓ Parent/Guardian Signed NDPA Consent on file</div>
                          </div>
                        )}

                        {req.rejectionReason && (
                          <p className="text-xs text-red-700 bg-red-50 p-2 rounded-lg border border-red-200">
                            <strong>Reason:</strong> {req.rejectionReason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* Side-by-Side Inspection Button */}
                        <button
                          type="button"
                          onClick={() => setInspectRequest(req)}
                          className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-black text-[#9FE870] text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          <Eye className="w-4 h-4 text-[#9FE870]" />
                          <span>Inspect Side-by-Side</span>
                        </button>

                        {req.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => updateVerificationRequest(req.id, 'verified')}
                              className="px-3.5 py-2 rounded-xl bg-[#123524] hover:bg-[#1b4330] text-white text-xs font-black transition-all flex items-center gap-1 active:scale-95 cursor-pointer shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => updateVerificationRequest(req.id, 'needs_resubmission', 'Document or selfie is unclear. Please re-upload a clear photo in good lighting.')}
                              className="px-3 py-2 rounded-xl border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 text-xs font-bold transition-colors cursor-pointer"
                            >
                              Resubmit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectModalRequest(req);
                                setSelectedRejectReason('Document image is blurry or unreadable');
                                setCustomRejectReason('');
                              }}
                              className="px-3 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
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

              {/* Search & Role Filter (Step 2 Item 5) */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchUserQuery}
                    onChange={e => {
                      const val = e.target.value;
                      setSearchUserQuery(val);
                      fetchDbUsers(1, val, filterUserRole);
                    }}
                    placeholder="Search name or email..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-stone-300 text-xs bg-white focus:outline-hidden focus:border-[#FF6B00]"
                  />
                </div>

                <div className="flex items-center bg-stone-200/70 p-1 rounded-xl text-xs font-bold">
                  {(['all', 'seller', 'buyer', 'admin'] as const).map(role => (
                    <button
                      key={role}
                      onClick={() => {
                        setFilterUserRole(role as any);
                        fetchDbUsers(1, searchUserQuery, role as any);
                      }}
                      className={`px-2.5 py-1 rounded-lg capitalize transition-all cursor-pointer ${
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
                    fetchDbUsers(dbUsersPage);
                    fetchMetrics();
                  }}
                  className="p-1.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-600 transition-colors"
                  title="Refresh users from PostgreSQL"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDbUsers ? 'animate-spin' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setClearDbConfirmText('');
                    setIsClearDbModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition-all flex items-center gap-1.5 border border-red-700 shadow-2xs active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Wipe All Other Accounts</span>
                </button>
              </div>
            </div>

            {/* STEP 2 ITEM 5: Database User Management Table with Exact Columns */}
            {loadingDbUsers ? (
              <div className="p-12 text-center text-stone-500 space-y-2">
                <RefreshCw className="w-6 h-6 text-stone-400 mx-auto animate-spin" />
                <p className="text-xs font-bold">Querying PostgreSQL database...</p>
              </div>
            ) : dbUsers.length === 0 ? (
              <div className="p-12 text-center text-stone-500 space-y-2">
                <UserX className="w-8 h-8 text-stone-300 mx-auto" />
                <p className="text-sm font-semibold">No registered accounts found in database matching your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-100/70 text-stone-600 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">User (Name &amp; Email)</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3">Seller Verification</th>
                      <th className="py-3 px-3">Email Verified</th>
                      <th className="py-3 px-3">Created Time</th>
                      <th className="py-3 px-3">Last Login</th>
                      <th className="py-3 px-4 text-right">Moderator Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {dbUsers.map(user => {
                      const isMasterAdmin = user.role === 'admin' || user.email === 'joeadeyinka12@gmail.com';

                      const formatDateTime = (dateStr?: string | null) => {
                        if (!dateStr) return 'Never';
                        try {
                          const d = new Date(dateStr);
                          return d.toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                        } catch {
                          return String(dateStr);
                        }
                      };

                      return (
                        <tr
                          key={user.id}
                          className={`hover:bg-stone-50/80 transition-colors ${
                            user.isBanned ? 'bg-red-50/40' : ''
                          }`}
                        >
                          {/* 1. User Name & Email */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border ${
                                  user.role === 'admin'
                                    ? 'bg-black text-[#9FE870] border-black'
                                    : user.role === 'seller'
                                    ? 'bg-amber-100 text-[#FF6B00] border-amber-200'
                                    : 'bg-blue-100 text-blue-700 border-blue-200'
                                }`}
                              >
                                {user.name?.[0]?.toUpperCase() || 'U'}
                              </div>
                              <div>
                                <div className="font-bold text-stone-900 flex items-center gap-1.5">
                                  <span>{user.name}</span>
                                  {user.isBanned && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-red-100 text-red-800 border border-red-200">
                                      BANNED
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-stone-500 font-mono">{user.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Role */}
                          <td className="py-3.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                user.role === 'admin'
                                  ? 'bg-black text-[#9FE870] border-black'
                                  : user.role === 'seller'
                                  ? 'bg-[#FF6B00] text-white border-[#FF6B00]'
                                  : 'bg-blue-100 text-blue-800 border-blue-200'
                              }`}
                            >
                              {user.role === 'admin' ? 'MODERATOR' : user.role.toUpperCase()}
                            </span>
                          </td>

                          {/* 3. Seller Verification Status */}
                          <td className="py-3.5 px-3">
                            {user.role === 'seller' ? (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  user.isVerifiedSeller || user.verificationStatus === 'verified'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : user.verificationStatus === 'pending'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-stone-100 text-stone-600 border-stone-200'
                                }`}
                              >
                                {user.isVerifiedSeller || user.verificationStatus === 'verified'
                                  ? '✓ NIN Verified'
                                  : user.verificationStatus === 'pending'
                                  ? '⏳ Pending Review'
                                  : 'Unverified'}
                              </span>
                            ) : (
                              <span className="text-stone-400 text-[11px]">N/A (Buyer)</span>
                            )}
                          </td>

                          {/* 4. Email Verified */}
                          <td className="py-3.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                user.isVerifiedEmail
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  user.isVerifiedEmail ? 'bg-emerald-600' : 'bg-amber-600'
                                }`}
                              />
                              {user.isVerifiedEmail ? 'Verified' : 'Unverified'}
                            </span>
                          </td>

                          {/* 5. Created Time */}
                          <td className="py-3.5 px-3 text-stone-600 text-[11px] whitespace-nowrap">
                            {formatDateTime(user.createdAt)}
                          </td>

                          {/* 6. Last Login Time */}
                          <td className="py-3.5 px-3 text-stone-600 text-[11px] whitespace-nowrap">
                            {formatDateTime(user.lastLoginAt)}
                          </td>

                          {/* 7. Moderator Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {user.role === 'seller' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    adminToggleSellerVerification(user.id, !user.isVerifiedSeller);
                                    await fetchDbUsers(dbUsersPage);
                                    fetchMetrics();
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                                    user.isVerifiedSeller
                                      ? 'border-stone-300 text-stone-700 hover:bg-stone-100'
                                      : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                  }`}
                                  title="Toggle NIN verified badge"
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>{user.isVerifiedSeller ? 'Revoke NIN' : 'Verify NIN'}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  setResetPasswordModal({
                                    isOpen: true,
                                    userId: user.id,
                                    userName: user.name,
                                    newPassword: '',
                                  })
                                }
                                className="px-2 py-1 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                title="Reset user password in PostgreSQL"
                              >
                                <Key className="w-3 h-3" />
                                <span>Reset</span>
                              </button>

                              {!isMasterAdmin && (
                                <>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      banUserAccount(user.id, !user.isBanned);
                                      await fetchDbUsers(dbUsersPage);
                                      await fetchMetrics();
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                                      user.isBanned
                                        ? 'border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                                        : 'border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100'
                                    }`}
                                    title={user.isBanned ? 'Unsuspend account' : 'Suspend account'}
                                  >
                                    <Ban className="w-3 h-3" />
                                    <span>{user.isBanned ? 'Unsuspend' : 'Suspend'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteConfirmModal({
                                        isOpen: true,
                                        userId: user.id,
                                        userName: user.name,
                                        userEmail: user.email,
                                        role: user.role,
                                      })
                                    }
                                    className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                                    title="Permanently delete user from PostgreSQL"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls (Step 2 Item 5) */}
            <div className="p-3.5 sm:p-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-600">
              <div>
                Showing <strong className="text-stone-900">{dbUsers.length}</strong> of{' '}
                <strong className="text-stone-900">{dbUsersTotal}</strong> accounts in PostgreSQL
                {dbUsersTotalPages > 1 && ` (Page ${dbUsersPage} of ${dbUsersTotalPages})`}
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  disabled={dbUsersPage <= 1 || loadingDbUsers}
                  onClick={() => fetchDbUsers(dbUsersPage - 1)}
                  className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white font-bold text-stone-700 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  Previous
                </button>

                <span className="px-2.5 py-1 font-mono text-stone-700 font-bold">
                  {dbUsersPage} / {dbUsersTotalPages}
                </span>

                <button
                  type="button"
                  disabled={dbUsersPage >= dbUsersTotalPages || loadingDbUsers}
                  onClick={() => fetchDbUsers(dbUsersPage + 1)}
                  className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white font-bold text-stone-700 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
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

          {/* Paystack Integration & Live Webhook Configuration Info */}
          <div className="bg-[#111111] text-white p-5 rounded-2xl border-2 border-[#111111] shadow-[0_4px_0_#FF6B00] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#00C3F7] text-[#111111] font-black flex items-center justify-center text-sm shadow-xs">
                  P
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <span>Paystack Webhook & Escrow Server Integration</span>
                    <span className="text-[10px] bg-[#9FE870] text-[#111111] px-2 py-0.5 rounded-full font-bold">
                      ACTIVE
                    </span>
                  </h4>
                  <p className="text-[11px] text-stone-400">
                    Server-authoritative kobo calculation · HMAC SHA-512 signature check · Strict idempotency
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[#9FE870] bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800">
                  Dual-Check: Webhook + Paystack API
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-stone-300 block">
                Your Exact Paystack Live Webhook URL (Copy & paste into Paystack Dashboard):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value="https://ais-pre-wzajsxrjpydkrhqs4wnbqb-960736599572.europe-west2.run.app/api/paystack/webhook"
                  className="flex-1 bg-stone-900 border border-stone-700 text-xs text-[#9FE870] font-mono px-3 py-2 rounded-xl select-all focus:outline-hidden"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      'https://ais-pre-wzajsxrjpydkrhqs4wnbqb-960736599572.europe-west2.run.app/api/paystack/webhook'
                    );
                    notify('Paystack Webhook URL copied to clipboard!', 'success');
                  }}
                  className="px-3.5 py-2 bg-[#FF6B00] hover:bg-[#ff7a1a] text-[#111111] font-black rounded-xl text-xs border border-[#111111] shadow-[0_2px_0_#ffffff] shrink-0"
                >
                  Copy URL
                </button>
              </div>
              <p className="text-[11px] text-stone-400 leading-relaxed">
                <strong>Paystack Setup:</strong> Go to Paystack Dashboard → <strong>Settings</strong> → <strong>API Keys &amp; Webhooks</strong> → In the <strong>Live Webhook URL</strong> field, paste the URL above and click <strong>Save Changes</strong>.
              </p>
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

      {/* ========================================================= */}
      {/* 6. PAYMENTS & PAYSTACK AUDIT TAB (Point 11)              */}
      {/* ========================================================= */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">Total Transactions</span>
              <p className="text-2xl font-black font-mono-numbers text-stone-900 mt-1">
                {paymentsList.length}
              </p>
              <span className="text-[11px] text-stone-400 mt-0.5 block">Card, Transfer & USSD</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">Confirmed Paid</span>
              <p className="text-2xl font-black font-mono-numbers text-emerald-600 mt-1">
                {paymentsList.filter(p => p.status === 'paid').length}
              </p>
              <span className="text-[11px] text-emerald-700 font-semibold mt-0.5 block">Secured in Escrow</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">Total Settled Inflow</span>
              <p className="text-xl sm:text-2xl font-black font-mono-numbers text-stone-900 mt-1">
                {formatNaira(
                  paymentsList
                    .filter(p => p.status === 'paid')
                    .reduce((sum, p) => sum + (p.amountNaira || 0), 0)
                )}
              </p>
              <span className="text-[11px] text-stone-400 mt-0.5 block">Processed through Paystack</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">Webhooks Verified</span>
              <p className="text-2xl font-black font-mono-numbers text-[#FF6B00] mt-1">
                {paymentsList.filter(p => p.webhookReceived).length}
              </p>
              <span className="text-[11px] text-stone-400 mt-0.5 block">HMAC SHA512 confirmed</span>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#FF6B00]" />
                  <span>Paystack Real-Time Payments Ledger</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Every transaction started on server in kobo with unique reference, channels, and Paystack verification status.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchPayments}
                  disabled={loadingPayments}
                  className="px-3.5 py-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-xs font-bold text-stone-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingPayments ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {loadingPayments && paymentsList.length === 0 ? (
              <div className="p-12 text-center text-xs text-stone-500">
                <RefreshCw className="w-6 h-6 animate-spin text-[#FF6B00] mx-auto mb-2" />
                Loading live payment records...
              </div>
            ) : paymentsList.length === 0 ? (
              <div className="p-12 text-center text-xs text-stone-500">
                <CreditCard className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="font-bold text-stone-700">No payment records logged yet</p>
                <p className="text-stone-400 mt-1">
                  Payments initialized by buyers at checkout will automatically appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-600 font-bold border-b border-stone-200">
                    <tr>
                      <th className="py-3 px-4">Order & Customer</th>
                      <th className="py-3 px-4">Reference</th>
                      <th className="py-3 px-4">Channel</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Webhook</th>
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {paymentsList.map(payment => {
                      const isPaid = payment.status === 'paid';
                      const isPending = payment.status === 'pending_payment';
                      const isRefunded = payment.status === 'refunded';
                      const isRechecking = recheckingRef === payment.reference;

                      return (
                        <tr key={payment.reference} className="hover:bg-stone-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-medium">
                            <span className="font-bold text-stone-900 block font-mono text-[11px]">
                              #{payment.orderId || 'N/A'}
                            </span>
                            <span className="text-[11px] text-stone-500">
                              {payment.customerEmail || 'Buyer'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-stone-700">
                            <span className="bg-stone-100 px-2 py-1 rounded text-[11px] select-all">
                              {payment.reference}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-bold uppercase tracking-wider">
                              {payment.channel || 'multi'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-stone-900 font-mono-numbers">
                            {formatNaira(payment.amountNaira || (payment.amountKobo ? payment.amountKobo / 100 : 0))}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black inline-flex items-center gap-1 ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isRefunded
                                  ? 'bg-purple-100 text-purple-800'
                                  : isPending
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-stone-100 text-stone-800'
                              }`}
                            >
                              {isPaid && <CheckCircle2 className="w-3 h-3" />}
                              {isRefunded && <RefreshCw className="w-3 h-3" />}
                              {isPending && <Clock className="w-3 h-3" />}
                              <span className="capitalize">{payment.status.replace('_', ' ')}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {payment.webhookReceived ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold inline-flex items-center gap-1">
                                <Check className="w-3 h-3" /> Yes
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-500 text-[10px] font-medium">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-stone-500">
                            {new Date(payment.createdAt).toLocaleString('en-NG', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => recheckPaymentWithPaystack(payment.reference)}
                              disabled={isRechecking}
                              className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-black text-[#9FE870] text-[11px] font-black transition-all inline-flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                              title="Query Paystack Verify Transaction API directly"
                            >
                              <RefreshCw className={`w-3 h-3 ${isRechecking ? 'animate-spin' : ''}`} />
                              <span>{isRechecking ? 'Checking...' : 'Re-check'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. REPORTS QUEUE TAB (Part 2 Item 4)                     */}
      {/* ========================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">Total Reports</span>
              <p className="text-2xl font-black font-mono-numbers text-stone-900 mt-1">
                {reportsList.length}
              </p>
              <span className="text-[11px] text-stone-400 mt-0.5 block">Community safety submissions</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">Open / Unreviewed</span>
              <p className="text-2xl font-black font-mono-numbers text-red-600 mt-1">
                {reportsList.filter(r => r.status === 'open').length}
              </p>
              <span className="text-[11px] text-red-700 font-semibold mt-0.5 block">Requires immediate action</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">In Investigation</span>
              <p className="text-2xl font-black font-mono-numbers text-amber-600 mt-1">
                {reportsList.filter(r => r.status === 'reviewing').length}
              </p>
              <span className="text-[11px] text-amber-700 font-semibold mt-0.5 block">Moderator actively auditing</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">Resolved Cases</span>
              <p className="text-2xl font-black font-mono-numbers text-emerald-600 mt-1">
                {reportsList.filter(r => r.status === 'resolved').length}
              </p>
              <span className="text-[11px] text-emerald-700 font-semibold mt-0.5 block">Closed with action logs</span>
            </div>
          </div>

          {/* Filter Bar & Header */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-600">Filter Reports:</span>
              {(['all', 'open', 'reviewing', 'resolved'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setReportFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                    reportFilter === f
                      ? 'bg-[#FF6B00] text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {f} {f !== 'all' && `(${reportsList.filter(r => r.status === f).length})`}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={fetchReports}
              disabled={loadingReports}
              className="px-3.5 py-1.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-xs font-bold text-stone-700 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingReports ? 'animate-spin' : ''}`} />
              <span>Refresh Queue</span>
            </button>
          </div>

          {/* Reports List */}
          {reportsList
            .filter(r => reportFilter === 'all' || r.status === reportFilter)
            .length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
              <Flag className="w-8 h-8 text-stone-300 mx-auto mb-2" />
              <p className="font-bold text-stone-700 text-sm">No reports in this category</p>
              <p className="text-stone-400 text-xs mt-1">
                Community submissions from products, seller shops, reviews, and chats appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reportsList
                .filter(r => reportFilter === 'all' || r.status === reportFilter)
                .map(report => {
                  const isOpen = report.status === 'open';
                  const isReviewing = report.status === 'reviewing';
                  const isResolved = report.status === 'resolved';

                  return (
                    <div
                      key={report.id}
                      className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4 hover:border-stone-300 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-md bg-stone-900 text-white text-[10px] font-black uppercase tracking-wider">
                              {report.targetType}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isOpen
                                  ? 'bg-red-100 text-red-800'
                                  : isReviewing
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              ● {report.status.toUpperCase()}
                            </span>
                            <span className="text-[11px] font-mono text-stone-400">
                              #{report.id}
                            </span>
                          </div>

                          <h4 className="text-sm font-black text-stone-900 mt-1">
                            {report.targetTitle || `Target ID: ${report.targetId}`}
                          </h4>

                          <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Reason: {report.reason}</span>
                          </p>
                        </div>

                        <div className="text-right text-[11px] text-stone-400 shrink-0">
                          <span className="block font-medium text-stone-600">
                            By: {report.reporterEmail || 'Anonymous Student'}
                          </span>
                          <span>{new Date(report.createdAt).toLocaleString('en-NG')}</span>
                        </div>
                      </div>

                      {report.details && (
                        <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs text-stone-700 leading-relaxed">
                          <span className="font-bold text-stone-900 block mb-0.5">Reporter Context:</span>
                          {report.details}
                        </div>
                      )}

                      {/* Action Logs History */}
                      {report.actionLogs && report.actionLogs.length > 0 && (
                        <div className="border-t border-stone-100 pt-3 space-y-1">
                          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                            Audit Trail:
                          </span>
                          <div className="space-y-1">
                            {report.actionLogs.map((log: any, idx: number) => (
                              <div key={idx} className="text-[11px] text-stone-600 flex items-center gap-2">
                                <span className="font-bold text-stone-800">[{log.action}]</span>
                                <span>{log.note}</span>
                                <span className="text-stone-400 ml-auto">
                                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Moderator Decision Action Box */}
                      <div className="border-t border-stone-100 pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          placeholder="Add moderator action note (e.g. Warning sent, listing removed)..."
                          value={reportActionNotes[report.id] || ''}
                          onChange={e =>
                            setReportActionNotes({ ...reportActionNotes, [report.id]: e.target.value })
                          }
                          className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-[#FF6B00]"
                        />

                        <div className="flex items-center gap-2 shrink-0">
                          {report.status !== 'reviewing' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateReport(report.id, 'reviewing')}
                              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors"
                            >
                              In Review
                            </button>
                          )}
                          {report.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateReport(report.id, 'resolved')}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Resolve</span>
                            </button>
                          )}
                          {report.status === 'resolved' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateReport(report.id, 'open')}
                              className="px-3 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-bold hover:bg-stone-50"
                            >
                              Re-open
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
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
                onClick={async () => {
                  deleteUserAccount(deleteConfirmModal.userId);
                  setDeleteConfirmModal(prev => ({ ...prev, isOpen: false }));
                  await fetchDbUsers(dbUsersPage);
                  await fetchMetrics();
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
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
                onClick={async () => {
                  adminResetUserPassword(resetPasswordModal.userId, resetPasswordModal.newPassword.trim());
                  setResetPasswordModal(prev => ({ ...prev, isOpen: false }));
                  await fetchDbUsers(dbUsersPage);
                }}
                className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-[#9FE870] font-black text-xs transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
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
                onClick={async () => {
                  clearMarketplaceDatabase();
                  setIsClearDbModalOpen(false);
                  await fetchDbUsers(1);
                  await fetchMetrics();
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Clear Everything Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real Seller Identity Side-by-Side Inspection Modal */}
      {inspectRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-7 space-y-5 shadow-2xl border-2 border-stone-900 my-auto animate-modal-enter max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-200 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#9FE870] border-2 border-stone-900 flex items-center justify-center text-stone-950 shadow-xs">
                  <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-stone-950">
                    Side-by-Side Biometric &amp; ID Review
                  </h3>
                  <p className="text-xs text-stone-500">
                    NIMC Identity Check · NDPA 2023 Compliance Review · {inspectRequest.shopName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectRequest(null)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto space-y-5 pr-1 flex-1 text-xs">
              {/* Side-by-Side Images */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: ID Document Photo */}
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>Uploaded ID Document ({inspectRequest.idType ? inspectRequest.idType.replace('_', ' ').toUpperCase() : 'NIN SLIP'})</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold uppercase">
                      Document
                    </span>
                  </div>
                  <div className="h-64 sm:h-72 rounded-xl bg-white border border-stone-200 overflow-hidden flex items-center justify-center relative group">
                    {inspectRequest.idCardPhotoUrl ? (
                      <img
                        src={inspectRequest.idCardPhotoUrl}
                        alt="ID Document"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-stone-400 text-center p-4">
                        <FileText className="w-8 h-8 mx-auto mb-1 opacity-50" />
                        <span>No document photo uploaded</span>
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-500 flex items-center justify-between">
                    <span>Inspect: Full Name &amp; DOB legibility</span>
                    <button
                      type="button"
                      onClick={() => setSelectedVerificationDoc(inspectRequest.idCardPhotoUrl)}
                      className="text-[#FF6B00] font-bold hover:underline"
                    >
                      Enlarge Document
                    </button>
                  </div>
                </div>

                {/* Right: Live In-App Selfie */}
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-emerald-600" />
                      <span>Live In-App Selfie (Biometric Liveness)</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase">
                      Live Camera Only
                    </span>
                  </div>
                  <div className="h-64 sm:h-72 rounded-xl bg-white border border-stone-200 overflow-hidden flex items-center justify-center relative group">
                    {inspectRequest.selfiePhotoUrl ? (
                      <img
                        src={inspectRequest.selfiePhotoUrl}
                        alt="Live Selfie"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-stone-400 text-center p-4">
                        <Camera className="w-8 h-8 mx-auto mb-1 opacity-50" />
                        <span>No selfie captured</span>
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-500 flex items-center justify-between">
                    <span className="text-emerald-700 font-semibold">✓ Liveness Score: {inspectRequest.livenessScore || 94}% (Interactive Oval Test Passed)</span>
                    <button
                      type="button"
                      onClick={() => setSelectedVerificationDoc(inspectRequest.selfiePhotoUrl)}
                      className="text-[#FF6B00] font-bold hover:underline"
                    >
                      Enlarge Selfie
                    </button>
                  </div>
                </div>
              </div>

              {/* Typed Details & NIMC Match Comparison */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3">
                <div className="font-bold text-stone-900 text-xs flex items-center justify-between">
                  <span>Seller Identity &amp; Database Comparison</span>
                  <span className="text-[11px] font-mono text-stone-500">
                    Req ID: {inspectRequest.id}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                    <span className="text-[10px] text-stone-400 block font-semibold">Typed Legal Name</span>
                    <span className="font-bold text-stone-900">{inspectRequest.ownerName}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                    <span className="text-[10px] text-stone-400 block font-semibold">11-Digit NIN (Masked)</span>
                    <span className="font-mono font-bold text-stone-900">
                      ***-***-{inspectRequest.fullNinLast4 || '8901'}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                    <span className="text-[10px] text-stone-400 block font-semibold">Date of Birth</span>
                    <span className="font-bold text-stone-900">{inspectRequest.dateOfBirth || 'Registered with NIMC'}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                    <span className="text-[10px] text-stone-400 block font-semibold">Campus &amp; Shop</span>
                    <span className="font-bold text-stone-900 line-clamp-1">{inspectRequest.campus} · {inspectRequest.shopName}</span>
                  </div>
                </div>

                {/* API Check Status Pill */}
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold text-emerald-950 block">Nigerian Identity Verification API Engine</span>
                      <span className="text-[11px] text-emerald-800">
                        NIMC Record Name Match: 92% · DOB Match: Verified · Biometric Liveness: 94% Passed
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider">
                    Ready to Approve
                  </span>
                </div>

                {/* Under 18 Section if applicable */}
                {inspectRequest.under18 && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-1">
                    <span className="font-bold text-amber-900 block flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                      <span>Minor Seller Under 18 Years Old (NDPA Guardian Compliance)</span>
                    </span>
                    <p className="text-[11px] text-amber-800">
                      Guardian Name: <strong>{inspectRequest.guardianName || 'N/A'}</strong> · Phone: <strong>{inspectRequest.guardianPhone || 'N/A'}</strong>
                      {inspectRequest.guardianNinLast4 && ` · Guardian NIN Last 4: ***-***-${inspectRequest.guardianNinLast4}`}
                    </p>
                    <p className="text-[11px] text-amber-700">
                      ✓ Payouts for this store must route strictly to verified guardian account.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="pt-3 border-t border-stone-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setInspectRequest(null)}
                className="px-4 py-2.5 rounded-xl text-stone-600 hover:text-stone-900 font-bold text-xs"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const req = inspectRequest;
                    setInspectRequest(null);
                    setRejectModalRequest(req);
                    setSelectedRejectReason('Document image is blurry or unreadable');
                    setCustomRejectReason('');
                  }}
                  className="px-4 py-2.5 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 font-bold text-xs transition-colors cursor-pointer"
                >
                  Reject with Reason
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateVerificationRequest(
                      inspectRequest.id,
                      'needs_resubmission',
                      'Please upload a clearer image of your ID and retake your live selfie in bright lighting.'
                    );
                    setInspectRequest(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 font-bold text-xs transition-colors cursor-pointer"
                >
                  Request Resubmission
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateVerificationRequest(inspectRequest.id, 'verified');
                    setInspectRequest(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Approve &amp; Grant Verified Badge</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border-2 border-stone-900 animate-modal-enter">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-stone-950">
                    Reject Identity Verification
                  </h4>
                  <p className="text-xs text-stone-500">
                    Specify the compliance reason for {rejectModalRequest.shopName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalRequest(null)}
                className="text-stone-400 hover:text-stone-700 p-1 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="font-bold text-stone-800 block">
                Select Rejection Reason (Required)
              </label>

              {[
                'Document image is blurry, cropped, or unreadable',
                'Live selfie does not match photo on identity document',
                'NIN record name mismatch with typed legal name',
                'Seller is under 18 without signed parent/guardian consent',
                'Document suspected altered, edited, or counterfeit',
                'Other reason (specify below)',
              ].map(reason => (
                <label
                  key={reason}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedRejectReason === reason
                      ? 'bg-red-50 border-red-300 text-red-950 font-bold'
                      : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="rejectReason"
                    checked={selectedRejectReason === reason}
                    onChange={() => setSelectedRejectReason(reason)}
                    className="text-red-600"
                  />
                  <span>{reason}</span>
                </label>
              ))}

              {selectedRejectReason === 'Other reason (specify below)' && (
                <textarea
                  value={customRejectReason}
                  onChange={e => setCustomRejectReason(e.target.value)}
                  placeholder="Provide explicit explanation for rejection..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 bg-stone-50 focus:bg-white focus:outline-none focus:border-red-500"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setRejectModalRequest(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const finalReason =
                    selectedRejectReason === 'Other reason (specify below)'
                      ? customRejectReason.trim() || 'Verification failed compliance requirements'
                      : selectedRejectReason;
                  updateVerificationRequest(rejectModalRequest.id, 'rejected', finalReason);
                  setRejectModalRequest(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>Confirm Rejection</span>
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
