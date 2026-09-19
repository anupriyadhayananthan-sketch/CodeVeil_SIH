import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { parseApiError } from '../utils/apiError';
import { EmptyState } from '../components/EmptyState';
import { ComplianceReportExportSection } from '../components/ComplianceReportExportSection';
import { CheckSquare, CheckCircle, XCircle, HelpCircle, AlertCircle, Send, FileText } from 'lucide-react';

export const OfficerDecisionPage = ({ selectedTenderId }) => {
  const { token, user } = useAuth();
  const [tenders, setTenders] = useState([]);
  const [activeTenderId, setActiveTenderId] = useState(selectedTenderId || 1);
  const [bidders, setBidders] = useState([]);
  const [selectedBidderId, setSelectedBidderId] = useState(null);

  const [decision, setDecision] = useState('QUALIFIED');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(true);

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
        if (data.length > 0 && !activeTenderId) setActiveTenderId(data[0].id);
      }
    } catch (err) {
      console.error("Fetch tenders error:", err);
    }
  };

  const fetchBidders = async (tId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bidders/tender/${tId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const list = await res.json();
        setBidders(list);
        if (list.length > 0) setSelectedBidderId(list[0].id);
        else setSelectedBidderId(null);
      }
    } catch (err) {
      console.error("Fetch bidders error:", err);
    } finally {
      setLoading(false);
    }
  };

  const currentTender = tenders.find(t => t.id === Number(activeTenderId));
  const selectedBidder = bidders.find(b => b.id === Number(selectedBidderId));

  const handleSubmitDecision = async (e) => {
    e.preventDefault();
    if (!comments.trim()) {
      setMsg({ text: 'Mandatory officer comment is required before recording decision.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setMsg({ text: '', type: '' });

    try {
      const res = await fetch('/api/bidders/decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          bidder_id: selectedBidderId,
          decision: decision,
          comments: comments
        })
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Officer decision API raw error:", data);
        throw new Error(parseApiError(data.detail));
      }

      setMsg({ text: `Decision '${decision}' recorded successfully for '${selectedBidder?.legal_name}'.`, type: 'success' });
      setComments('');
      fetchBidders(activeTenderId);
    } catch (err) {
      console.error("Officer decision caught error:", err);
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Procurement Officer Decision Workflow</h1>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">
          The procurement officer always makes the final call. Record Qualify / Reject / Clarification decisions with mandatory audit rationale.
        </p>
      </div>

      <div className="p-6 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tender Scenario</label>
            <select
              value={activeTenderId}
              onChange={(e) => setActiveTenderId(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white shadow-xs"
            >
              {tenders.map(t => (
                <option key={t.id} value={t.id}>{t.tender_number} — {t.title.substring(0, 35)}...</option>
              ))}
            </select>
          </div>

          {bidders.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Target Bidder Entity</label>
              <select
                value={selectedBidderId || ''}
                onChange={(e) => setSelectedBidderId(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white shadow-xs"
              >
                {bidders.map(b => (
                  <option key={b.id} value={b.id}>[{b.archetype}] {b.legal_name} (Score: {b.compliance_score}%)</option>
                ))}
              </select>
            </div>
          )}
        </div>

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

        {selectedBidder && (
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-900 dark:text-white text-base">{selectedBidder.legal_name}</span>
                <span className={`px-2.5 py-1 text-xs font-black rounded ${
                  selectedBidder.risk_level === 'High' ? 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950 dark:text-rose-200' :
                  selectedBidder.risk_level === 'Medium' ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200' : 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200'
                }`}>
                  Risk Level: {selectedBidder.risk_level}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-bold">Current Status: <strong className="text-slate-900 dark:text-white">{selectedBidder.status}</strong> • Compliance Score: <strong className="text-blue-700 dark:text-blue-400">{selectedBidder.compliance_score}%</strong></p>
            </div>

            {msg.text && (
              <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${
                msg.type === 'success' ? 'bg-emerald-100 border border-emerald-300 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200' : 'bg-rose-100 border border-rose-300 text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200'
              }`}>
                {msg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
                <span>{msg.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmitDecision} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase">Qualification Verdict</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setDecision('QUALIFIED')}
                    className={`p-4 rounded-xl border flex flex-col items-center gap-2 text-xs font-black transition ${
                      decision === 'QUALIFIED'
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-900 shadow-sm dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-200'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    <span>QUALIFY</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDecision('CLARIFICATION_REQUESTED')}
                    className={`p-4 rounded-xl border flex flex-col items-center gap-2 text-xs font-black transition ${
                      decision === 'CLARIFICATION_REQUESTED'
                        ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-sm dark:bg-amber-950 dark:border-amber-700 dark:text-amber-200'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <HelpCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    <span>REQUEST CLARIFICATION</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDecision('REJECTED')}
                    className={`p-4 rounded-xl border flex flex-col items-center gap-2 text-xs font-black transition ${
                      decision === 'REJECTED'
                        ? 'bg-rose-100 border-rose-400 text-rose-900 shadow-sm dark:bg-rose-950 dark:border-rose-700 dark:text-rose-200'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                    <span>REJECT</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mandatory Officer Comments & Rationale</label>
                <textarea
                  required
                  rows={4}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Enter official procurement justification, referencing specific clause verification findings..."
                  className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 dark:bg-slate-950 dark:border-slate-800 dark:text-white dark:placeholder-slate-500 transition"
                />
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">This comment will be signed with your user ID and recorded in the append-only audit trail.</p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition"
              >
                {submitting ? 'Recording Decision...' : 'Record Official Decision & Sign Audit Trail'}
                <Send className="w-4 h-4" />
              </button>
            </form>

            {/* Compliance Report Export & Notification Section */}
            <ComplianceReportExportSection
              bidder={selectedBidder}
              onRefreshBidder={() => fetchBidders(activeTenderId)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
