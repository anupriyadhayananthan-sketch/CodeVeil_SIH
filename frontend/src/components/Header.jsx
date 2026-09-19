import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { CodeVeilLogo } from './CodeVeilLogo';
import { Sun, Moon, Lock, Building, FileText } from 'lucide-react';

export const Header = ({ currentTab, setCurrentTab }) => {
  const { user } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <header className="sticky top-0 z-40 flex flex-col shadow-sm border-b transition-colors duration-200 bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800">
      {/* Prominent High-Readability Scrolling Text Ticker: CPCL - Chennai Petroleum Corporation Limited */}
      <div className="w-full bg-blue-950 text-white dark:bg-slate-950 dark:text-blue-100 py-2 px-6 flex items-center justify-between border-b border-blue-800/60 dark:border-slate-800 overflow-hidden font-bold">
        {/* Enterprise Prefix Badge */}
        <div className="flex items-center gap-2 flex-shrink-0 z-10 bg-blue-950 dark:bg-slate-950 pr-5 font-black text-amber-300 text-sm uppercase tracking-wider border-r border-blue-800 dark:border-slate-800">
          <Building className="w-4 h-4 text-amber-400" />
          <span>CPCL Official Portal:</span>
        </div>

        {/* Horizontal Scrolling Marquee Ticker (18px Font Size) */}
        <div className="relative overflow-hidden w-full h-7 flex items-center">
          <div className="animate-marquee text-[18px] text-white dark:text-blue-100 font-extrabold tracking-wide drop-shadow-xs">
            CPCL - Chennai Petroleum Corporation Limited &nbsp;&nbsp;••&nbsp;&nbsp; Central Public Sector Enterprise (CPSE) &nbsp;&nbsp;••&nbsp;&nbsp; Automated GeM Tender Compliance & Risk Intelligence Platform &nbsp;&nbsp;••&nbsp;&nbsp; Official Procurement Officer Decision Support Engine
          </div>
        </div>

        {/* Right Reference Badge */}
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0 z-10 bg-blue-950 dark:bg-slate-950 pl-5 text-xs text-blue-200 border-l border-blue-800 dark:border-slate-800">
          <span>Tender Ref: <strong className="text-white font-mono font-black text-sm">GEM/2026/B/4587210</strong></span>
        </div>
      </div>

      {/* Main Header Navigation Bar */}
      <div className="px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Top-Left Logo */}
        <div 
          className="cursor-pointer transition-transform hover:scale-[1.01]" 
          onClick={() => setCurrentTab('home')}
        >
          <CodeVeilLogo isDark={isDark} />
        </div>

        {/* Center Sandbox & Tender Badge */}
        <div className="hidden xl:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-xs font-black text-amber-800 dark:text-amber-300">
            <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>DATA SOURCE: SYNTHETIC DEMO DATA</span>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 border border-blue-200 dark:bg-slate-800/80 dark:border-slate-700 rounded-full text-xs font-black text-blue-900 dark:text-blue-300">
            <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>GeM Tender: Industrial Safety Equipment</span>
          </div>
        </div>

        {/* Top-Right Controls */}
        <div className="flex items-center gap-3">
          {/* Light / Dark Mode Toggle Switch */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border font-bold text-xs shadow-xs transition-all duration-200 bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-700"
            title={`Current Theme: ${isDark ? 'Dark Mode' : 'Light Mode'}. Click to switch.`}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <>
                <Moon className="w-4 h-4 text-indigo-400 fill-indigo-400/20" />
                <span className="font-black text-slate-100">Theme: Dark</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-200 border border-indigo-700 ml-1 font-mono font-bold">DARK ACTIVE</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                <span className="font-black text-slate-900">Theme: Light</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300 ml-1 font-mono font-bold">LIGHT ACTIVE</span>
              </>
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentTab('profile')}
                className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl transition-colors border text-left bg-slate-50 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
              >
                <div className="w-8.5 h-8.5 rounded-full bg-blue-700 text-white font-black text-xs flex items-center justify-center shadow-xs">
                  {user.full_name?.substring(0, 2).toUpperCase() || 'US'}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-black text-slate-900 dark:text-slate-100">{user.full_name}</p>
                  <p className="text-[11px] font-bold text-blue-800 dark:text-blue-400">{user.role}</p>
                </div>
              </button>
              {/* Sign-out button intentionally hidden — no login page exists in this demo build.
                  The auto-login flow re-establishes a session automatically on next load. */}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};
