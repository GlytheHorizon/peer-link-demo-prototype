import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CHECKS = [
  { label: 'Valid ID submitted', done: true },
  { label: 'Academic background verified', done: true },
  { label: 'Tutor profile complete', done: true },
  { label: 'Subject proficiency confirmed', done: false }
];

export default function Verification() {
  const { user } = useAuth();
  const pct = Math.round((CHECKS.filter((c) => c.done).length / CHECKS.length) * 100);

  return (
    <div>
      <div className="page-head">
        <h2>Verification</h2>
      </div>

      <section className="card verify-card">
        <div className="verify-badge">
          <span className="verify-icon">✓</span>
          <div>
            <h3 style={{ marginTop: 0 }}>Verified Tutor</h3>
            <p className="muted" style={{ margin: 0 }}>
              {user ? `${user.first_name} ${user.last_name}` : 'Your profile'} has passed PeerLink verification.
              Students can see the verified badge on your tutor profile.
            </p>
          </div>
        </div>
        <div className="verify-bar">
          <div className="verify-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="muted small" style={{ margin: '6px 0 0' }}>{pct}% of verification checks completed</p>
      </section>

      <section className="card">
        <h3>Verification Checklist</h3>
        {CHECKS.map((c) => (
          <div className="verify-check" key={c.label}>
            <span className={`verify-check-mark ${c.done ? 'done' : ''}`}>{c.done ? '✓' : '○'}</span>
            <span className={c.done ? '' : 'muted'}>{c.label}</span>
          </div>
        ))}
        <div className="row-actions" style={{ marginTop: 14 }}>
          <Link className="btn btn-primary" to="/profile">Update Profile</Link>
        </div>
      </section>
    </div>
  );
}
