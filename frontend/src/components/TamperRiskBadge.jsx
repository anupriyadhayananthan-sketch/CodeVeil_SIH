import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, Info, X } from 'lucide-react';

export const TamperRiskBadge = ({ flag, documentType }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!flag || flag.tamper_risk === 'LOW') {
    return null;
  }

  const isHigh = flag.tamper_risk === 'HIGH';
  const isMedium = flag.tamper_risk === 'MEDIUM';

  let reasons = [];
  try {
    if (flag.details_json) {
      const parsed = typeof flag.details_json === 'string' ? JSON.parse(flag.details_json) : flag.details_json;
      reasons = parsed.reasons || [];
    }
  } catch (e) {
    console.error("Parse tamper flag details error:", e);
  }

  const primaryReason = reasons.length > 0 
    ? reasons[0] 
    : isHigh 
      ? "High probability of document modification or hash duplication" 
      : "Editing software signatures detected in document metadata";

  return (
    <div className="relative inline-block ml-2">
      <button
        type="button"
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase border transition cursor-pointer ${
          isHigh
            ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800 hover:bg-rose-200'
            : 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800 hover:bg-amber-200'
        }`}
        title="Click to view document integrity tamper rationale"
      >
        {isHigh ? <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" /> : <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
        <span>Tamper risk: {flag.tamper_risk}</span>
      </button>

      {/* Tooltip Rationale Popup */}
      {showTooltip && (
        <div className="absolute left-0 top-full mt-1 z-50 w-72 p-3 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 text-xs space-y-1.5 animate-in fade-in duration-100 pointer-events-none">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
            <span className="font-black text-[10px] uppercase text-amber-400 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Integrity Warning
            </span>
            <span className="text-[10px] font-bold text-slate-400">{documentType || 'Document'}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-200 font-medium">
            {primaryReason}
          </p>
          <div className="text-[9px] text-slate-400 italic pt-1 border-t border-slate-800">
            Note: Informational integrity signal. PASS/FAIL compliance score remains unaltered.
          </div>
        </div>
      )}
    </div>
  );
};
