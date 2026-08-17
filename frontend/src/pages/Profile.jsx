import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useApi } from '../hooks/useApi';
import { studentService, tutorService, userService, subjectService } from '../services';
import { Spinner, Alert, RatingStars } from '../components/ui';
import {
  STRANDS, STRAND_LABELS, GRADE_LEVELS, LEARNING_MODES, SCHEDULE_OPTIONS, TIME_OPTIONS
} from '../constants/learningProfile';

const TAG_OPTIONS = [
  'Flexible Schedule', 'Online Session', 'Face-to-Face', 'Patient & Friendly',
  'Exam Prep', 'Beginner Friendly', 'Advanced Topics', 'Project Help',
  'Speaks English & Filipino', 'Quick Replies'
];

function StudentProfile() {
  const confirm = useConfirm();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState([]);
  const [time, setTime] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [allSubjects, setAllSubjects] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [subjectQuery, setSubjectQuery] = useState('');

  const load = () => Promise.all([
    studentService.getMe(),
    subjectService.list(),
    studentService.getSubjects()
  ]).then(([me, list, mine]) => {
    if (me.ok) {
      setProfile(me.data);
      setDays(me.data.preferred_schedule || []);
      const t = me.data.preferred_time || '';
      setTime(TIME_OPTIONS.includes(t) ? t : t ? 'Custom time' : '');
      setCustomTime(TIME_OPTIONS.includes(t) ? '' : t);
    } else setErr(me.message);
    if (list.ok) setAllSubjects(list.data);
    if (mine.ok) setSelectedSubjects(mine.data.map((s) => s.id));
    setLoading(false);
  });

  useEffect(() => {
    load();
  }, []);

  const toggleDay = (d) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const toggleSubject = (id) => {
    setSelectedSubjects((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const subjectQueryLower = subjectQuery.trim().toLowerCase();
  const visibleSubjects = allSubjects.filter((s) => {
    if (!subjectQueryLower) return true;
    return (
      s.name.toLowerCase().includes(subjectQueryLower) ||
      s.code.toLowerCase().includes(subjectQueryLower) ||
      (s.strand || '').toLowerCase().includes(subjectQueryLower) ||
      (STRAND_LABELS[s.strand] || '').toLowerCase().includes(subjectQueryLower)
    );
  });

  const submit = async (e) => {
    e.preventDefault();
    if (selectedSubjects.length === 0) {
      setErr('Pick at least one subject you need help with');
      return;
    }
    const ok = await confirm({ title: 'Save profile?', message: 'Save your profile changes?', confirmText: 'Save profile' });
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    const [res, subjRes] = await Promise.all([
      studentService.updateMe({
        year_level: Number(e.target.year_level.value),
        course: e.target.course.value,
        bio: e.target.bio.value,
        age: e.target.age.value ? Number(e.target.age.value) : undefined,
        grade_level: e.target.grade_level.value || undefined,
        school: e.target.school.value || undefined,
        strand: e.target.strand.value || undefined,
        learning_mode: e.target.learning_mode.value || undefined,
        preferred_schedule: days,
        preferred_time: time === 'Custom time' ? customTime.trim() : time || undefined
      }),
      studentService.setSubjects(selectedSubjects)
    ]);
    setBusy(false);
    if (res.ok && subjRes.ok) {
      setMsg({ type: 'success', text: res.message });
      setProfile(res.data);
    } else if (!res.ok) setErr(res.message);
    else setErr(subjRes.message);
  };

  if (loading) return <Spinner />;
  if (err) return <Alert type="error">{err}</Alert>;
  if (!profile) return <Alert type="error">Student profile not found.</Alert>;

  return (
    <div>
      <h2>My Profile <span className="muted small">— Student</span></h2>
      <Alert type={msg?.type}>{msg ? msg.text : null}</Alert>
      <Alert type="error">{err}</Alert>
      <form className="card form" onSubmit={submit}>
        <label>Full name</label>
        <input value={profile.full_name} disabled />
        <label>Email</label>
        <input value={profile.email} disabled />
        <label>Course / program</label>
        <input name="course" defaultValue={profile.course || ''} placeholder="e.g. Computer Science" />
        <label>Year level</label>
        <select name="year_level" defaultValue={profile.year_level || 1}>
          {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}
        </select>
        <div className="grid-2">
          <div>
            <label>Age</label>
            <input name="age" type="number" min="10" max="100" defaultValue={profile.age || ''} placeholder="e.g. 16" />
          </div>
          <div>
            <label>Grade level</label>
            <select name="grade_level" defaultValue={profile.grade_level || ''}>
              <option value="">—</option>
              {GRADE_LEVELS.map((g) => <option key={g.label} value={g.label}>{g.label}</option>)}
            </select>
          </div>
        </div>
        <label>School</label>
        <input name="school" defaultValue={profile.school || ''} placeholder="e.g. Quezon City High School" />
        <div>
          <label>Strand / level</label>
          <select name="strand" defaultValue={profile.strand || ''}>
            <option value="">—</option>
            {STRANDS.map((s) => <option key={s} value={s}>{STRAND_LABELS[s] || s}</option>)}
          </select>
        </div>
        <label>Bio (optional)</label>
        <textarea name="bio" rows="4" defaultValue={profile.bio || ''} placeholder="Tell tutors what kind of help you need…" />
        <label>Subjects I need help with <span className="muted small">— approved subjects from the admin catalog</span></label>
        <div className="subject-search-wrap">
          <input
            type="search"
            className="subject-search"
            placeholder="Search subjects by name, code or strand…"
            value={subjectQuery}
            onChange={(e) => setSubjectQuery(e.target.value)}
            aria-label="Search approved subjects"
          />
          {subjectQuery && (
            <button type="button" className="search-clear" onClick={() => setSubjectQuery('')} aria-label="Clear search">×</button>
          )}
        </div>
        <div className="day-picker subject-picker">
          {visibleSubjects.map((s) => (
            <button
              type="button"
              key={s.id}
              className={`day-chip ${selectedSubjects.includes(s.id) ? 'on' : ''}`}
              onClick={() => toggleSubject(s.id)}
            >
              {s.name}
              {s.strand && <span className="chip-strand"> · {STRAND_LABELS[s.strand] || s.strand}</span>}
            </button>
          ))}
        </div>
        {visibleSubjects.length === 0 && (
          <p className="muted small">No approved subjects match “{subjectQuery.trim()}”.</p>
        )}
        {allSubjects.length === 0 && (
          <p className="muted small">No subjects in the catalog yet — ask an administrator to add subjects.</p>
        )}
        <p className="muted small">Tip: the more subjects you pick, the more tutors the matching engine can recommend (selected: {selectedSubjects.length}).</p>
        <label>Preferred learning mode</label>
        <select name="learning_mode" defaultValue={profile.learning_mode || ''}>
          <option value="">—</option>
          {LEARNING_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <label>Preferred schedule</label>
        <div className="day-picker">
          {SCHEDULE_OPTIONS.map((d) => (
            <button type="button" key={d} className={`day-chip ${days.includes(d) ? 'on' : ''}`} onClick={() => toggleDay(d)}>
              {d}
            </button>
          ))}
        </div>
        <label>Preferred time</label>
        <select value={time} onChange={(e) => setTime(e.target.value)}>
          <option value="">—</option>
          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {time === 'Custom time' && (
          <input value={customTime} onChange={(e) => setCustomTime(e.target.value)} placeholder="e.g. 10:00 AM - 11:30 AM" />
        )}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
      </form>
    </div>
  );
}

function TutorProfile() {
  const confirm = useConfirm();
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState({});
  const [prefDays, setPrefDays] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [time, setTime] = useState('');
  const [customTime, setCustomTime] = useState('');

  const load = async () => {
    const res = await tutorService.getMe();
    if (res.ok) {
      setProfile(res.data);
      setDays((res.data.availability || {}));
      setPrefDays(res.data.preferred_schedule || []);
      setTags(Array.isArray(res.data.tags) ? res.data.tags : []);
      const t = res.data.preferred_time || '';
      setTime(TIME_OPTIONS.includes(t) ? t : t ? 'Custom time' : '');
      setCustomTime(TIME_OPTIONS.includes(t) ? '' : t);
    } else setErr(res.message);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleDay = (day) => {
    setDays((prev) => {
      const next = { ...prev };
      if (next[day]) delete next[day];
      else next[day] = ['10:00-12:00', '14:00-16:00'];
      return next;
    });
  };

  const togglePrefDay = (d) => {
    setPrefDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const toggleTag = (t) => {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const addTag = () => {
    const t = tagInput.trim().slice(0, 30);
    if (!t || tags.includes(t) || tags.length >= 12) return;
    setTags((prev) => [...prev, t]);
    setTagInput('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const ok = await confirm({ title: 'Save profile?', message: 'Save your profile changes?', confirmText: 'Save profile' });
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await tutorService.updateMe({
      course: e.target.course.value,
      max_year_level: Number(e.target.max_year.value),
      bio: e.target.bio.value,
      availability: days,
      age: e.target.age.value ? Number(e.target.age.value) : undefined,
      grade_level: e.target.grade_level.value || undefined,
      school: e.target.school.value || undefined,
      strand: e.target.strand.value || undefined,
      learning_mode: e.target.learning_mode.value || undefined,
      preferred_schedule: prefDays,
      preferred_time: time === 'Custom time' ? customTime.trim() : time || undefined,
      tags
    });
    setBusy(false);
    if (res.ok) {
      setMsg({ type: 'success', text: res.message });
      setProfile(res.data);
    } else setErr(res.message);
  };

  if (!profile && !err) return <Spinner />;
  if (err && !profile) return <Alert type="error">{err}</Alert>;

  return (
    <div>
      <h2>My Profile <span className="muted small">— Tutor</span></h2>
      <Alert type={msg?.type}>{msg ? msg.text : null}</Alert>
      <Alert type="error">{err}</Alert>
      <form className="card form" onSubmit={submit}>
        <label>Full name</label>
        <input value={profile.full_name} disabled />
        <label>Email</label>
        <input value={profile.email} disabled />
        <div className="grid-2">
          <div>
            <label>Course / program</label>
            <input name="course" defaultValue={profile.course || ''} placeholder="e.g. Mathematics" />
          </div>
          <div>
            <label>Max year level you can tutor</label>
            <select name="max_year" defaultValue={profile.max_year_level || 5}>
              {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div>
            <label>Age</label>
            <input name="age" type="number" min="10" max="100" defaultValue={profile.age || ''} placeholder="e.g. 18" />
          </div>
          <div>
            <label>Grade level</label>
            <select name="grade_level" defaultValue={profile.grade_level || ''}>
              <option value="">—</option>
              {GRADE_LEVELS.map((g) => <option key={g.label} value={g.label}>{g.label}</option>)}
            </select>
          </div>
        </div>
        <label>School</label>
        <input name="school" defaultValue={profile.school || ''} placeholder="e.g. Quezon City High School" />
        <label>Strand / level</label>
        <select name="strand" defaultValue={profile.strand || ''}>
          <option value="">—</option>
          {STRANDS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label>Preferred learning mode</label>
        <select name="learning_mode" defaultValue={profile.learning_mode || ''}>
          <option value="">—</option>
          {LEARNING_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <label>Preferred schedule</label>
        <div className="day-picker">
          {SCHEDULE_OPTIONS.map((d) => (
            <button type="button" key={d} className={`day-chip ${prefDays.includes(d) ? 'on' : ''}`} onClick={() => togglePrefDay(d)}>
              {d}
            </button>
          ))}
        </div>
        <label>Preferred time</label>
        <select value={time} onChange={(e) => setTime(e.target.value)}>
          <option value="">—</option>
          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {time === 'Custom time' && (
          <input value={customTime} onChange={(e) => setCustomTime(e.target.value)} placeholder="e.g. 10:00 AM - 11:30 AM" />
        )}
        <label>Bio (optional)</label>
        <textarea name="bio" rows="4" defaultValue={profile.bio || ''} placeholder="Share your teaching style and strengths…" />

        <label>Weekly availability (days you can hold sessions)</label>
        <div className="day-picker">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <button
              type="button"
              key={d}
              className={`day-chip ${days[d] ? 'on' : ''}`}
              onClick={() => toggleDay(d)}
            >
              {d}
            </button>
          ))}
        </div>
        <p className="muted small">Tip: more available days improve your matching score (up to 15 points).</p>

        <label>Tags (shown on your tutor card)</label>
        <div className="day-picker">
          {TAG_OPTIONS.map((t) => (
            <button type="button" key={t} className={`day-chip ${tags.includes(t) ? 'on' : ''}`} onClick={() => toggleTag(t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="tag-input-row">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            placeholder="Add a custom tag… (max 30 chars)"
            maxLength={30}
          />
          <button type="button" className="btn btn-outline" onClick={addTag} disabled={!tagInput.trim()}>Add</button>
        </div>
        {tags.length > 0 && (
          <div className="day-picker">
            {tags.map((t) => (
              <span key={t} className="day-chip static on">{t} <button type="button" className="tag-remove" onClick={() => toggleTag(t)} aria-label={`Remove ${t}`}>×</button></span>
            ))}
          </div>
        )}
        <p className="muted small">Tip: tags help students understand your teaching style and appear in tutor search results.</p>

        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
      </form>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  if (user?.role_key === 'student') return <StudentProfile />;
  if (user?.role_key === 'tutor') return <TutorProfile />;
  return (
    <div>
      <h2>My Profile</h2>
      <div className="card form">
        <label>Full name</label>
        <input value={`${user.first_name} ${user.last_name}`} disabled />
        <label>Email</label>
        <input value={user.email} disabled />
        <label>Role</label>
        <input value={user.role} disabled />
        <p className="muted small">Faculty and administrator account details are managed by an administrator.</p>
      </div>
    </div>
  );
}