import React, { createContext, useState, useEffect, useContext } from 'react';
import { parseApiError } from '../utils/apiError';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('codeveil_token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('codeveil_user') || 'null'));
  const [loading, setLoading] = useState(false);

  const logout = () => {
    localStorage.removeItem('codeveil_token');
    localStorage.removeItem('codeveil_user');
    setToken(null);
    setUser(null);
  };

  // Verify stored token validity on mount
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          if (res.status === 401) {
            console.warn("Stored JWT token is invalid or expired (401). Clearing session.");
            logout();
          }
        })
        .catch(err => {
          console.error("Token verification network error:", err);
        });
    }
  }, []);

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
      const accessToken = data.access_token;
      localStorage.setItem('codeveil_token', accessToken);
      setToken(accessToken);

      // Fetch user profile
      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (meRes.ok) {
        const userData = await meRes.json();
        setUser(userData);
        localStorage.setItem('codeveil_user', JSON.stringify(userData));
      }
      return true;
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
    <AuthContext.Provider value={{ token, user, setUser, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
