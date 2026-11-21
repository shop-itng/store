import React from 'react';
import { Order, OrderStatus } from '../types';
import {
  Check,
  Clock,
  ShieldCheck,
  Package,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  XCircle,
} from 'lucide-react';

interface OrderProgressTrackerProps {
  order: Pick<
    Order,
    | 'id'
    | 'status'
    | 'createdAt'
    | 'packedAt'
    | 'shippedAt'
    | 'deliveredAt'
    | 'completedAt'
    | 'deliveryArea'
    | 'safeMeetingSpotName'
    | 'pickupPoint'
    | 'disputeReason'
    | 'packedPhotoUrl'
  >;
  viewerRole?: 'buyer' | 'seller';
  compact?: boolean;
  className?: string;
}

interface StageDefinition {
  id: 'placed' | 'escrow_held' | 'pickup_ready' | 'completed';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  sublabel: string;
  timestamp?: string;
}

function formatShortTime(iso?: string): string | undefined {
  if (!iso) return undefined;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveProgressState(
  status: OrderStatus,
  order: OrderProgressTrackerProps['order'],
  viewerRole: 'buyer' | 'seller'
) {
  const pickupTarget = order.safeMeetingSpotName || order.pickupPoint || order.deliveryArea || 'Safe Spot';

  const stages: StageDefinition[] = [
    {
      id: 'placed',
      label: 'Placed',
      icon: Clock,
      sublabel: status === 'pending_payment' ? 'Awaiting payment' : 'Order confirmed',
      timestamp: formatShortTime(order.createdAt),
    },
    {
      id: 'escrow_held',
      label: 'Escrow Held',
      icon: status === 'packed' ? Package : ShieldCheck,
      sublabel:
        status === 'packed'
          ? 'Packed & photo verified'
          : status === 'paid'
          ? viewerRole === 'seller'
            ? 'Pack & upload proof'
            : 'Seller preparing craft'
          : 'Funds secured',
      timestamp: formatShortTime(order.packedAt),
    },
    {
      id: 'pickup_ready',
      label: 'Pickup Ready',
      icon: MapPin,
      sublabel:
        status === 'delivered'
          ? `At ${pickupTarget}`
          : status === 'shipped'
          ? `En route to ${pickupTarget}`
          : 'Campus handoff',
      timestamp: formatShortTime(order.deliveredAt || order.shippedAt),
    },
    {
      id: 'completed',
      label: 'Completed',
      icon: CheckCircle2,
      sublabel: status === 'completed' ? 'Escrow released' : 'Buyer confirmation',
      timestamp: formatShortTime(order.completedAt),
    },
  ];

  // Determine active stage index (0..3), fill percent along the 3 track segments, and summary copy
  switch (status) {
    case 'pending_payment':
      return {
        stages,
        completedThroughIndex: -1,
        activeIndex: 0,
        progressPercent: 8,
        headline: 'Order Placed · Awaiting Payment',
        detail: 'Complete Flutterwave checkout within 30 minutes to lock funds into escrow.',
        isHalted: false as const,
      };
    case 'paid':
      return {
        stages,
        completedThroughIndex: 0,
        activeIndex: 1,
        progressPercent: 33,
        headline: 'Escrow Held · Preparing Order',
        detail:
          viewerRole === 'seller'
            ? 'Buyer payment is secured in escrow. Upload a packing photo to mark as Packed.'
            : 'Payment confirmed and locked safely in escrow while the seller prepares your item.',
        isHalted: false as const,
      };
    case 'packed':
      return {
        stages,
        completedThroughIndex: 0,
        activeIndex: 1,
        progressPercent: 50,
        headline: 'Escrow Held · Packed & Photo Verified',
        detail:
          viewerRole === 'seller'
            ? 'Packing proof saved. Dispatch to the safe campus spot to advance.'
            : 'The artisan packed and photographed your order and is getting ready to dispatch.',
        isHalted: false as const,
      };
    case 'shipped':
      return {
        stages,
        completedThroughIndex: 1,
        activeIndex: 2,
        progressPercent: 68,
        headline: `Pickup Ready · En Route to ${pickupTarget}`,
        detail: `Item has been dispatched toward ${pickupTarget}. Inspect carefully before releasing your PIN.`,
        isHalted: false as const,
      };
    case 'delivered':
      return {
        stages,
        completedThroughIndex: 1,
        activeIndex: 2,
        progressPercent: 86,
        headline: `Pickup Ready · Arrived at ${pickupTarget}`,
        detail:
          viewerRole === 'seller'
            ? 'Delivered. Enter the buyer Handshake PIN or wait for confirmation to unlock funds.'
            : 'Your item is ready for inspection. Confirm receipt once satisfied to release escrow.',
        isHalted: false as const,
      };
    case 'completed':
      return {
        stages,
        completedThroughIndex: 3,
        activeIndex: 3,
        progressPercent: 100,
        headline: 'Completed · Escrow Funds Released',
        detail: 'Delivery confirmed and payment released to the seller wallet.',
        isHalted: false as const,
      };
    case 'disputed': {
      const reachedStage = order.deliveredAt || order.shippedAt ? 2 : order.packedAt ? 1 : 0;
      return {
        stages,
        completedThroughIndex: Math.max(0, reachedStage - 1),
        activeIndex: reachedStage,
        progressPercent: reachedStage === 2 ? 67 : reachedStage === 1 ? 33 : 10,
        headline: 'Dispute Open · Escrow Frozen',
        detail:
          order.disputeReason ||
          'Order is paused under moderation review. Escrow funds remain safely frozen.',
        isHalted: 'disputed' as const,
      };
    }
    case 'refunded':
      return {
        stages,
        completedThroughIndex: 0,
        activeIndex: -1,
        progressPercent: 0,
        headline: 'Order Refunded',
        detail: order.disputeReason || 'Escrow payment has been returned to the buyer.',
        isHalted: 'refunded' as const,
      };
    case 'cancelled':
    default:
      return {
        stages,
        completedThroughIndex: -1,
        activeIndex: -1,
        progressPercent: 0,
        headline: 'Order Cancelled',
        detail: order.disputeReason || 'This order was cancelled and any held payment was refunded.',
        isHalted: 'cancelled' as const,
      };
  }
}

export const OrderProgressTracker: React.FC<OrderProgressTrackerProps> = ({
  order,
  viewerRole = 'buyer',
  compact = false,
  className = '',
}) => {
  const state = resolveProgressState(order.status, order, viewerRole);
  const { stages, completedThroughIndex, activeIndex, progressPercent, headline, detail, isHalted } =
    state;

  const isTerminalNegative = isHalted === 'cancelled' || isHalted === 'refunded';
  const currentStepNumber =
    order.status === 'completed'
      ? stages.length
      : activeIndex >= 0
      ? activeIndex + 1
      : 0;

  return (
    <section
      aria-label={`Order progress for ${order.id}`}
      className={`py-3 border-y border-slate-100 dark:border-[#27272A] space-y-3 ${className}`}
    >
      {/* Top summary line — unboxed editorial metadata with typographic separator */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2 min-w-0">
          {isHalted === 'disputed' ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          ) : isHalted === 'refunded' ? (
            <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          ) : isHalted === 'cancelled' ? (
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          ) : order.status === 'completed' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#9FE870] shrink-0" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-[#FF6B00] shrink-0" />
          )}
          <span
            className={`text-xs font-bold tracking-tight truncate ${
              isHalted === 'cancelled' || isHalted === 'refunded'
                ? 'text-rose-700 dark:text-rose-400'
                : isHalted === 'disputed'
                ? 'text-amber-800 dark:text-amber-300'
                : 'text-[#111111] dark:text-[#F4F4F5]'
            }`}
          >
            {headline}
          </span>
        </div>

        {!isTerminalNegative && (
          <span className="text-[11px] font-medium text-slate-500 dark:text-[#A1A1AA] tabular-nums whitespace-nowrap shrink-0">
            Stage {currentStepNumber} of {stages.length}
          </span>
        )}
      </div>

      {!compact && (
        <p className="text-xs text-slate-600 dark:text-[#A1A1AA] leading-relaxed">
          {detail}
        </p>
      )}

      {/* Horizontal visual step bar (cleanly spaced for mobile and desktop) */}
      {!isTerminalNegative && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          aria-valuetext={headline}
          className="relative pt-1"
        >
          {/* Background connecting rail across stage centers */}
          <div
            aria-hidden="true"
            className="absolute top-[19px] left-[12.5%] right-[12.5%] h-[3px] rounded-full bg-slate-200 dark:bg-[#27272A] overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-300 ease-out ${
                isHalted === 'disputed'
                  ? 'bg-amber-500'
                  : order.status === 'completed'
                  ? 'bg-emerald-600 dark:bg-[#9FE870]'
                  : 'bg-[#FF6B00]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <ol className="relative z-10 grid grid-cols-4 gap-1.5 sm:gap-3">
            {stages.map((stage, idx) => {
              const Icon = stage.icon;
              const isCompleted =
                order.status === 'completed' ? true : idx <= completedThroughIndex;
              const isCurrent = order.status !== 'completed' && idx === activeIndex;
              const isDisputedHere = isHalted === 'disputed' && isCurrent;

              return (
                <li
                  key={stage.id}
                  aria-current={isCurrent ? 'step' : undefined}
                  className="flex flex-col items-center text-center min-w-0"
                >
                  {/* Milestone node */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-200 shrink-0 ${
                      isCompleted
                        ? 'bg-[#111111] dark:bg-[#9FE870] border-[#111111] dark:border-[#9FE870] text-[#9FE870] dark:text-[#111111]'
                        : isDisputedHere
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-700 dark:text-amber-300'
                        : isCurrent
                        ? 'bg-[#FF6B00] border-[#111111] dark:border-[#FF6B00] text-[#111111] shadow-[0_2px_0_#111111] dark:shadow-none'
                        : 'bg-white dark:bg-[#15161C] border-slate-300 dark:border-[#27272A] text-slate-400 dark:text-[#71717A]'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    ) : isDisputedHere ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                  </div>

                  {/* Stage label */}
                  <span
                    className={`mt-2 text-[11px] sm:text-xs font-bold leading-tight whitespace-nowrap truncate max-w-full ${
                      isCompleted || isCurrent
                        ? 'text-[#111111] dark:text-[#F4F4F5]'
                        : 'text-slate-400 dark:text-[#71717A] font-medium'
                    }`}
                  >
                    {stage.label}
                  </span>

                  {/* Dynamic status detail + timestamp */}
                  {!compact && (
                    <span className="mt-0.5 text-[10px] text-slate-500 dark:text-[#A1A1AA] leading-tight line-clamp-2 hidden sm:block">
                      {stage.timestamp ? (
                        <span className="tabular-nums">{stage.timestamp}</span>
                      ) : (
                        stage.sublabel
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
};
