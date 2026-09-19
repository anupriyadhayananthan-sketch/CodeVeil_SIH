import React, { useState, useEffect, useRef } from 'react';
import { QrCode, ShieldCheck, Copy, Check, AlertCircle, ArrowRight, KeyRound } from 'lucide-react';

export const TotpSetupModal = ({ preAuthToken, email, onSuccess, onCancel }) => {
  const [setupData, setSetupData] = useState(null);
  const [fetchingSetup, setFetchingSetup] = useState(true);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    const fetchSetup = async () => {
      setFetchingSetup(true);
      setError('');
      try {
        const res = await fetch('/api/auth/2fa/totp-setup-init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pre_auth_token: preAuthToken })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Failed to initialize TOTP setup.');
        }

        setSetupData(data);
      } catch (err) {
        setError(err.message || 'Error fetching 2FA QR code.');
      } finally {
        setFetchingSetup(false);
      }
    };

    fetchSetup();
  }, [preAuthToken]);

  const handleCopyKey = () => {
    if (setupData?.raw_secret) {
      navigator.clipboard.writeText(setupData.raw_secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!code || code.trim().length !== 6) {
      setError('Please enter the 6-digit authenticator code.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/2fa/totp-setup-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_auth_token: preAuthToken,
          raw_secret: setupData.raw_secret,
          totp_code: code.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Authenticator confirmation failed.');
      }

      onSuccess(data.access_token);
    } catch (err) {
      setError(err.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 transition-opacity">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 relative animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
        
        <div className="text-center space-y-1 flex flex-col items-center">
          <div className="w-14 h-14 bg-purple-50 dark:bg-purple-950/50 p-2.5 rounded-full border border-purple-200 dark:border-purple-800 flex items-center justify-center mb-1">
            <QrCode className="w-7 h-7 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Set up 2FA Authenticator</h2>
          <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider bg-purple-50 dark:bg-purple-950/50 px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-800">
            Elevated Account Security Required
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {fetchingSetup ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-semibold text-slate-500">Generating secure 2FA QR code...</p>
          </div>
        ) : (
          setupData && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col items-center space-y-3">
                <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                  <img src={setupData.qr_code_url} alt="2FA QR Code" className="w-40 h-40 object-contain" />
                </div>
                <p className="text-xs text-center text-slate-600 dark:text-slate-400 font-medium">
                  Scan this QR code using <strong>Google Authenticator</strong>, <strong>Authy</strong>, or <strong>Microsoft Authenticator</strong>.
                </p>

                <div className="w-full pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">Or enter key manually:</span>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-700 flex items-center gap-1 transition"
                  >
                    {setupData.raw_secret.slice(0, 10)}...
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <form onSubmit={handleConfirm} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Enter 6-digit Code from Authenticator App:
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      ref={inputRef}
                      type="text"
                      required
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-center tracking-[0.3em] font-mono text-lg font-black text-slate-900 focus:outline-none focus:border-purple-600 dark:bg-slate-950 dark:border-slate-800 dark:text-white transition"
                      placeholder="000000"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || code.trim().length !== 6}
                  className="w-full py-3 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition"
                >
                  {loading ? 'Enabling 2FA...' : 'Confirm Setup & Sign In'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )
        )}

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
