import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authService } from '../services/auth';
import { getToken, setToken } from '../services/api';

const AuthContext = createContext(null);

const ROLE_LABELS = { student: 'Student', tutor: 'Tutor', faculty: 'Faculty', admin: 'Administrator' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const restore = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    const res = await authService.me();
    if (res.ok) setUser(res.data);
    else setToken(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    restore();
  }, [restore]);

  const login = useCallback(async (email, password) => {
    const res = await authService.login({ email, password });
    if (res.ok) {
      setToken(res.data.token);
      setUser(res.data.user);
    }
    return res;
  }, []);

  const adminLogin = useCallback(async (email, password) => {
    const res = await authService.adminLogin({ email, password });
    if (res.ok) {
      setToken(res.data.token);
      setUser(res.data.user);
    }
    return res;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await authService.register(payload);
    if (res.ok) {
      setToken(res.data.token);
      setUser(res.data.user);
    }
    return res;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout().catch(() => {});
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getToken()) return;
    const res = await authService.me();
    if (res.ok) {
      setUser(res.data);
    } else {
      console.error('[AuthContext] refreshUser failed:', res.status, res.message);
      // Don't clear token on 401 - might be a transient issue; let user manually re-login if needed
      if (res.status !== 401) setToken(null);
    }
  }, []);

  const updateVerificationStatus = useCallback((status) => {
    setUser(prev => prev ? { ...prev, verification_status: status } : null);
  }, []);

  const isRole = useCallback(
    (...roles) => Boolean(user && roles.includes(user.role_key)),
    [user]
  );

  const value = {
    user,
    loading,
    login,
    adminLogin,
    register,
    logout,
    refreshUser,
    updateVerificationStatus,
    isRole,
    roleLabel: user ? ROLE_LABELS[user.role_key] : ''
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}