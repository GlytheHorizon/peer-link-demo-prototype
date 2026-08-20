import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useConfirm } from '../context/ConfirmContext';
import { sessionService, conversationService } from '../services';
import { Spinner, Alert, EmptyState, Modal } from '../components/ui';
import RescheduleModal from '../components/RescheduleModal';
import CancelSessionModal, { useCancelWindow, CancelCountdown } from '../components/CancelSessionModal';

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
const fmtDateTime = (d) => asDate(d).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

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
  cancelled: 'Cancelled Sessions',
  rejected: 'Rejected Requests'
};

const STATUS_META = {
  pending: { label: 'Pending', cls: 'pill--pending' },
  accepted: { label: 'Waiting for payment', cls: 'pill--accepted' },
  completed: { label: 'Completed', cls: 'pill--completed' },
  cancelled: { label: 'Cancelled', cls: 'pill--cancelled' },
  rejected: { label: 'Rejected', cls: 'pill--cancelled' }
};

const initialsOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => (p[0] || '').toUpperCase()).join('') || '?';
};

function ChatIconButton({ onClick, label }) {
  return (
    <button type="button" className="sc-icon-btn" onClick={onClick} title={label} aria-label={label}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}

/** Compact tutor session card: avatar, student name, schedule, rate, actions. */
function TutorSessionCard({
  session: s,
  onChat,
  onCancel,
  onAccept,
  onReject,
  onConfirmReschedule,
  onDeclineReschedule,
  onConfirmPayment,
  hasPendingReq,
  myRequest
}) {
  const meta = STATUS_META[s.status] || { label: s.status, cls: '' };
  const statusLabel = s.status === 'accepted' && s.payment_id ? 'Confirmed' : meta.label;
  const start = asDate(s.scheduled_start);
  const end = asDate(s.scheduled_end);
  const rate = Number(s.rate_per_hour) || RATE_PER_HOUR;
  const rating = s.evaluation_rating != null ? Number(s.evaluation_rating).toFixed(1) : null;
  const dateLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeLabel = `${fmtTime(start)} – ${fmtTime(end)}`;

  return (
    <div className="session-card tutor-card" key={s.id}>
      <span className="mini-avatar sc-avatar" aria-hidden="true">{initialsOf(s.student_name)}</span>
      <div className="sc-main">
        <div className="sc-top">
          <Link className="sc-name" to={`/students/${s.student_id}`}>{s.student_name}</Link>
          <span className={`pill ${meta.cls}`}>{statusLabel}</span>
          {s.status === 'accepted' && s.pending_payment_id && !s.payment_id && (
            <span className="pill pill--pending">Payment request</span>
          )}
          {s.status === 'completed' && rating && <span className="sc-rating">★ {rating}</span>}
        </div>
        <div className="sc-sub">{dateLabel} · {timeLabel}</div>
        {s.status === 'accepted' && s.pending_payment_id && !s.payment_id && (
          <p className="sc-note sc-note--amber">
            {s.student_name} sent a payment request{s.pending_amount ? ` of ₱${Number(s.pending_amount).toLocaleString()}` : ''} —{' '}
            <button type="button" className="sc-note-link" onClick={() => onChat(s)}>
              check your messages to confirm
            </button>
          </p>
        )}
        {s.status === 'accepted' && s.payment_id && (
          <p className="sc-note sc-note--green">
            {s.payment_amount ? `Paid ₱${Number(s.payment_amount).toLocaleString()}` : 'Paid'} — session is confirmed
          </p>
        )}
        {hasPendingReq && (
          <p className={`sc-note ${myRequest ? 'sc-note--amber' : ''}`}>
            {myRequest ? 'Awaiting confirmation for reschedule' : 'Reschedule requested'}
          </p>
        )}
        {s.status === 'rejected' && s.reject_reason && (
          <p className="sc-note">Rejected reason: {s.reject_reason}</p>
        )}
        {s.status === 'cancelled' && (
          <p className="sc-note">
            {s.cancel_reason && <>Cancellation reason: {s.cancel_reason}. </>}
            Cancelled {fmtDateTime(s.cancelled_at || s.updated_at)}
          </p>
        )}
      </div>
      <div className="sc-rate">₱{rate} / 1 hour</div>
      <div className="sc-actions">
        {s.status === 'pending' && (
          <>
            <button className="action-btn action-btn--accept" onClick={() => onAccept(s)}>Accept</button>
            <button className="action-btn action-btn--reject" onClick={() => onReject(s)}>Reject</button>
          </>
        )}
        {s.status === 'accepted' && (
          <>
            {s.pending_payment_id && !s.payment_id && (
              <button className="action-btn action-btn--accept" onClick={() => onConfirmPayment(s)}>
                Confirm payment
              </button>
            )}
            {hasPendingReq && !myRequest && (
              <>
                <button className="action-btn action-btn--chat" onClick={() => onConfirmReschedule(s)}>Confirm</button>
                <button className="action-btn action-btn--cancel" onClick={() => onDeclineReschedule(s)}>Decline</button>
              </>
            )}
            <button className="action-btn action-btn--solid" onClick={() => onChat(s)}>Chat</button>
            {!s.payment_id && (
              <button className="action-btn action-btn--outline-danger" onClick={() => onCancel(s)}>Cancel</button>
            )}
          </>
        )}
        {s.status !== 'accepted' && (
          <ChatIconButton onClick={() => onChat(s)} label={`Open conversation with ${s.student_name}`} />
        )}
      </div>
    </div>
  );
}

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
  const [checking, setChecking] = useState(false);
  const [conflict, setConflict] = useState(null);
  const checkTimer = useRef(null);

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

  useEffect(() => {
    setConflict(null);
    if (!scheduleOk) {
      setChecking(false);
      return;
    }
    setChecking(true);
    clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      const res = await sessionService.checkConflicts({
        start: pickedStart.toISOString(),
        end: pickedEnd.toISOString(),
        other_id: session.tutor_id,
        exclude_session_id: session.id
      });
      setChecking(false);
      if (res.ok) setConflict(res.data);
    }, 350);
    return () => clearTimeout(checkTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, startTime, endTime, scheduleOk]);

  const submit = async (e) => {
    e.preventDefault();
    if (!scheduleOk) {
      setErr('Pick a date and an end time that comes after the start time');
      return;
    }
    if (conflict?.conflict) {
      setErr(conflict.mine
        ? 'This time conflicts with one of your existing sessions — pick a different time'
        : 'The tutor is already booked at this time — pick a different time');
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
          <Alert type="success">Payment sent — waiting for the tutor to confirm it in your conversation.</Alert>
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
          <p className="muted small">The total updates live — set the schedule, then send the payment. The tutor will confirm it in your conversation.</p>
          {tooLong && <p className="muted small" style={{ color: 'var(--danger, #dc3545)' }}>Sessions are limited to 4 hours — please shorten the schedule.</p>}
          {checking && <p className="muted small" style={{ marginTop: 8 }}>Checking for scheduling conflicts…</p>}
          {conflict?.conflict && (
            <Alert type="error">
              {conflict.mine
                ? 'Time conflict: you already have a session booked at this time — pick a different time.'
                : `Time conflict: ${session.tutor_name} is already booked by another session at this time — pick a different time.`}
            </Alert>
          )}

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
            <button className="btn btn-primary" disabled={busy || !scheduleOk || tooLong || !!conflict?.conflict}>
              {busy ? 'Processing payment…' : `Send Payment (₱${amount == null ? '—' : amount})`}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Student cancel control: only lives for the 5-minute free-cancel window, then disappears. */
function StudentCancel({ session, onCancel }) {
  const { active } = useCancelWindow(session);
  if (!active) return null;
  return (
    <>
      <CancelCountdown session={session} />
      <button className="action-btn action-btn--cancel" onClick={onCancel}>
        Cancel Session
      </button>
    </>
  );
}

function RejectModal({ session, onClose, onRejected }) {
  const confirm = useConfirm();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const ok = await confirm({
      title: 'Reject session request?',
      message: `Reject ${session.student_name}'s ${session.subject_name} session request? The student will see your reason.`,
      confirmText: 'Reject Request',
      danger: true
    });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    const res = await sessionService.respond(session.id, 'rejected', reason.trim());
    setBusy(false);
    if (res.ok) onRejected(res.data);
    else setErr(res.message);
  };

  return (
    <Modal title="Reject Session Request" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="pay-summary">
          <b className="pay-tutor">{session.subject_name} with {session.student_name}</b>
          <div className="pay-row"><span>Date</span><b>{dayTag(asDate(session.scheduled_start))} · {fmtRange(asDate(session.scheduled_start), asDate(session.scheduled_end))}</b></div>
        </div>

        <label>Reason (optional)</label>
        <textarea
          rows={3}
          value={reason}
          placeholder="Tell the student why you can't accept this request"
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
        />
        <p className="muted small">The student will see this reason on the rejected session.</p>

        {err && <Alert type="error">{err}</Alert>}
        <div className="row-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-danger" disabled={busy}>
            {busy ? 'Rejecting…' : 'Reject Request'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
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
  const [rejecting, setRejecting] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [notice, setNotice] = useState(null);

  const all = sessions.data || [];
  const isTutor = user.role_key === 'tutor';

  const upcoming = all.filter((s) => s.status === 'pending' || s.status === 'accepted');
  const completed = all.filter((s) => s.status === 'completed');
  const cancelled = all.filter((s) => s.status === 'cancelled');
  const rejected = all.filter((s) => s.status === 'rejected');

  const filtered = filter === 'upcoming' ? upcoming : filter === 'completed' ? completed : filter === 'rejected' ? rejected : cancelled;

  const next = [...upcoming.filter((s) => s.status === 'accepted' && s.payment_id)].sort(
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

  const confirmPayment = async (s) => {
    if (!s.conversation_id || !s.pending_payment_id) return;
    const amount = s.pending_amount ? ` of ₱${Number(s.pending_amount).toLocaleString()}` : '';
    const ok = await confirm({
      title: 'Confirm payment?',
      message: `Accept ${s.student_name}'s payment${amount} for the ${s.subject_name} session?`,
      confirmText: 'Accept payment'
    });
    if (!ok) return;
    const res = await conversationService.acceptPayment(s.conversation_id, s.pending_payment_id);
    if (res.ok) { setNotice({ type: 'success', text: res.message }); sessions.reload(); }
    else setNotice({ type: 'error', text: res.message });
  };

  const cancelSession = async (s) => {
    const paid = s.payment_id ? ` This session has already been paid${s.payment_amount ? ` (₱${Number(s.payment_amount).toLocaleString()})` : ''} — there is no refund.` : '';
    const ok = await confirm({
      title: 'Cancel session?',
      message: `Cancel the ${s.subject_name} session with ${s.tutor_name || s.student_name}?${paid}`,
      confirmText: 'Cancel session'
    });
    if (!ok) return;
    const res = await sessionService.cancel(s.id);
    if (res.ok) { setNotice({ type: 'success', text: res.message }); sessions.reload(); }
    else setNotice({ type: 'error', text: res.message });
  };

  const respondSession = async (s, decision) => {
    const action = decision === 'accepted' ? 'Accept' : 'Reject';
    const ok = await confirm({
      title: `${action} session request?`,
      message: decision === 'accepted'
        ? `Accept the ${s.subject_name} session with ${s.student_name} on ${dayTag(asDate(s.scheduled_start))} at ${fmtTime(asDate(s.scheduled_start))}?`
        : `Reject ${s.student_name}'s ${s.subject_name} session request?`,
      confirmText: action
    });
    if (!ok) return;
    const res = await sessionService.respond(s.id, decision);
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

      {!isTutor && (
        <>
          <div className="dash-stats dash-stats--4">
            {['upcoming', 'completed', 'cancelled', 'rejected'].map((key) => (
              <div className="dash-stat" key={key}>
                <span className="dash-stat-label">{STAT_LABELS[key]}</span>
                <span className={`dash-stat-value ${key === 'completed' ? 'is-green' : ''}`}>
                  {sessions.loading ? '–' : (key === 'upcoming' ? upcoming.length : key === 'completed' ? completed.length : key === 'rejected' ? rejected.length : cancelled.length)}
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
              <button type="button" className="btn-join" onClick={() => chatTutor(next)}>
                Chat Tutor
              </button>
            </section>
          )}
        </>
      )}

      <div className="session-tabs">
        {(['upcoming', 'completed', 'cancelled', 'rejected']).map((key) => (
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
          description={isTutor
            ? (filter === 'rejected' ? 'Session requests you declined will show up here.' : 'Students will send you tutoring requests.')
            : (filter === 'rejected' ? 'Session requests rejected by your tutor will show up here.' : 'Request a session with a matched tutor to get started.')}
          action={!isTutor && filter !== 'rejected' ? <Link className="btn btn-primary" to="/matches">Find Tutors</Link> : null}
        />
      )}

      <div className={`session-list ${isTutor ? 'session-list--tutor' : ''}`}>
        {filtered.map((s) => {
          const meta = STATUS_META[s.status] || { label: s.status, cls: '' };
          const statusLabel = s.status === 'accepted' && s.payment_id ? 'Confirmed' : meta.label;
          const start = asDate(s.scheduled_start);
          const end = asDate(s.scheduled_end);
          const otherName = isTutor ? s.student_name : s.tutor_name;
          const hasPendingReq = !!s.reschedule_request_id;
          const myRequest = hasPendingReq && Number(s.reschedule_requester_id) === Number(user.id);
          return isTutor ? (
            <TutorSessionCard
              key={s.id}
              session={s}
              onChat={chatStudent}
              onCancel={cancelSession}
              onAccept={(x) => respondSession(x, 'accepted')}
              onReject={setRejecting}
              onConfirmReschedule={(x) => respondReschedule(x, 'accepted')}
              onDeclineReschedule={(x) => respondReschedule(x, 'rejected')}
              onConfirmPayment={confirmPayment}
              hasPendingReq={hasPendingReq}
              myRequest={myRequest}
            />
          ) : (
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
                  {!isTutor && s.status === 'accepted' && !s.payment_id && s.pending_payment_id && (
                    <span className="pill pill--pending">Payment pending — awaiting tutor confirmation</span>
                  )}
                  {hasPendingReq && (
                    <span className="pill pill--reschedule">
                      {myRequest ? 'Awaiting Confirmation' : 'Reschedule Requested'}
                    </span>
                  )}
                </div>
                {s.status === 'rejected' && s.reject_reason && (
                  <p className="session-card-note">Rejected reason: {s.reject_reason}</p>
                )}
                {s.status === 'cancelled' && (
                  <p className="session-card-note">
                    {s.cancel_reason && <>Cancellation reason: {s.cancel_reason}. </>}
                    Cancelled {fmtDateTime(s.cancelled_at || s.updated_at)}
                  </p>
                )}
              </div>
              <div className="session-actions">
                {isTutor && s.status === 'pending' && (
                  <>
                    <button className="action-btn action-btn--accept" onClick={() => respondSession(s, 'accepted')}>
                      Accept Session Request
                    </button>
                    <button className="action-btn action-btn--reject" onClick={() => setRejecting(s)}>
                      Reject Session Request
                    </button>
                    <button className="action-btn action-btn--chat" onClick={() => chatStudent(s)}>
                      Chat Student
                    </button>
                  </>
                )}
                {!isTutor && s.status === 'pending' && (
                  <StudentCancel session={s} onCancel={() => setCancelling(s)} />
                )}
                {s.status === 'accepted' && (
                  <>
                    {!isTutor && !s.payment_id && !s.pending_payment_id && (
                      <button
                        className="action-btn action-btn--pay"
                        onClick={() => setPaying(s)}
                      >
                        Pay
                      </button>
                    )}
                    {s.payment_id && !hasPendingReq && (
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
                    {isTutor
                      ? !s.payment_id && (
                        <button className="action-btn action-btn--cancel" onClick={() => cancelSession(s)}>
                          Cancel
                        </button>
                      )
                      : !s.payment_id && <StudentCancel session={s} onCancel={() => setCancelling(s)} />}
                  </>
                )}
                {(s.status === 'rejected' || s.status === 'cancelled') && !isTutor && (
                  <Link
                    className="action-btn action-btn--book"
                    to={`/sessions/new?tutor=${s.tutor_id}&subject=${s.subject_id}`}
                  >
                    Book Again
                  </Link>
                )}
                {s.status !== 'pending' && (
                  !isTutor ? (
                    <button className="action-btn action-btn--chat" onClick={() => chatTutor(s)}>
                      Chat Tutor
                    </button>
                  ) : (
                    <button className="action-btn action-btn--chat" onClick={() => chatStudent(s)}>
                      Chat Student
                    </button>
                  )
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
          otherUserId={Number(user.id) === Number(rescheduling.student_id) ? rescheduling.tutor_id : rescheduling.student_id}
          onClose={() => setRescheduling(null)}
          onSent={() => { setRescheduling(null); sessions.reload(); }}
        />
      )}
      {rejecting && (
        <RejectModal
          session={rejecting}
          onClose={() => setRejecting(null)}
          onRejected={() => { setRejecting(null); setNotice({ type: 'success', text: 'Session request rejected' }); sessions.reload(); }}
        />
      )}
      {cancelling && (
        <CancelSessionModal
          session={cancelling}
          onClose={() => setCancelling(null)}
          onCancelled={() => { setCancelling(null); setNotice({ type: 'success', text: 'Session cancelled' }); sessions.reload(); }}
        />
      )}
    </div>
  );
}