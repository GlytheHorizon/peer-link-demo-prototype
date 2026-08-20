import React, { useState } from 'react';
import { adminService } from '../services';
import { useConfirm } from '../context/ConfirmContext';
import { Spinner, Alert, EmptyState } from '../components/ui';

const STATUS_META = {
  pending: { label: 'Pending', className: 'badge-pending' },
  accepted: { label: 'Scheduled', className: 'badge-accepted' },
  rejected: { label: 'Rejected', className: 'badge-rejected' },
  completed: { label: 'Completed', className: 'badge-completed' },
  cancelled: { label: 'Closed', className: 'badge-cancelled' }
};

const RATE_PER_HOUR = 150;
const LEARNING_MODE_LABELS = {
  online: 'Online',
  'face-to-face': 'Face-to-face',
  both: 'Both'
};
const modeLabel = (m) => LEARNING_MODE_LABELS[m] || '—';
const fmtDate = (v) => new Date(v).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'long' });
const fmtTime = (v) => new Date(v).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
const fmtShortDate = (v) => new Date(v).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

export default function ManageSessions() {
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    setLoading(true);
    const res = await adminService.listSessions({ status: filter || undefined, page, limit: 50 });
    if (res.ok) {
      setData(res.data);
      setRows(res.data.rows);
      setSelectedId((prev) => {
        if (prev && res.data.rows.some((s) => s.id === prev)) return prev;
        return res.data.rows[0]?.id || null;
      });
    } else {
      setErr(res.message);
    }
    setLoading(false);
  };

  useState(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = rows?.find((s) => s.id === selectedId) || null;
  const canClose = selected && (selected.status === 'pending' || selected.status === 'accepted');

  const closeSession = async (session) => {
    const ok = await confirm({
      title: 'Close session?',
      message: `Close the ${session.subject_name} session between ${session.student_name} and ${session.tutor_name}?\nIt will be marked as closed and can no longer be attended.`,
      confirmText: 'Close session',
      cancelText: 'Cancel',
      danger: true
    });
    if (!ok) return;
    setRows((prev) => prev.map((r) => (r.id === session.id ? { ...r, status: 'cancelled' } : r)));
    setMsg({ type: 'success', text: `${session.student_name} & ${session.tutor_name} session closed.` });
  };

  return (
    <div>
      <h1 className="dash-greeting">
        Welcome back <span className="greet-name">Admin!</span>
      </h1>

      <div className="page-head">
        <div>
          <h2>Manage Sessions</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            {data ? `Select a session to view its details (${data.total} total)` : 'Select a session to view its details'}
          </p>
        </div>
      </div>

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {err && <Alert type="error">{err}</Alert>}

      {loading && !data && <Spinner />}

      {data && rows.length === 0 && (
        <EmptyState title="No sessions found" description="No tutoring sessions match the current filter." />
      )}

      {data && rows.length > 0 && (
        <div className="manage-sessions-grid">
          <section className="card ms-list">
            <div className="ms-list-head">
              <strong className="small">Sessions</strong>
              <select className="ms-filter" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); setTimeout(load, 0); }}>
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="accepted">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Closed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="ms-list-body">
              {rows.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`ms-item ${s.id === selectedId ? 'active' : ''}`}
                  onClick={() => setSelectedId(s.id)}
                >
                  <span className="ms-item-top">
                    <span className="ms-item-name">{s.student_name}</span>
                    <span className={`badge ${STATUS_META[s.status].className}`}>{STATUS_META[s.status].label}</span>
                  </span>
                  <span className="ms-item-subject">{s.subject_name} · with {s.tutor_name}</span>
                  <span className="ms-item-time">{fmtShortDate(s.scheduled_start)}</span>
                </button>
              ))}
            </div>
            {data.total > 50 && (
              <div className="pager ms-pager">
                <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => { setPage(page - 1); setTimeout(load, 0); }}>← Prev</button>
                <span className="muted small">Page {data.page}</span>
                <button className="btn btn-ghost btn-sm" disabled={page >= Math.ceil(data.total / data.limit)} onClick={() => { setPage(page + 1); setTimeout(load, 0); }}>Next →</button>
              </div>
            )}
          </section>

          <section className="card session-detail-card">
            <h3 className="session-detail-title">Session Information</h3>

            <div className="session-detail-rows">
              <div className="info-row">
                <span className="info-label">Student Name</span>
                <span className="info-value">{selected.student_name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Tutor Name</span>
                <span className="info-value">{selected.tutor_name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Subject</span>
                <span className="info-value">{selected.subject_name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Mode</span>
                <span className="info-value">{selected.learning_mode ? modeLabel(selected.learning_mode) : '—'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Date</span>
                <span className="info-value">{fmtDate(selected.scheduled_start)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Time</span>
                <span className="info-value">{fmtTime(selected.scheduled_start)} - {fmtTime(selected.scheduled_end)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Rate</span>
                <span className="info-value">₱{RATE_PER_HOUR}/hour</span>
              </div>
              <div className="info-row">
                <span className="info-label">Status</span>
                <span className="info-value">
                  <span className={`badge ${STATUS_META[selected.status].className}`}>{STATUS_META[selected.status].label}</span>
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Meeting Link</span>
                <span className="info-value">
                  <a
                    className="meeting-link"
                    href={`https://meet.peerlink.dev/session/${selected.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open online tutoring session
                  </a>
                </span>
              </div>
            </div>

            <div className="session-detail-footer">
              {canClose ? (
                <button type="button" className="btn btn-close btn-sm" onClick={() => closeSession(selected)}>
                  Close
                </button>
              ) : (
                <span className="muted small">{selected ? 'This session is no longer open for attendance.' : ''}</span>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}