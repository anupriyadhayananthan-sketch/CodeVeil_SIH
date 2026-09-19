import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CaptchaWidget } from '../components/CaptchaWidget';
import { EmailOtpModal } from '../components/auth/EmailOtpModal';
import { TotpSetupModal } from '../components/auth/TotpSetupModal';
import { TotpVerifyModal } from '../components/auth/TotpVerifyModal';
import { ShieldCheck, Lock, Mail, User as UserIcon, ArrowRight, AlertCircle, Info } from 'lucide-react';
import cpclLogo from '../assets/cpcl-logo.png';

export const LoginPage = ({ setCurrentTab }) => {
  const { login, complete2FA } = useAuth();
  const [name, setName] = useState('Rajesh Sharma');
  const [email, setEmail] = useState('officer@cpcl.gov.in');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA pending state
  const [pending2FA, setPending2FA] = useState(null);

  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaId, setCaptchaId] = useState(null);
  const [captchaRequired, setCaptchaRequired] = useState(true);

  const checkCaptchaStatus = async (emailToCheck) => {
    try {
      const res = await fetch(`/api/auth/captcha-status?email=${encodeURIComponent(emailToCheck || '')}`);
      if (res.ok) {
        const data = await res.json();
        if (data.provider === 'disabled') {
          setCaptchaRequired(false);
        } else {
          setCaptchaRequired(true);
        }
      }
    } catch (err) {
      console.error("Error checking captcha status:", err);
    }
  };

  useEffect(() => {
    checkCaptchaStatus(email);
  }, [email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = name ? name.trim() : '';
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password, trimmedName, captchaToken, captchaId);
      if (result && result.requires_2fa) {
        setPending2FA(result);
      } else {
        setCurrentTab('home');
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials.');
      checkCaptchaStatus(email);
    } finally {
      setLoading(false);
    }
  };

  const handle2FASuccess = async (accessToken) => {
    try {
      await complete2FA(accessToken);
      setPending2FA(null);
      setCurrentTab('home');
    } catch (err) {
      setError("Failed to complete 2FA login session.");
    }
  };

  const handleQuickFill = (roleEmail) => {
    setEmail(roleEmail);
    setPassword('Password123!');
    if (roleEmail.includes('officer')) setName('Rajesh Sharma');
    else if (roleEmail.includes('admin')) setName('System Administrator');
    else if (roleEmail.includes('auditor')) setName('Priya Nair');
  };

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center p-6 transition-colors duration-200 bg-slate-100 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2 flex flex-col items-center">
          <div className="w-20 h-20 bg-white p-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-2">
            <img src={cpclLogo} alt="CPCL Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Sign in to CodeVeil</h1>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">CPCL GeM Bid Compliance & Risk Intelligence Platform</p>
        </div>

        {/* Demo Account Presets */}
        <div className="p-4 rounded-xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-2 text-xs shadow-xs">
          <p className="text-xs font-black uppercase text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
            <Info className="w-4 h-4" /> Quick Demo Credentials:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('officer@cpcl.gov.in')}
              className="p-2.5 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded-lg text-blue-900 dark:bg-blue-950 dark:hover:bg-blue-900 dark:border-blue-800 dark:text-blue-200 font-bold text-xs text-center transition"
            >
              Officer
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('admin@codeveil.gov.in')}
              className="p-2.5 bg-purple-100 hover:bg-purple-200 border border-purple-300 rounded-lg text-purple-900 dark:bg-purple-950 dark:hover:bg-purple-900 dark:border-purple-800 dark:text-purple-200 font-bold text-xs text-center transition"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('auditor@cag.gov.in')}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-200 font-bold text-xs text-center transition"
            >
              Auditor
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 rounded-2xl space-y-4 border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm">
          {error && (
            <div className="p-3.5 bg-rose-100 border border-rose-300 rounded-xl text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Name</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 dark:bg-slate-950 dark:border-slate-800 dark:text-white dark:placeholder-slate-500 transition"
                placeholder="Sadhana Kumar"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 dark:bg-slate-950 dark:border-slate-800 dark:text-white dark:placeholder-slate-500 transition"
                placeholder="officer@cpcl.gov.in"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
              <button
                type="button"
                onClick={() => setCurrentTab('forgot-password')}
                className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 dark:bg-slate-950 dark:border-slate-800 dark:text-white dark:placeholder-slate-500 transition"
                placeholder="••••••••"
              />
            </div>
          </div>

          <CaptchaWidget
            action="login"
            required={captchaRequired}
            onVerify={(token, id) => {
              setCaptchaToken(token);
              setCaptchaId(id);
            }}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-center text-xs font-semibold text-slate-600 dark:text-slate-400">
          Don't have an account?{' '}
          <button
            onClick={() => setCurrentTab('signup')}
            className="font-bold text-blue-700 dark:text-blue-400 hover:underline"
          >
            Request Access / Sign Up
          </button>
        </p>
      </div>

      {/* 2FA Post-Password Security Verification Modals */}
      {pending2FA && pending2FA.fa_type === 'OTP' && (
        <EmailOtpModal
          preAuthToken={pending2FA.pre_auth_token}
          email={pending2FA.email}
          initialCooldown={pending2FA.cooldown_seconds}
          onSuccess={handle2FASuccess}
          onCancel={() => setPending2FA(null)}
        />
      )}

      {pending2FA && pending2FA.fa_type === 'TOTP_SETUP' && (
        <TotpSetupModal
          preAuthToken={pending2FA.pre_auth_token}
          email={pending2FA.email}
          onSuccess={handle2FASuccess}
          onCancel={() => setPending2FA(null)}
        />
      )}

      {pending2FA && pending2FA.fa_type === 'TOTP_VERIFY' && (
        <TotpVerifyModal
          preAuthToken={pending2FA.pre_auth_token}
          email={pending2FA.email}
          onSuccess={handle2FASuccess}
          onCancel={() => setPending2FA(null)}
        />
      )}
    </div>
  );
};
