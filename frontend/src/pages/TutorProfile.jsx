import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useConfirm } from '../context/ConfirmContext';
import { tutorService, conversationService } from '../services';
import { Spinner, Alert, RatingStars, formatDate, EmptyState } from '../components/ui';

export default function TutorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [params] = useSearchParams();
  const [tutor, setTutor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [subjectId, setSubjectId] = useState(params.get('subject') || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    tutorService.getPublic(id).then((res) => {
      if (res.ok) {
        setTutor(res.data);
        if (!params.get('subject') && res.data.subjects[0]) {
          setSubjectId(res.data.subjects[0].id);
        }
      } else setErr(res.message);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <Spinner />;
  if (err) return <Alert type="error">{err}</Alert>;
  if (!tutor) return <EmptyState title="Tutor not found" action={<Link className="btn btn-primary" to="/matches">Back to matches</Link>} />;

  const startConversation = async () => {
    if (!subjectId) { setMsg({ type: 'error', text: 'Pick a subject first' }); return; }
    const ok = await confirm({ title: 'Start conversation?', message: `Start a conversation with ${tutor.full_name} about this subject?`, confirmText: 'Message tutor' });
    if (!ok) return;
    setBusy(true);
    const res = await conversationService.start(tutor.user_id, Number(subjectId));
    setBusy(false);
    if (res.ok) navigate(`/messages/${res.data.id}`);
    else setMsg({ type: 'error', text: res.message });
  };

  const availability = tutor.availability || {};

  return (
    <div>
      <Link className="btn btn-ghost" to="/matches">← Back to matches</Link>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      <div className="card tutor-profile">
        <div className="tutor-head">
          <div className="avatar">{tutor.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</div>
          <div>
            <h2>{tutor.full_name}</h2>
            <p className="muted">{tutor.email}</p>
            <RatingStars rating={tutor.avg_rating} /> <span className="muted small">({tutor.rating_count} ratings)</span>
          </div>
        </div>

        <div className="grid-2">
          <div>
            <h4>About</h4>
            <p>{tutor.bio || 'No bio yet.'}</p>
            <p className="muted small">Course: {tutor.course || '—'} · Tutors up to Year {tutor.max_year_level || 5}</p>
          </div>
          <div>
            <h4>Subjects taught</h4>
            <div className="subject-tags">
              {tutor.subjects.map((s) => (
                <span key={s.id} className={`tag ${Number(subjectId) === s.id ? 'tag-on' : ''}`}>
                  {s.name} <b>· Proficiency {s.proficiency}/5</b>
                </span>
              ))}
            </div>
            <h4>Weekly availability</h4>
            <div className="day-picker">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <span key={d} className={`day-chip static ${availability[d] ? 'on' : ''}`}>{d}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="card-inner actions">
          <label>Subject for this conversation</label>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Select subject…</option>
            {tutor.subjects.map((s) => <option key={s.id} value={s.id}>{s.name} (Proficiency {s.proficiency}/5)</option>)}
          </select>
          <div className="row-actions">
            <button className="btn btn-primary" onClick={startConversation} disabled={busy}>
              {busy ? 'Starting…' : 'Message this tutor'}
            </button>
            <Link
              className="btn btn-outline"
              to={`/sessions/new?tutor=${tutor.user_id}&subject=${subjectId || ''}`}
            >
              Schedule a session
            </Link>
          </div>
        </div>
      </div>
      <p className="muted small">Member since {formatDate(tutor.created_at)}</p>
    </div>
  );
}