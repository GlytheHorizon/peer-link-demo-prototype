import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth';
import { Alert, Spinner, formatDateTime } from '../components/ui';

const STATUS_META = {
  pending: { title: 'Waiting for Approval', icon: '⏳', className: 'pending', note: 'Our team is reviewing your credentials and documents. This usually takes 24–48 hours.' },
  approved: { title: 'Verified Tutor', icon: '✓', className: 'approved', note: 'You have passed PeerLink verification. Students can see the verified badge on your tutor profile.' },
  rejected: { title: 'Verification Rejected', icon: '!', className: 'rejected', note: 'Your application did not pass verification. Please review your documents and reapply.' }
};

export default function Verification() {
  const { user } = useAuth();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await authService.myApplication();
    if (res.ok) setApp(res.data);
    else if (res.status === 404) setApp(null);
    else setError(res.message);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;

  if (error) {
    return (
      <div>
        <div className="page-head"><h2>Verification</h2></div>
        <Alert type="error">{error}</Alert>
      </div>
    );
  }

  if (!app) {
    return (
      <div>
        <div className="page-head"><h2>Verification</h2></div>
        <section className="card empty-state">
          <h3>No application found</h3>
          <p>You have not submitted a tutor verification application yet.</p>
          <Link className="btn btn-primary" to="/register/tutor">Apply as a Tutor</Link>
        </section>
      </div>
    );
  }

  const status = STATUS_META[app.status] || STATUS_META.pending;
  const checks = [
    { label: 'Application details complete', done: Boolean(app.email && app.phone && app.hourly_rate != null) },
    { label: 'Teaching license uploaded', done: Boolean(app.license_file) },
    { label: 'Government ID uploaded', done: Boolean(app.id_file) },
    { label: 'Approved by PeerLink', done: app.status === 'approved' }
  ];
  const pct = Math.round((checks.filter((c) => c.done).length / checks.length) * 100);

  return (
    <div>
      <div className="page-head">
        <h2>Verification</h2>
      </div>

      <section className={`card verify-card verify-card--${status.className}`}>
        <div className="verify-badge">
          <span className="verify-icon">{status.icon}</span>
          <div>
            <h3 style={{ marginTop: 0 }}>{status.title}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {user ? `${user.first_name} ${user.last_name}` : 'Your profile'} · {formatDateTime(app.created_at)}
            </p>
          </div>
        </div>
        <div className="verify-bar">
          <div className="verify-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="muted small" style={{ margin: '6px 0 0' }}>{pct}% of verification checks completed</p>
        <p className="muted small" style={{ margin: '2px 0 0' }}>{status.note}</p>
      </section>

      <section className="card">
        <h3>Verification Checklist</h3>
        {checks.map((c) => (
          <div className="verify-check" key={c.label}>
            <span className={`verify-check-mark ${c.done ? 'done' : ''}`}>{c.done ? '✓' : '○'}</span>
            <span className={c.done ? '' : 'muted'}>{c.label}</span>
          </div>
        ))}
        <div className="row-actions" style={{ marginTop: 14 }}>
          {app.status === 'approved' ? (
            <Link className="btn btn-primary" to="/profile">Update Profile</Link>
          ) : app.status === 'rejected' ? (
            <Link className="btn btn-primary" to="/register/tutor">Reapply</Link>
          ) : (
            <Link className="btn btn-primary" to="/profile">Update Profile</Link>
          )}
        </div>
      </section>
    </div>
  );
}