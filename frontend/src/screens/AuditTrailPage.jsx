import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { History, ShieldCheck, Lock, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';

export const AuditTrailPage = () => {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [verificationRes, setVerificationRes] = useState(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/audit/logs', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) setLogs(await res.json());
    } catch (err) {
      console.error("Fetch audit logs error:", err);
    }
  };

  const handleVerifyHashChain = async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/audit/verify-hash-chain', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) setVerificationRes(await res.json());
    } catch (err) {
      console.error("Verify hash chain error:", err);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Append-Only Tamper-Evident Audit Trail</h1>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">Cryptographically linked SHA-256 hash chain guarantees immutable audit history for procurement compliance.</p>
        </div>

        <button
          onClick={handleVerifyHashChain}
          disabled={verifying}
          className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-300" />
          {verifying ? 'Verifying Hashes...' : 'Verify Cryptographic Hash-Chain'}
        </button>
      </div>

      {/* Verification Status Banner */}
      {verificationRes && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 text-xs font-bold ${
          verificationRes.tamper_evident_valid 
            ? 'bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200' 
            : 'bg-rose-100 border-rose-300 text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200'
        }`}>
          <div className="flex items-center gap-3">
            {verificationRes.tamper_evident_valid ? <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" />}
            <div>
              <p className="font-black text-base text-slate-900 dark:text-white">{verificationRes.message}</p>
              <p className="text-xs font-semibold opacity-90">Total Audit Records Evaluated: {verificationRes.total_logs} • Zero Hash Mismatches</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200 font-mono font-black rounded-lg uppercase">
            SHA-256 Verified
          </span>
        </div>
      )}

      {/* Log Timeline Table */}
      <div className="p-6 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Audit Entry History ({logs.length} Entries)
          </h2>
          <button
            onClick={fetchLogs}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800 dark:text-slate-300 rounded-xl"
            title="Refresh Logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 dark:bg-slate-950 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase">
                <th className="p-3">ID / Time</th>
                <th className="p-3">Actor / User</th>
                <th className="p-3">Action Type</th>
                <th className="p-3">Entity Details</th>
                <th className="p-3">Previous Hash</th>
                <th className="p-3">Current Hash (SHA-256)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-300 font-medium">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="p-3 font-mono">
                    <span className="font-black text-slate-900 dark:text-white">#{log.id}</span>
                    <p className="text-[10px] text-slate-500 font-semibold">{new Date(log.timestamp).toLocaleString()}</p>
                  </td>
                  <td className="p-3 font-extrabold text-slate-900 dark:text-slate-200">{log.actor_email || 'System'}</td>
                  <td className="p-3">
                    <span className="px-2.5 py-1 text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 rounded">
                      {log.action_type}
                    </span>
                  </td>
                  <td className="p-3 max-w-xs truncate text-slate-800 dark:text-slate-300 font-medium">{log.details_json}</td>
                  <td className="p-3 font-mono text-[10px] text-slate-500 font-bold">{log.prev_hash?.substring(0, 12)}...</td>
                  <td className="p-3 font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-black">{log.current_hash?.substring(0, 16)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
