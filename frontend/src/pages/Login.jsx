import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui';

const ROLES = { student: 'Student', tutor: 'Tutor' };

function EyeIcon({ open }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      )}
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('student');
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="login-page">
      <section className="login-hero">
        <div className="hero-brand"><span>PeerLink</span><span>Tutoring</span></div>
        <div className="hero-visual"><img src="/logo.svg" className="hero-logo" alt="PeerLink logo" /></div>
      </section>

      <section className="login-col">
        <div className="login-panel">
          <div className="login-logo"><img src="/logo.svg" width="26" height="26" alt="PeerLink logo" /></div>
          <h2>Welcome Back!</h2>
          <p className="login-sub">Login to continue to PeerLink</p>

          <div className="role-switch" role="tablist" aria-label="Choose your role">
            {Object.entries(ROLES).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={role === key}
                className={`role-btn ${role === key ? 'on' : ''}`}
                onClick={() => setRole(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="login-form">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="you@peerlink.edu"
              autoComplete="email"
              required
            />

            <div className="pwd-row">
              <label htmlFor="login-password">Password</label>
              <span className="forgot">
                <Link to="/forgot-password">Forgot Password?</Link>
              </span>
            </div>
            <div className="password-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>

            {error && <Alert type="error">{error}</Alert>}

            <button className="login-btn" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Login'}
            </button>
          </form>

          <hr className="login-divider" />
          <p className="signup-line">
            Don&rsquo;t have an account?{' '}
            <Link to={role === 'tutor' ? '/register/tutor' : '/register'}>
              Create {role === 'tutor' ? 'Tutor' : 'Student'} Account
            </Link>
          </p>
          <p className="signup-line" style={{ marginTop: 8 }}>
            Administrator? <Link to="/admin/login">Admin Login</Link>
          </p>

          <details className="demo-details">
            <summary>Demo accounts</summary>
            <table className="table demo-table">
              <tbody>
                {[
                  ['student@peerlink.edu', 'Student@123'],
                  ['mike.chen@peerlink.edu', 'Student@123'],
                  ['maria@peerlink.edu', 'Tutor@123'],
                  ['gerome@peerlink.edu', 'Tutor@123'],
                  ['kiel@peerlink.edu', 'Tutor@123']
                ].map(([email, password]) => (
                  <tr
                    key={email}
                    className="demo-row-click"
                    onClick={() => { setForm({ email, password }); setError(null); }}
                    title="Click to fill"
                  >
                    <td>{email}</td><td>{password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      </section>
    </div>
  );
}