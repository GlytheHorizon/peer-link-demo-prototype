import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui';

function ShieldIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l7 3v5c0 4.5-3 8.4-7 9.7C8 19.4 5 15.5 5 11V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AdminLogin() {
  const { adminLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await adminLogin(form.email.trim(), form.password);
    setBusy(false);
    if (res.ok) navigate('/dashboard');
    else setError(res.message);
  };

  return (
    <div className="auth-page royal">
      <div className="auth-card">
        <Link to="/login" className="back-home"><span aria-hidden="true">←</span> Back to user login</Link>
        <div className="brand-side"><span className="logo-dot" /> PeerLink</div>
        <div className="admin-badge"><ShieldIcon /></div>
        <h1 className="center" style={{ marginTop: 10 }}>Admin Login</h1>
        <p className="muted center">
          Restricted access for PeerLink administrators only.
        </p>

        <form className="form" onSubmit={submit}>
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="admin@peerlink.edu"
            autoComplete="email"
            required
          />
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          <Alert type="error">{error}</Alert>

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <details className="demo-details">
          <summary>Demo account</summary>
          <table className="table demo-table">
            <tbody>
              <tr
                className="demo-row-click"
                onClick={() => { setForm({ email: 'admin@peerlink.edu', password: 'Admin@123' }); setError(null); }}
                title="Click to fill"
              >
                <td>admin@peerlink.edu</td><td>Admin@123</td>
              </tr>
            </tbody>
          </table>
        </details>

        <p className="muted small ct-line center">
          Not an admin? <Link to="/login">Student / Tutor login</Link>
        </p>
      </div>
    </div>
  );
}
