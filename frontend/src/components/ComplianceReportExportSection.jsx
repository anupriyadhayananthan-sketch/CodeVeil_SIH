import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, RefreshCw, Send, FileText, ShieldCheck, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { parseApiError } from '../utils/apiError';

export const ComplianceReportExportSection = ({ bidder, onRefreshBidder }) => {
  const { token } = useAuth();
  const [resending, setResending] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  if (!bidder) return null;

  const handleResendReport = async () => {
    setResending(true);
    setMsg({ text: '', type: '' });

    try {
      const res = await fetch(`/api/bidders/${bidder.id}/resend-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(parseApiError(data.detail));
      }

      setMsg({ text: data.message || 'Compliance report re-sent successfully.', type: 'success' });
      if (onRefreshBidder) onRefreshBidder();
    } catch (err) {
      setMsg({ text: err.message || 'Failed to resend compliance report.', type: 'error' });
    } finally {
      setResending(false);
    }
  };

  const isSent = bidder.last_report_status === 'SENT';
  const isFailed = bidder.last_report_status === 'FAILED';

  return (
    <div className="p-6 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Compliance Report Export & Bidder Notification
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Automated formal audit report delivery & registered bidder communications.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResendReport}
          disabled={resending || !bidder.email}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-blue-700 dark:hover:bg-blue-800 font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
          {resending ? 'Dispatching...' : 'Resend Report'}
        </button>
      </div>

      {msg.text && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
          msg.type === 'success' 
            ? 'bg-emerald-100 border border-emerald-300 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200' 
            : 'bg-rose-100 border border-rose-300 text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold">
        {/* Recipient Card */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
          <span className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400">Registered Recipient</span>
          <p className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate" title={bidder.email}>
            {bidder.email || 'No email registered'}
          </p>
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
            <ShieldCheck className="w-3 h-3" /> Verified Address
          </span>
        </div>

        {/* Dispatch Status Card */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
          <span className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400">Delivery Status</span>
          <div>
            {isSent ? (
              <span className="px-2 py-0.5 text-[11px] font-black rounded bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200">
                DELIVERED (SENT)
              </span>
            ) : isFailed ? (
              <span className="px-2 py-0.5 text-[11px] font-black rounded bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950 dark:text-rose-200">
                DELIVERY FAILED
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[11px] font-black rounded bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200">
                PENDING DECISION
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Refmitted Verdict: <strong>{bidder.status || 'PENDING'}</strong>
          </p>
        </div>

        {/* Timestamp Card */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1">
          <span className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Last Dispatched
          </span>
          <p className="text-xs font-bold text-slate-900 dark:text-white">
            {bidder.last_report_sent_at 
              ? new Date(bidder.last_report_sent_at).toLocaleString() 
              : 'Not dispatched yet'}
          </p>
          <p className="text-[10px] text-slate-500">Auto-sent on verdict save</p>
        </div>
      </div>

      {isFailed && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Delivery failed — retry using the button above or contact bidder manually at <strong>{bidder.email}</strong>.</span>
        </div>
      )}
    </div>
  );
};
