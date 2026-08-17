import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useApi } from '../hooks/useApi';
import { studentService, tutorService, userService } from '../services';
import { Spinner, Alert, RatingStars } from '../components/ui';

function StudentProfile() {
  const confirm = useConfirm();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => studentService.getMe().then((res) => {
    if (res.ok) setProfile(res.data);
    else setErr(res.message);
    setLoading(false);
  });

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const ok = await confirm({ title: 'Save profile?', message: 'Save your profile changes?', confirmText: 'Save profile' });
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    const res = await studentService.updateMe({
      year_level: Number(e.target.year_level.value),
      course: e.target.course.value,
      bio: e.target.bio.value
    });
    setBusy(false);
    if (res.ok) {
      setMsg({ type: 'success', text: res.message });
      setProfile(res.data);
    } else setErr(res.message);
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
        <label>Bio (optional)</label>
        <textarea name="bio" rows="4" defaultValue={profile.bio || ''} placeholder="Tell tutors what kind of help you need…" />
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

  const load = async () => {
    const res = await tutorService.getMe();
    if (res.ok) {
      setProfile(res.data);
      setDays((res.data.availability || {}));
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
      availability: days
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