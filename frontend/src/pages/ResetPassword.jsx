import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GuestRoute } from '../routes/ProtectedRoute';
import { Alert, Spinner } from '../components/ui';
import { authService } from '../services';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [validating, setValidating] = useState(true);
  const navigate = useNavigate();

  const setField = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token.');
      setValidating(false);
    } else {
      setValidating(false);
    }
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (!token) return;
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await authService.resetPassword(token, form.password);
    setBusy(false);
    if (res.ok) {
      setSuccess(true);
    } else {
      setError(res.message);
    }
  };

  if (validating) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="spinner-wrap"><div className="spinner" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-side">
          <svg className="logo-node" width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="#4361ee"/>
            <path d="M8 12h16M8 16h12M8 20h8" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <span>PeerLink</span>
        </div>
        <h1>Reset Password</h1>

        {success && (
          <>
            <Alert type="success">Your password has been reset successfully.</Alert>
            <p className="muted" style={{ marginBottom: 20 }}>You can now log in with your new password.</p>
            <Link to="/login" className="btn btn-primary btn-block">Go to Login</Link>
          </>
        )}

        {!success && (
          <>
            {error && <Alert type="error">{error}</Alert>}
            {!error && !token && <Alert type="error">Invalid or expired reset link. Please request a new one.</Alert>}
            {token && (
              <form onSubmit={submit} className="form">
                <p className="muted" style={{ marginBottom: 20 }}>Enter your new password below.</p>
                <label htmlFor="rp-password">New Password (min 8 characters)</label>
                <input
                  id="rp-password"
                  type="password"
                  value={form.password}
                  onChange={setField('password')}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  required
                  disabled={busy}
                  minLength={8}
                />
                <label htmlFor="rp-confirm">Confirm New Password</label>
                <input
                  id="rp-confirm"
                  type="password"
                  value={form.confirmPassword}
                  onChange={setField('confirmPassword')}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  required
                  disabled={busy}
                />
                <button className="btn btn-primary btn-block" disabled={busy} type="submit">
                  {busy ? 'Resetting…' : 'Reset Password'}
                </button>
              </form>
            )}
            <p className="signup-line" style={{ marginTop: 18 }}>
              <Link to="/login">← Back to Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}