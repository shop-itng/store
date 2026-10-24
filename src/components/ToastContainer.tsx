import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { notifications, dismissNotification } = useApp();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.map(n => (
        <div
          key={n.id}
          className={`pointer-events-auto p-3.5 rounded-xl border shadow-lg text-xs flex items-center justify-between gap-3 transition-all animate-in slide-in-from-bottom-2 ${
            n.type === 'success'
              ? 'bg-slate-900 text-white border-slate-800'
              : n.type === 'error'
              ? 'bg-rose-950 text-rose-100 border-rose-800'
              : 'bg-white text-slate-900 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {n.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {n.type === 'info' && <Info className="w-4 h-4 text-slate-500 shrink-0" />}
            <span className="font-medium leading-snug">{n.message}</span>
          </div>
          <button
            onClick={() => dismissNotification(n.id)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
