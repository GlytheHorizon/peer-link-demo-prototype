import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useConfirm } from '../context/ConfirmContext';
import { sessionService, conversationService } from '../services';
import { Spinner, Alert, EmptyState, Modal } from '../components/ui';

const RATE_PER_HOUR = 100;
const PAY_METHODS = [
  { key: 'gcash', label: 'GCash', hint: 'Pay with your GCash wallet' },
  { key: 'maya', label: 'Maya', hint: 'Pay with your Maya wallet' },
  { key: 'bank_card', label: 'Bank Card', hint: 'Credit or debit card' }
];

const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const MIN_DURATION_MS = 15 * 60 * 1000;
const MAX_DURATION_MS = 4 * 60 * 60 * 1000;

const fmtDuration = (ms) => {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h && m) return `${h} hr${h > 1 ? 's' : ''} ${m} min`;
  if (h) return `${h} hr${h > 1 ? 's' : ''}`;
  return `${m} min`;
};

const asDate = (v) => (v instanceof Date ? v : new Date(v));

const fmtTime = (d) => asDate(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmtRange = (start, end) => `${fmtTime(start)} - ${fmtTime(end)}`;

const dayTag = (d) => {
  const day = asDate(d);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((day - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return day.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

const STAT_LABELS = {
  upcoming: 'Upcoming Sessions',
  completed: 'Completed Sessions',
  cancelled: 'Cancelled Sessions'
};

const STATUS_META = {
  pending: { label: 'Pending', cls: 'pill--pending' },
  accepted: { label: 'Upcoming', cls: 'pill--accepted' },
  completed: { label: 'Completed', cls: 'pill--completed' },
  cancelled: { label: 'Cancelled', cls: 'pill--cancelled' },
  rejected: { label: 'Rejected', cls: 'pill--cancelled' }
};

function PayModal({ session, onClose, onPaid }) {
  const start = asDate(session.scheduled_start);
  const end = asDate(session.scheduled_end);
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
  const durationMs = scheduleOk ? Math.max(pickedEnd.getTime() - pickedStart.getTime(), MIN_DURATION_MS) : null;
  const hours = durationMs != null ? durationMs / 3600000 : null;
  const tooLong = durationMs != null && durationMs > MAX_DURATION_MS;
  const rate = Number(session.rate_per_hour) || RATE_PER_HOUR;
  const amount = hours != null && !tooLong ? Math.round(hours * rate) : null;

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
            <div className="pay-row"><span>Duration</span><b>{scheduleOk ? fmtDuration(durationMs) : '—'}</b></div>
            <div className="pay-row"><span>Rate</span><b>₱{rate}/hr</b></div>
            <div className="pay-row"><span>Total</span><b className="pay-total">{amount == null ? '—' : `₱${amount}`}</b></div>
            {amount != null && (
              <p className="muted small" style={{ margin: '6px 0 0' }}>
                {fmtDuration(durationMs)} × ₱{rate}/hr = ₱{amount}
              </p>
            )}
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
          {tooLong && <p className="muted small" style={{ color: 'var(--danger, #dc3545)' }}>Sessions are limited to 4 hours — please shorten the schedule.</p>}

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
            <button className="btn btn-primary" disabled={busy || !scheduleOk || tooLong}>
              {busy ? 'Processing payment…' : `Confirm Payment (₱${amount == null ? '—' : amount})`}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function RescheduleModal({ session, onClose, onSent }) {
  const confirm = useConfirm();
  const start = asDate(session.scheduled_start);
  const end = asDate(session.scheduled_end);
  const durationMs = Math.max(end.getTime() - start.getTime(), MIN_DURATION_MS);
  const [date, setDate] = useState(toDateInput(start));
  const [startTime, setStartTime] = useState(toTimeInput(start));
  const [endTime, setEndTime] = useState(toTimeInput(end));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(false);

  const shiftEnd = (d, sTime) => {
    const s = new Date(`${d}T${sTime}`);
    if (Number.isNaN(s.getTime())) return;
    setEndTime(toTimeInput(new Date(s.getTime() + durationMs)));
  };

  useEffect(() => {
    shiftEnd(date, startTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, startTime]);

  const onDateChange = (v) => {
    setDate(v);
    shiftEnd(v, startTime);
  };

  const onStartTimeChange = (v) => {
    setStartTime(v);
    shiftEnd(date, v);
  };

  const pickedStart = new Date(`${date}T${startTime}`);
  const pickedEnd = new Date(`${date}T${endTime}`);
  const scheduleOk =
    !Number.isNaN(pickedStart.getTime()) &&
    !Number.isNaN(pickedEnd.getTime()) &&
    pickedEnd.getTime() > pickedStart.getTime();

  const submit = async (e) => {
    e.preventDefault();
    if (!scheduleOk) {
      setErr('Pick a date and an end time that comes after the start time');
      return;
    }
    const ok = await confirm({
      title: 'Send reschedule request?',
      message: `Send a reschedule request to ${session.tutor_name || session.student_name} for ${dayTag(pickedStart)} at ${fmtTime(pickedStart)}?`,
      confirmText: 'Send Request'
    });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    const res = await sessionService.rescheduleRequests.create(session.id, {
      scheduled_start: pickedStart.toISOString(),
      scheduled_end: pickedEnd.toISOString(),
      reason: reason.trim() || 'I would like to move this session to a different schedule.'
    });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      onSent(res.data);
    } else setErr(res.message);
  };

  return (
    <Modal title="Reschedule Session" onClose={onClose}>
      {done ? (
        <div>
          <Alert type="success">Reschedule request sent — waiting for the tutor to confirm. Your session keeps its current schedule until they approve.</Alert>
          <div className="row-actions" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <div className="pay-summary">
            <b className="pay-tutor">{session.subject_name} with {session.tutor_name || session.student_name}</b>
            <div className="pay-row"><span>Current</span><b>{dayTag(start)} · {fmtRange(start, end)}</b></div>
            <div className="pay-row"><span>Duration</span><b>{fmtDuration(durationMs)} (locked)</b></div>
          </div>

          <label>Select Date</label>
          <input
            type="date"
            value={date}
            min={toDateInput(new Date())}
            onChange={(e) => onDateChange(e.target.value)}
            required
          />
          <div className="grid-2">
            <div>
              <label>Select Time (start)</label>
              <input type="time" value={startTime} onChange={(e) => onStartTimeChange(e.target.value)} required />
            </div>
            <div>
              <label>Select Time (end)</label>
              <input type="time" value={endTime} readOnly disabled />
            </div>
          </div>

          <label>Reason</label>
          <textarea
            rows={3}
            value={reason}
            placeholder="Tell the other party why you'd like to move this session (optional)"
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="muted small">The session keeps its paid duration of {fmtDuration(durationMs)} — only the start time (and date) can be moved.</p>

          {err && <Alert type="error">{err}</Alert>}
          <div className="row-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" disabled={busy || !scheduleOk}>
              {busy ? 'Sending…' : 'Send Request'}
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
  const navigate = useNavigate();
  const confirm = useConfirm();
  const sessions = useApi(sessionService.list);
  const [filter, setFilter] = useState('upcoming');
  const [paying, setPaying] = useState(null);
  const [rescheduling, setRescheduling] = useState(null);
  const [notice, setNotice] = useState(null);

  const all = sessions.data || [];
  const isTutor = user.role_key === 'tutor';

  const upcoming = all.filter((s) => s.status === 'pending' || s.status === 'accepted');
  const completed = all.filter((s) => s.status === 'completed');
  const cancelled = all.filter((s) => s.status === 'cancelled' || s.status === 'rejected');

  const filtered = filter === 'upcoming' ? upcoming : filter === 'completed' ? completed : cancelled;

  const next = [...upcoming].sort(
    (a, b) => asDate(a.scheduled_start) - asDate(b.scheduled_start)
  )[0];
  const nextStart = next ? asDate(next.scheduled_start) : null;
  const startsToday = nextStart && dayTag(nextStart) === 'Today';
  const nextWho = next ? (isTutor ? next.student_name : next.tutor_name) : null;

  /** Opens the conversation of a session; falls back to creating/finding it. */
  const openSessionChat = async (s, role) => {
    if (s.conversation_id) {
      navigate(`/messages/${s.conversation_id}`);
      return;
    }
    const res = role === 'tutor'
      ? await conversationService.start(Number(s.student_id), Number(s.subject_id), 'tutor')
      : await conversationService.start(Number(s.tutor_id), Number(s.subject_id));
    if (res.ok && res.data?.id) navigate(`/messages/${res.data.id}`);
    else if (res.ok) navigate('/messages');
    else setNotice({ type: 'error', text: res.message });
  };

  const chatTutor = async (s) => openSessionChat(s, 'student');

  const chatStudent = async (s) => openSessionChat(s, 'tutor');

  const cancelSession = async (s) => {
    const ok = await confirm({
      title: 'Cancel session?',
      message: `Cancel the ${s.subject_name} session with ${s.tutor_name || s.student_name}?`,
      confirmText: 'Cancel session'
    });
    if (!ok) return;
    const res = await sessionService.cancel(s.id);
    if (res.ok) { setNotice({ type: 'success', text: res.message }); sessions.reload(); }
    else setNotice({ type: 'error', text: res.message });
  };

  const respondReschedule = async (s, decision) => {
    const who = s.tutor_name || s.student_name;
    const ok = await confirm({
      title: decision === 'accepted' ? 'Confirm new schedule?' : 'Decline reschedule?',
      message: decision === 'accepted'
        ? `Move this session to ${dayTag(s.reschedule_start)} at ${fmtTime(s.reschedule_start)}?`
        : `Decline ${who}'s reschedule request? The session keeps its current schedule.`,
      confirmText: decision === 'accepted' ? 'Confirm Schedule' : 'Decline Request'
    });
    if (!ok) return;
    const res = await sessionService.rescheduleRequests.respond(s.id, s.reschedule_request_id, decision);
    if (res.ok) { setNotice({ type: 'success', text: res.message }); sessions.reload(); }
    else setNotice({ type: 'error', text: res.message });
  };

  return (
    <div>
      <div className="page-head">
        <h2>Sessions</h2>
        {!isTutor && <Link className="btn btn-primary" to="/sessions/new">+ Request session</Link>}
      </div>
      {sessions.loading && <Spinner />}
      {sessions.error && <Alert type="error">{sessions.error.message}</Alert>}
      {notice && <Alert type={notice.type}>{notice.text}</Alert>}

      <div className="dash-stats">
        {['upcoming', 'completed', 'cancelled'].map((key) => (
          <div className="dash-stat" key={key}>
            <span className="dash-stat-label">{STAT_LABELS[key]}</span>
            <span className={`dash-stat-value ${key === 'completed' ? 'is-green' : ''}`}>
              {sessions.loading ? '–' : (key === 'upcoming' ? upcoming.length : key === 'completed' ? completed.length : cancelled.length)}
            </span>
          </div>
        ))}
      </div>

      {next && (
        <section className="upcoming-banner">
          <div>
            <span className="upcoming-label">Next Sessions</span>
            <h2 className="upcoming-title">{next.subject_name} with {nextWho}</h2>
            <span className="upcoming-time">
              {startsToday
                ? `Your session starts today at ${fmtTime(nextStart)}`
                : `Your session starts on ${dayTag(nextStart)} at ${fmtTime(nextStart)}`}
            </span>
          </div>
          {!isTutor ? (
            <button type="button" className="btn-join" onClick={() => chatTutor(next)}>
              Chat Tutor
            </button>
          ) : (
            <button type="button" className="btn-join" onClick={() => chatStudent(next)}>
              Chat Student
            </button>
          )}
        </section>
      )}

      <div className="session-tabs">
        {(['upcoming', 'completed', 'cancelled']).map((key) => (
          <button
            key={key}
            className={`session-tab ${filter === key ? 'on' : ''}`}
            onClick={() => setFilter(key)}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 && !sessions.loading && (
        <EmptyState
          title={`No ${filter === 'upcoming' ? 'upcoming' : filter} sessions`}
          description={isTutor ? 'Students will send you tutoring requests.' : 'Request a session with a matched tutor to get started.'}
          action={!isTutor ? <Link className="btn btn-primary" to="/matches">Find Tutors</Link> : null}
        />
      )}

      <div className="session-list">
        {filtered.map((s) => {
          const meta = STATUS_META[s.status] || { label: s.status, cls: '' };
          const start = asDate(s.scheduled_start);
          const end = asDate(s.scheduled_end);
          const otherName = isTutor ? s.student_name : s.tutor_name;
          const active = s.status === 'pending' || s.status === 'accepted';
          const hasPendingReq = !!s.reschedule_request_id;
          const myRequest = hasPendingReq && Number(s.reschedule_requester_id) === Number(user.id);
          return (
            <div className="session-card" key={s.id}>
              <div className="session-card-main">
                <Link className="session-card-title" to={`/sessions/${s.id}`}>{s.subject_name} Session</Link>
                <p className="session-card-sub">
                  {isTutor ? 'Student' : 'Tutor'}:{' '}
                  {isTutor ? (
                    <button
                      type="button"
                      className="session-card-name"
                      onClick={() => chatStudent(s)}
                      title={`Open conversation with ${otherName}`}
                    >
                      {otherName}
                    </button>
                  ) : (
                    <Link className="session-card-name" to={`/tutors/${s.tutor_id}`}>{otherName}</Link>
                  )}
                </p>
                <div className="session-pills">
                  <span className="pill pill--neutral">{dayTag(start)}</span>
                  <span className="pill pill--neutral">{fmtRange(start, end)}</span>
                  <span className={`pill ${meta.cls}`}>{meta.label}</span>
                  {hasPendingReq && (
                    <span className="pill pill--reschedule">
                      {myRequest ? 'Awaiting Confirmation' : 'Reschedule Requested'}
                    </span>
                  )}
                </div>
              </div>
              <div className="session-actions">
                {!isTutor && s.status === 'accepted' && !s.payment_id && (
                  <button
                    className="action-btn action-btn--pay"
                    onClick={() => setPaying(s)}
                  >
                    Pay
                  </button>
                )}
                {active && (
                  <>
                    {!hasPendingReq && (
                      <button className="action-btn action-btn--reschedule" onClick={() => setRescheduling(s)}>
                        Reschedule
                      </button>
                    )}
                    {hasPendingReq && !myRequest && (
                      <>
                        <button className="action-btn action-btn--chat" onClick={() => respondReschedule(s, 'accepted')}>
                          Confirm
                        </button>
                        <button className="action-btn action-btn--cancel" onClick={() => respondReschedule(s, 'rejected')}>
                          Decline
                        </button>
                      </>
                    )}
                    <button className="action-btn action-btn--cancel" onClick={() => cancelSession(s)}>
                      Cancel
                    </button>
                  </>
                )}
                {!isTutor ? (
                  <button className="action-btn action-btn--chat" onClick={() => chatTutor(s)}>
                    Chat Tutor
                  </button>
                ) : (
                  <button className="action-btn action-btn--chat" onClick={() => chatStudent(s)}>
                    Chat Student
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {paying && (
        <PayModal
          session={paying}
          onClose={() => setPaying(null)}
          onPaid={() => { setPaying(null); sessions.reload(); }}
        />
      )}
      {rescheduling && (
        <RescheduleModal
          session={rescheduling}
          onClose={() => setRescheduling(null)}
          onSent={() => { setRescheduling(null); sessions.reload(); }}
        />
      )}
    </div>
  );
}