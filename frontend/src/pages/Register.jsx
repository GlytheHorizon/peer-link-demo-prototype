import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm: '',
    role: 'student',
    year_level: 1,
    course: ''
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    const res = await register({
      email: form.email.trim(),
      password: form.password,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      role: form.role,
      year_level: form.role === 'student' ? Number(form.year_level) : undefined,
      course: form.course.trim() || undefined
    });
    setBusy(false);
    if (res.ok) navigate('/dashboard');
    else setError(res.message);
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="auth-page">
      <div className="auth-card wide">
        <div className="brand-side"><span className="logo-dot" /> PeerLink</div>
        <h1>Create your account</h1>
        <p className="muted">Join as a student needing help — or as a tutor ready to teach.</p>
        <form onSubmit={submit} className="form">
          <div className="grid-2">
            <div>
              <label>Role</label>
              <select value={form.role} onChange={set('role')}>
                <option value="student">Student (I need help)</option>
                <option value="tutor">Tutor (I want to teach)</option>
              </select>
            </div>
            <div>
              <label>Course / program</label>
              <input value={form.course} onChange={set('course')} placeholder="e.g. Computer Science" />
            </div>
          </div>
          <div className="grid-2">
            <div>
              <label>First name</label>
              <input value={form.first_name} onChange={set('first_name')} required />
            </div>
            <div>
              <label>Last name</label>
              <input value={form.last_name} onChange={set('last_name')} required />
            </div>
          </div>
          <label>Email</label>
          <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
          {form.role === 'student' && (
            <div>
              <label>Year level</label>
              <select value={form.year_level} onChange={set('year_level')}>
                {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
          )}
          <div className="grid-2">
            <div>
              <label>Password (min 8 chars)</label>
              <input type="password" value={form.password} onChange={set('password')} required autoComplete="new-password" />
            </div>
            <div>
              <label>Confirm password</label>
              <input type="password" value={form.confirm} onChange={set('confirm')} required autoComplete="new-password" />
            </div>
          </div>
          <Alert type="error">{error}</Alert>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Register'}</button>
        </form>
        <p className="muted small ct-line">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}