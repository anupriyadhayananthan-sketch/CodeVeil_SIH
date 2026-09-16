import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DeadlineCountdown } from '../components/DeadlineCountdown';
import { 
  FileText, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Activity, 
  ShieldAlert, 
  Upload, 
  Award, 
  Lock,
  ChevronRight
} from 'lucide-react';

export const HomePage = ({ setCurrentTab, setSelectedTenderId }) => {
  const { token, user } = useAuth();
  const [tenders, setTenders] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [tRes, aRes] = await Promise.all([
        fetch('/api/tenders', { headers }),
        fetch('/api/audit/logs', { headers })
      ]);

      if (tRes.ok) setTenders(await tRes.json());
      if (aRes.ok) setAuditLogs((await aRes.json()).slice(0, 5));
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const totalBidders = tenders.reduce((acc, t) => acc + (t.bidders?.length || 0), 0);
  const pendingReviewCount = tenders.reduce((acc, t) => {
    return acc + (t.bidders?.filter(b => b.status === 'PENDING').length || 0);
  }, 0);
  const highRiskCount = tenders.reduce((acc, t) => {
    return acc + (t.bidders?.filter(b => b.risk_level === 'High').length || 0);
  }, 0);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Banner / Welcome Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 border border-blue-700/40 p-8 shadow-md text-white">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-blue-200 text-xs font-bold uppercase tracking-wider">
              <span>CPCL Procurement Desk</span>
              <span>•</span>
              <span>GeM Approved</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">
              Welcome back, {user?.full_name || 'Procurement Officer'}
            </h1>
            <p className="text-sm font-medium text-blue-100/90 leading-relaxed">
              CodeVeil AI evaluates bidder submissions against official clause requirements using a deterministic rules engine. 
              Review extracted verification evidence, collusion flags, and record qualification decisions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setCurrentTab('tender-upload')}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2 transition"
            >
              <Upload className="w-4 h-4" />
              Upload Tender / Bidders
            </button>
            <button
              onClick={() => setCurrentTab('risk-collusion')}
              className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-black rounded-xl flex items-center gap-2 transition"
            >
              <ShieldAlert className="w-4 h-4 text-amber-300" />
              Collusion Screen
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active GeM Tenders</span>
            <div className="p-2.5 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-slate-900 dark:text-white">{tenders.length}</span>
            <span className="ml-2 text-xs font-bold text-slate-500 dark:text-slate-400">Scenarios</span>
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">CPCL Safety, Service & MSME tenders</p>
        </div>

        <div className="p-5 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Bidders Ingested</span>
            <div className="p-2.5 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-slate-900 dark:text-white">{totalBidders}</span>
            <span className="ml-2 text-xs font-bold text-slate-500 dark:text-slate-400">Evaluated</span>
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Archetype submissions</p>
        </div>

        <div className="p-5 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Officer Decision</span>
            <div className="p-2.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-slate-900 dark:text-white">{pendingReviewCount}</span>
            <span className="ml-2 text-xs font-black text-amber-700 dark:text-amber-400">Requires Action</span>
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mandatory officer sign-off</p>
        </div>

        <div className="p-5 rounded-2xl border bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-rose-800 dark:text-rose-300 uppercase tracking-wider">High Risk Compliance Flags</span>
            <div className="p-2.5 bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-rose-700 dark:text-rose-400">{highRiskCount}</span>
            <span className="ml-2 text-xs font-bold text-slate-600 dark:text-slate-400">High Risk</span>
          </div>
          <p className="text-xs font-bold text-rose-800 dark:text-rose-300">Hard requirement flaws detected</p>
        </div>
      </div>

      {/* Main Content Grid: Tenders list & Audit activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tenders Scenarios List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-700 dark:text-blue-400" />
              Active Tenders & Bid Compliance Status
            </h2>
            <button
              onClick={() => setCurrentTab('bidder-comparison')}
              className="text-xs font-black text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              Compare All Bidders <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {tenders.map((tender) => (
              <div
                key={tender.id}
                className="p-6 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-4 hover:border-blue-400 dark:hover:border-blue-700 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 text-xs font-black bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 rounded-md">
                        {tender.tender_number}
                      </span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{tender.category}</span>
                      <DeadlineCountdown submissionDeadline={tender.submission_deadline} isClosed={tender.is_closed} />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">{tender.title}</h3>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Authority: {tender.issuing_authority}</p>
                  </div>

                  <button
                    onClick={() => {
                      if (setSelectedTenderId) setSelectedTenderId(tender.id);
                      setCurrentTab('requirement-matrix');
                    }}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition self-start sm:self-center shadow-xs"
                  >
                    View Matrix & Evidence
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Bidder archetypes overview badges */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1">
                  {tender.bidders?.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => {
                        if (setSelectedTenderId) setSelectedTenderId(tender.id);
                        setCurrentTab('requirement-matrix');
                      }}
                      className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800/80 dark:border-slate-800 rounded-xl text-left cursor-pointer transition space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 truncate">{b.archetype}</span>
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          b.risk_level === 'High' ? 'bg-rose-600' :
                          b.risk_level === 'Medium' ? 'bg-amber-500' : 'bg-emerald-600'
                        }`} />
                      </div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate" title={b.legal_name}>{b.legal_name}</p>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400 font-semibold">Score: {b.compliance_score}%</span>
                        <span className={`font-black ${
                          b.status === 'QUALIFIED' ? 'text-emerald-700 dark:text-emerald-400' :
                          b.status === 'REJECTED' ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'
                        }`}>{b.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Activity Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-700 dark:text-blue-400" />
              Audit Trail Activity Feed
            </h2>
            <button
              onClick={() => setCurrentTab('audit-trail')}
              className="text-xs font-black text-blue-700 dark:text-blue-400 hover:underline"
            >
              Full Log
            </button>
          </div>

          <div className="p-5 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Tamper-Evident SHA-256 Hash Chain Active</span>
            </div>

            <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-300 dark:before:bg-slate-800">
              {auditLogs.map((log) => (
                <div key={log.id} className="relative pl-7 text-xs space-y-1">
                  <div className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white dark:ring-slate-900" />
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-extrabold text-slate-900 dark:text-slate-200">{log.action_type}</span>
                    <span className="font-semibold">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-300 font-medium">{log.details_json}</p>
                  <p className="text-[10px] font-mono text-slate-500 font-bold truncate">Hash: {log.current_hash?.substring(0, 16)}...</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
