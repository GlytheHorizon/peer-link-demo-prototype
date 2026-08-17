import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useConfirm } from '../context/ConfirmContext';
import { subjectService, sessionService, matchService, studentService } from '../services';
import { Spinner, Alert } from '../components/ui';

const pad = (n) => String(n).padStart(2, '0');

/** Next full hour in the future, as datetime-local input value. */
function nextHourInput() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ScheduleSession() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const autoTutor = params.get('tutor');
  const autoSubject = params.get('subject');

  const subjects = useApi(subjectService.list);
  const mine = useApi(studentService.getMe);
  const confirm = useConfirm();

  const [form, setForm] = useState({
    tutor_id: autoTutor ? Number(autoTutor) : '',
    subject_id: autoSubject ? Number(autoSubject) : '',
    start: nextHourInput(),
    end: nextHourInput()
  });
  const [tutorList, setTutorList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!form.subject_id) {
      setTutorList([]);
      return;
    }
    matchService.list(form.subject_id).then((res) => {
      if (res.ok) setTutorList(res.data);
    });
  }, [form.subject_id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const tutor = tutorList.find((t) => t.tutor_user_id === Number(form.tutor_id));
    const subject = subjects.data?.find((s) => s.id === Number(form.subject_id));
    const ok = await confirm({
      title: 'Send session request?',
      message:
        `Send this request to ${tutor?.tutor_name || 'this tutor'} for ${subject?.name || 'this subject'}?\n` +
        `When: ${form.start.replace('T', ' ')} → ${form.end.replace('T', ' ')}`,
      confirmText: 'Send request'
    });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await sessionService.create({
      tutor_id: Number(form.tutor_id),
      subject_id: Number(form.subject_id),
      scheduled_start: new Date(form.start).toISOString(),
      scheduled_end: new Date(form.end).toISOString(),
      topic: form.topic,
      notes: form.notes
    });
    setBusy(false);
    if (res.ok) {
      setMsg({ type: 'success', text: res.message });
      navigate(`/sessions/${res.data.id}`);
    } else setErr(res.message);
  };

  const mySubjectIds = (mine.data?.subjects || []).map((s) => s.id);

  return (
    <div>
      <h2>Schedule a Tutoring Session</h2>
      <p className="muted">Requests are sent to the tutor, who accepts or rejects them. Scheduling conflicts are blocked automatically.</p>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {err && <Alert type="error">{err}</Alert>}
      {(subjects.loading || mine.loading) && <Spinner />}

      <form className="card form" onSubmit={submit}>
        <label>Subject</label>
        <select value={form.subject_id} onChange={set('subject_id')} required>
          <option value="">Select subject…</option>
          {mySubjectIds.map((sid) => {
            const s = subjects.data?.find((x) => x.id === sid);
            if (!s) return null;
            return <option key={s.id} value={s.id}>{s.name} ({s.code})</option>;
          })}
        </select>

        <label>Tutor</label>
        <select value={form.tutor_id} onChange={set('tutor_id')} required>
          <option value="">Select tutor…</option>
          {tutorList.map((t) => (
            <option key={t.id} value={t.tutor_user_id}>
              {t.tutor_name} — {Number(t.compatibility_score).toFixed(0)}% match
            </option>
          ))}
        </select>
        {tutorList.length === 0 && form.subject_id && (
          <p className="muted small">
            No matched tutors for this subject yet — <Link to="/matches">run matching first</Link>.
          </p>
        )}

        <div className="grid-2">
          <div>
            <label>Start date & time</label>
            <input
              type="datetime-local"
              value={form.start}
              onChange={set('start')}
              required
              min={nextHourInput()}
            />
          </div>
          <div>
            <label>End date & time</label>
            <input type="datetime-local" value={form.end} onChange={set('end')} required min={form.start} />
          </div>
        </div>
        <label>Topic (optional)</label>
        <input value={form.topic || ''} onChange={set('topic')} placeholder="e.g. Derivatives review" maxLength={255} />
        <label>Notes for the tutor (optional)</label>
        <textarea rows="3" value={form.notes || ''} onChange={set('notes')} placeholder="What should we focus on?" maxLength={2000} />

        <div className="row-actions">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending request…' : 'Send session request'}</button>
          <Link className="btn btn-ghost" to="/sessions">Back to sessions</Link>
        </div>
      </form>
    </div>
  );
}