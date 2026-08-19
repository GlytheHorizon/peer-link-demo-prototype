import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { sessionService, evaluationService } from '../services';
import { Spinner, Alert, StatusBadge, RatingStars, formatDateTime } from '../components/ui';
import CancelSessionModal, { useCancelWindow, CancelCountdown } from '../components/CancelSessionModal';

/** Student cancel control: active only during the 5-minute free-cancel window. */
function StudentCancelDetails({ session, busy, onCancel }) {
  const { active } = useCancelWindow(session);
  if (!active) return null;
  return (
    <>
      <CancelCountdown session={session} />
      <button className="btn btn-danger btn-block" disabled={busy} onClick={onCancel}>
        Cancel Session
      </button>
    </>
  );
}

export default function SessionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [evaluating, setEvaluating] = useState(false);

  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    const res = await sessionService.get(id);
    if (res.ok) setSession(res.data);
    else setErr(res.message);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  const act = async (fn, okText = '') => {
    setBusy(true);
    setMsg(null);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      setMsg({ type: 'success', text: okText || res.message });
      setSession(res.data);
    } else setErr(res.message);
  };

  const submitEvaluation = async (e) => {
    e.preventDefault();
    const ok = await confirm({
      title: 'Submit evaluation?',
      message: `Submit your evaluation (${rating}/5) of this session?`,
      confirmText: 'Submit evaluation'
    });
    if (!ok) return;
    setEvaluating(true);
    setErr(null);
    const res = await evaluationService.create(session.id, rating, comment);
    setEvaluating(false);
    if (res.ok) {
      setMsg({ type: 'success', text: res.message });
      await load();
    } else setErr(res.message);
  };

  if (loading) return <Spinner />;
  if (err && !session) return <Alert type="error">{err}</Alert>;
  if (!session) return null;

  const isTutor = user.id === session.tutor_id;
  const isStudent = user.id === session.student_id;

  return (
    <div>
      <Link className="btn btn-ghost" to="/sessions">← My sessions</Link>
      <h2>Session Details</h2>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {err && <Alert type="error">{err}</Alert>}

      <div className="card">
        <div className="grid-2">
          <div>
            <h3>{session.subject_name} <StatusBadge status={session.status} /></h3>
            <p className="muted small">{session.subject_code}</p>
            <p><b>When:</b> {formatDateTime(session.scheduled_start)} → {formatDateTime(session.scheduled_end)}</p>
            <p><b>Student:</b> {session.student_name}</p>
            <p><b>Tutor:</b> {session.tutor_name}</p>
            {session.topic && <p><b>Topic:</b> {session.topic}</p>}
            {session.notes && <p><b>Notes:</b> {session.notes}</p>}
            {session.status === 'rejected' && session.reject_reason && (
              <p><b>Rejection reason:</b> {session.reject_reason}</p>
            )}
            {session.status === 'cancelled' && (
              <p><b>Cancelled:</b> {session.cancel_reason ? `${session.cancel_reason} — ` : ''}{formatDateTime(session.cancelled_at || session.updated_at)}</p>
            )}
            <p className="muted small">Requested {formatDateTime(session.created_at)}</p>
          </div>
          <div className="session-actions">
            {isTutor && session.status === 'pending' && (
              <>
                <button
                  className="btn btn-primary btn-block"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await confirm({ title: 'Accept session request?', message: `Accept this request from ${session.student_name}?`, confirmText: 'Accept session' });
                    if (ok) act(() => sessionService.respond(session.id, 'accepted'), 'Session confirmed — great!');
                  }}
                >
                  Accept session
                </button>
                {!rejecting ? (
                  <button
                    className="btn btn-ghost btn-block"
                    disabled={busy}
                    onClick={() => setRejecting(true)}
                  >
                    Reject
                  </button>
                ) : (
                  <div className="card" style={{ marginTop: 8, padding: 12 }}>
                    <label className="muted small">Reason for rejecting (optional)</label>
                    <textarea
                      rows={3}
                      value={rejectReason}
                      maxLength={300}
                      placeholder="Tell the student why you can't accept"
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <button
                      className="btn btn-danger btn-block"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Reject session request?',
                          message: `Reject the request from ${session.student_name}?${rejectReason.trim() ? ' They will see your reason.' : ''}`,
                          confirmText: 'Reject',
                          danger: true
                        });
                        if (ok) act(() => sessionService.respond(session.id, 'rejected', rejectReason.trim()));
                      }}
                    >
                      Confirm rejection
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-block"
                      disabled={busy}
                      onClick={() => { setRejecting(false); setRejectReason(''); }}
                    >
                      Back
                    </button>
                  </div>
                )}
              </>
            )}
            {isTutor && session.status === 'accepted' && session.payment_id && (
              <button
                className="btn btn-primary btn-block"
                disabled={busy || !!session.tutor_complete_confirmed_at}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Confirm session completed?',
                    message: session.student_complete_confirmed_at
                      ? `${session.student_name} already confirmed — completing will finalize the session.`
                      : 'Confirm that this session was completed? It finalizes once the student confirms too, then they can rate you.',
                    confirmText: 'Confirm completed'
                  });
                  if (ok) act(() => sessionService.confirmComplete(session.id));
                }}
              >
                {session.tutor_complete_confirmed_at
                  ? 'Waiting for the student to confirm…'
                  : 'Confirm completion'}
              </button>
            )}
            {isTutor && session.status === 'accepted' && !session.payment_id && (
              <p className="muted small">Completion unlocks once the student pays and confirms in the chat.</p>
            )}
            {isStudent && session.status === 'pending' && (
              <>
                <StudentCancelDetails session={session} busy={busy} onCancel={() => setCancelling(true)} />
                <button
                  className="btn btn-danger btn-block"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete session request?',
                      message: 'Delete this session booking? It has not been confirmed by the tutor yet and will be removed permanently.',
                      confirmText: 'Delete request',
                      danger: true
                    });
                    if (!ok) return;
                    setBusy(true);
                    const res = await sessionService.remove(session.id);
                    setBusy(false);
                    if (res.ok) navigate('/sessions');
                    else setErr(res.message);
                  }}
                >
                  Delete request
                </button>
              </>
            )}
            {isTutor && ['accepted'].includes(session.status) && (
              <button
                className="btn btn-ghost btn-block"
                disabled={busy}
                onClick={async () => {
                  const paid = session.payment_id ? ` This session has already been paid${session.payment_amount ? ` (₱${Number(session.payment_amount).toLocaleString()})` : ''} — there is no refund.` : '';
                  const ok = await confirm({ title: 'Cancel session?', message: `Cancel this session?${paid} This cannot be undone.`, confirmText: 'Cancel session', danger: true });
                  if (ok) act(() => sessionService.cancel(session.id));
                }}
              >
                Cancel session
              </button>
            )}
            {isStudent && ['accepted'].includes(session.status) && (
              <StudentCancelDetails session={session} busy={busy} onCancel={() => setCancelling(true)} />
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>
          Evaluation
          {session.evaluation_id != null && (
            <span className="muted small"> — rated {session.evaluation_rating}/5</span>
          )}
        </h3>
        {isStudent && session.status === 'completed' && session.evaluation_id == null && (
          <form className="form" onSubmit={submitEvaluation}>
            <label>Rating (1–5)</label>
            <div className="rating-picker">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  className={`star-btn ${n <= rating ? 'on' : ''}`}
                  onClick={() => setRating(n)}
                >
                  ★
                </button>
              ))}
            </div>
            <label>Comment (optional)</label>
            <textarea rows="3" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was the session?" maxLength={2000} />
            <button className="btn btn-primary" disabled={evaluating}>
              {evaluating ? 'Submitting…' : 'Submit evaluation'}
            </button>
          </form>
        )}
        {isStudent && session.status === 'completed' && session.evaluation_id != null && (
          <p className="muted">You already rated this session. Thank you!</p>
        )}
        {session.status !== 'completed' && (
          <p className="muted">Evaluations unlock after the session is completed by both you and the tutor in the chat.</p>
        )}
        {isTutor && session.evaluation_id != null && <RatingStars rating={session.evaluation_rating} />}
      </div>

      {cancelling && (
        <CancelSessionModal
          session={session}
          onClose={() => setCancelling(false)}
          onCancelled={(updated) => { setCancelling(false); setMsg({ type: 'success', text: 'Session cancelled' }); setSession(updated); }}
        />
      )}
    </div>
  );
}