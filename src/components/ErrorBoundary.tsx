import React, { Component, ErrorInfo, ReactNode } from 'react';
import { captureAppError } from '../utils/sentry';
import { RefreshCw, Home, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureAppError(error, { componentStack: errorInfo.componentStack });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f9fafb] dark:bg-[#0D0E12] flex items-center justify-center p-4 text-[#111111] dark:text-white">
          <div className="bg-white dark:bg-[#15161C] border-2 border-[#111111] dark:border-[#27272A] rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 shadow-[0_4px_0_#111111] dark:shadow-none">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF4EC] dark:bg-[#201712] text-[#FF6B00] border-2 border-[#111111] flex items-center justify-center mx-auto shadow-[0_2px_0_#111111]">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#111111] text-[#9FE870] border border-[#111111]">
                Safety First
              </span>
              <h1 className="text-xl sm:text-2xl font-black">Something went wrong</h1>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                Don’t worry — your orders, escrow funds, and wallet balances are 100% safe. This glitch has been logged securely for our engineering team.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#FF6B00] hover:bg-[#FF7A1A] text-[#111111] border-2 border-[#111111] text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-[0_2px_0_#111111] active:translate-y-0.5"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#9FE870] hover:bg-[#AEF083] text-[#111111] border-2 border-[#111111] text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-[0_2px_0_#111111] active:translate-y-0.5"
              >
                <Home className="w-4 h-4" />
                <span>Return to Shop</span>
              </button>
            </div>

            <p className="text-[11px] text-stone-400 dark:text-stone-500">
              Need immediate help? Reach us at <strong className="text-stone-600 dark:text-stone-300">shopitverified@gmail.com</strong>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
