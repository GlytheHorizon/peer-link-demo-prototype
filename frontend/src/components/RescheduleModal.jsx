import React, { useState, useEffect, useRef } from 'react';
import { useConfirm } from '../context/ConfirmContext';
import { sessionService } from '../services';
import { Alert, Modal } from './ui';

const MIN_DURATION_MS = 15 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const asDate = (v) => (v instanceof Date ? v : new Date(v));

const fmtTime = (d) => asDate(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmtRange = (start, end) => `${fmtTime(start)} - ${fmtTime(end)}`;

const fmtDuration = (ms) => {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h && m) return `${h} hr${h > 1 ? 's' : ''} ${m} min`;
  if (h) return `${h} hr${h > 1 ? 's' : ''}`;
  return `${m} min`;
};

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

/** Reschedule a paid session — opens in both My Sessions and the conversation chat. */
export default function RescheduleModal({ session, onClose, onSent, otherUserId }) {
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
  const [checking, setChecking] = useState(false);
  const [conflict, setConflict] = useState(null);
  const checkTimer = useRef(null);

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
        other_id: otherUserId,
        exclude_session_id: session.id
      });
      setChecking(false);
      if (res.ok) setConflict(res.data);
    }, 350);
    return () => clearTimeout(checkTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, startTime, scheduleOk]);

  const submit = async (e) => {
    e.preventDefault();
    if (!scheduleOk) {
      setErr('Pick a date and an end time that comes after the start time');
      return;
    }
    if (conflict?.conflict) {
      setErr(conflict.mine
        ? 'This time conflicts with one of your existing sessions — pick a different time'
        : 'The other party is already booked at this time — pick a different time');
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
          <Alert type="success">Reschedule request sent — waiting for the other party to confirm. The session keeps its current schedule until they approve.</Alert>
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
          {checking && <p className="muted small" style={{ marginTop: 8 }}>Checking for scheduling conflicts…</p>}
          {conflict?.conflict && (
            <Alert type="error">
              {conflict.mine
                ? 'Time conflict: you already have a session booked at this time — pick a different time.'
                : `Time conflict: ${session.tutor_name || session.student_name} is already booked by another session at this time — pick a different time.`}
            </Alert>
          )}

          {err && <Alert type="error">{err}</Alert>}
          <div className="row-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" disabled={busy || !scheduleOk || !!conflict?.conflict}>
              {busy ? 'Sending…' : 'Send Request'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
