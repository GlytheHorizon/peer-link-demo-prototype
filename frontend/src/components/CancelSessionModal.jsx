import React, { useState } from 'react';
import { sessionService } from '../services';
import { Modal, Alert } from './ui';
import { asDate } from '../utils/datetime';

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
          <div className="pay-row"><span>When</span><b>{asDate(session.scheduled_start).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</b></div>
        </div>

        {session.payment_id && (
          <div className="no-refund-warning">
            <b>Payment already received — no refund</b>
            <p>This session has already been paid{Number(session.payment_amount) ? ` (₱${Number(session.payment_amount).toLocaleString()})` : ''} — cancelling will not issue a refund.</p>
          </div>
        )}

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