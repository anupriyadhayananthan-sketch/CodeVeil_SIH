import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FileCheck, Printer, ShieldCheck, Download, Award, CheckCircle2 } from 'lucide-react';

export const ReportExportPage = ({ selectedTenderId }) => {
  const { token, user } = useAuth();
  const [tenders, setTenders] = useState([]);
  const [activeTenderId, setActiveTenderId] = useState(selectedTenderId || 1);
  const [bidders, setBidders] = useState([]);
  const [selectedBidderId, setSelectedBidderId] = useState(null);
  const [bidderDetail, setBidderDetail] = useState(null);

  useEffect(() => {
    fetchTenders();
  }, []);

  useEffect(() => {
    if (activeTenderId) fetchBidders(activeTenderId);
  }, [activeTenderId]);

  useEffect(() => {
    if (selectedBidderId) fetchBidderDetail(selectedBidderId);
  }, [selectedBidderId]);

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
    try {
      const res = await fetch(`/api/bidders/tender/${tId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const list = await res.json();
        setBidders(list);
        if (list.length > 0) setSelectedBidderId(list[0].id);
      }
    } catch (err) {
      console.error("Fetch bidders error:", err);
    }
  };

  const fetchBidderDetail = async (bId) => {
    try {
      const res = await fetch(`/api/bidders/${bId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) setBidderDetail(await res.json());
    } catch (err) {
      console.error("Fetch bidder detail error:", err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Compliance Verification Report Export</h1>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">Generate and print official compliance audit summaries for tender archives.</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedBidderId || ''}
            onChange={(e) => setSelectedBidderId(Number(e.target.value))}
            className="px-3.5 py-2 bg-white border border-slate-300 dark:bg-slate-900 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white shadow-xs"
          >
            {bidders.map(b => (
              <option key={b.id} value={b.id}>[{b.archetype}] {b.legal_name}</option>
            ))}
          </select>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition"
          >
            <Printer className="w-4 h-4" />
            Print / Export PDF Report
          </button>
        </div>
      </div>

      {/* Printable Report Certificate */}
      {bidderDetail && (
        <div className="bg-white text-slate-900 p-10 rounded-2xl shadow-md border border-slate-300 space-y-6 print:p-0 print:shadow-none print:border-none">
          {/* Watermark Banner */}
          <div className="p-2.5 bg-amber-100 border border-amber-300 text-amber-900 text-center font-black text-xs rounded-lg uppercase tracking-wider">
            SYNTHETIC DEMONSTRATION REPORT — NOT A GOVERNMENT DOCUMENT
          </div>

          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">CHENNAI PETROLEUM CORPORATION LIMITED</h2>
              <p className="text-xs text-slate-600 font-bold">GeM Bid Compliance Verification Certificate — SIH26100</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-black text-blue-800">CODEVEIL-VERIFIED</span>
              <p className="text-[10px] text-slate-500 font-bold">{new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <p className="text-slate-500 font-bold">Bidding Legal Entity:</p>
              <p className="font-black text-base text-slate-900">{bidderDetail.legal_name}</p>
              <p className="text-slate-600 font-mono font-bold mt-1">PAN: {bidderDetail.pan || 'N/A'} • GSTIN: {bidderDetail.gstin || 'N/A'}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 font-bold">Compliance Metric:</p>
              <p className="text-3xl font-black text-slate-900">{bidderDetail.compliance_score}%</p>
              <p className="text-slate-600 font-black">Risk Level: {bidderDetail.risk_level}</p>
            </div>
          </div>

          {/* Requirement Results Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Requirement-by-Requirement Evidence Summary</h3>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700 uppercase">
                  <th className="p-2.5">Req Code</th>
                  <th className="p-2.5">Title</th>
                  <th className="p-2.5">Verdict</th>
                  <th className="p-2.5">Source</th>
                  <th className="p-2.5">Evidence / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                {bidderDetail.verifications?.map((v) => (
                  <tr key={v.id}>
                    <td className="p-2.5 font-mono font-black text-blue-800">{v.requirement?.code}</td>
                    <td className="p-2.5 font-bold text-slate-900">{v.requirement?.title}</td>
                    <td className="p-2.5 font-black">{v.status}</td>
                    <td className="p-2.5 text-[10px] uppercase font-bold text-slate-600">{v.source_type}</td>
                    <td className="p-2.5 text-[11px] text-slate-700">{v.evidence_text || v.failure_reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Officer Decision & Signature Block */}
          <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-2 gap-6 text-xs">
            <div className="space-y-1">
              <p className="font-bold text-slate-900">Officer Decision Status:</p>
              <p className="text-base font-black text-blue-900">{bidderDetail.status}</p>
              <p className="text-slate-600 italic font-medium">Comments: {bidderDetail.decisions?.[0]?.comments || 'Verified by automated rules engine.'}</p>
            </div>

            <div className="text-right space-y-4">
              <div className="h-12 border-b border-slate-400 w-48 ml-auto" />
              <p className="font-bold text-slate-900">Authorized Procurement Officer Signature</p>
              <p className="text-[10px] text-slate-500 font-mono font-bold">Signed with SHA-256 Hash Audit Trail</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
