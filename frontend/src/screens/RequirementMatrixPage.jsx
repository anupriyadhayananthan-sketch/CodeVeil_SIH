import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { parseApiError } from '../utils/apiError';
import { EmptyState } from '../components/EmptyState';
import { DeadlineCountdown } from '../components/DeadlineCountdown';
import { Table, CheckCircle2, XCircle, AlertTriangle, HelpCircle, Eye, FileText, Lock, RefreshCw, X } from 'lucide-react';

export const RequirementMatrixPage = ({ selectedTenderId }) => {
  const { token } = useAuth();
  const [tenders, setTenders] = useState([]);
  const [activeTenderId, setActiveTenderId] = useState(selectedTenderId || 1);
  const [biddersList, setBiddersList] = useState([]);
  const [activeBidderId, setActiveBidderId] = useState(null);

  const [bidderDetail, setBidderDetail] = useState(null);
  const [activeEvidenceModal, setActiveEvidenceModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchTenders();
  }, []);

  useEffect(() => {
    if (activeTenderId) fetchBiddersForTender(activeTenderId);
  }, [activeTenderId]);

  useEffect(() => {
    if (activeBidderId) fetchBidderDetail(activeBidderId);
    else setBidderDetail(null);
  }, [activeBidderId]);

  const fetchTenders = async () => {
    try {
      const res = await fetch('/api/tenders', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setTenders(data);
        if (data.length > 0 && !activeTenderId) {
          setActiveTenderId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Fetch tenders error:", err);
    }
  };

  const fetchBiddersForTender = async (tId) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/bidders/tender/${tId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        const errData = await res.json();
        console.error("Fetch bidders API error:", errData);
        setErrorMsg(parseApiError(errData.detail));
        setBiddersList([]);
        setActiveBidderId(null);
        return;
      }
      const bidders = await res.json();
      setBiddersList(bidders);
      if (bidders.length > 0) {
        setActiveBidderId(bidders[0].id);
      } else {
        setActiveBidderId(null);
        setBidderDetail(null);
      }
    } catch (err) {
      console.error("Fetch bidders caught error:", err);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBidderDetail = async (bId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bidders/${bId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setBidderDetail(await res.json());
      }
    } catch (err) {
      console.error("Fetch bidder detail error:", err);
    } finally {
      setLoading(false);
    }
  };

  const currentTender = tenders.find(t => t.id === Number(activeTenderId));

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Requirement Verification Matrix</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Requirement-by-requirement evidence matrix verified by deterministic Python rules engine.</p>
            {currentTender && (
              <DeadlineCountdown submissionDeadline={currentTender.submission_deadline} isClosed={currentTender.is_closed} />
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Tender Scenario</span>
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

          {biddersList.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Select Bidder</span>
              <select
                value={activeBidderId || ''}
                onChange={(e) => setActiveBidderId(Number(e.target.value))}
                className="px-3.5 py-2 bg-white border border-slate-300 dark:bg-slate-900 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white shadow-xs"
              >
                {biddersList.map(b => (
                  <option key={b.id} value={b.id}>[{b.archetype}] {b.legal_name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Error Message Banner */}
      {errorMsg && (
        <div className="p-4 bg-rose-100 border border-rose-300 text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200 rounded-xl text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* Empty State Component when Tender has 0 Bidders */}
      {!loading && biddersList.length === 0 && (
        <EmptyState
          tender={currentTender}
          onSwitchToSeededTender={() => {
            const seeded = tenders.find(t => t.tender_number.includes('SAFETY-001')) || tenders[0];
            if (seeded) setActiveTenderId(seeded.id);
          }}
          onBiddersSeeded={() => fetchBiddersForTender(activeTenderId)}
        />
      )}

      {/* Requirement Matrix Table */}
      {bidderDetail && (
        <div className="p-6 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-6">
          {/* Bidder Header Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 text-xs font-black bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 rounded-md">
                  Archetype: {bidderDetail.archetype}
                </span>
                <span className={`px-2.5 py-0.5 text-xs font-black rounded-md border ${
                  bidderDetail.risk_level === 'High' ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800' :
                  bidderDetail.risk_level === 'Medium' ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800' :
                  'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800'
                }`}>
                  Risk: {bidderDetail.risk_level}
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">{bidderDetail.legal_name}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono font-bold">
                PAN: {bidderDetail.pan || 'N/A'} • GSTIN: {bidderDetail.gstin || 'N/A'} • Udyam: {bidderDetail.udyam_number || 'N/A'}
              </p>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">Compliance Score</span>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{bidderDetail.compliance_score}%</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">Decision Status</span>
                <p className={`text-base font-black ${
                  bidderDetail.status === 'QUALIFIED' ? 'text-emerald-700 dark:text-emerald-400' :
                  bidderDetail.status === 'REJECTED' ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'
                }`}>{bidderDetail.status}</p>
              </div>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 dark:bg-slate-950 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase">
                  <th className="p-3">Req Code</th>
                  <th className="p-3">Requirement Title</th>
                  <th className="p-3">Clause</th>
                  <th className="p-3">Status Verdict</th>
                  <th className="p-3">Source Type</th>
                  <th className="p-3">Evidence / Reason</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-300 font-medium">
                {bidderDetail.verifications?.map((v) => {
                  const req = v.requirement;
                  const isPass = v.status === 'PASS';
                  const isFail = v.status === 'FAIL';
                  const isMissing = v.status === 'MISSING';
                  const isMismatch = v.status === 'MISMATCH';
                  const isManual = v.status === 'MANUAL_REVIEW';

                  return (
                    <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3 font-mono font-black text-blue-700 dark:text-blue-400">{req?.code}</td>
                      <td className="p-3 font-black text-slate-900 dark:text-white max-w-xs">{req?.title}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400 font-bold">{req?.source_clause} (p.{req?.source_page})</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black ${
                          isPass ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800' :
                          isFail ? 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800' :
                          isMissing ? 'bg-orange-100 text-orange-900 border border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800' :
                          isMismatch ? 'bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800' :
                          'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800'
                        }`}>
                          {isPass && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                          {isFail && <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
                          {isMissing && <AlertTriangle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />}
                          {isMismatch && <XCircle className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
                          {isManual && <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                          {v.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-[10px] font-black rounded uppercase ${
                          v.source_type === 'official' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' :
                          v.source_type === 'licensed_sandbox' ? 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' :
                          'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                        }`}>
                          {v.source_type}
                        </span>
                      </td>
                      <td className="p-3 max-w-sm text-slate-800 dark:text-slate-300 font-medium">
                        {isPass ? v.evidence_text : v.failure_reason}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setActiveEvidenceModal(v)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 rounded-xl font-bold flex items-center gap-1.5 ml-auto text-xs transition"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          View Evidence Snippet
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Side-by-Side Evidence Snippet Modal */}
      {activeEvidenceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl rounded-2xl border bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-800 p-6 space-y-6 max-h-[90vh] overflow-y-auto relative shadow-2xl text-slate-900 dark:text-slate-100">
            <button
              onClick={() => setActiveEvidenceModal(null)}
              className="absolute right-4 top-4 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <span className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">Document AI Evidence Deep-Dive</span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">{activeEvidenceModal.requirement?.title}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono font-bold mt-1">
                Requirement Code: <strong className="text-blue-700 dark:text-blue-300">{activeEvidenceModal.requirement?.code}</strong> • Source Citation: <strong className="text-slate-900 dark:text-slate-200">{activeEvidenceModal.requirement?.source_clause} (Page {activeEvidenceModal.requirement?.source_page})</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Panel: Submitted Document Text & Raw OCR Output */}
              <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2 font-black text-slate-900 dark:text-slate-200">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Document AI Extracted OCR Text</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 rounded uppercase">
                    Raw OCR Output
                  </span>
                </div>

                <div className="p-3 bg-white border border-slate-300 dark:bg-slate-900 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-300 leading-relaxed font-mono whitespace-pre-wrap text-[11px] max-h-48 overflow-y-auto">
                  {activeEvidenceModal.evidence_text || 'No document text uploaded for missing requirement.'}
                </div>

                {/* Extracted Structured JSON preview */}
                <div className="p-3 bg-white border border-slate-300 dark:bg-slate-900 dark:border-slate-800 rounded-lg space-y-1">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Extracted Key Identifiers (Structured JSON)</span>
                  <p className="font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400 break-all">
                    {JSON.stringify({
                      requirement_code: activeEvidenceModal.requirement?.code,
                      bidder_legal_name: bidderDetail?.legal_name,
                      pan_extracted: bidderDetail?.pan,
                      gstin_extracted: bidderDetail?.gstin,
                      udyam_extracted: bidderDetail?.udyam_number,
                      status: activeEvidenceModal.status
                    }, null, 2)}
                  </p>
                </div>
              </div>

              {/* Right Panel: Verification Source Response & Rules Rationale */}
              <div className="p-4 bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2 font-black text-slate-900 dark:text-slate-200">
                    <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Verification Connector Registry Payload</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 rounded uppercase">
                    {activeEvidenceModal.source_type}
                  </span>
                </div>

                <div className="p-3 bg-white border border-slate-300 dark:bg-slate-900 dark:border-slate-800 rounded-lg font-mono text-[11px] text-slate-800 dark:text-slate-300 break-all leading-relaxed max-h-36 overflow-y-auto">
                  {activeEvidenceModal.raw_source_data || 'Synthetic API Response Payload'}
                </div>

                <div className="p-3 bg-white border border-slate-300 dark:bg-slate-900 dark:border-slate-800 rounded-lg text-[11px] space-y-1">
                  <p className="font-black text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    Rules Engine Compliance Rationale:
                  </p>
                  <p className="leading-relaxed text-slate-800 dark:text-slate-200 font-medium">
                    {activeEvidenceModal.failure_reason || activeEvidenceModal.evidence_text}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
