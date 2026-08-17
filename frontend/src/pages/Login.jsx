import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'student@peerlink.edu', password: 'Student@123' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await login(form.email.trim(), form.password);
    setBusy(false);
    if (res.ok) navigate('/dashboard');
    else setError(res.message);
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-side"><span className="logo-dot" /> PeerLink</div>
        <h1>Log in</h1>
        <p className="muted">Welcome back — continue your tutoring journey.</p>
        <form onSubmit={submit} className="form">
          <label>Email</label>
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
          <label>Password</label>
          <input type="password" value={form.password} onChange={set('password')} autoComplete="current-password" required />
          <Alert type="error">{error}</Alert>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        </form>
        <p className="muted small ct-line">
          No account yet? <Link to="/register">Register here</Link>
        </p>
        <details className="demo-details">
          <summary>Demo accounts</summary>
          <table className="table demo-table">
            <tbody>
              <tr><td>student@peerlink.edu</td><td>Student@123</td></tr>
              <tr><td>tutor@peerlink.edu</td><td>Tutor@123</td></tr>
              <tr><td>faculty@peerlink.edu</td><td>Faculty@123</td></tr>
              <tr><td>admin@peerlink.edu</td><td>Admin@123</td></tr>
            </tbody>
          </table>
        </details>
      </div>
    </div>
  );
}