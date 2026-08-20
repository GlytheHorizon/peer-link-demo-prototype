import React, { useState } from 'react';
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

const INITIAL_REPORTS = [
  {
    id: 1,
    reporter: 'Bernard Bestil',
    reporter_role: 'Student',
    reported: 'Anna Cruz',
    reported_role: 'Tutor',
    reason: 'Tutor Missed Session',
    session: 'Mathematics · Mar 12, 2026, 3:00 PM',
    submitted: '2026-08-18T09:24:00+08:00',
    details: 'The tutor confirmed the session but never showed up. I waited in the meeting room for the full hour and there was no response to my messages.',
    status: 'open'
  },
  {
    id: 2,
    reporter: 'Gino Valdez',
    reporter_role: 'Student',
    reported: 'Gerome Valdez',
    reported_role: 'Tutor',
    reason: 'Tutor Missed Session',
    session: 'Physics · Mar 14, 2026, 5:00 PM',
    submitted: '2026-08-19T14:02:00+08:00',
    details: 'The session was accepted but the tutor did not join the call and has not replied since. I rescheduled once already.',
    status: 'open'
  },
  {
    id: 3,
    reporter: 'Jess Quinto',
    reporter_role: 'Tutor',
    reported: 'Elsa Quinto',
    reported_role: 'Student',
    reason: 'Tutor Missed Session',
    session: 'English · Mar 15, 2026, 10:00 AM',
    submitted: '2026-08-19T18:40:00+08:00',
    details: 'The student booked a session and then did not attend. No notice was given before the scheduled time.',
    status: 'open'
  }
];

function UserReports() {
  const confirm = useConfirm();
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [selected, setSelected] = useState(null);
  const [msg, setMsg] = useState(null);

  const openReports = reports.filter((r) => r.status === 'open');

  const resolve = (id, actionLabel) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'resolved', action: actionLabel } : r)));
    setSelected(null);
    setMsg({ type: 'success', text: `Report resolved — ${actionLabel}.` });
  };

  const handleAction = async (report, action) => {
    if (action.danger) {
      const ok = await confirm({
        title: `${action.label}?`,
        message: `${action.label} ${report.reported} based on this report?\nThis will affect their account access.`,
        confirmText: action.label,
        cancelText: 'Cancel',
        danger: true
      });
      if (!ok) return;
    }
    resolve(report.id, action.label);
  };

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
                    {report.reporter}
                    <div className="muted small cap">{report.reporter_role}</div>
                  </td>
                  <td>
                    {report.reported}
                    <div className="muted small cap">{report.reported_role}</div>
                  </td>
                  <td className="verify-subject">{report.reason}</td>
                  <td>
                    <div className="verify-actions">
                      <button
                        type="button"
                        className="btn btn-review btn-sm"
                        onClick={() => setSelected(report)}
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
        <Modal title="Review Report" onClose={() => setSelected(null)} className="verify-modal">
          <div className="verify-profile">
            <div className="verify-profile-head">
              <div className="verify-avatar">{initials(selected.reported)}</div>
              <div>
                <h3>{selected.reported}</h3>
                <p className="muted cap">{selected.reported_role} · {selected.reason}</p>
              </div>
            </div>

            <div className="review-grid">
              <InfoBox label="Reporter" value={`${selected.reporter} · ${selected.reporter_role}`} />
              <InfoBox label="Reported user" value={`${selected.reported} · ${selected.reported_role}`} />
              <InfoBox label="Reason" value={selected.reason} />
              <InfoBox label="Submitted" value={formatDateTime(selected.submitted)} />
              <InfoBox label="Related session" value={selected.session} />
            </div>

            <div className="verify-bio">
              <span className="info-box-label">Report details</span>
              <p className="verify-bio-text">{selected.details}</p>
            </div>

            <div className="report-actions">
              {REPORT_ACTIONS.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className={`btn btn-${action.tone}`}
                  onClick={() => handleAction(selected, action)}
                >
                  {action.label}
                </button>
              ))}
            </div>
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