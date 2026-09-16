import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Award, CheckCircle2, AlertCircle, RefreshCw, BarChart2 } from 'lucide-react';

export const AccuracyTestingPage = () => {
  const { token } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runBenchmark();
  }, []);

  const runBenchmark = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accuracy/benchmark', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) setReport(await res.json());
    } catch (err) {
      console.error("Benchmark error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Ground-Truth Accuracy & Benchmark Suite</h1>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">
            Real precision/recall valuation running the rules engine against MANIFEST.csv ground-truth test cases.
          </p>
        </div>

        <button
          onClick={runBenchmark}
          disabled={loading}
          className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Run MANIFEST Ground-Truth Audit
        </button>
      </div>

      {report && (
        <div className="space-y-6">
          {/* Executive Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Exact Match Accuracy</span>
              <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400">{report.overall_accuracy_pct}%</p>
              <p className="text-xs text-slate-500 font-semibold">{report.exact_matches} / {report.total_bidders} archetype test cases</p>
            </div>

            <div className="p-5 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Precision Score</span>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{(report.precision * 100).toFixed(1)}%</p>
              <p className="text-xs text-slate-500 font-semibold">True Positive ratio</p>
            </div>

            <div className="p-5 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Recall Score</span>
              <p className="text-3xl font-black text-blue-700 dark:text-blue-400">{(report.recall * 100).toFixed(1)}%</p>
              <p className="text-xs text-slate-500 font-semibold">Sensitivity / Coverage</p>
            </div>

            <div className="p-5 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">F1 Score Metric</span>
              <p className="text-3xl font-black text-indigo-700 dark:text-indigo-400">{(report.f1_score * 100).toFixed(1)}%</p>
              <p className="text-xs text-slate-500 font-semibold">Harmonic Mean</p>
            </div>
          </div>

          {/* Archetype Breakdown Table */}
          <div className="p-6 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              15 Bidder Archetypes Ground-Truth Results
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 dark:bg-slate-950 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase">
                    <th className="p-3">Bidder Entity</th>
                    <th className="p-3">Archetype</th>
                    <th className="p-3">Ground Truth</th>
                    <th className="p-3">Computed Verdict</th>
                    <th className="p-3">Compliance Score</th>
                    <th className="p-3">Benchmark Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-300 font-medium">
                  {report.archetype_results?.map((res, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3 font-extrabold text-slate-900 dark:text-white">{res.legal_name}</td>
                      <td className="p-3 font-bold text-blue-700 dark:text-blue-400">{res.archetype}</td>
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-300">{res.expected_status}</td>
                      <td className="p-3 font-black text-slate-900 dark:text-white">{res.computed_status}</td>
                      <td className="p-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">{res.compliance_score}%</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black ${
                          res.match ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {res.match ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
                          {res.match ? 'EXACT MATCH' : 'MISMATCH'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
