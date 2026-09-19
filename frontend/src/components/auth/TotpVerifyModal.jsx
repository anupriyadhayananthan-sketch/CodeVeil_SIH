import React, { useState, useRef, useEffect } from 'react';
import { KeyRound, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';

export const TotpVerifyModal = ({ preAuthToken, email, onSuccess, onCancel }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!code || code.trim().length !== 6) {
      setError('Please enter the 6-digit authenticator code.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/2fa/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_auth_token: preAuthToken,
          totp_code: code.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Authenticator verification failed.');
      }

      onSuccess(data.access_token);
    } catch (err) {
      setError(err.message || 'Invalid authenticator code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 transition-opacity">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6 relative animate-in fade-in zoom-in duration-150">
        
        <div className="text-center space-y-2 flex flex-col items-center">
          <div className="w-16 h-16 bg-purple-50 dark:bg-purple-950/50 p-3 rounded-full border border-purple-200 dark:border-purple-800 flex items-center justify-center mb-1">
            <ShieldCheck className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Authenticator Verification</h2>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Enter the 6-digit verification code from your authenticator app for <span className="font-bold text-slate-800 dark:text-slate-200">{email}</span>.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-100 border border-rose-300 rounded-xl text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              6-Digit Authenticator Code
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                ref={inputRef}
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full pl-9 pr-3.5 py-3 bg-white border border-slate-300 rounded-xl text-center tracking-[0.3em] font-mono text-xl font-black text-slate-900 focus:outline-none focus:border-purple-600 dark:bg-slate-950 dark:border-slate-800 dark:text-white transition"
                placeholder="000000"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || code.trim().length !== 6}
            className="w-full py-3 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition"
          >
            {loading ? 'Verifying Code...' : 'Verify Code & Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Cancel & Return to Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
