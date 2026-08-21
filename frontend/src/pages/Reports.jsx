import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { reportService } from '../services';
import { Spinner, Alert, Modal, InfoBox, EmptyState, RatingStars, formatDateTime } from '../components/ui';

/* ------------------------------------------------------------------ *
 *  Academic & tutoring reports (faculty)
 * ------------------------------------------------------------------ */

function Overview() {
  const data = useApi(reportService.overview);
  if (data.loading) return <Spinner />;
  if (data.error) return <Alert type="error">{data.error.message}</Alert>;
  const o = data.data;
  return (
    <div className="stat-cards">
      <div className="stat-card"><b>{o.users}</b><span>Active users</span></div>
      <div className="stat-card"><b>{o.sessions}</b><span>Sessions</span></div>
      <div className="stat-card"><b>{o.avg_rating}</b><span>Avg rating</span></div>
      <div className="stat-card"><b>{o.evaluations}</b><span>Evaluations</span></div>
      <div className="stat-card"><b>{o.matches}</b><span>Matches stored</span></div>
      <div className="stat-card"><b>{o.completed_last_30_days}</b><span>Completed (30d)</span></div>
    </div>
  );
}

function SessionsReport() {
  const data = useApi(reportService.sessions);
  if (data.loading) return <Spinner />;
  if (data.error) return <Alert type="error">{data.error.message}</Alert>;
  const bySubject = data.data?.by_subject || [];
  const perTutor = data.data?.per_tutor || [];

  const summary = bySubject.reduce((acc, r) => {
    const key = `${r.code} ${r.name}`;
    acc[key] = acc[key] || { code: r.code, name: r.name, statuses: {} };
    acc[key].statuses[r.status] = r.total;
    return acc;
  }, {});

  return (
    <div className="grid-2">
      <section className="card">
        <h3>Sessions by subject</h3>
        <table className="table">
          <thead><tr><th>Subject</th><th>Pending</th><th>Accepted</th><th>Completed</th><th>Other</th></tr></thead>
          <tbody>
            {Object.values(summary).map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>{s.statuses.pending || 0}</td>
                <td>{s.statuses.accepted || 0}</td>
                <td>{s.statuses.completed || 0}</td>
                <td>{(s.statuses.rejected || 0) + (s.statuses.cancelled || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h3>Sessions per tutor</h3>
        <table className="table">
          <thead><tr><th>Tutor</th><th>Total</th><th>Completed</th><th>Pending</th></tr></thead>
          <tbody>
            {perTutor.map((t) => (
              <tr key={t.tutor_id}>
                <td>{t.tutor_name}</td>
                <td>{Number(t.total_sessions)}</td>
                <td>{Number(t.completed)}</td>
                <td>{Number(t.pending)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function TutorsReport() {
  const data = useApi(reportService.tutors);
  if (data.loading) return <Spinner />;
  if (data.error) return <Alert type="error">{data.error.message}</Alert>;
  return (
    <section className="card">
      <h3>Tutor performance</h3>
      <table className="table">
        <thead><tr><th>Tutor</th><th>Course</th><th>Subjects</th><th>Sessions</th><th>Avg rating</th></tr></thead>
        <tbody>
          {(data.data || []).map((t) => (
            <tr key={t.tutor_id}>
              <td>{t.tutor_name}<div className="muted small">{t.email}</div></td>
              <td>{t.course || '—'}</td>
              <td>{Number(t.subject_count)}</td>
              <td>{Number(t.session_count)}</td>
              <td>{t.avg_rating ? <RatingStars rating={t.avg_rating} /> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function StudentsReport() {
  const data = useApi(reportService.students);
  if (data.loading) return <Spinner />;
  if (data.error) return <Alert type="error">{data.error.message}</Alert>;
  return (
    <section className="card">
      <h3>Student activity</h3>
      <table className="table">
        <thead><tr><th>Student</th><th>Course</th><th>Year</th><th>Subjects</th><th>Sessions</th><th>Evaluations given</th></tr></thead>
        <tbody>
          {(data.data || []).map((s) => (
            <tr key={s.student_id}>
              <td>{s.student_name}<div className="muted small">{s.email}</div></td>
              <td>{s.course || '—'}</td>
              <td>{s.year_level || '—'}</td>
              <td>{Number(s.subject_count)}</td>
              <td>{Number(s.session_count)}</td>
              <td>{Number(s.evaluations_given)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const TABS = [
  { key: 'overview', label: 'Overview', comp: Overview },
  { key: 'sessions', label: 'Sessions', comp: SessionsReport },
  { key: 'tutors', label: 'Tutors', comp: TutorsReport },
  { key: 'students', label: 'Students', comp: StudentsReport }
];

function AcademicReports() {
  const [tab, setTab] = useState('overview');
  const active = TABS.find((t) => t.key === tab);
  const Comp = active.comp;

  return (
    <div>
      <div className="page-head">
        <h2>Academic & Tutoring Reports</h2>
      </div>
      <div className="filter-row">
        {TABS.map((t) => (
          <button key={t.key} className={`chip ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <Comp />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  User reports management (admin) — submitted by students & tutors
 * ------------------------------------------------------------------ */

const REPORT_ACTIONS = [
  { key: 'dismiss', label: 'Dismiss', tone: 'ghost', danger: false },
  { key: 'warn', label: 'Warn user', tone: 'outline', danger: false },
  { key: 'suspend', label: 'Suspend account', tone: 'primary', danger: true },
  { key: 'ban', label: 'Ban account', tone: 'danger', danger: true }
];

const REPORT_REASONS = [
  'Tutor Missed Session',
  'Student Missed Session',
  'Inappropriate Behavior',
  'Harassment',
  'Spam / Fake Account',
  'Payment Issue',
  'Other'
];

function UserReports() {
  const confirm = useConfirm();
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [msg, setMsg] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const data = useApi(() => reportService.listUserReports('open'), [refreshKey]);
  const loading = data.loading;
  const error = data.error;

  useEffect(() => {
    if (data.data) {
      setReports(data.data);
    }
  }, [data.data]);

  const [pendingAction, setPendingAction] = useState(null); // { actionKey: string, actionLabel: string }
  const [actionReason, setActionReason] = useState('');
  const [durationDays, setDurationDays] = useState('7');

  const openReports = reports.filter((r) => r.status === 'open');

  const resolve = async (id, payload) => {
    try {
      await reportService.resolveUserReport(id, payload);
      const actionKey = typeof payload === 'string' ? payload : payload.action;
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'resolved', action_taken: actionKey } : r)));
      setSelected(null);
      setPendingAction(null);
      setActionReason('');
      setMsg({ type: 'success', text: `Report resolved — ${actionKey}.` });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to resolve report' });
    }
  };

  const handleActionClick = (report, action) => {
    if (action.key === 'dismiss') {
      resolve(report.id, 'dismiss');
      return;
    }
    setPendingAction(action);
    setActionReason(`Reported for ${report.reason}.`);
  };

  const handleConfirmAction = () => {
    if (!selected || !pendingAction) return;
    if (!actionReason.trim()) {
      setMsg({ type: 'error', text: 'Reason is required' });
      return;
    }
    const payload = {
      action: pendingAction.key,
      reason: actionReason.trim(),
      duration_days: pendingAction.key === 'suspend' ? Number(durationDays) : undefined
    };
    resolve(selected.id, payload);
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="dash-greeting">
        Welcome back <span className="greet-name">Admin!</span>
      </h1>

      <div className="page-head">
        <div>
          <h2>Reports</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            {openReports.length > 0
              ? `${openReports.length} open report${openReports.length > 1 ? 's' : ''} from students and tutors`
              : 'No open reports to review'}
          </p>
        </div>
      </div>

      {error && <Alert type="error">{error.message}</Alert>}
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}

      <div className="card verify-table-card">
        {openReports.length === 0 ? (
          <div className="verify-empty">
            <EmptyState
              title="No open reports"
              description="Reports submitted by students and tutors will appear here for review."
            />
          </div>
        ) : (
          <table className="table verify-table">
            <thead>
              <tr>
                <th>Reporter</th>
                <th>Reported User</th>
                <th>Reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {openReports.map((report) => (
                <tr key={report.id}>
                  <td className="verify-name">
                    {report.reporter_name}
                    <div className="muted small cap">{report.reporter_role}</div>
                  </td>
                  <td>
                    {report.reported_name}
                    <div className="muted small cap">{report.reported_role}</div>
                  </td>
                  <td className="verify-subject">{report.reason}</td>
                  <td>
                    <div className="verify-actions">
                      <button
                        type="button"
                        className="btn btn-review btn-sm"
                        onClick={() => { setSelected(report); setPendingAction(null); }}
                      >
                        Review
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <Modal title="Review Report" onClose={() => { setSelected(null); setPendingAction(null); }} className="verify-modal">
          <div className="verify-profile">
            <div className="verify-profile-head">
              <div className="verify-avatar">{initials(selected.reported_name)}</div>
              <div>
                <h3>{selected.reported_name}</h3>
                <p className="muted cap">{selected.reported_role} · {selected.reason}</p>
              </div>
            </div>

            <div className="review-grid">
              <InfoBox label="Reporter" value={`${selected.reporter_name} · ${selected.reporter_role}`} />
              <InfoBox label="Reported user" value={`${selected.reported_name} · ${selected.reported_role}`} />
              <InfoBox label="Reason" value={selected.reason} />
              <InfoBox label="Submitted" value={formatDateTime(selected.created_at)} />
              <InfoBox label="Related session" value={selected.session_topic ? `${selected.session_topic} · ${formatDateTime(selected.session_start)}` : 'Not specified'} />
            </div>

            <div className="verify-bio">
              <span className="info-box-label">Report details</span>
              <p className="verify-bio-text">{selected.details || 'No additional details provided'}</p>
            </div>

            {!pendingAction ? (
              <div className="report-actions">
                {REPORT_ACTIONS.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className={`btn btn-${action.tone}`}
                    onClick={() => handleActionClick(selected, action)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="verify-bio" style={{ marginTop: 16, background: '#f8fafc', borderColor: 'var(--primary)' }}>
                <h4 style={{ margin: '0 0 10px', textTransform: 'capitalize' }}>Confirm Action: {pendingAction.label}</h4>
                {pendingAction.key === 'suspend' && (
                  <div style={{ marginBottom: 10 }}>
                    <label htmlFor="report-suspend-days" style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: 4 }}>Suspension Duration</label>
                    <select
                      id="report-suspend-days"
                      value={durationDays}
                      onChange={(e) => setDurationDays(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', width: '100%' }}
                    >
                      <option value="1">1 Day</option>
                      <option value="3">3 Days</option>
                      <option value="7">7 Days</option>
                      <option value="14">14 Days</option>
                      <option value="30">30 Days</option>
                    </select>
                  </div>
                )}
                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="report-mod-reason" style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: 4 }}>Reason for {pendingAction.label} *</label>
                  <textarea
                    id="report-mod-reason"
                    rows={3}
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Enter reason..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontFamily: 'inherit' }}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setPendingAction(null)}>
                    Cancel
                  </button>
                  <button type="button" className={`btn btn-${pendingAction.tone} btn-sm`} onClick={handleConfirmAction}>
                    Confirm {pendingAction.label}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function initials(name) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

/* ------------------------------------------------------------------ */

export default function Reports() {
  const { user } = useAuth();
  return user?.role_key === 'admin' ? <UserReports /> : <AcademicReports />;
}