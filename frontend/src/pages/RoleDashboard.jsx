import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { tutorService, sessionService, matchService, conversationService, reportService, adminService } from '../services';
import { Spinner, Alert, StatusBadge, RatingStars, formatDateTime } from '../components/ui';

const RATE_PER_HOUR = 100;

function timeAgo(iso) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

function StudentDashboard() {
  const { user } = useAuth();
  const sessions = useApi(sessionService.list);
  const matches = useApi(matchService.list);

  const all = sessions.data || [];
  const upcoming = all.filter(
    (s) => (s.status === 'pending' || s.status === 'accepted') && new Date(s.scheduled_start) > new Date()
  );
  const featured = upcoming[0];
  const completed = all.filter((s) => s.status === 'completed');
  const totalSpent = completed.reduce((sum, s) => sum + Math.max(0, (new Date(s.scheduled_end) - new Date(s.scheduled_start)) / 3600000) * RATE_PER_HOUR, 0);
  const recs = (matches.data || []).slice(0, 3);
  const greetName = (user?.first_name || 'there').toUpperCase();

  return (
    <div>
      <h1 className="dash-greeting">
        Welcome back, <span className="greet-name">{greetName}!</span>
      </h1>

      <div className="dash-stats">
        <div className="dash-stat">
          <span className="dash-stat-label">Total Sessions</span>
          <span className="dash-stat-value">{sessions.loading ? '–' : all.length}</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-label">Upcoming Sessions</span>
          <span className="dash-stat-value">{upcoming.length}</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-label">Total Spent</span>
          <span className="dash-stat-value is-green">{Math.round(totalSpent)}</span>
        </div>
      </div>

      <section className="upcoming-banner">
        <div>
          <span className="upcoming-label">Upcoming Session</span>
          {featured ? (
            <>
              <h2 className="upcoming-title">{featured.subject_name} With {featured.tutor_name}</h2>
              <span className="upcoming-time">{formatDateTime(featured.scheduled_start)}</span>
            </>
          ) : (
            <>
              <h2 className="upcoming-title">Book a Session</h2>
              <span className="upcoming-time">No upcoming sessions — find a tutor and schedule your first session today.</span>
            </>
          )}
        </div>
        <Link className="btn-join" to={featured ? `/sessions/${featured.id}` : '/matches'}>
          {featured ? 'Join Session' : 'Book a Session'}
        </Link>
      </section>

      <section className="dash-section">
        <h2 className="dash-section-title">Recommended Tutors</h2>
        {matches.loading ? (
          <Spinner />
        ) : recs.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              No recommended tutors yet — <Link to="/matches">run Smart Match</Link> to find tutors for your subjects.
            </p>
          </div>
        ) : (
          <div className="tutor-row">
            {recs.map((t) => (
              <div className="tutor-card" key={`${t.tutor_profile_id}-${t.subject_id}`}>
                <span className="tutor-avatar">{initials(t.tutor_name)}</span>
                <div className="tutor-body">
                  <div className="tutor-head">
                    <b className="tutor-name">{t.tutor_name}</b>
                    <span className="tutor-rating">★ {Number(t.compatibility_score).toFixed(0)}% match</span>
                  </div>
                  <span className="tutor-subject">{t.subject_name}</span>
                  <div className="tutor-foot">
                    <span className="tutor-rate">100/hr</span>
                    <Link className="btn-book" to={`/tutors/${t.tutor_profile_id}`}>View Profile</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="dash-section">
        <h2 className="dash-section-title">Recent Activity</h2>
        <div className="activity-panel">
          {sessions.loading ? (
            <div className="activity-row"><span className="muted">Loading…</span></div>
          ) : completed.length === 0 ? (
            <div className="activity-row">
              <span className="muted">No activity yet — book your first session to get started.</span>
            </div>
          ) : completed.slice(0, 5).map((s) => (
            <div className="activity-row" key={s.id}>
              <div className="activity-main">
                <b>Session Completed</b>
                <span className="muted">{s.subject_name} with {s.tutor_name}</span>
              </div>
              <span className="activity-time">{timeAgo(s.scheduled_end)}</span>
            </div>
          ))}
        </div>
      </section>
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