import React, { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useApi } from '../hooks/useApi';
import { tutorService, sessionService, matchService, reportService } from '../services';
import { Spinner, Alert, formatDateTime } from '../components/ui';

const RATE_PER_HOUR = 100;

const asDate = (v) => (v instanceof Date ? v : new Date(v));

const fmtShortDate = (d) =>
  asDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const fmtTime12 = (d) =>
  asDate(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '');

const dayTag = (d) => {
  const day = asDate(d);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((day - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return fmtShortDate(day);
};

const scheduleLabel = (s) =>
  `${dayTag(s.scheduled_start)} - ${fmtTime12(s.scheduled_start)} - ${fmtTime12(s.scheduled_end)}`;

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
  const sessions = useApi(sessionService.list, [], 15000);
  const matches = useApi(matchService.list);

  const all = sessions.data || [];
  const upcoming = all.filter(
    (s) => s.status === 'accepted' && s.payment_id && new Date(s.scheduled_start) > new Date()
  );
  const featured = upcoming[0];
  const completed = all.filter((s) => s.status === 'completed');
  const totalSpent = completed.reduce((sum, s) => sum + Math.max(0, (new Date(s.scheduled_end) - new Date(s.scheduled_start)) / 3600000) * (Number(s.rate_per_hour) || RATE_PER_HOUR), 0);
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
                    <span className="tutor-rate">{Number(t.rate_per_hour) || RATE_PER_HOUR}/hr</span>
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
  const { user } = useAuth();
  const confirm = useConfirm();
  const profile = useApi(tutorService.getMe, [], 20000);
  const sessions = useApi(sessionService.list, [], 15000);
  const [notice, setNotice] = useState(null);

  // Check if tutor is approved - profile.data should have verification_status or status
  const isApproved = profile.data?.verification_status === 'approved' || profile.data?.status === 'approved';

  // For unapproved tutors, redirect to verification page
  if (profile.data && !isApproved) {
    return <Navigate to="/verification" replace />;
  }

  const all = sessions.data || [];
  const pending = all
    .filter((s) => s.status === 'pending')
    .sort((a, b) => asDate(b.scheduled_start) - asDate(a.scheduled_start));
  const upcoming = all
    .filter((s) => s.status === 'accepted' && asDate(s.scheduled_start) > new Date())
    .sort((a, b) => asDate(a.scheduled_start) - asDate(b.scheduled_start));
  const completed = all.filter((s) => s.status === 'completed');
  const featured = upcoming[0];

  const studentMap = new Map();
  for (const s of all) {
    if (s.status === 'rejected') continue;
    if (!studentMap.has(s.student_id)) studentMap.set(s.student_id, { student_id: s.student_id, name: s.student_name, sessions: [] });
    studentMap.get(s.student_id).sessions.push(s);
  }
  const myStudents = [...studentMap.values()].map((st) => {
    const last = [...st.sessions].sort((a, b) => asDate(b.scheduled_start) - asDate(a.scheduled_start))[0];
    const lastStatus = !last ? 'Completed'
      : last.status === 'cancelled' ? 'Cancelled'
      : last.status === 'pending' ? 'Pending'
      : 'Completed';
    return {
      ...st,
      next: st.sessions
        .filter((x) => x.status === 'accepted' && asDate(x.scheduled_start) > new Date())
        .sort((a, b) => asDate(a.scheduled_start) - asDate(b.scheduled_start))[0],
      latestSubject: st.sessions[st.sessions.length - 1]?.subject_name || '—',
      lastStatus
    };
  });

  const totalStudents = myStudents.length;
  const totalEarnings = completed
    .filter((s) => s.payment_id)
    .reduce((sum, s) => {
      const paid = Number(s.payment_amount);
      const rate = Math.max(0, (asDate(s.scheduled_end) - asDate(s.scheduled_start)) / 3600000) * (Number(s.rate_per_hour) || RATE_PER_HOUR);
      return sum + (paid > 0 ? paid : rate);
    }, 0);

  const avgRating = Number(profile.data?.avg_rating) || 0;

  const respondRequest = async (s, decision) => {
    const action = decision === 'accepted' ? 'Accept' : 'Decline';
    const ok = await confirm({
      title: `${action} session request?`,
      message: decision === 'accepted'
        ? `Accept the ${s.subject_name} session with ${s.student_name}?`
        : `Decline ${s.student_name}'s ${s.subject_name} session request?`,
      confirmText: action,
      danger: decision !== 'accepted'
    });
    if (!ok) return;
    const res = await sessionService.respond(s.id, decision);
    if (res.ok) { setNotice({ type: 'success', text: res.message }); sessions.reload(); }
    else setNotice({ type: 'error', text: res.message });
  };

  return (
    <div>
      <h1 className="dash-greeting">Welcome back {user.first_name || 'there'}!</h1>
      <p className="dash-request-note">
        You have <b>{sessions.loading ? '–' : pending.length}</b> new session request{pending.length === 1 ? '' : 's'}
      </p>

      {notice && <Alert type={notice.type}>{notice.text}</Alert>}

      <div className="tutor-stat-cards">
        <div className="tutor-stat">
          <span className="tutor-stat-icon">☻</span>
          <div className="tutor-stat-body">
            <span className="tutor-stat-label">Total Students</span>
            <span className="tutor-stat-value">{sessions.loading ? '–' : totalStudents}</span>
          </div>
        </div>
        <div className="tutor-stat">
          <span className="tutor-stat-icon">◷</span>
          <div className="tutor-stat-body">
            <span className="tutor-stat-label">Total Sessions</span>
            <span className="tutor-stat-value">{sessions.loading ? '–' : all.length}</span>
          </div>
        </div>
        <div className="tutor-stat">
          <span className="tutor-stat-icon">¤</span>
          <div className="tutor-stat-body">
            <span className="tutor-stat-label">Total Earnings</span>
            <span className="tutor-stat-value">₱{sessions.loading ? '–' : Math.round(totalEarnings)}</span>
          </div>
        </div>
        <div className="tutor-stat">
          <span className="tutor-stat-icon">★</span>
          <div className="tutor-stat-body">
            <span className="tutor-stat-label">Rating</span>
            <span className="tutor-stat-value">
              {profile.loading ? '–' : avgRating ? avgRating.toFixed(1) : '0.0'}
              <span className="tutor-stat-sub"> / 5.0</span>
            </span>
          </div>
        </div>
      </div>

      {featured && (
        <section className="upcoming-banner">
          <div>
            <span className="upcoming-label">Upcoming Session</span>
            <h2 className="upcoming-title">{featured.subject_name} with {featured.student_name}</h2>
            <span className="upcoming-time">{scheduleLabel(featured)}</span>
          </div>
          <Link className="btn-join" to={`/sessions/${featured.id}`}>Start Session</Link>
        </section>
      )}

      <div className="dash-grid-2">
        <section className="dash-panel">
          <div className="dash-panel-head">
            <h3 className="dash-panel-title">New Session Request</h3>
          </div>
          {sessions.loading ? (
            <Spinner />
          ) : pending.length === 0 ? (
            <p className="muted" style={{ padding: '12px 0' }}>No new session requests — check back soon.</p>
          ) : (
            pending.slice(0, 3).map((s) => (
              <div className="req-row" key={s.id}>
                <span className="req-avatar">{initials(s.student_name)}</span>
                <div className="req-main">
                  <b className="req-name">{s.student_name}</b>
                  <span className="req-subject">{s.subject_name}</span>
                  <span className="req-schedule">{scheduleLabel(s)}</span>
                </div>
                <div className="req-meta">
                  <span className="req-time">{timeAgo(s.created_at)}</span>
                  <div className="req-actions">
                    <button className="action-btn action-btn--accept" onClick={() => respondRequest(s, 'accepted')}>Accept</button>
                    <button className="action-btn action-btn--decline" onClick={() => respondRequest(s, 'rejected')}>Decline</button>
                  </div>
                </div>
              </div>
            ))
          )}
          <div className="dash-panel-foot">
            <Link to="/sessions">View All Request ›</Link>
          </div>
        </section>

        <section className="dash-panel">
          <div className="dash-panel-head">
            <h3 className="dash-panel-title">My Student</h3>
            <Link className="dash-panel-link" to="/students">View All</Link>
          </div>
          {sessions.loading ? (
            <Spinner />
          ) : myStudents.length === 0 ? (
            <p className="muted" style={{ padding: '12px 0' }}>You don't have any students yet.</p>
          ) : (
            myStudents.slice(0, 2).map((st) => (
              <div className="req-row" key={st.student_id}>
                <span className="req-avatar">{initials(st.name)}</span>
                <div className="req-main">
                  <b className="req-name">{st.name}</b>
                  <span className="req-subject">{st.latestSubject}</span>
                </div>
                <div className="req-meta">
                  <span className="req-time">Next session</span>
                  <b className={`req-sched-value ${st.lastStatus === 'Cancelled' ? 'is-cancelled' : ''}`}>
                    {st.next ? fmtShortDate(st.next.scheduled_start) : st.lastStatus}
                  </b>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
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

export default function RoleDashboard() {
  const { user } = useAuth();
  if (user?.role_key === 'student') return <StudentDashboard />;
  if (user?.role_key === 'tutor') return <TutorDashboard />;
  if (user?.role_key === 'faculty') return <FacultyDashboard />;
  return <Navigate to="/admin/verifications" replace />;
}