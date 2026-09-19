import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Network, AlertTriangle, ShieldAlert, Cpu, BarChart2, Activity, CheckCircle2 } from 'lucide-react';
import { BidderRelationshipGraph } from '../components/BidderRelationshipGraph';

export const RiskCollusionPage = () => {
  const { token } = useAuth();
  const [tenderId, setTenderId] = useState(1);
  const [tenders, setTenders] = useState([]);

  const [priceRigging, setPriceRigging] = useState(null);
  const [networkGraph, setNetworkGraph] = useState(null);
  const [mlMetrics, setMlMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTenders();
    fetchCollusionData(1);
  }, []);

  const fetchTenders = async () => {
    try {
      const res = await fetch('/api/tenders', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setTenders(data);
      }
    } catch (err) {
      console.error("Fetch tenders error:", err);
    }
  };

  const fetchCollusionData = async (tId) => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [prRes, ngRes, mlRes] = await Promise.all([
        fetch(`/api/collusion/price-rigging/${tId}`, { headers }),
        fetch('/api/collusion/network-graph', { headers }),
        fetch('/api/collusion/ml-risk-metrics', { headers })
      ]);

      if (prRes.ok) setPriceRigging(await prRes.json());
      if (ngRes.ok) setNetworkGraph(await ngRes.json());
      if (mlRes.ok) setMlMetrics(await mlRes.json());
    } catch (err) {
      console.error("Fetch collusion data error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header & Tender Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Risk & Collusion Intelligence Engine
          </h1>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Bid-rigging price variance screens (CoV & Skewness), NetworkX shell-company graph analysis, and trained ML risk classifier metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Select Tender:</span>
          <select
            value={tenderId}
            onChange={(e) => {
              const val = Number(e.target.value);
              setTenderId(val);
              fetchCollusionData(val);
            }}
            className="px-3.5 py-2 bg-white border border-slate-300 dark:bg-slate-900 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white shadow-xs"
          >
            {tenders.map(t => (
              <option key={t.id} value={t.id}>{t.tender_number} — {t.title.substring(0, 30)}...</option>
            ))}
          </select>
        </div>
      </div>

      {/* Feature Section: Production-Quality Interactive NetworkX Bidder Relationship Graph */}
      <BidderRelationshipGraph selectedTenderId={tenderId} />

      {/* Screen 1: Bid-Price Rigging CoV Analysis */}
      {priceRigging && (
        <div className="p-6 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Bid-Price Variance & Cover-Bidding Screen (CoV / Skewness)
            </h2>
            <span className={`px-3 py-1 text-xs font-black rounded-full border ${priceRigging.rigging_risk_flag
                ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800'
                : 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800'
              }`}>
              {priceRigging.rigging_risk_flag ? 'COLLUSION RISK FLAG DETECTED' : 'NORMAL VARIANCE'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl space-y-1">
              <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Coefficient of Variation (CoV)</span>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{priceRigging.cov_percent}%</p>
              <p className="text-[11px] text-slate-500 font-semibold">Flag threshold: &lt; 1.5%</p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl space-y-1">
              <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Price Spread</span>
              <p className="text-3xl font-black text-blue-700 dark:text-blue-400">{priceRigging.spread_percent}%</p>
              <p className="text-[11px] text-slate-500 font-semibold">(Max - Min) / Min</p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl space-y-1">
              <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Distribution Skewness</span>
              <p className="text-3xl font-black text-slate-800 dark:text-slate-200">{priceRigging.skewness}</p>
              <p className="text-[11px] text-slate-500 font-semibold">3rd moment asymmetry</p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl space-y-1">
              <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Mean Bid Price</span>
              <p className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">₹{(priceRigging.mean_price || 0).toLocaleString('en-IN')}</p>
              <p className="text-[11px] text-slate-500 font-semibold">Average quoted value</p>
            </div>
          </div>

          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 leading-relaxed">
            <strong className="text-slate-900 dark:text-white">Statistical Screening Rationale:</strong> {priceRigging.risk_reason}
          </p>
        </div>
      )}





    </div>
  );
};
