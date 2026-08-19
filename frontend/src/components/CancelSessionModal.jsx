import React, { useState, useEffect } from 'react';
import { sessionService } from '../services';
import { Modal, Alert } from './ui';

export const CANCEL_WINDOW_MS = 5 * 60 * 1000;

/** Counts down the student's free-cancel window (5 min from booking). */
export function useCancelWindow(session) {
  const deadline = session ? new Date(session.created_at).getTime() + CANCEL_WINDOW_MS : 0;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!session) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session, deadline]);

  return { active: deadline - now > 0, remaining: Math.max(deadline - now, 0) };
}

const fmtRemaining = (ms) => {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** Visible "You can cancel within MM:SS" indicator for the student. */
export function CancelCountdown({ session }) {
  const { remaining } = useCancelWindow(session);
  return <span className="cancel-countdown">You can cancel within {fmtRemaining(remaining)}</span>;
}

const REASONS = [
  { key: 'mistake', label: 'Booked by mistake', hint: 'I did not mean to book this session' },
  { key: 'conflict', label: 'Schedule conflict', hint: 'I have another commitment at this time' },
  { key: 'other', label: 'Other', hint: 'Something else came up' }
];

/** Quick modal asking for a cancellation reason before submitting. */
export default function CancelSessionModal({ session, onClose, onCancelled }) {
  const [reason, setReason] = useState(null);
  const [otherText, setOtherText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!reason) return;
    setBusy(true);
    setErr(null);
    const text = reason === 'other' && otherText.trim() ? `Other: ${otherText.trim()}` : REASONS.find((r) => r.key === reason)?.label;
    const res = await sessionService.cancel(session.id, text);
    setBusy(false);
    if (res.ok) onCancelled(res.data);
    else setErr(res.message);
  };

  return (
    <Modal title="Cancel Session" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="pay-summary">
          <b className="pay-tutor">{session.subject_name} with {session.tutor_name}</b>
          <div className="pay-row"><span>When</span><b>{new Date(session.scheduled_start).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</b></div>
        </div>

        <label>Why are you cancelling this session?</label>
        <div className="cancel-reasons">
          {REASONS.map((r) => (
            <label key={r.key} className={`pay-method ${reason === r.key ? 'on' : ''}`}>
              <input
                type="radio"
                name="cancel-reason"
                value={r.key}
                checked={reason === r.key}
                onChange={() => setReason(r.key)}
              />
              <span className="pay-method-name">{r.label}</span>
              <span className="pay-method-hint">{r.hint}</span>
            </label>
          ))}
        </div>
        {reason === 'other' && (
          <textarea
            rows={3}
            value={otherText}
            placeholder="Tell the tutor why (optional)"
            maxLength={300}
            onChange={(e) => setOtherText(e.target.value)}
          />
        )}
        <p className="muted small">You can only cancel within 5 minutes of booking — this window is about to close.</p>

        {err && <Alert type="error">{err}</Alert>}
        <div className="row-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-danger" disabled={busy || !reason}>
            {busy ? 'Cancelling…' : 'Cancel Session'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Keep Session</button>
        </div>
      </form>
    </Modal>
  );
}