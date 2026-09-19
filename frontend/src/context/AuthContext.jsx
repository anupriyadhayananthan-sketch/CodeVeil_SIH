import React, { createContext, useState, useEffect, useContext } from 'react';
import { parseApiError } from '../utils/apiError';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('codeveil_token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('codeveil_user') || 'null'));
  const [loading, setLoading] = useState(false);

  // True while the silent auto-login is in progress on first load.
  // Start as `true` when there is no existing token so the dashboard never
  // renders (and fires API calls) before the auto-login has completed.
  const [initializing, setInitializing] = useState(
    !localStorage.getItem('codeveil_token')
  );

  const logout = () => {
    localStorage.removeItem('codeveil_token');
    localStorage.removeItem('codeveil_user');
    setToken(null);
    setUser(null);
  };

  /**
   * Internal helper: store a JWT and fetch the matching /me profile, reusing
   * exactly the same localStorage keys and state shape as the real login flow.
   */
  const _applyToken = async (accessToken) => {
    localStorage.setItem('codeveil_token', accessToken);
    setToken(accessToken);

    const meRes = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (meRes.ok) {
      const userData = await meRes.json();
      setUser(userData);
      localStorage.setItem('codeveil_user', JSON.stringify(userData));
    }
  };

  // On initial mount: if there is no valid session token in storage,
  // silently call the demo-session endpoint to obtain a real JWT so every
  // protected API endpoint keeps working without ever showing a login form.
  //
  // ⚠️  DEMO / PRESENTATION ONLY — this auto-login bypasses 2FA using a
  //     backend endpoint (/api/auth/demo-session) that issues a token for
  //     the seeded demo account (officer@cpcl.gov.in / Password123! — from seed.py).
  //     Remove this block (and the backend endpoint) before deploying with
  //     real user data or in any production environment.
  useEffect(() => {
    const existingToken = localStorage.getItem('codeveil_token');

    if (existingToken) {
      // Validate the stored token; clear it if it has expired (401).
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${existingToken}` }
      })
        .then(async (res) => {
          if (res.status === 401) {
            console.warn("Stored JWT token is invalid or expired (401). Refreshing demo session.");
            logout();
            // Fall through to silent re-login below by re-triggering the effect.
            // Simplest: recurse by removing token and calling the endpoint now.
            await _silentDemoLogin();
          }
        })
        .catch(err => {
          console.error("Token verification network error:", err);
        });
    } else {
      // No stored token — perform silent demo auto-login immediately.
      _silentDemoLogin();
    }
  }, []);

  const _silentDemoLogin = async () => {
    setInitializing(true);
    try {
      const res = await fetch('/api/auth/demo-session', { method: 'POST' });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error("Silent demo auto-login failed:", errBody);
        return;
      }
      const data = await res.json();
      if (data.access_token) {
        await _applyToken(data.access_token);
      }
    } catch (err) {
      console.error("Silent demo auto-login network error:", err);
    } finally {
      setInitializing(false);
    }
  };

  const complete2FA = async (accessToken) => {
    setLoading(true);
    try {
      await _applyToken(accessToken);
      return true;
    } catch (err) {
      console.error("2FA completion user fetch error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, name = null, captchaToken = null, captchaId = null) => {
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      if (name) formData.append('name', name);
      if (captchaToken) formData.append('captcha_token', captchaToken);
      if (captchaId) formData.append('captcha_id', captchaId);

      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Auth login API error detail:", err);
        throw new Error(parseApiError(err.detail));
      }

      const data = await res.json();

      if (data.requires_2fa) {
        return {
          requires_2fa: true,
          fa_type: data.fa_type,
          pre_auth_token: data.pre_auth_token,
          email: data.email || email,
          cooldown_seconds: data.cooldown_seconds || 0
        };
      }

      if (data.access_token) {
        await complete2FA(data.access_token);
        return { requires_2fa: false, success: true };
      }

      throw new Error("Invalid authentication response format.");
    } catch (err) {
      console.error("Login submission error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email, password, fullName, role, captchaToken = null, captchaId = null) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          role,
          captcha_token: captchaToken,
          captcha_id: captchaId
        })
      });
      if (!res.ok) {
        const err = await res.json();
        console.error("Auth signup API error detail:", err);
        throw new Error(parseApiError(err.detail));
      }
      return await res.json();
    } catch (err) {
      console.error("Signup submission error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ token, user, setUser, login, complete2FA, signup, logout, loading, initializing }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

