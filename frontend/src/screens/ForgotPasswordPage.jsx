import React, { useState } from 'react';
import { CaptchaWidget } from '../components/CaptchaWidget';
import { Mail, ArrowRight, CheckCircle, Key, AlertCircle } from 'lucide-react';
import { parseApiError } from '../utils/apiError';

export const ForgotPasswordPage = ({ setCurrentTab }) => {
  const [email, setEmail] = useState('');
  const [tokenInfo, setTokenInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaId, setCaptchaId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setTokenInfo(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          captcha_token: captchaToken,
          captcha_id: captchaId
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(parseApiError(err.detail));
      }
      const data = await res.json();
      setTokenInfo(data);
    } catch (err) {
      setError(err.message || 'Password reset request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-61px)] flex items-center justify-center p-6 bg-slate-100 dark:bg-slate-950 transition-colors">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl shadow-xl shadow-indigo-500/25 text-white mb-2">
            <Key className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Reset Password</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Enter your official email to generate a token-based reset link.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-6 rounded-2xl space-y-4 border border-slate-200 dark:border-slate-800 shadow-xl">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Registered Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                placeholder="officer@cpcl.gov.in"
              />
            </div>
          </div>

          <CaptchaWidget
            action="reset_password"
            required={true}
            onVerify={(token, id) => {
              setCaptchaToken(token);
              setCaptchaId(id);
            }}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition"
          >
            {loading ? 'Generating Token...' : 'Send Reset Instructions'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {tokenInfo && (
          <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/30 space-y-2 text-xs text-emerald-800 dark:text-emerald-200">
            <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              <span>Reset Token Generated</span>
            </div>
            <p>{tokenInfo.message}</p>
            {tokenInfo.demo_reset_token && (
              <div className="p-2 bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded font-mono text-[10px] break-all text-slate-800 dark:text-slate-300">
                {tokenInfo.demo_reset_token}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Remembered your password?{' '}
          <button
            onClick={() => setCurrentTab('login')}
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Back to Sign In
          </button>
        </p>
      </div>
    </div>
  );
};
