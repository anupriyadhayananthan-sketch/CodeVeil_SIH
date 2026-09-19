import React, { useState, useEffect, useRef } from 'react';
import { Mail, RefreshCw, AlertCircle, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import cpclLogo from '../../assets/cpcl-logo.png';

export const EmailOtpModal = ({ preAuthToken, email, initialCooldown = 0, onSuccess, onCancel }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(initialCooldown || 45);
  const [resending, setResending] = useState(false);
  const [resendSuccessMsg, setResendSuccessMsg] = useState('');

  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    // Focus first input box on mount
    if (inputRefs[0].current) {
      inputRefs[0].current.focus();
    }
  }, []);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    // Handle single character or paste
    if (value.length > 1) {
      const pastedDigits = value.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pastedDigits[i] || '';
      }
      setOtp(newOtp);
      const nextIndex = Math.min(pastedDigits.length, 5);
      inputRefs[nextIndex].current?.focus();
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next input field
    if (value && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/2fa/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_auth_token: preAuthToken,
          otp_code: code
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'OTP verification failed.');
      }

      onSuccess(data.access_token);
    } catch (err) {
      setError(err.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;

    setResending(true);
    setError('');
    setResendSuccessMsg('');

    try {
      const res = await fetch('/api/auth/2fa/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pre_auth_token: preAuthToken })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to resend OTP.');
      }

      setResendSuccessMsg('A fresh verification code has been dispatched to your email.');
      setCooldown(data.cooldown_seconds || 45);
      setOtp(['', '', '', '', '', '']);
      inputRefs[0].current?.focus();
    } catch (err) {
      setError(err.message || 'Error resending OTP.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 transition-opacity">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6 relative animate-in fade-in zoom-in duration-150">
        
        <div className="text-center space-y-2 flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/50 p-3 rounded-full border border-blue-200 dark:border-blue-800 flex items-center justify-center mb-1">
            <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Two-Factor Security</h2>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            We have sent a 6-digit verification code to <span className="font-bold text-slate-800 dark:text-slate-200">{email}</span>.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-100 border border-rose-300 rounded-xl text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {resendSuccessMsg && (
          <div className="p-3.5 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{resendSuccessMsg}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex justify-between items-center gap-2 max-w-xs mx-auto">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-11 h-13 text-center text-xl font-black rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:bg-slate-950 dark:border-slate-800 dark:text-white dark:focus:border-blue-500 transition"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || otp.join('').length !== 6}
            className="w-full py-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition"
          >
            {loading ? 'Verifying Code...' : 'Verify & Continue'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
          <span>Didn't receive the code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
            className="text-blue-700 dark:text-blue-400 font-bold hover:underline disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
          </button>
        </div>

        <div className="text-center">
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
