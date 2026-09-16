import React from 'react';
import { ShieldCheck, Lock, AlertTriangle, EyeOff, Cpu, Database, CheckCircle2, FileText } from 'lucide-react';

export const AboutPage = () => {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="space-y-2 text-center max-w-3xl mx-auto">
        <div className="inline-flex p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-600 dark:text-indigo-400 mb-2">
          <ShieldCheck className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">About CodeVeil Platform</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Smart India Hackathon 2026 Problem Statement <strong className="text-indigo-600 dark:text-indigo-400">SIH26100</strong>: 
          "AI-Powered Integrated Bid Compliance Verification Platform for GeM Procurement."
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Sponsor: Ministry of Petroleum & Natural Gas / Chennai Petroleum Corporation Limited (CPCL)</p>
      </div>

      {/* Mandatory Credibility Shield & Transparency Disclosure Banner */}
      <div className="bg-amber-500/10 p-6 rounded-2xl border-2 border-amber-500/40 space-y-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
              Mandatory Transparency Disclosure & Confidentiality Shield
            </h2>
            <p className="text-xs text-amber-800/90 dark:text-amber-300/80 font-medium">Non-Negotiable System Integrity Commitments</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700 dark:text-slate-200">
          <div className="p-4 bg-white dark:bg-slate-950/80 border border-amber-500/30 rounded-xl space-y-2 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <Database className="w-4 h-4" />
              <span>Synthetic & Sandbox Data Labeling</span>
            </div>
            <p className="leading-relaxed text-slate-600 dark:text-slate-300">
              This is a demonstration system built on synthetic test data. Verification sources are labeled 
              <strong className="text-slate-900 dark:text-white font-bold"> Official / Licensed Sandbox / Synthetic</strong> throughout the application interface and API responses. 
              No real PAN, GSTIN, Udyam, or Aadhaar data is stored or processed.
            </p>
          </div>

          <div className="p-4 bg-white dark:bg-slate-950/80 border border-indigo-500/30 rounded-xl space-y-2 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-indigo-700 dark:text-indigo-300">
              <EyeOff className="w-4 h-4" />
              <span>Bidder Document Confidentiality Guarantee</span>
            </div>
            <p className="leading-relaxed text-slate-600 dark:text-slate-300">
              Bidder documents are strictly confidential — only the officer(s) assigned to a tender and system admins can view them; 
              no third party or unrelated bidder ever has access. All document content views are recorded in an immutable audit log.
            </p>
          </div>
        </div>
      </div>

      {/* 5-Stage Domain Architecture */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Cpu className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          5-Stage Compliance Pipeline Architecture
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 text-xs">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/10 dark:bg-indigo-600/30 border border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center">1</div>
            <h3 className="font-bold text-slate-900 dark:text-white">Tender & Bidder Ingestion</h3>
            <p className="text-slate-500 dark:text-slate-400">PDF tender clause parser ingests requirements; bidder doc packages uploaded.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 text-xs">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/10 dark:bg-indigo-600/30 border border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center">2</div>
            <h3 className="font-bold text-slate-900 dark:text-white">Document AI Pipeline</h3>
            <p className="text-slate-500 dark:text-slate-400">Structured field extraction (PAN, GSTIN, dates, turnover, experience) from uploaded PDFs.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 text-xs">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/10 dark:bg-indigo-600/30 border border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center">3</div>
            <h3 className="font-bold text-slate-900 dark:text-white">Verification & Rules Engine</h3>
            <p className="text-slate-500 dark:text-slate-400">Deterministic Python rules engine computes PASS/FAIL/MISSING/MISMATCH/MANUAL_REVIEW.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 text-xs">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/10 dark:bg-indigo-600/30 border border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center">4</div>
            <h3 className="font-bold text-slate-900 dark:text-white">Risk & Collusion Intelligence</h3>
            <p className="text-slate-500 dark:text-slate-400">CoV price-rigging screen, NetworkX shell company detector, and trained ML risk model.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 text-xs">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/10 dark:bg-indigo-600/30 border border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center">5</div>
            <h3 className="font-bold text-slate-900 dark:text-white">Officer Dashboard & Audit Log</h3>
            <p className="text-slate-500 dark:text-slate-400">Explainable evidence matrix, officer qualification decision, and tamper-evident hash chain.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
