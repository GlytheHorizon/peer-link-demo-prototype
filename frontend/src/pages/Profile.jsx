import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { studentService, tutorService, subjectService, userService } from '../services';
import { Spinner, Alert, Modal, RatingStars } from '../components/ui';
import {
  STRANDS, STRAND_LABELS, GRADE_LEVELS, LEARNING_MODES, SCHEDULE_OPTIONS, TIME_OPTIONS
} from '../constants/learningProfile';

const GENDERS = ['Male', 'Female', 'Other'];

const TAG_OPTIONS = [
  'Flexible Schedule', 'Online Session', 'Face-to-Face', 'Patient & Friendly',
  'Exam Prep', 'Beginner Friendly', 'Advanced Topics', 'Project Help',
  'Speaks English & Filipino', 'Quick Replies'
];

const initialsOf = (name) => (
  (name || '?').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
);

const modeLabel = (v) => (LEARNING_MODES.find((m) => m.value === v)?.label) || v;
const strandLabel = (v) => (v ? (STRAND_LABELS[v] || v) : null);
const joinList = (arr) => (Array.isArray(arr) && arr.length ? arr.join(', ') : null);
const subjectLabel = (s) => String(s?.name || s?.code || `Subject #${s?.id}`).trim();

/* ------------------------------------------------------------------ */
/*  Inline editable name header                                         */
/* ------------------------------------------------------------------ */
function ProfileHeaderCard({ profile, nameChangesCount, onEdit, onNameSave }) {
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(profile.first_name || '');
  const [last, setLast] = useState(profile.last_name || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const changesLeft = Math.max(0, 2 - (nameChangesCount || 0));

  const save = async () => {
    if (!first.trim() || !last.trim()) { setErr('First and last name are required'); return; }
    setBusy(true); setErr(null);
    const res = await userService.changeName({ first_name: first.trim(), last_name: last.trim() });
    setBusy(false);
    if (res.ok) {
      setEditing(false);
      onNameSave(res.data, res.message);
    } else {
      setErr(res.message);
    }
  };

  const cancel = () => {
    setFirst(profile.first_name || '');
    setLast(profile.last_name || '');
    setErr(null);
    setEditing(false);
  };

  return (
    <div className="profile-header">
      <div className="profile-avatar" aria-hidden="true">{initialsOf(profile.full_name)}</div>
      <div className="profile-identity">
        {editing ? (
          <div className="profile-name-edit">
            <div className="profile-name-inputs">
              <input
                id="pn-first"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                placeholder="First name"
                maxLength={100}
                style={{ fontWeight: 600, fontSize: '1rem' }}
              />
              <input
                id="pn-last"
                value={last}
                onChange={(e) => setLast(e.target.value)}
                placeholder="Last name"
                maxLength={100}
                style={{ fontWeight: 600, fontSize: '1rem' }}
              />
            </div>
            {err && <p className="muted small" style={{ color: 'var(--danger)', margin: '4px 0 0' }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save name'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={cancel} disabled={busy}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {profile.full_name}
              {changesLeft > 0 ? (
                <button
                  type="button"
                  title={`Edit name (${changesLeft} change${changesLeft !== 1 ? 's' : ''} left this month)`}
                  onClick={() => setEditing(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.85rem', padding: '2px 6px' }}
                >✎</button>
              ) : (
                <span title="Name change limit reached for this month" style={{ color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 400 }}>
                  (name locked — 2/2 used this month)
                </span>
              )}
            </h3>
            <p className="muted small">
              Name changes: {nameChangesCount || 0}/2 this month
            </p>
            {profile.age ? <p className="profile-age">{profile.age} yrs old</p> : null}
          </>
        )}
      </div>
      <button type="button" className="btn btn-primary profile-edit-btn" onClick={onEdit}>Edit Profile</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Account Settings card (email + password change)                     */
/* ------------------------------------------------------------------ */
function AccountSettings({ userEmail, refreshUser }) {
  const [emailForm, setEmailForm] = useState({ current_email: '', new_email: '', confirm_new_email: '' });
  const [emailMsg, setEmailMsg] = useState(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_new_password: '' });
  const [pwMsg, setPwMsg] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);

  const setEF = (k) => (e) => setEmailForm((p) => ({ ...p, [k]: e.target.value }));
  const setPF = (k) => (e) => setPwForm((p) => ({ ...p, [k]: e.target.value }));

  const submitEmail = async (e) => {
    e.preventDefault();
    setEmailBusy(true); setEmailMsg(null);
    const res = await userService.changeEmail(emailForm);
    setEmailBusy(false);
    if (res.ok) {
      setEmailMsg({ type: 'success', text: res.message });
      setEmailForm({ current_email: '', new_email: '', confirm_new_email: '' });
      if (refreshUser) refreshUser();
    } else {
      setEmailMsg({ type: 'error', text: res.message });
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwBusy(true); setPwMsg(null);
    const res = await userService.changePassword(pwForm);
    setPwBusy(false);
    if (res.ok) {
      setPwMsg({ type: 'success', text: res.message });
      setPwForm({ current_password: '', new_password: '', confirm_new_password: '' });
    } else {
      setPwMsg({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="card profile-panel" style={{ marginTop: 18 }}>
      <h4 style={{ marginBottom: 18 }}>Account Settings</h4>

      {/* --- Change Email --- */}
      <div className="account-settings-section">
        <h5 className="form-section-title" style={{ marginBottom: 10 }}>Change Email</h5>
        {emailMsg && <Alert type={emailMsg.type}>{emailMsg.text}</Alert>}
        <form className="form" onSubmit={submitEmail} style={{ gap: 10 }}>
          <label htmlFor="ae-current">Current Email</label>
          <input
            id="ae-current"
            type="email"
            value={emailForm.current_email}
            onChange={setEF('current_email')}
            placeholder={userEmail || 'your.current@email.com'}
            required
            disabled={emailBusy}
          />
          <label htmlFor="ae-new">New Email</label>
          <input
            id="ae-new"
            type="email"
            value={emailForm.new_email}
            onChange={setEF('new_email')}
            placeholder="new@email.com"
            required
            disabled={emailBusy}
          />
          <label htmlFor="ae-confirm">Confirm New Email</label>
          <input
            id="ae-confirm"
            type="email"
            value={emailForm.confirm_new_email}
            onChange={setEF('confirm_new_email')}
            placeholder="new@email.com"
            required
            disabled={emailBusy}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="submit" className="btn btn-primary" disabled={emailBusy}>
              {emailBusy ? 'Updating…' : 'Update Email'}
            </button>
          </div>
        </form>
      </div>

      <hr style={{ margin: '22px 0', borderColor: 'var(--border)' }} />

      {/* --- Change Password --- */}
      <div className="account-settings-section">
        <h5 className="form-section-title" style={{ marginBottom: 10 }}>Change Password</h5>
        {pwMsg && <Alert type={pwMsg.type}>{pwMsg.text}</Alert>}
        <form className="form" onSubmit={submitPassword} style={{ gap: 10 }}>
          <label htmlFor="ap-current">Current Password</label>
          <input
            id="ap-current"
            type="password"
            value={pwForm.current_password}
            onChange={setPF('current_password')}
            placeholder="Enter current password"
            required
            disabled={pwBusy}
            autoComplete="current-password"
          />
          <label htmlFor="ap-new">New Password</label>
          <input
            id="ap-new"
            type="password"
            value={pwForm.new_password}
            onChange={setPF('new_password')}
            placeholder="Minimum 8 characters"
            required
            minLength={8}
            disabled={pwBusy}
            autoComplete="new-password"
          />
          <label htmlFor="ap-confirm">Confirm New Password</label>
          <input
            id="ap-confirm"
            type="password"
            value={pwForm.confirm_new_password}
            onChange={setPF('confirm_new_password')}
            placeholder="Repeat new password"
            required
            disabled={pwBusy}
            autoComplete="new-password"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="submit" className="btn btn-primary" disabled={pwBusy}>
              {pwBusy ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                               */
/* ------------------------------------------------------------------ */
function InfoRow({ label, value, list }) {
  if (list && list.length) {
    return (
      <div className="info-row info-row--list">
        <span className="info-label">{label}</span>
        <ul className="info-list">
          {list.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </div>
    );
  }
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value || '—'}</span>
    </div>
  );
}

function InfoPanel({ title, rows }) {
  return (
    <div className="card profile-panel">
      <h4>{title}</h4>
      <div className="info-rows">
        {rows.map((r) => <InfoRow key={r.label} label={r.label} value={r.value} list={r.list} />)}
      </div>
    </div>
  );
}

function PersonalInfoFields({ profile }) {
  return (
    <>
      <h5 className="form-section-title">Personal Information</h5>
      <label>Contact No</label>
      <input name="contact_no" defaultValue={profile.contact_no || ''} placeholder="e.g. 09123456789" maxLength={20} />
      <label>School</label>
      <input name="school" defaultValue={profile.school || ''} placeholder="e.g. Pateros Technological College" />
      <label>Course / program</label>
      <input name="course" defaultValue={profile.course || ''} placeholder="e.g. BSIT" />
      <div className="grid-2">
        <div>
          <label>Age</label>
          <input name="age" type="number" min="10" max="100" defaultValue={profile.age || ''} placeholder="e.g. 23" />
        </div>
        <div>
          <label>Gender</label>
          <select name="gender" defaultValue={profile.gender || ''}>
            <option value="">—</option>
            {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Student Profile                                                     */
/* ------------------------------------------------------------------ */
function StudentProfile() {
  const confirm = useConfirm();
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState([]);
  const [time, setTime] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [allSubjects, setAllSubjects] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [subjectQuery, setSubjectQuery] = useState('');
  const [nameChangesCount, setNameChangesCount] = useState(0);

  const load = () => Promise.all([
    studentService.getMe(),
    subjectService.list(),
    studentService.getSubjects()
  ]).then(([me, list, mine]) => {
    if (me.ok) {
      setProfile(me.data);
      setNameChangesCount(me.data.name_changes_count || 0);
      setDays(me.data.preferred_schedule || []);
      const t = me.data.preferred_time || '';
      setTime(TIME_OPTIONS.includes(t) ? t : t ? 'Custom time' : '');
      setCustomTime(TIME_OPTIONS.includes(t) ? '' : t);
    } else setErr(me.message);
    if (list.ok) setAllSubjects(list.data);
    if (mine.ok) setSelectedSubjects(mine.data.map((s) => s.id));
    setLoading(false);
  });

  useEffect(() => { load(); }, []);

  const toggleDay = (d) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  const toggleSubject = (id) => setSelectedSubjects((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const subjectQueryLower = subjectQuery.trim().toLowerCase();
  const visibleSubjects = allSubjects
    .filter((s) => {
      if (!subjectQueryLower) return true;
      const name = subjectLabel(s).toLowerCase();
      const code = String(s.code || '').toLowerCase();
      return name.includes(subjectQueryLower) || code.includes(subjectQueryLower) ||
        (s.strand || '').toLowerCase().includes(subjectQueryLower) ||
        (STRAND_LABELS[s.strand] || '').toLowerCase().includes(subjectQueryLower);
    })
    .sort((a, b) => (selectedSubjects.includes(a.id) ? 0 : 1) - (selectedSubjects.includes(b.id) ? 0 : 1));

  const submit = async (e) => {
    e.preventDefault();
    if (selectedSubjects.length === 0) { setErr('Pick at least one subject you need help with'); return; }
    const ok = await confirm({ title: 'Save profile?', message: 'Save your profile changes?', confirmText: 'Save profile' });
    if (!ok) return;
    setBusy(true); setMsg(null); setErr(null);
    const subjRes = await studentService.setSubjects(selectedSubjects);
    const res = subjRes.ok ? await studentService.updateMe({
      year_level: Number(e.target.year_level.value),
      course: e.target.course.value,
      bio: e.target.bio.value,
      age: e.target.age.value ? Number(e.target.age.value) : undefined,
      grade_level: e.target.grade_level.value || undefined,
      school: e.target.school.value || undefined,
      strand: e.target.strand.value || undefined,
      contact_no: e.target.contact_no.value || undefined,
      gender: e.target.gender.value || undefined,
      learning_mode: e.target.learning_mode.value || undefined,
      preferred_schedule: days,
      preferred_time: time === 'Custom time' ? customTime.trim() : time || undefined
    }) : null;
    setBusy(false);
    if (res && subjRes.ok) {
      setMsg({ type: 'success', text: res.message });
      setProfile(res.data);
      setEditing(false);
      setDays(res.data.preferred_schedule || []);
      const t = res.data.preferred_time || '';
      setTime(TIME_OPTIONS.includes(t) ? t : t ? 'Custom time' : '');
      setCustomTime(TIME_OPTIONS.includes(t) ? '' : t);
      setSelectedSubjects(res.data.subjects?.map((s) => s.id) || []);
    } else if (!res) setErr(subjRes.message);
    else setErr(res.message);
  };

  if (loading) return <Spinner />;
  if (err && !profile) return <Alert type="error">{err}</Alert>;
  if (!profile) return <Alert type="error">Student profile not found.</Alert>;

  return (
    <div>
      <h2>Profile</h2>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {err && <Alert type="error">{err}</Alert>}
      <ProfileHeaderCard
        profile={profile}
        nameChangesCount={nameChangesCount}
        onEdit={() => setEditing(true)}
        onNameSave={(updated, message) => {
          setProfile((p) => ({ ...p, first_name: updated.first_name, last_name: updated.last_name, full_name: `${updated.first_name} ${updated.last_name}` }));
          setNameChangesCount(updated.name_changes_count || 0);
          setMsg({ type: 'success', text: message });
          if (refreshUser) refreshUser();
        }}
      />
      <InfoPanel
        title="Personal Information"
        rows={[
          { label: 'Email', value: profile.email },
          { label: 'Contact No', value: profile.contact_no },
          { label: 'School', value: profile.school },
          { label: 'Course', value: profile.course },
          { label: 'Year level', value: profile.year_level ? `Year ${profile.year_level}` : null },
          { label: 'Age', value: profile.age ? `${profile.age} yrs old` : null },
          { label: 'Gender', value: profile.gender },
          { label: 'Grade level', value: profile.grade_level },
          { label: 'Strand / level', value: strandLabel(profile.strand) }
        ]}
      />
      <InfoPanel
        title="Learning preferences"
        rows={[
          { label: 'Learning mode', value: modeLabel(profile.learning_mode) },
          { label: 'Preferred schedule', value: joinList(profile.preferred_schedule) },
          { label: 'Preferred time', value: profile.preferred_time },
          { label: 'Subjects I need help with', value: (profile.subjects || []).map((s) => s.name).join(', ') },
          { label: 'Bio', value: profile.bio }
        ]}
      />

      <AccountSettings userEmail={profile.email} refreshUser={refreshUser} />

      {editing && (
        <Modal title="Edit Profile" className="profile-modal" onClose={() => setEditing(false)}>
          <form className="form" onSubmit={submit}>
            <PersonalInfoFields profile={profile} />
            <h5 className="form-section-title">Learning preferences</h5>
            <label>Year level</label>
            <select name="year_level" defaultValue={profile.year_level || 1}>
              {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
            <div className="grid-2">
              <div>
                <label>Grade level</label>
                <select name="grade_level" defaultValue={profile.grade_level || ''}>
                  <option value="">—</option>
                  {GRADE_LEVELS.map((g) => <option key={g.label} value={g.label}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <label>Strand / level</label>
                <select name="strand" defaultValue={profile.strand || ''}>
                  <option value="">—</option>
                  {STRANDS.map((s) => <option key={s} value={s}>{STRAND_LABELS[s] || s}</option>)}
                </select>
              </div>
            </div>
            <label>Bio (optional)</label>
            <textarea name="bio" rows="4" defaultValue={profile.bio || ''} placeholder="Tell tutors what kind of help you need…" />
            <label>Subjects I need help with <span className="muted small">— approved subjects from the admin catalog</span></label>
            <div className="subject-search-wrap">
              <input type="search" className="subject-search" placeholder="Search subjects by name, code or strand…" value={subjectQuery} onChange={(e) => setSubjectQuery(e.target.value)} aria-label="Search approved subjects" />
              {subjectQuery && <button type="button" className="search-clear" onClick={() => setSubjectQuery('')} aria-label="Clear search">×</button>}
            </div>
            <div className="day-picker subject-picker">
              {visibleSubjects.map((s) => (
                <button type="button" key={s.id} className={`day-chip ${selectedSubjects.includes(s.id) ? 'on' : ''}`} onClick={() => toggleSubject(s.id)}>
                  {subjectLabel(s)}
                  {s.strand && <span className="chip-strand"> · {STRAND_LABELS[s.strand] || s.strand}</span>}
                </button>
              ))}
            </div>
            {visibleSubjects.length === 0 && <p className="muted small">No approved subjects match "{subjectQuery.trim()}".</p>}
            {allSubjects.length === 0 && <p className="muted small">No subjects in the catalog yet — ask an administrator to add subjects.</p>}
            <p className="muted small">Tip: the more subjects you pick, the more tutors the matching engine can recommend (selected: {selectedSubjects.length}).</p>
            <label>Preferred learning mode</label>
            <select name="learning_mode" defaultValue={profile.learning_mode || ''}>
              <option value="">—</option>
              {LEARNING_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <label>Preferred schedule</label>
            <div className="day-picker">
              {SCHEDULE_OPTIONS.map((d) => (
                <button type="button" key={d} className={`day-chip ${days.includes(d) ? 'on' : ''}`} onClick={() => toggleDay(d)}>{d}</button>
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
            <div className="row-actions modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tutor Profile                                                       */
/* ------------------------------------------------------------------ */
function TutorProfile() {
  const confirm = useConfirm();
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState({});
  const [prefDays, setPrefDays] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [time, setTime] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [allSubjects, setAllSubjects] = useState([]);
  const [subjectMap, setSubjectMap] = useState({});
  const [subjectQuery, setSubjectQuery] = useState('');
  const [nameChangesCount, setNameChangesCount] = useState(0);

  const load = async () => {
    const [res, catalog] = await Promise.all([tutorService.getMe(), subjectService.list()]);
    if (res.ok) {
      setProfile(res.data);
      setNameChangesCount(res.data.name_changes_count || 0);
      setDays((res.data.availability || {}));
      setPrefDays(res.data.preferred_schedule || []);
      setTags(Array.isArray(res.data.tags) ? res.data.tags : []);
      const t = res.data.preferred_time || '';
      setTime(TIME_OPTIONS.includes(t) ? t : t ? 'Custom time' : '');
      setCustomTime(TIME_OPTIONS.includes(t) ? '' : t);
      const map = {};
      for (const s of res.data.subjects || []) {
        map[s.id] = { proficiency: s.proficiency || 3, rate_per_hour: s.rate_per_hour ?? 100 };
      }
      setSubjectMap(map);
    } else setErr(res.message);
    if (catalog.ok) setAllSubjects(catalog.data);
  };

  useEffect(() => { load(); }, []);

  const toggleDay = (day) => setDays((prev) => { const next = { ...prev }; if (next[day]) delete next[day]; else next[day] = ['10:00-12:00', '14:00-16:00']; return next; });
  const togglePrefDay = (d) => setPrefDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  const toggleTag = (t) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const addTag = () => {
    const t = tagInput.trim().slice(0, 30);
    if (!t || tags.includes(t) || tags.length >= 12) return;
    setTags((prev) => [...prev, t]);
    setTagInput('');
  };

  const toggleSubject = (id) => setSubjectMap((prev) => { const next = { ...prev }; if (next[id]) delete next[id]; else next[id] = { proficiency: 3, rate_per_hour: 100 }; return next; });
  const updateSubjectField = (id, field, value) => setSubjectMap((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const subjectQueryLower = subjectQuery.trim().toLowerCase();
  const visibleSubjects = allSubjects
    .filter((s) => {
      if (!subjectQueryLower) return true;
      const name = subjectLabel(s).toLowerCase();
      const code = String(s.code || '').toLowerCase();
      return name.includes(subjectQueryLower) || code.includes(subjectQueryLower) ||
        (s.strand || '').toLowerCase().includes(subjectQueryLower) ||
        (STRAND_LABELS[s.strand] || '').toLowerCase().includes(subjectQueryLower);
    })
    .sort((a, b) => (subjectMap[a.id] ? 0 : 1) - (subjectMap[b.id] ? 0 : 1));

  const submit = async (e) => {
    e.preventDefault();
    if (Object.keys(subjectMap).length === 0) { setErr('Pick at least one subject you can teach'); return; }
    const subjects = Object.entries(subjectMap).map(([id, d]) => ({
      subject_id: Number(id),
      proficiency: Math.min(5, Math.max(1, Number(d.proficiency) || 3)),
      rate_per_hour: Math.max(0, Number(d.rate_per_hour) || 0)
    }));
    const ok = await confirm({ title: 'Save profile?', message: 'Save your profile changes?', confirmText: 'Save profile' });
    if (!ok) return;
    setBusy(true); setMsg(null); setErr(null);
    const subjRes = await tutorService.setSubjects(subjects);
    const res = subjRes.ok ? await tutorService.updateMe({
      course: e.target.course.value,
      max_year_level: Number(e.target.max_year.value),
      bio: e.target.bio.value,
      availability: days,
      age: e.target.age.value ? Number(e.target.age.value) : undefined,
      grade_level: e.target.grade_level.value || undefined,
      school: e.target.school.value || undefined,
      strand: e.target.strand.value || undefined,
      contact_no: e.target.contact_no.value || undefined,
      gender: e.target.gender.value || undefined,
      learning_mode: e.target.learning_mode.value || undefined,
      preferred_schedule: prefDays,
      preferred_time: time === 'Custom time' ? customTime.trim() : time || undefined,
      tags
    }) : null;
    setBusy(false);
    if (res && subjRes.ok) {
      setMsg({ type: 'success', text: res.message });
      setProfile(res.data);
      setEditing(false);
      setDays((res.data.availability || {}));
      setPrefDays(res.data.preferred_schedule || []);
      setTags(Array.isArray(res.data.tags) ? res.data.tags : []);
      const t = res.data.preferred_time || '';
      setTime(TIME_OPTIONS.includes(t) ? t : t ? 'Custom time' : '');
      setCustomTime(TIME_OPTIONS.includes(t) ? '' : t);
      const map = {};
      for (const s of subjRes.data.subjects || []) {
        map[s.id] = { proficiency: s.proficiency || 3, rate_per_hour: s.rate_per_hour ?? 100 };
      }
      setSubjectMap(map);
    } else if (!res) setErr(subjRes.message);
    else setErr(res.message);
  };

  if (!profile && !err) return <Spinner />;
  if (err && !profile) return <Alert type="error">{err}</Alert>;

  return (
    <div>
      <h2>Profile</h2>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {err && <Alert type="error">{err}</Alert>}
      <ProfileHeaderCard
        profile={profile}
        nameChangesCount={nameChangesCount}
        onEdit={() => setEditing(true)}
        onNameSave={(updated, message) => {
          setProfile((p) => ({ ...p, first_name: updated.first_name, last_name: updated.last_name, full_name: `${updated.first_name} ${updated.last_name}` }));
          setNameChangesCount(updated.name_changes_count || 0);
          setMsg({ type: 'success', text: message });
          if (refreshUser) refreshUser();
        }}
      />
      <div className="card profile-panel">
        <h4>My rating</h4>
        <div className="info-rows">
          <div className="info-row">
            <span className="info-label">Average rating</span>
            <span className="info-value">
              <RatingStars rating={profile.avg_rating} />
              <span className="muted small"> ({profile.rating_count} ratings)</span>
              <Link className="rating-link" to={`/tutors/${user.id}/reviews`} title="View all reviews">
                View all reviews
              </Link>
            </span>
          </div>
        </div>
      </div>
      <InfoPanel
        title="Personal Information"
        rows={[
          { label: 'Email', value: profile.email },
          { label: 'Contact No', value: profile.contact_no },
          { label: 'School', value: profile.school },
          { label: 'Course', value: profile.course },
          { label: 'Age', value: profile.age ? `${profile.age} yrs old` : null },
          { label: 'Gender', value: profile.gender },
          { label: 'Grade level', value: profile.grade_level },
          { label: 'Strand / level', value: strandLabel(profile.strand) }
        ]}
      />
      <InfoPanel
        title="Tutoring settings"
        rows={[
          { label: 'Max year level you can tutor', value: profile.max_year_level ? `Year ${profile.max_year_level}` : null },
          { label: 'Learning mode', value: modeLabel(profile.learning_mode) },
          { label: 'Preferred schedule', value: joinList(profile.preferred_schedule) },
          { label: 'Preferred time', value: profile.preferred_time },
          { label: 'Weekly availability', list: (() => { const av = profile.availability || {}; return Object.keys(av).map((d) => `${d}: ${(av[d] || []).join(', ')}`); })() },
          { label: 'Subjects I teach', list: (profile.subjects || []).map((s) => `${s.name} (Proficiency ${s.proficiency}/5 · ₱${Number(s.rate_per_hour) || 100}/hr)`) },
          { label: 'Tags', value: joinList(profile.tags) },
          { label: 'Bio', value: profile.bio }
        ]}
      />

      <AccountSettings userEmail={profile.email} refreshUser={refreshUser} />

      {editing && (
        <Modal title="Edit Profile" className="profile-modal" onClose={() => setEditing(false)}>
          <form className="form" onSubmit={submit}>
            <PersonalInfoFields profile={profile} />
            <h5 className="form-section-title">Tutoring settings</h5>
            <div className="grid-2">
              <div>
                <label>Max year level you can tutor</label>
                <select name="max_year" defaultValue={profile.max_year_level || 5}>
                  {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </div>
              <div>
                <label>Grade level</label>
                <select name="grade_level" defaultValue={profile.grade_level || ''}>
                  <option value="">—</option>
                  {GRADE_LEVELS.map((g) => <option key={g.label} value={g.label}>{g.label}</option>)}
                </select>
              </div>
            </div>
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
                <button type="button" key={d} className={`day-chip ${prefDays.includes(d) ? 'on' : ''}`} onClick={() => togglePrefDay(d)}>{d}</button>
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

            <h5 className="form-section-title">Subjects you teach</h5>
            <label>Subjects I can teach <span className="muted small">— set proficiency and hourly rate for each</span></label>
            <div className="subject-search-wrap">
              <input type="search" className="subject-search" placeholder="Search subjects by name, code or strand…" value={subjectQuery} onChange={(e) => setSubjectQuery(e.target.value)} aria-label="Search subjects" />
              {subjectQuery && <button type="button" className="search-clear" onClick={() => setSubjectQuery('')} aria-label="Clear search">×</button>}
            </div>
            <div className="subject-editor">
              {allSubjects.length === 0 && <p className="muted small" style={{ padding: '6px 4px' }}>No subjects in the catalog yet — ask an administrator to add subjects.</p>}
              {allSubjects.length > 0 && visibleSubjects.length === 0 && <p className="muted small" style={{ padding: '6px 4px' }}>No subjects match "{subjectQuery.trim()}".</p>}
              {visibleSubjects.map((s) => {
                const on = !!subjectMap[s.id];
                const d = subjectMap[s.id] || { proficiency: 3, rate_per_hour: 100 };
                return (
                  <div key={s.id} className={`subject-editor-row ${on ? 'on' : ''}`}>
                    <button type="button" className="subject-editor-toggle" onClick={() => toggleSubject(s.id)} aria-pressed={on}>
                      <span className="subject-editor-check">{on ? '✓' : ''}</span>
                      <span className="subject-editor-name">{subjectLabel(s)}</span>
                      {s.strand && <span className="chip-strand"> · {STRAND_LABELS[s.strand] || s.strand}</span>}
                    </button>
                    {on && (
                      <div className="subject-editor-fields">
                        <div>
                          <label>Proficiency</label>
                          <select value={d.proficiency} onChange={(e) => updateSubjectField(s.id, 'proficiency', e.target.value)}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>{n} — {n === 1 ? 'Beginner' : n === 2 ? 'Basic' : n === 3 ? 'Intermediate' : n === 4 ? 'Advanced' : 'Expert'}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label>Rate per hour (₱)</label>
                          <input type="number" min="0" max="100000" step="10" value={d.rate_per_hour} onChange={(e) => updateSubjectField(s.id, 'rate_per_hour', e.target.value)} placeholder="e.g. 150" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="muted small">Tip: pick the subjects you teach — students book sessions at your hourly rate (selected: {Object.keys(subjectMap).length}).</p>

            <label>Weekly availability (days you can hold sessions)</label>
            <div className="day-picker">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <button type="button" key={d} className={`day-chip ${days[d] ? 'on' : ''}`} onClick={() => toggleDay(d)}>{d}</button>
              ))}
            </div>
            <p className="muted small">Tip: more available days improve your matching score (up to 15 points).</p>

            <label>Tags (shown on your tutor card)</label>
            <div className="day-picker">
              {TAG_OPTIONS.map((t) => (
                <button type="button" key={t} className={`day-chip ${tags.includes(t) ? 'on' : ''}`} onClick={() => toggleTag(t)}>{t}</button>
              ))}
            </div>
            <div className="tag-input-row">
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="Add a custom tag… (max 30 chars)" maxLength={30} />
              <button type="button" className="btn btn-outline" onClick={addTag} disabled={!tagInput.trim()}>Add</button>
            </div>
            {tags.length > 0 && (
              <div className="day-picker">
                {tags.map((t) => (
                  <span key={t} className="day-chip static on">{t} <button type="button" className="tag-remove" onClick={() => toggleTag(t)} aria-label={`Remove ${t}`}>×</button></span>
                ))}
              </div>
            )}
            <div className="row-actions modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Default export — routes by role                                     */
/* ------------------------------------------------------------------ */
export default function Profile() {
  const { user } = useAuth();
  if (user?.role_key === 'student') return <StudentProfile />;
  if (user?.role_key === 'tutor') return <TutorProfile />;
  return (
    <div>
      <h2>Profile</h2>
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
