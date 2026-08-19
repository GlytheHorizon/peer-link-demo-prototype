import React from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { sessionService } from '../services';
import { Spinner, Alert, EmptyState } from '../components/ui';

const RATE_PER_HOUR = 100;

const asDate = (v) => (v instanceof Date ? v : new Date(v));

const fmtShortDate = (d) =>
  asDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const fmtTime12 = (d) =>
  asDate(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '');

export default function Earnings() {
  const sessions = useApi(sessionService.list);

  const all = sessions.data || [];
  const completed = all
    .filter((s) => s.status === 'completed' && s.payment_id)
    .sort((a, b) => asDate(b.scheduled_end) - asDate(a.scheduled_end));

  const amountOf = (s) => {
    const paid = Number(s.payment_amount);
    const rate = Math.max(0, (asDate(s.scheduled_end) - asDate(s.scheduled_start)) / 3600000) * (Number(s.rate_per_hour) || RATE_PER_HOUR);
    return paid > 0 ? paid : rate;
  };

  const total = completed.reduce((sum, s) => sum + amountOf(s), 0);
  const pending = all.filter((s) => s.status === 'accepted' && s.pending_payment_id).length;

  return (
    <div>
      <div className="page-head">
        <h2>Earnings</h2>
      </div>
      {sessions.loading && <Spinner />}
      {sessions.error && <Alert type="error">{sessions.error.message}</Alert>}

      <div className="stat-cards">
        <div className="stat-card"><b>₱{sessions.loading ? '–' : Math.round(total)}</b><span>Total earnings</span></div>
        <div className="stat-card"><b>{sessions.loading ? '–' : completed.length}</b><span>Paid sessions</span></div>
        <div className="stat-card"><b>{pending}</b><span>Payments to confirm</span></div>
      </div>

      {!sessions.loading && completed.length === 0 && (
        <EmptyState
          title="No earnings yet"
          description="Completed sessions with confirmed payments will show up here."
          action={<Link className="btn btn-primary" to="/sessions">View Sessions</Link>}
        />
      )}

      <div className="student-list">
        {completed.map((s) => (
          <div className="student-card" key={s.id}>
            <span className="req-avatar">{s.student_name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
            <div className="req-main">
              <b className="req-name">{s.subject_name} with {s.student_name}</b>
              <span className="req-subject">{fmtShortDate(s.scheduled_start)} · {fmtTime12(s.scheduled_start)} - {fmtTime12(s.scheduled_end)}</span>
            </div>
            <div className="req-meta">
              <span className="req-time">Earned</span>
              <b className="req-sched-value is-earned">₱{Math.round(amountOf(s))}</b>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
