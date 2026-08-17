import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { sessionService } from '../services';
import { Spinner, Alert, StatusBadge, EmptyState, formatDateTime } from '../components/ui';

export default function Sessions() {
  const { user } = useAuth();
  const sessions = useApi(sessionService.list);
  const [filter, setFilter] = useState('all');

  const filtered = (sessions.data || []).filter((s) => filter === 'all' || s.status === filter);
  const isTutor = user.role_key === 'tutor';

  return (
    <div>
      <div className="page-head">
        <h2>My Sessions</h2>
        {!isTutor && <Link className="btn btn-primary" to="/sessions/new">+ Request session</Link>}
      </div>
      {sessions.loading && <Spinner />}
      {sessions.error && <Alert type="error">{sessions.error.message}</Alert>}

      <div className="filter-row">
        {['all', 'pending', 'accepted', 'completed', 'rejected', 'cancelled'].map((f) => (
          <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 && !sessions.loading && (
        <EmptyState
          title="No sessions here"
          description={isTutor ? 'Students will send you tutoring requests.' : 'Request a session with a matched tutor to get started.'}
          action={!isTutor ? <Link className="btn btn-primary" to="/matches">Find Tutors</Link> : null}
        />
      )}

      <div className="session-list">
        {filtered.map((s) => (
          <Link key={s.id} to={`/sessions/${s.id}`} className="card session-row">
            <div>
              <b>{s.subject_name}</b>
              <p className="muted small">
                {isTutor ? `Student: ${s.student_name}` : `Tutor: ${s.tutor_name}`} · {formatDateTime(s.scheduled_start)}
              </p>
              {s.topic && <p className="muted small">“{s.topic}”</p>}
            </div>
            <div className="session-meta">
              <StatusBadge status={s.status} />
              {s.evaluation_id != null && <span className="badge badge-completed">Rated {s.evaluation_rating}★</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}