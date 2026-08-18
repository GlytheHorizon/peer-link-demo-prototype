import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { studentService, conversationService } from '../services';
import { Spinner, Alert, formatDate, EmptyState } from '../components/ui';

const STRAND_LABELS = { STEM: 'STEM', GAS: 'GAS', ICT: 'ICT', ABM: 'ABM', HUMSS: 'HUMSS', JHS: 'JHS (Grade 7-10)' };

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    studentService.getPublic(id).then((res) => {
      if (res.ok) setStudent(res.data);
      else setErr(res.message);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <Spinner />;
  if (err) return <Alert type="error">{err}</Alert>;
  if (!student) return <EmptyState title="Student not found" action={<Link className="btn btn-primary" to="/sessions">Back to sessions</Link>} />;

  const isTutor = user.role_key === 'tutor';

  const startConversation = async () => {
    const ok = await confirm({
      title: 'Start conversation?',
      message: `Start a conversation with ${student.full_name} about ${student.subjects[0]?.name || 'their subjects'}?`,
      confirmText: 'Message student'
    });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    const res = await conversationService.start(student.user_id, student.subjects[0]?.id, 'tutor');
    setBusy(false);
    if (res.ok) navigate(`/messages/${res.data.id}`);
    else setMsg({ type: 'error', text: res.message });
  };

  return (
    <div>
      <Link className="btn btn-ghost" to="/sessions">← Back to sessions</Link>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      <div className="card tutor-profile">
        <div className="tutor-head">
          <div className="avatar">{student.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</div>
          <div>
            <h2>{student.full_name}</h2>
            <p className="muted">{student.email}</p>
            <p className="muted small">
              {student.strand ? `${STRAND_LABELS[student.strand] || student.strand}` : 'No strand set'}
              {student.course ? ` · Course: ${student.course}` : ''}
              {student.year_level ? ` · Year ${student.year_level}` : ''}
              {student.grade_level ? ` · Grade ${student.grade_level}` : ''}
            </p>
          </div>
        </div>

        <div className="grid-2">
          <div>
            <h4>About</h4>
            <p>{student.bio || 'No bio yet.'}</p>
            {student.school && <p className="muted small">School: {student.school}</p>}
            {student.age && <p className="muted small">Age: {student.age}</p>}
            {student.learning_mode && (
              <p className="muted small">Prefers: {student.learning_mode === 'both' ? 'Online & In-Person'
                : student.learning_mode === 'online' ? 'Online sessions' : 'Face-to-face sessions'}</p>
            )}
            {student.preferred_time && <p className="muted small">Preferred time: {student.preferred_time}</p>}
          </div>
          <div>
            <h4>Subjects needing help</h4>
            {student.subjects.length > 0 ? (
              <div className="subject-tags">
                {student.subjects.map((s) => (
                  <span key={s.id} className="tag">{s.name}</span>
                ))}
              </div>
            ) : (
              <p className="muted small">No subjects listed yet.</p>
            )}
            {student.subjects_needed && Array.isArray(student.subjects_needed) && student.subjects_needed.length > 0 && (
              <>
                <h4>Additional needs</h4>
                <p className="muted small">{student.subjects_needed.join(', ')}</p>
              </>
            )}
          </div>
        </div>

        {isTutor && (
          <div className="card-inner actions">
            <div className="row-actions">
              <button className="btn btn-primary" onClick={startConversation} disabled={busy || student.subjects.length === 0}>
                {busy ? 'Starting…' : 'Message this student'}
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="muted small">Member since {formatDate(student.created_at)}</p>
    </div>
  );
}