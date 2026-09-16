import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Settings, Users, Database, Shield, Eye, Lock, CheckCircle, RefreshCw } from 'lucide-react';

export const SettingsPage = () => {
  const { user, token } = useAuth();
  const [usersList, setUsersList] = useState([]);
  const [docLogs, setDocLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('connectors');
  const [loading, setLoading] = useState(false);

  const [connectors, setConnectors] = useState([
    { name: 'GSTN Registry API', source_type: 'synthetic', status: 'Active', latency: '120ms' },
    { name: 'Udyam MSME Registry', source_type: 'synthetic', status: 'Active', latency: '95ms' },
    { name: 'Income Tax PAN Verification', source_type: 'synthetic', status: 'Active', latency: '110ms' },
    { name: 'MoPNG Central Debarment Portal', source_type: 'synthetic', status: 'Active', latency: '80ms' },
    { name: 'DigiLocker Verification Vault', source_type: 'licensed_sandbox', status: 'Connected', latency: '210ms' }
  ]);

  useEffect(() => {
    if (user?.role === 'Admin') {
      fetchAdminData();
    }
    fetchDocumentAccessLogs();
  }, [user, token]);

  const fetchAdminData = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setUsersList(await res.json());
    } catch (err) {
      console.error("Fetch users error:", err);
    }
  };

  const fetchDocumentAccessLogs = async () => {
    try {
      const res = await fetch('/api/audit/document-access-logs', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) setDocLogs(await res.json());
    } catch (err) {
      console.error("Fetch doc logs error:", err);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await fetch(`/api/users/${userId}/role?role=${encodeURIComponent(newRole)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchAdminData();
    } catch (err) {
      console.error("Role update error:", err);
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    try {
      const res = await fetch(`/api/users/${userId}/status?is_active=${!currentStatus}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchAdminData();
    } catch (err) {
      console.error("Status toggle error:", err);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">System Settings & Governance</h1>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">Configure verification connectors, user access, and inspect the document confidentiality access log.</p>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('connectors')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition ${
            activeTab === 'connectors' ? 'bg-blue-700 text-white shadow-xs dark:bg-blue-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          Verification Connectors
        </button>

        <button
          onClick={() => setActiveTab('doc-logs')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition ${
            activeTab === 'doc-logs' ? 'bg-blue-700 text-white shadow-xs dark:bg-blue-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Eye className="w-4 h-4 text-emerald-500" />
          Document Access Log (Audit Shield)
        </button>

        {user?.role === 'Admin' && (
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition ${
              activeTab === 'users' ? 'bg-blue-700 text-white shadow-xs dark:bg-blue-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            User Management (Admin)
          </button>
        )}
      </div>

      {/* Tab 1: Connectors */}
      {activeTab === 'connectors' && (
        <div className="p-6 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Verification Source Connectors & Labeling Config
            </h2>
            <span className="px-3 py-1 bg-amber-100 border border-amber-300 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300 rounded-full text-xs font-extrabold">
              Source Type Labeling Enforced
            </span>
          </div>

          <div className="space-y-3">
            {connectors.map((c, idx) => (
              <div key={idx} className="p-4 bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-white text-base">{c.name}</span>
                    <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-md uppercase ${
                      c.source_type === 'official' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' :
                      c.source_type === 'licensed_sandbox' ? 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-300' :
                      'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {c.source_type}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 font-semibold">Response Latency: {c.latency} • API Protocol: REST/HTTPS</p>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={c.source_type}
                    onChange={(e) => {
                      const copy = [...connectors];
                      copy[idx].source_type = e.target.value;
                      setConnectors(copy);
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-300 dark:bg-slate-900 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white shadow-xs"
                  >
                    <option value="synthetic">Synthetic Mock</option>
                    <option value="licensed_sandbox">Licensed Sandbox</option>
                    <option value="official">Official API</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Document Access Logs View */}
      {activeTab === 'doc-logs' && (
        <div className="p-6 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Document Access Audit Log (Confidentiality Proof)
              </h2>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                Every user access, view, or download of a bidder document is logged with timestamp, user ID, and document ID.
              </p>
            </div>
            <button
              onClick={fetchDocumentAccessLogs}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800 dark:text-slate-300 rounded-xl transition"
              title="Refresh Logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 dark:bg-slate-950 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">User Email</th>
                  <th className="p-3">Document Name</th>
                  <th className="p-3">Bidder ID</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-300 font-medium">
                {docLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-6 text-center text-slate-500 font-semibold">No document views recorded yet. Click a document snippet to generate access logs.</td>
                  </tr>
                ) : (
                  docLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-mono text-slate-500 font-semibold">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{log.user_email}</td>
                      <td className="p-3 font-mono font-bold text-blue-700 dark:text-blue-400">{log.document_name}</td>
                      <td className="p-3 font-bold">Bidder #{log.bidder_id}</td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 rounded uppercase">
                          {log.action_type}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Admin User Management */}
      {activeTab === 'users' && user?.role === 'Admin' && (
        <div className="p-6 rounded-2xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            User Management & Role Elevation
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 dark:bg-slate-950 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase">
                  <th className="p-3">User</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-300 font-medium">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3">
                      <p className="font-extrabold text-slate-900 dark:text-white">{u.full_name}</p>
                      <p className="text-xs text-slate-500 font-semibold">{u.email}</p>
                    </td>
                    <td className="p-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="px-3 py-1.5 bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white shadow-xs"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Procurement Officer">Procurement Officer</option>
                        <option value="Viewer/Auditor">Viewer / Auditor</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 text-[10px] font-black rounded-full ${
                        u.is_active ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleStatusToggle(u.id, u.is_active)}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-xl font-bold transition text-xs"
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
