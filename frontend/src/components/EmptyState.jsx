import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, FileText, Upload, RefreshCw, Users, ShieldAlert } from 'lucide-react';

export const EmptyState = ({ tender, onSwitchToSeededTender, onBiddersSeeded }) => {
  const { token } = useAuth();
  const [seeding, setSeeding] = useState(false);
  const [msg, setMsg] = useState('');

  const handleAttachSampleBidders = async () => {
    if (!tender) return;
    setSeeding(true);
    setMsg('');
    try {
      const res = await fetch(`/api/tenders/${tender.id}/seed-sample-bidders`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      setMsg(data.message || 'Sample bidders attached!');
      if (onBiddersSeeded) onBiddersSeeded();
    } catch (err) {
      setMsg('Failed to attach sample bidders.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-6 max-w-2xl mx-auto my-8 shadow-md">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/10">
        <AlertCircle className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
          No Bidders Submitted Yet for {tender?.tender_number || 'This Tender'}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
          Tender <strong className="text-indigo-600 dark:text-indigo-300">"{tender?.title || tender?.tender_number}"</strong> was created successfully and has extracted clause requirements. However, no bidder compliance documents have been submitted for it yet.
        </p>
      </div>

      {msg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-bold">
          {msg}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {onSwitchToSeededTender && (
          <button
            onClick={onSwitchToSeededTender}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition"
          >
            <FileText className="w-4 h-4" />
            Switch to Seeded Tender (SAFETY-001)
          </button>
        )}

        <button
          onClick={handleAttachSampleBidders}
          disabled={seeding}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl flex items-center gap-2 transition"
        >
          <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          {seeding ? 'Attaching Bidders...' : 'Attach Demo Bidders to this Tender'}
        </button>
      </div>
    </div>
  );
};
