import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useApi } from '../hooks/useApi';
import { studentService, tutorService, sessionService, conversationService, reportService, adminService, matchService } from '../services';
import { Spinner, Alert, StatusBadge, RatingStars, formatDateTime } from '../components/ui';

function StudentDashboard() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const profile = useApi(studentService.getMe);
  const sessions = useApi(sessionService.list);
  const convos = useApi(conversationService.list);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState(null);

  const runMatching = async () => {
    const ok = await confirm({ title: 'Run matching?', message: 'Scores are recalculated from your subjects and tutor availability.', confirmText: 'Run matching' });
    if (!ok) return;
    setGenerating(true);
    setMsg(null);
    const res = await matchService.generate();
    setGenerating(false);
    if (res.ok) {
      setMsg({ type: 'success', text: res.message });
      navigate('/matches');
    } else setMsg({ type: 'error', text: res.message });
  };

  const upcoming = (sessions.data || []).filter(
    (s) => (s.status === 'pending' || s.status === 'accepted') && new Date(s.scheduled_start) > new Date()
  );
  const past = (sessions.data || []).filter((s) => s.status === 'completed');

  return (
    <div>
      <h2>Student Dashboard</h2>
      {(profile.loading || sessions.loading) && <Spinner />}
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {profile.data && (
        <div className="welcome-row">
          <div>
            <p className="muted">Welcome back</p>
            <h3>{profile.data.full_name}</h3>
            <p className="muted small">{profile.data.course || 'No course set'} · Year {profile.data.year_level || '—'}</p>
          </div>
          <div className="row-actions">
            <Link className="btn btn-primary" to="/sessions/new">Request a Session</Link>
            <button className="btn btn-outline" onClick={runMatching} disabled={generating}>
              {generating ? 'Matching…' : 'Run Tutor Matching'}
            </button>
          </div>
        </div>
      )}

      <div className="stat-cards">
        <div className="stat-card"><b>{(profile.data?.subjects || []).length}</b><span>Subjects needing help</span></div>
        <div className="stat-card"><b>{upcoming.length}</b><span>Upcoming sessions</span></div>
        <div className="stat-card"><b>{past.length}</b><span>Completed sessions</span></div>
        <div className="stat-card"><b>{convos.data?.length || 0}</b><span>Conversations</span></div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>Upcoming sessions</h3>
          {upcoming.length === 0 && <p className="muted">No upcoming sessions. Find a tutor and book one!</p>}
          {upcoming.map((s) => (
            <Link key={s.id} to={`/sessions/${s.id}`} className="list-row">
              <div>
                <b>{s.subject_name}</b> with {s.tutor_name}
                <div className="muted small">{formatDateTime(s.scheduled_start)}</div>
              </div>
              <StatusBadge status={s.status} />
            </Link>
          ))}
        </section>
        <section className="card">
          <h3>Recent conversations</h3>
          {(convos.data || []).slice(0, 5).map((c) => (
            <Link key={c.id} to={`/messages/${c.id}`} className="list-row">
              <div>
                <b>{c.tutor_name}</b>
                <div className="muted small">{c.subject_name}</div>
              </div>
              {c.unread_count > 0 && <span className="badge badge-pending">{c.unread_count} new</span>}
            </Link>
          ))}
          {(!convos.data || convos.data.length === 0) && !convos.loading && (
            <div className="empty-state"><p className="muted">No conversations yet — visit your matches to message a tutor.</p></div>
          )}
        </section>
      </div>
    </div>
  );
}

function TutorDashboard() {
  const profile = useApi(tutorService.getMe);
  const sessions = useApi(sessionService.list);
  const convos = useApi(conversationService.list);

  const pending = (sessions.data || []).filter((s) => s.status === 'pending');
  const upcoming = (sessions.data || []).filter(
    (s) => s.status === 'accepted' && new Date(s.scheduled_start) > new Date()
  );

  return (
    <div>
      <h2>Tutor Dashboard</h2>
      {profile.loading && <Spinner />}
      {profile.data && (
        <div className="welcome-row">
          <div>
            <p className="muted">Welcome back</p>
            <h3>{profile.data.full_name}</h3>
            <div className="muted small"><RatingStars rating={profile.data.avg_rating} /> ({profile.data.rating_count} ratings)</div>
          </div>
          <Link className="btn btn-primary" to="/profile">Edit Availability</Link>
        </div>
      )}

      <div className="stat-cards">
        <div className="stat-card"><b>{pending.length}</b><span>Match requests</span></div>
        <div className="stat-card"><b>{upcoming.length}</b><span>Confirmed sessions</span></div>
        <div className="stat-card"><b>{(profile.data?.subjects || []).length}</b><span>Subjects taught</span></div>
        <div className="stat-card"><b>{convos.data?.length || 0}</b><span>Conversations</span></div>
      </div>

      <section className="card">
        <h3>Session requests awaiting your response</h3>
        {pending.length === 0 && <p className="muted">No pending requests — check back soon.</p>}
        {pending.map((s) => (
          <Link key={s.id} to={`/sessions/${s.id}`} className="list-row">
            <div>
              <b>{s.subject_name}</b> with {s.student_name}
              <div className="muted small">{formatDateTime(s.scheduled_start)}</div>
            </div>
            <StatusBadge status={s.status} />
          </Link>
        ))}
      </section>
    </div>
  );
}

function FacultyDashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    reportService.overview().then((res) => {
      if (res.ok) setOverview(res.data);
      else setErr(res.message);
      setLoading(false);
    });
  }, []);

  const byRole = overview?.users_by_role || [];
  const byStatus = overview?.sessions_by_status || [];

  return (
    <div>
      <h2>Faculty Dashboard</h2>
      {loading && <Spinner />}
      <Alert type="error">{err}</Alert>
      {overview && (
        <>
          <div className="stat-cards">
            <div className="stat-card"><b>{overview.users}</b><span>Active users</span></div>
            <div className="stat-card"><b>{overview.sessions}</b><span>Total sessions</span></div>
            <div className="stat-card"><b>{overview.avg_rating}</b><span>Average rating</span></div>
            <div className="stat-card"><b>{overview.completed_last_30_days}</b><span>Completed (30 days)</span></div>
          </div>
          <div className="grid-2">
            <section className="card">
              <h3>Users by role</h3>
              {byRole.map((r) => (
                <div key={r.role} className="list-row">
                  <b className="cap">{r.role}</b>
                  <span className="badge badge-accepted">{r.total}</span>
                </div>
              ))}
            </section>
            <section className="card">
              <h3>Sessions by status</h3>
              {byStatus.map((r) => (
                <div key={r.status} className="list-row">
                  <b className="cap">{r.status}</b>
                  <span className="badge badge-accepted">{r.total}</span>
                </div>
              ))}
            </section>
          </div>
          <div className="row-actions">
            <Link className="btn btn-primary" to="/reports">View Detailed Reports</Link>
          </div>
        </>
      )}
    </div>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    adminService.stats().then((res) => {
      if (res.ok) setStats(res.data);
      else setErr(res.message);
      setLoading(false);
    });
  }, []);

  const s = stats || {};
  const cards = [
    ['Users', s.users, '/admin/users'],
    ['Subjects', s.subjects, '/admin/subjects'],
    ['Sessions', s.sessions, '/reports'],
    ['Evaluations', s.evaluations, '/reports'],
    ['Conversations', s.conversations, null],
    ['Messages', s.messages, null],
    ['Activity logs', s.activity_logs, '/admin/logs'],
    ['Inactive users', s.inactive_users, '/admin/users']
  ];

  return (
    <div>
      <h2>Admin Dashboard</h2>
      {loading && <Spinner />}
      <Alert type="error">{err}</Alert>
      {stats && (
        <div className="stat-cards">
          {cards.map(([label, value, to]) => (
            <Link to={to || '/dashboard'} className="stat-card link-card" key={label}>
              <b>{value}</b><span>{label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RoleDashboard() {
  const { user } = useAuth();
  if (user?.role_key === 'student') return <StudentDashboard />;
  if (user?.role_key === 'tutor') return <TutorDashboard />;
  if (user?.role_key === 'faculty') return <FacultyDashboard />;
  return <AdminDashboard />;
}