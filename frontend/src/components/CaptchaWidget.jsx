import React, { useState, useEffect } from 'react';
import { ShieldCheck, RotateCw, Volume2, AlertCircle } from 'lucide-react';

export const CaptchaWidget = ({ onVerify, action = 'login', required = true }) => {
  const [config, setConfig] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [recaptchaFailed, setRecaptchaFailed] = useState(false);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [audioActive, setAudioActive] = useState(false);

  // Fetch CAPTCHA configuration from backend
  useEffect(() => {
    fetch('/api/auth/captcha-config')
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        if (data.provider === 'local' || data.disabled) {
          if (data.provider === 'local') {
            loadLocalChallenge();
          }
        } else if (data.provider === 'recaptcha') {
          if (data.site_key) {
            loadRecaptchaScript(data.site_key);
          } else {
            console.warn("reCAPTCHA site key missing. Degraded fallback to local challenge.");
            setRecaptchaFailed(true);
            loadLocalChallenge();
          }
        }
      })
      .catch(err => {
        console.error("Failed to load captcha config:", err);
        setRecaptchaFailed(true);
        loadLocalChallenge();
      });
  }, []);

  const loadRecaptchaScript = (siteKey) => {
    if (window.grecaptcha) {
      executeRecaptcha(siteKey);
      return;
    }

    const scriptId = 'recaptcha-v3-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
      script.async = true;
      script.onload = () => executeRecaptcha(siteKey);
      script.onerror = () => {
        console.warn("Google reCAPTCHA script failed to load. Falling back to local CAPTCHA.");
        setRecaptchaFailed(true);
        loadLocalChallenge();
      };
      document.head.appendChild(script);
    } else {
      executeRecaptcha(siteKey);
    }
  };

  const executeRecaptcha = (siteKey) => {
    if (window.grecaptcha) {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(siteKey, { action })
          .then(token => {
            if (onVerify) onVerify(token, null);
          })
          .catch(err => {
            console.warn("reCAPTCHA execution failed. Falling back to local CAPTCHA.", err);
            setRecaptchaFailed(true);
            loadLocalChallenge();
          });
      });
    }
  };

  const loadLocalChallenge = async () => {
    setLoadingChallenge(true);
    setUserAnswer('');
    try {
      const res = await fetch('/api/auth/captcha-challenge');
      if (res.ok) {
        const data = await res.json();
        setChallenge(data);
        if (onVerify) onVerify('', data.captcha_id);
      }
    } catch (err) {
      console.error("Failed to fetch local captcha challenge:", err);
    } finally {
      setLoadingChallenge(false);
    }
  };

  const handleAnswerChange = (e) => {
    const val = e.target.value;
    setUserAnswer(val);
    if (challenge && onVerify) {
      onVerify(val, challenge.captcha_id);
    }
  };

  const handleAudioSpeak = () => {
    if (!challenge || !challenge.prompt) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      // Clean prompt for natural text-to-speech reading
      const spokenText = challenge.prompt
        .replace('+', 'plus')
        .replace('-', 'minus')
        .replace('*', 'times')
        .replace('=', 'equals');
      
      const utterance = new SpeechSynthesisUtterance(`Security verification: What is ${spokenText}`);
      utterance.rate = 0.9;
      setAudioActive(true);
      utterance.onend = () => setAudioActive(false);
      utterance.onerror = () => setAudioActive(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!required || (config && config.disabled)) {
    return null; // CAPTCHA disabled or not required for current view
  }

  // Active Provider: reCAPTCHA v3 (invisible score badge)
  if (config && config.provider === 'recaptcha' && !recaptchaFailed) {
    return (
      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 justify-center py-1">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>Protected by Google reCAPTCHA v3 (invisible)</span>
      </div>
    );
  }

  // Active Provider: Local Math Challenge (or fallback when reCAPTCHA fails)
  return (
    <div className="p-3 rounded-xl border border-indigo-200 bg-white text-slate-800 dark:bg-slate-900/80 dark:border-indigo-500/30 dark:text-slate-300 space-y-2 text-xs shadow-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
          <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Security Verification (CAPTCHA)
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleAudioSpeak}
            title="Read challenge aloud (Accessibility)"
            className={`p-1.5 rounded-lg border transition ${
              audioActive
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={loadLocalChallenge}
            disabled={loadingChallenge}
            title="Refresh Challenge"
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 rounded-lg transition"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loadingChallenge ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {recaptchaFailed && (
        <p className="text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1 font-bold">
          <AlertCircle className="w-3 h-3" />
          Third-party CAPTCHA unavailable. Switched to offline local verification.
        </p>
      )}

      {challenge ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div
              className="rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 shrink-0 bg-slate-50 dark:bg-slate-950"
              dangerouslySetInnerHTML={{ __html: challenge.svg }}
              aria-label={`CAPTCHA Math Challenge: ${challenge.prompt}`}
            />
            <input
              type="text"
              required
              value={userAnswer}
              onChange={handleAnswerChange}
              placeholder="Answer?"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white dark:placeholder-slate-500 transition font-mono text-center text-sm font-bold tracking-wider"
            />
          </div>
        </div>
      ) : (
        <div className="py-2 text-center text-slate-500">Loading challenge...</div>
      )}
    </div>
  );
};
