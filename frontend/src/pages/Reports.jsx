import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { reportService } from '../services';
import { Spinner, Alert, RatingStars } from '../components/ui';

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

export default function Reports() {
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