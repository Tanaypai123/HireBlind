import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/http.js';

const AuthContext = createContext(null);

function getStoredToken() {
  try {
    return localStorage.getItem('hb_token');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // loading | anon | authed
  const [user, setUser] = useState(null);

  async function refresh() {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setStatus('anon');
      return;
    }
    try {
      const me = await apiFetch('/api/auth/me');
      setUser(me.user);
      setStatus('authed');
    } catch {
      try {
        localStorage.removeItem('hb_token');
      } catch {
        // ignore
      }
      setUser(null);
      setStatus('anon');
    }
  }

  async function login(email, password) {
    const data = await apiFetch('/api/auth/login', { method: 'POST', body: { email, password } });
    localStorage.setItem('hb_token', data.token);
    await refresh();
    return data;
  }

  function logout() {
    try {
      localStorage.removeItem('hb_token');
    } catch {
      // ignore
    }
    setUser(null);
    setStatus('anon');
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ status, user, login, logout, refresh }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

