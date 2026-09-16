import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Upload, 
  Table, 
  Users, 
  CheckSquare, 
  History, 
  FileCheck, 
  Network, 
  Award, 
  Info, 
  Settings, 
  User,
  ShieldAlert
} from 'lucide-react';

export const Sidebar = ({ currentTab, setCurrentTab }) => {
  const { user } = useAuth();

  const navItems = [
    { id: 'home', label: 'Dashboard', icon: LayoutDashboard, role: 'all' },
    { id: 'tender-upload', label: 'Tender & Bidder Upload', icon: Upload, role: 'Officer' },
    { id: 'requirement-matrix', label: 'Requirement Matrix', icon: Table, role: 'all' },
    { id: 'bidder-comparison', label: 'Bidder Comparison', icon: Users, role: 'all' },
    { id: 'officer-decision', label: 'Officer Decision Workflow', icon: CheckSquare, role: 'Officer' },
    { id: 'risk-collusion', label: 'Risk & Collusion Intelligence', icon: Network, role: 'all' },
    { id: 'audit-trail', label: 'Audit Trail (Hash-Chain)', icon: History, role: 'all' },
    { id: 'report-export', label: 'Compliance Report Export', icon: FileCheck, role: 'all' },
    
    { id: 'about', label: 'About & Security Shield', icon: Info, role: 'all' },
    { id: 'settings', label: 'Settings & Access Logs', icon: Settings, role: 'all' },
    { id: 'profile', label: 'User Profile', icon: User, role: 'all' }
  ];

  const userRole = user?.role || 'Viewer/Auditor';

  const isAllowed = (itemRole) => {
    if (itemRole === 'all') return true;
    if (itemRole === 'Officer' && (userRole === 'Procurement Officer' || userRole === 'Admin')) return true;
    if (itemRole === 'Admin' && userRole === 'Admin') return true;
    return false;
  };

  return (
    <aside className="w-68 border-r transition-colors duration-200 bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 flex flex-col justify-between shrink-0 min-h-[calc(100vh-73px)] shadow-xs">
      <div className="p-4 space-y-1.5">
        <p className="px-3 pb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Platform Modules
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const allowed = isAllowed(item.role);
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              disabled={!allowed}
              onClick={() => allowed && setCurrentTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold text-sm transition-all ${
                isActive
                  ? 'bg-blue-700 text-white shadow-md shadow-blue-700/20 dark:bg-blue-600 dark:text-white'
                  : allowed
                  ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80'
                  : 'text-slate-400 opacity-50 cursor-not-allowed dark:text-slate-600'
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
              <span className="truncate text-[13.5px]">{item.label}</span>
              {!allowed && (
                <span className="ml-auto text-[9.5px] font-extrabold px-2 py-0.5 rounded bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 uppercase">
                  Locked
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Role Badge Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 dark:bg-slate-950/60 dark:border-slate-800">
        <div className="p-3 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Role</span>
            <span className={`text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full border ${
              userRole === 'Admin' ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800' :
              userRole === 'Procurement Officer' ? 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800' :
              'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
            }`}>
              {userRole}
            </span>
          </div>
          <p className="text-[11.5px] font-medium text-slate-600 dark:text-slate-400 leading-snug">
            {userRole === 'Admin' && 'Full system, configuration & benchmark access.'}
            {userRole === 'Procurement Officer' && 'Authorized to evaluate & record procurement decisions.'}
            {userRole === 'Viewer/Auditor' && 'Read-only access to matrices, audit logs & reports.'}
          </p>
        </div>
      </div>
    </aside>
  );
};
