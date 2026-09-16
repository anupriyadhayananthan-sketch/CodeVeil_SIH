import React from 'react';
import cpclLogo from '../assets/cpcl-logo.png';

export const CodeVeilLogo = ({ className = '', subtitleClassName = '', isDark = false, showSubtitle = true }) => {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Official CPCL Emblem */}
      <div className="relative flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-white p-0.5 shadow-md shadow-blue-900/15 border border-slate-200 dark:border-slate-700 overflow-hidden group">
        <img 
          src={cpclLogo} 
          alt="CPCL Logo" 
          className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* Brand Name and Official Subtitle */}
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className={`font-black text-xl tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            CPCL
          </span>
          <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-blue-700 text-white rounded shadow-xs">
            CodeVeil AI
          </span>
        </div>
        {showSubtitle && (
          <p className={`text-[11px] font-bold leading-tight ${subtitleClassName || (isDark ? 'text-slate-300' : 'text-slate-600')}`}>
            Chennai Petroleum Corporation Limited
          </p>
        )}
      </div>
    </div>
  );
};

