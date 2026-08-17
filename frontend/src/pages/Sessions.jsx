import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { sessionService } from '../services';
import { Spinner, Alert, StatusBadge, EmptyState, Modal, formatDateTime } from '../components/ui';

const RATE_PER_HOUR = 100;
const PAY_METHODS = [
  { key: 'gcash', label: 'GCash', hint: 'Pay with your GCash wallet' },
  { key: 'maya', label: 'Maya', hint: 'Pay with your Maya wallet' },
  { key: 'bank_card', label: 'Bank Card', hint: 'Credit or debit card' }
];

const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function PayModal({ session, onClose, onPaid }) {
  const start = new Date(session.scheduled_start);
  const end = new Date(session.scheduled_end);
  const [method, setMethod] = useState('gcash');
  const [date, setDate] = useState(toDateInput(start));
  const [startTime, setStartTime] = useState(toTimeInput(start));
  const [endTime, setEndTime] = useState(toTimeInput(end));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(false);

  const pickedStart = new Date(`${date}T${startTime}`);
  const pickedEnd = new Date(`${date}T${endTime}`);
  const scheduleOk =
    !Number.isNaN(pickedStart.getTime()) &&
    !Number.isNaN(pickedEnd.getTime()) &&
    pickedEnd.getTime() > pickedStart.getTime();
  const amount = scheduleOk
    ? Math.round(Math.max((pickedEnd - pickedStart) / 3600000, 15 / 60) * RATE_PER_HOUR)
    : null;

  const submit = async (e) => {
    e.preventDefault();
    if (!scheduleOk) {
      setErr('Pick a date and an end time that comes after the start time');
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await sessionService.pay(session.id, {
      method,
      scheduled_start: pickedStart.toISOString(),
      scheduled_end: pickedEnd.toISOString()
    });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      onPaid(res.data);
    } else setErr(res.message);
  };

  return (
    <Modal title="Pay Session" onClose={onClose}>
      {done ? (
        <div>
          <Alert type="success">Payment recorded — your session is confirmed!</Alert>
          <div className="row-actions" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <div className="pay-summary">
            <b className="pay-tutor">{session.tutor_name}</b>
            <div className="pay-row"><span>Subject</span><b>{session.subject_name}</b></div>
            <div className="pay-row"><span>Rate</span><b>{RATE_PER_HOUR}/hr</b></div>
            <div className="pay-row"><span>Total</span><b className="pay-total">{amount == null ? '—' : amount}</b></div>
          </div>

          <label>Date</label>
          <input
            type="date"
            value={date}
            min={toDateInput(new Date())}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <div className="grid-2">
            <div>
              <label>Start time</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div>
              <label>End time</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>
          <p className="muted small">The total updates live — set the schedule, then confirm payment.</p>

          <label className="pay-method-label">Mode of Payment</label>
          <div className="pay-methods">
            {PAY_METHODS.map((m) => (
              <label key={m.key} className={`pay-method ${method === m.key ? 'on' : ''}`}>
                <input
                  type="radio"
                  name="pay-method"
                  value={m.key}
                  checked={method === m.key}
                  onChange={() => setMethod(m.key)}
                />
                <span className="pay-method-name">{m.label}</span>
                <span className="pay-method-hint">{m.hint}</span>
              </label>
            ))}
          </div>

          {err && <Alert type="error">{err}</Alert>}
          <div className="row-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" disabled={busy || !scheduleOk}>
              {busy ? 'Processing payment…' : `Confirm Payment (${amount == null ? '—' : amount})`}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function Sessions() {
  const { user } = useAuth();
  const sessions = useApi(sessionService.list);
  const [filter, setFilter] = useState('all');
  const [paying, setPaying] = useState(null);

  const filtered = (sessions.data || []).filter((s) => filter === 'all' || s.status === filter);
  const isTutor = user.role_key === 'tutor';

  return (
    <div>
      <div className="page-head">
        <h2>My Sessions</h2>
        {!isTutor && <Link className="btn btn-primary" to="/sessions/new">+ Request session</Link>}
      </div>
      {sessions.loading && <Spinner />}
      {sessions.error && <Alert type="error">{sessions.error.message}</Alert>}

      <div className="filter-row">
        {['all', 'pending', 'accepted', 'completed', 'rejected', 'cancelled'].map((f) => (
          <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 && !sessions.loading && (
        <EmptyState
          title="No sessions here"
          description={isTutor ? 'Students will send you tutoring requests.' : 'Request a session with a matched tutor to get started.'}
          action={!isTutor ? <Link className="btn btn-primary" to="/matches">Find Tutors</Link> : null}
        />
      )}

      <div className="session-list">
        {filtered.map((s) => (
          <Link key={s.id} to={`/sessions/${s.id}`} className="card session-row">
            <div>
              <b>{s.subject_name}</b>
              <p className="muted small">
                {isTutor ? `Student: ${s.student_name}` : `Tutor: ${s.tutor_name}`} · {formatDateTime(s.scheduled_start)}
              </p>
              {s.topic && <p className="muted small">“{s.topic}”</p>}
            </div>
            <div className="session-meta">
              <StatusBadge status={s.status} />
              {!isTutor && s.status === 'accepted' && !s.payment_id && (
                <button
                  className="btn btn-pay"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPaying(s); }}
                >
                  Pay
                </button>
              )}
              {s.payment_id && <span className="badge badge-completed">Paid</span>}
              {s.evaluation_id != null && <span className="badge badge-completed">Rated {s.evaluation_rating}★</span>}
            </div>
          </Link>
        ))}
      </div>

      {paying && (
        <PayModal
          session={paying}
          onClose={() => setPaying(null)}
          onPaid={() => { setPaying(null); sessions.reload(); }}
        />
      )}
    </div>
  );
}