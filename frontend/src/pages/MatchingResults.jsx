import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useConfirm } from '../context/ConfirmContext';
import { subjectService, matchService, studentService } from '../services';
import { Spinner, Alert, EmptyState, RatingStars } from '../components/ui';

const BREAKDOWN_LABELS = {
  subject: 'Subject compatibility',
  proficiency: 'Tutor proficiency',
  courseYear: 'Course / year match',
  availability: 'Availability',
  rating: 'Tutor rating'
};

function ScoreBreakdown({ breakdown }) {
  if (!breakdown) return null;
  return (
    <div className="score-breakdown muted small">
      {Object.entries(BREAKDOWN_LABELS).map(([key, label]) => (
        <div key={key} className="sb-row">
          <span>{label}</span>
          <span>{breakdown[key] !== undefined ? Number(breakdown[key]).toFixed(0) : 0}</span>
        </div>
      ))}
    </div>
  );
}

const COMPAT_COLORS = (score) =>
  score >= 85 ? 'green' : score >= 70 ? 'blue' : score >= 50 ? 'amber' : 'red';

export default function MatchingResults() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const subjects = useApi(subjectService.list);
  const mine = useApi(studentService.getMe);
  const [filterSubject, setFilterSubject] = useState('');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [ratings, setRatings] = useState({});

  const run = async (subjectId, quiet = false) => {
    if (!quiet) {
      const ok = await confirm({ title: 'Re-run matching?', message: 'Stored match scores will be recalculated.', confirmText: 'Re-run matching' });
      if (!ok) return;
    }
    setLoading(true);
    setMsg(null);
    setErr(null);
    const res = await matchService.generate(subjectId || null);
    setLoading(false);
    if (res.ok) {
      setMatches(res.data);
      setMsg({ type: 'success', text: res.message });
    } else setErr(res.message);
  };

  useEffect(() => {
    run(null, true);
  }, []);

  const scoreStyles = { fontSize: '1.6rem', fontWeight: 700 };

  return (
    <div>
      <h2>Matching Results</h2>
      <p className="muted">
        The backend matching engine scores every compatible tutor between 0 and 100 using subject (40%),
        proficiency (20%), course/year (15%), availability (15%), and ratings (10%).
      </p>

      <div className="card match-controls">
        <div className="grid-2">
          <div>
            <label>Filter by subject</label>
            <select
              value={filterSubject}
              onChange={(e) => { setFilterSubject(e.target.value); run(e.target.value ? Number(e.target.value) : null); }}
            >
              <option value="">All my subjects</option>
              {(mine.data?.subjects || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="row-actions align-end">
            <button className="btn btn-primary" onClick={() => run(filterSubject ? Number(filterSubject) : null)} disabled={loading}>
              {loading ? 'Matching…' : 'Re-run Matching'}
            </button>
            <Link className="btn btn-outline" to="/subjects">Edit subjects</Link>
          </div>
        </div>
        {msg && <Alert type={msg.type}>{msg.text}</Alert>}
        {err && <Alert type="error">{err}</Alert>}
      </div>

      {loading && <Spinner label="Running matching algorithm…" />}

      {!loading && matches.length === 0 && (
        <EmptyState
          title="No matches yet"
          description="Add subjects you need help with, or make sure tutors teach them."
          action={<Link className="btn btn-primary" to="/subjects">Go to Subjects</Link>}
        />
      )}

      <div className="match-list">
        {matches.map((m, i) => (
          <div className="card match-card" key={`${m.tutor_profile_id}-${m.subject_id}`}>
            <div className="match-rank">
              <span className="rank-circle">{i + 1}</span>
            </div>
            <div className="match-info">
              <h3>{m.tutor_name}</h3>
              <span className="muted small">for {subjects.data?.find((s) => s.id === m.subject_id)?.name || `Subject #${m.subject_id}`}</span>
              <ScoreBreakdown breakdown={m.breakdown} />
            </div>
            <div className="match-score">
              <div style={{ ...scoreStyles, color: `var(--${COMPAT_COLORS(m.score)})` }}>{Number(m.score).toFixed(0)}%</div>
              <span className="muted small">compatibility</span>
              <div className="row-actions stack">
                <Link className="btn btn-primary btn-sm" to={`/tutors/${m.tutor_profile_id}`}>View Profile</Link>
                <Link className="btn btn-outline btn-sm" to={`/messages?tutor=${m.tutor_profile_id}&subject=${m.subject_id}`}>Message</Link>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate(`/sessions/new?tutor=${m.tutor_profile_id}&subject=${m.subject_id}`)}
                >
                  Schedule
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}