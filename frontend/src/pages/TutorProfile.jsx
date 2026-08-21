import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { tutorService, conversationService } from '../services';
import { Spinner, Alert, RatingStars, formatDate, EmptyState } from '../components/ui';
import ReportModal from '../components/ReportModal';

const initialsOf = (name) => (
  (name || '?').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
);

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value || '—'}</span>
    </div>
  );
}

export default function TutorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [tutor, setTutor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [subjectId, setSubjectId] = useState(params.get('subject') || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

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
    const ok = await confirm({ title: 'Start conversation?', message: `Start a conversation with ${tutor.full_name}?`, confirmText: 'Message tutor' });
    if (!ok) return;
    setBusy(true);
    const res = await conversationService.start(tutor.user_id, null);
    setBusy(false);
    if (res.ok) navigate(`/messages/${res.data.id}`);
    else setMsg({ type: 'error', text: res.message });
  };

  const bookSession = async () => {
    if (!subjectId) { setMsg({ type: 'error', text: 'Pick a subject first' }); return; }
    const ok = await confirm({ title: 'Schedule a session?', message: `Schedule a session with ${tutor.full_name} on this subject?`, confirmText: 'Schedule session' });
    if (ok) navigate(`/sessions/new?tutor=${tutor.user_id}&subject=${subjectId}`);
  };

  const availability = tutor.availability || {};

  return (
    <div>
      <Link className="btn btn-ghost" to="/matches">← Back to matches</Link>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      <div className="profile-header">
        <div className="profile-avatar" aria-hidden="true">{initialsOf(tutor.full_name)}</div>
        <div className="profile-identity">
          <h3>{tutor.full_name}</h3>
          <p className="profile-age">{tutor.email}</p>
          <Link className="rating-link" to={`/tutors/${tutor.user_id}/reviews`} title="View all reviews">
            <RatingStars rating={tutor.avg_rating} />
            <span className="muted small">({tutor.rating_count} ratings) · View reviews</span>
          </Link>
        </div>
        <div className="profile-actions">
          <button className="btn btn-primary" onClick={startConversation} disabled={busy}>
            {busy ? 'Starting…' : '✉ Chat'}
          </button>
          <button className="btn btn-outline" onClick={() => setShowReportModal(true)} title="Report user">
            ⚠ Report
          </button>
        </div>
      </div>

      <div className="card profile-panel">
        <h4>About</h4>
        <div className="info-rows">
          <InfoRow label="Bio" value={tutor.bio} />
          <InfoRow label="Course" value={tutor.course} />
          <InfoRow label="Max year level you can tutor" value={tutor.max_year_level ? `Year ${tutor.max_year_level}` : null} />
          <InfoRow label="Learning mode" value={tutor.learning_mode} />
          <InfoRow label="Preferred schedule" value={(tutor.preferred_schedule || []).join(', ')} />
          <InfoRow label="Member since" value={formatDate(tutor.created_at)} />
        </div>
      </div>

      <div className="card profile-panel">
        <h4>Subjects taught</h4>
        <div className="info-rows">
          {tutor.subjects.length === 0 && <InfoRow label="Subjects" value="No subjects listed yet" />}
          {tutor.subjects.map((s) => (
            <InfoRow
              key={s.id}
              label={s.name}
              value={`Proficiency ${s.proficiency}/5 · ₱${Number(s.rate_per_hour) || 100}/hr`}
            />
          ))}
        </div>
        <h4>Weekly availability</h4>
        <div className="day-picker">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <span key={d} className={`day-chip static ${availability[d] ? 'on' : ''}`}>{d}</span>
          ))}
        </div>
      </div>

      <div className="card profile-panel">
        <h4>Book a session</h4>
        <div className="book-row">
          <select
            className="subject-select"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            aria-label="Subject for the session"
          >
            <option value="">Select subject…</option>
            {tutor.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (Proficiency {s.proficiency}/5 · ₱{Number(s.rate_per_hour) || 100}/hr)
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={bookSession} disabled={busy}>
            Book session
          </button>
        </div>
      </div>

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={tutor.user_id}
        reportedUserName={tutor.full_name}
        reporterRole={user.role_key}
      />
    </div>
  );
}