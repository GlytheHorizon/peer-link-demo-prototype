import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GuestRoute } from '../routes/ProtectedRoute';
import { Alert, Modal } from '../components/ui';
import { authService } from '../services';
import { isDemoActive } from '../demo/staticMode';

export default function ForgotPassword() {
  const [form, setForm] = useState({ email: '' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showVisualOnly, setShowVisualOnly] = useState(false);
  const navigate = useNavigate();

  const setField = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    // Static demo: visual representation only — no email is ever sent.
    if (isDemoActive()) {
      setSuccess(true);
      setShowVisualOnly(true);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await authService.requestPasswordReset(form.email.trim().toLowerCase());
    setBusy(false);
    if (res.ok) {
      setSuccess(true);
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="auth-page royal">
      <div className="auth-card">
        <div className="brand-side">
          <svg className="logo-node" width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="#4361ee"/>
            <path d="M8 12h16M8 16h12M8 20h8" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <span>PeerLink</span>
        </div>
        <h1>Forgot Password</h1>
        <p className="muted" style={{ marginBottom: 20 }}>Enter your email and we'll send you a link to reset your password.</p>

        {success && <Alert type="success">If an account with that email exists, a password reset link has been sent. Check your inbox (and spam folder).</Alert>}
        {error && <Alert type="error">{error}</Alert>}

        {!success && (
          <form onSubmit={submit} className="form">
            <label htmlFor="fp-email">Email</label>
            <input
              id="fp-email"
              type="email"
              value={form.email}
              onChange={setField('email')}
              placeholder="you@peerlink.edu"
              autoComplete="email"
              required
              disabled={busy}
            />
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">
              {busy ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="signup-line" style={{ marginTop: 18 }}>
          <Link to="/login">← Back to Login</Link>
        </p>
      </div>

      {showVisualOnly && (
        <Modal title="Static demo — visual only" onClose={() => setShowVisualOnly(false)}>
          <p>
            This is only for <strong>visual representation</strong>. No password-reset
            email was sent and nothing was changed — the static demo has no
            backend, database, or email service.
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setShowVisualOnly(false)}>
            Got it
          </button>
        </Modal>
      )}
    </div>
  );
}