import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { parseApiError } from '../utils/apiError';
import { EmptyState } from '../components/EmptyState';
import { Users, Filter, ArrowUpDown, ShieldAlert, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';

export const BidderComparisonPage = ({ setCurrentTab, setSelectedTenderId }) => {
  const { token } = useAuth();
  const [tenders, setTenders] = useState([]);
  const [activeTenderId, setActiveTenderId] = useState(1);
  const [bidders, setBidders] = useState([]);
  const [filterRisk, setFilterRisk] = useState('ALL');
  const [sortBy, setSortBy] = useState('score');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchTenders();
  }, []);

  useEffect(() => {
    if (activeTenderId) fetchBidders(activeTenderId);
  }, [activeTenderId]);

  const fetchTenders = async () => {
    try {
      const res = await fetch('/api/tenders', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setTenders(data);
        if (data.length > 0) setActiveTenderId(data[0].id);
      }
    } catch (err) {
      console.error("Fetch tenders error:", err);
    }
  };

  const fetchBidders = async (tId) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/bidders/tender/${tId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        const errData = await res.json();
        setErrorMsg(parseApiError(errData.detail));
        setBidders([]);
        return;
      }
      setBidders(await res.json());
    } catch (err) {
      console.error("Fetch bidders error:", err);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtering & Sorting
  let filtered = bidders.filter(b => {
    if (filterRisk === 'HIGH') return b.risk_level === 'High';
    if (filterRisk === 'MEDIUM') return b.risk_level === 'Medium';
    if (filterRisk === 'LOW') return b.risk_level === 'Low';
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'score') return b.compliance_score - a.compliance_score;
    if (sortBy === 'price') return (a.bid_amount_inr || 0) - (b.bid_amount_inr || 0);
    return a.legal_name.localeCompare(b.legal_name);
  });

  const currentTender = tenders.find(t => t.id === Number(activeTenderId));

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Bidder Comparison Matrix</h1>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">Comparative compliance evaluation, risk classification, and bid pricing across all submitting entities.</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Select Tender:</span>
          <select
            value={activeTenderId}
            onChange={(e) => setActiveTenderId(Number(e.target.value))}
            className="px-3.5 py-2 bg-white border border-slate-300 dark:bg-slate-900 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white shadow-xs"
          >
            {tenders.map(t => (
              <option key={t.id} value={t.id}>{t.tender_number} — {t.title.substring(0, 30)}...</option>
            ))}
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-100 border border-rose-300 text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200 rounded-xl text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* Filter and Controls Bar */}
      {bidders.length > 0 && (
        <div className="p-4 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
              <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Risk Filter:
            </span>
            <button
              onClick={() => setFilterRisk('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${filterRisk === 'ALL' ? 'bg-blue-700 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:hover:text-white'}`}
            >
              All ({bidders.length})
            </button>
            <button
              onClick={() => setFilterRisk('HIGH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${filterRisk === 'HIGH' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:hover:text-white'}`}
            >
              High Risk ({bidders.filter(b => b.risk_level === 'High').length})
            </button>
            <button
              onClick={() => setFilterRisk('MEDIUM')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${filterRisk === 'MEDIUM' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:hover:text-white'}`}
            >
              Medium ({bidders.filter(b => b.risk_level === 'Medium').length})
            </button>
            <button
              onClick={() => setFilterRisk('LOW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${filterRisk === 'LOW' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:hover:text-white'}`}
            >
              Low ({bidders.filter(b => b.risk_level === 'Low').length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1 uppercase tracking-wider">
              <ArrowUpDown className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Sort By:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white shadow-xs"
            >
              <option value="score">Compliance Score % (High to Low)</option>
              <option value="price">Bid Price (L1 Lowest First)</option>
              <option value="name">Legal Name A-Z</option>
            </select>
          </div>
        </div>
      )}

      {/* Empty State when 0 bidders exist */}
      {!loading && bidders.length === 0 && (
        <EmptyState
          tender={currentTender}
          onSwitchToSeededTender={() => {
            const seeded = tenders.find(t => t.tender_number.includes('SAFETY-001')) || tenders[0];
            if (seeded) setActiveTenderId(seeded.id);
          }}
          onBiddersSeeded={() => fetchBidders(activeTenderId)}
        />
      )}

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((b) => (
          <div key={b.id} className="p-6 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between hover:border-blue-400 transition">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 text-xs font-black bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 rounded-md">
                  {b.archetype}
                </span>
                <span className={`px-2.5 py-0.5 text-xs font-black rounded-md border ${
                  b.risk_level === 'High' ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800' :
                  b.risk_level === 'Medium' ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800' :
                  'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800'
                }`}>
                  Risk: {b.risk_level}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white leading-snug">{b.legal_name}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono font-bold mt-0.5">PAN: {b.pan || 'N/A'}</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-bold">Compliance Score:</span>
                  <span className="font-black text-slate-900 dark:text-white text-base">{b.compliance_score}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-bold">Quoted Bid Amount:</span>
                  <span className="font-mono font-black text-blue-700 dark:text-blue-400 text-sm">₹{(b.bid_amount_inr || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-bold">Officer Decision:</span>
                  <span className={`font-black ${
                    b.status === 'QUALIFIED' ? 'text-emerald-700 dark:text-emerald-400' :
                    b.status === 'REJECTED' ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'
                  }`}>{b.status}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
              <button
                onClick={() => {
                  if (setSelectedTenderId) setSelectedTenderId(activeTenderId);
                  setCurrentTab('requirement-matrix');
                }}
                className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-200 dark:border-blue-800 rounded-xl font-bold flex items-center justify-center gap-1.5 transition"
              >
                Inspect Matrix & Evidence
                <ArrowRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
