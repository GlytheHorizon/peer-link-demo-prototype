import React, { useState, useEffect } from 'react';
import { sessionService, reportService } from '../services';
import { Modal, Spinner, Alert } from './ui';

const REPORT_REASONS = [
  'Tutor Missed Session',
  'Student Missed Session',
  'Inappropriate Behavior',
  'Harassment',
  'Spam / Fake Account',
  'Payment Issue',
  'Other'
];

export default function ReportModal({
  isOpen,
  onClose,
  reportedUserId,
  reportedUserName,
  reporterRole
}) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen, reportedUserId, reporterRole]);

  const fetchSessions = async () => {
    try {
      const res = await sessionService.list();
      if (res.ok) {
        setSessions(res.data.filter(s => 
          (reporterRole === 'student' && s.tutor_id === Number(reportedUserId)) ||
          (reporterRole === 'tutor' && s.student_id === Number(reportedUserId))
        ));
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      setMsg({ type: 'error', text: 'Please select a reason' });
      return;
    }

    const finalReason = reason === 'Other' ? customReason : reason;
    if (!finalReason.trim()) {
      setMsg({ type: 'error', text: 'Please specify the reason' });
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const res = await reportService.createUserReport({
        reported_id: reportedUserId,
        reason: finalReason,
        session_id: sessionId || undefined,
        details: details || undefined
      });

      if (res.ok) {
        setMsg({ type: 'success', text: 'Report submitted successfully' });
        setTimeout(() => {
          onClose();
          resetForm();
        }, 1500);
      } else {
        setMsg({ type: 'error', text: res.message || 'Failed to submit report' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to submit report' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setReason('');
    setCustomReason('');
    setSessionId('');
    setDetails('');
    setMsg(null);
  };

  if (!isOpen) return null;

  return (
    <Modal title="Report User" onClose={onClose} className="report-modal">
      <form onSubmit={handleSubmit} className="form">
        {msg && <Alert type={msg.type}>{msg.text}</Alert>}

        <label>Reported User</label>
        <input type="text" value={reportedUserName} readOnly />

        <label>Reason <span className="required">*</span></label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        >
          <option value="">Select a reason…</option>
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {reason === 'Other' && (
          <>
            <label>Specify Reason <span className="required">*</span></label>
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Enter custom reason"
              required
            />
          </>
        )}

        <label>Related Session (optional)</label>
        <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
          <option value="">None / Not related to a session</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.topic || s.subject_name || 'Session'} · {new Date(s.scheduled_start).toLocaleDateString()} · {s.status}
            </option>
          ))}
        </select>
        <p className="muted small" style={{ marginTop: 4, marginBottom: 14 }}>Select a session if this report is related to a specific tutoring session</p>

        <label>Additional Details</label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          placeholder="Provide any additional context or details about this report…"
        />

        <div className="modal-actions" style={{ marginTop: 16, display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit Report'}
          </button>
        </div>
      </form>
    </Modal>
  );
}