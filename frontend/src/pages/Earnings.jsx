import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { sessionService } from '../services';
import { Spinner, Alert, EmptyState } from '../components/ui';

const RATE_PER_HOUR = 100;

const asDate = (v) => (v instanceof Date ? v : new Date(v));

const fmtLongDate = (d) =>
  asDate(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const fmtAmount = (n) => `₱${Math.round(Number(n) || 0).toLocaleString()}`;

const PERIODS = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' }
];

/** Fallback estimate when a payment has no recorded amount. */
const estimate = (s) => {
  const hrs = Math.max(0, (asDate(s.scheduled_end) - asDate(s.scheduled_start)) / 3600000);
  return hrs * (Number(s.rate_per_hour) || RATE_PER_HOUR);
};

const inPeriod = (date, period) => {
  const d = asDate(date);
  const now = new Date();
  if (period === 'week') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    return d >= start;
  }
  if (period === 'month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  return d.getFullYear() === now.getFullYear();
};

export default function Earnings() {
  const sessions = useApi(sessionService.list, [], 15000);
  const [period, setPeriod] = useState('week');

  const rows = useMemo(() => {
    const all = sessions.data || [];
    const out = [];
    for (const s of all) {
      if (s.pending_payment_id) {
        out.push({
          key: `pending-${s.pending_payment_id}`,
          student: s.student_name,
          subject: s.subject_name,
          amount: Number(s.pending_amount) > 0 ? Number(s.pending_amount) : estimate(s),
          date: s.pending_at || s.created_at || s.scheduled_start,
          status: 'pending'
        });
      } else if (s.payment_id) {
        out.push({
          key: `paid-${s.payment_id}`,
          student: s.student_name,
          subject: s.subject_name,
          amount: Number(s.payment_amount) > 0 ? Number(s.payment_amount) : estimate(s),
          date: s.paid_at || s.created_at || s.scheduled_start,
          status: 'paid'
        });
      }
    }
    return out.sort((a, b) => asDate(b.date) - asDate(a.date));
  }, [sessions.data]);

  const filtered = rows.filter((r) => inPeriod(r.date, period));
  const total = filtered.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="earnings-page">
      <h2 className="earnings-title">Earnings</h2>

      <div className="earn-periods" role="tablist" aria-label="Earnings period">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={period === p.key}
            className={`earn-period-btn ${period === p.key ? 'on' : ''}`}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="earn-total">
        <span className="earn-wallet-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
        </span>
        <div className="earn-total-info">
          <span className="earn-total-label">Total Earnings</span>
          <b className="earn-total-value">{sessions.loading ? '–' : fmtAmount(total)}</b>
        </div>
      </div>

      {sessions.loading && <Spinner />}
      {sessions.error && <Alert type="error">{sessions.error.message}</Alert>}

      {!sessions.loading && !sessions.error && rows.length === 0 && (
        <EmptyState
          title="No earnings yet"
          description="Payments from students will show up here — pending once sent, paid once you confirm them."
          action={<Link className="btn btn-primary" to="/sessions">View Sessions</Link>}
        />
      )}

      {rows.length > 0 && (
        <div className="earn-history">
          <h3>Earnings History</h3>
          <table className="earn-table">
            <thead>
              <tr>
                <th>STUDENT</th>
                <th>SUBJECT</th>
                <th>DATE</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.key}>
                  <td className="earn-student">{r.student}</td>
                  <td>{r.subject}</td>
                  <td>{fmtLongDate(r.date)}</td>
                  <td className="earn-amount">{fmtAmount(r.amount)}</td>
                  <td>
                    <span className={`earn-pill earn-pill--${r.status}`}>
                      {r.status === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="earn-empty">No earnings in this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}