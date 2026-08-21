import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { studentService, conversationService, reportService } from '../services';
import { Spinner, Alert, formatDate, EmptyState } from '../components/ui';
import ReportModal from '../components/ReportModal';

const STRAND_LABELS = { STEM: 'STEM', GAS: 'GAS', ICT: 'ICT', ABM: 'ABM', HUMSS: 'HUMSS', JHS: 'JHS (Grade 7-10)' };

const MODE_LABELS = {
  online: 'Online sessions',
  f2f: 'Face-to-face sessions',
  both: 'Online & In-Person'
};

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
  const [showReportModal, setShowReportModal] = useState(false);

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
      message: `Start a conversation with ${student.full_name}?`,
      confirmText: 'Message student'
    });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    const res = await conversationService.start(student.user_id, null, 'tutor');
    setBusy(false);
    if (res.ok) navigate(`/messages/${res.data.id}`);
    else setMsg({ type: 'error', text: res.message });
  };

  const strandLine = [
    student.strand ? STRAND_LABELS[student.strand] || student.strand : null,
    student.course ? `Course: ${student.course}` : null,
    student.year_level ? `Year ${student.year_level}` : null,
    student.grade_level ? `Grade ${student.grade_level}` : null
  ].filter(Boolean).join(' · ');

  return (
    <div>
      <Link className="btn btn-ghost" to="/sessions">← Back to sessions</Link>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      <div className="profile-header">
        <div className="profile-avatar" aria-hidden="true">{initialsOf(student.full_name)}</div>
        <div className="profile-identity">
          <h3>{student.full_name}</h3>
          <p className="profile-age">{student.email}</p>
          {strandLine && <p className="muted small">{strandLine}</p>}
        </div>
        {isTutor && (
          <div className="profile-actions">
            <button className="btn btn-primary" onClick={startConversation} disabled={busy}>
              {busy ? 'Starting…' : '✉ Chat'}
            </button>
            <button className="btn btn-outline" onClick={() => setShowReportModal(true)} title="Report user">
              ⚠ Report
            </button>
          </div>
        )}
      </div>

      <div className="card profile-panel">
        <h4>Personal Information</h4>
        <div className="info-rows">
          <InfoRow label="School" value={student.school} />
          <InfoRow label="Course" value={student.course} />
          <InfoRow label="Year level" value={student.year_level ? `Year ${student.year_level}` : null} />
          <InfoRow label="Grade level" value={student.grade_level} />
          <InfoRow label="Strand / level" value={student.strand ? STRAND_LABELS[student.strand] || student.strand : null} />
          <InfoRow label="Age" value={student.age ? `${student.age} yrs old` : null} />
          <InfoRow label="Member since" value={formatDate(student.created_at)} />
        </div>
      </div>

      <div className="card profile-panel">
        <h4>Learning preferences</h4>
        <div className="info-rows">
          <InfoRow label="Learning mode" value={MODE_LABELS[student.learning_mode] || student.learning_mode} />
          <InfoRow label="Preferred schedule" value={(student.preferred_schedule || []).join(', ')} />
          <InfoRow label="Preferred time" value={student.preferred_time} />
          <InfoRow label="Subjects needing help" value={(student.subjects || []).map((s) => s.name).join(', ') || (student.subjects_needed || []).join(', ')} />
          <InfoRow label="Bio" value={student.bio} />
        </div>
      </div>

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={student.user_id}
        reportedUserName={student.full_name}
        reporterRole={user.role_key}
      />
    </div>
  );
}