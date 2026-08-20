import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useConfirm } from '../context/ConfirmContext';
import { sessionService, conversationService } from '../services';
import { Spinner, Alert, EmptyState } from '../components/ui';

const asDate = (v) => (v instanceof Date ? v : new Date(v));

const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const fmtShortDate = (d) =>
  asDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const fmtTime12 = (d) =>
  asDate(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '');

const scheduleLabel = (s) =>
  `${fmtShortDate(s.scheduled_start)} - ${fmtTime12(s.scheduled_start)} - ${fmtTime12(s.scheduled_end)}`;

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

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' }
];

const STATUS_PILL = {
  'Waiting for payment': 'pill--accepted',
  Pending: 'pill--pending',
  Completed: 'pill--neutral',
  Cancelled: 'pill--cancelled'
};

/** Status of a subject for a student, from their real session history. */
const subjectStatus = (list) => {
  if (list.some((x) => x.status === 'accepted' && asDate(x.scheduled_start) > new Date())) return 'Waiting for payment';
  if (list.some((x) => x.status === 'pending')) return 'Pending';
  const latest = [...list].sort((a, b) => asDate(a.scheduled_start) - asDate(b.scheduled_start)).pop();
  if (!latest) return 'Completed';
  return latest.status === 'cancelled' ? 'Cancelled' : 'Completed';
};

export default function MyStudents() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const sessions = useApi(sessionService.list);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [notice, setNotice] = useState(null);

  const all = sessions.data || [];
  const requests = all
    .filter((s) => s.status === 'pending')
    .sort((a, b) => asDate(b.scheduled_start) - asDate(a.scheduled_start));

  const studentMap = new Map();
  for (const s of all) {
    if (s.status === 'rejected') continue;
    if (!studentMap.has(s.student_id)) {
      studentMap.set(s.student_id, { student_id: s.student_id, name: s.student_name, sessions: [] });
    }
    studentMap.get(s.student_id).sessions.push(s);
  }

  const students = [...studentMap.values()]
    .map((st) => {
      const subjectMap = new Map();
      for (const x of st.sessions) {
        if (!subjectMap.has(x.subject_id)) subjectMap.set(x.subject_id, { subject_id: x.subject_id, name: x.subject_name, sessions: [] });
        subjectMap.get(x.subject_id).sessions.push(x);
      }
      const subjects = [...subjectMap.values()].map((sub) => ({
        name: sub.name,
        status: subjectStatus(sub.sessions)
      }));
      const latest = st.sessions[st.sessions.length - 1];
      return {
        ...st,
        subjects,
        active: subjects.some((s) => s.status === 'Waiting for payment' || s.status === 'Pending'),
        subjectId: latest?.subject_id || null,
        latestAt: latest ? asDate(latest.scheduled_start) : 0
      };
    })
    .sort((a, b) => b.latestAt - a.latestAt);

  const q = query.trim().toLowerCase();
  const filteredStudents = students.filter((st) => {
    const nameMatch = !q || st.name.toLowerCase().includes(q);
    if (!nameMatch) return false;
    if (filter === 'active') return st.active;
    if (filter === 'completed') return !st.active;
    return true;
  });

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

  const openChat = async (st) => {
    const res = await conversationService.start(Number(st.student_id), Number(st.subjectId), 'tutor');
    if (res.ok && res.data?.id) navigate(`/messages/${res.data.id}`);
    else if (res.ok) navigate('/messages');
    else setNotice({ type: 'error', text: res.message });
  };

  return (
    <div>
      <div className="page-head">
        <h2>My Students</h2>
      </div>
      {sessions.loading && <Spinner />}
      {sessions.error && <Alert type="error">{sessions.error.message}</Alert>}
      {notice && <Alert type={notice.type}>{notice.text}</Alert>}

      <div className="students-toolbar">
        <input
          className="search-field"
          type="search"
          placeholder="Search student..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="students-filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`filter-btn ${filter === f.key ? 'on' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <h2 className="dash-section-title">New Requests</h2>
      {!sessions.loading && requests.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>No new session requests — check back soon.</p>
        </div>
      )}
      {requests.slice(0, 3).map((s) => (
        <div className="req-card" key={s.id}>
          <div className="req-card-top">
            <span className="req-avatar">{initials(s.student_name)}</span>
            <div className="req-main">
              <Link className="req-name" to={`/students/${s.student_id}`}>{s.student_name}</Link>
              <span className="req-subject req-subject--blue">{s.subject_name}</span>
              <span className="req-schedule">{scheduleLabel(s)}</span>
            </div>
            <span className="req-time">{timeAgo(s.created_at)}</span>
          </div>
          <div className="req-card-actions">
            <button className="action-btn action-btn--accept" onClick={() => respondRequest(s, 'accepted')}>Accept</button>
            <button className="action-btn action-btn--decline" onClick={() => respondRequest(s, 'rejected')}>Decline</button>
          </div>
        </div>
      ))}

      <h2 className="dash-section-title" style={{ marginTop: 26 }}>All Students</h2>
      {!sessions.loading && students.length === 0 && (
        <EmptyState
          title="No students yet"
          description="Once students send session requests, they will show up here."
          action={<button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>}
        />
      )}
      {!sessions.loading && students.length > 0 && filteredStudents.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>No students match your search.</p>
        </div>
      )}
      <div className="student-list">
        {filteredStudents.map((st) => (
          <div className="student-card" key={st.student_id}>
            <span className="req-avatar">{initials(st.name)}</span>
            <div className="req-main">
              <Link className="req-name" to={`/students/${st.student_id}`}>{st.name}</Link>
              <div className="student-sub-row">
                {st.subjects.map((sub, i) => (
                  <React.Fragment key={sub.name}>
                    {i > 0 && <span className="subject-sep">|</span>}
                    <span className="req-subject">{sub.name}</span>
                    <span className={`pill ${STATUS_PILL[sub.status]}`}>{sub.status}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <button className="action-btn action-btn--chat" onClick={() => openChat(st)}>Message</button>
          </div>
        ))}
      </div>
    </div>
  );
}
