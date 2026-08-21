import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth';
import { Alert } from '../components/ui';
import {
  STRANDS, STRAND_LABELS, SUBJECT_OPTIONS, GRADE_LEVELS, LEARNING_MODES, SCHEDULE_OPTIONS, TIME_OPTIONS
} from '../constants/learningProfile';

function Chip({ active, onClick, children }) {
  return (
    <button type="button" className={`chip ${active ? 'on' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    age: '',
    email: '',
    grade_level: '',
    school: '',
    password: '',
    confirm: ''
  });
  const [strand, setStrand] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [mode, setMode] = useState('');
  const [schedule, setSchedule] = useState([]);
  const [time, setTime] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const toggleIn = (list, setter, value) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const validateStep1 = () => {
    if (!form.name.trim()) return 'Please enter your full name';
    if (!form.age || Number(form.age) < 10 || Number(form.age) > 100) return 'Please enter a valid age';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address';
    if (!form.grade_level) return 'Please select your grade level';
    if (!form.school.trim()) return 'Please enter your school';
    if (form.password.length < 8) return 'Password must be at least 8 characters';
    if (form.password !== form.confirm) return 'Passwords do not match';
    return null;
  };

  const validateStep2 = () => {
    if (!strand) return 'Please select your strand / level';
    if (subjects.length === 0) return 'Please pick at least one subject';
    return null;
  };

  const validateStep3 = () => {
    if (!mode) return 'Please choose a preferred learning mode';
    if (schedule.length === 0) return 'Please pick at least one preferred schedule day';
    if (!time) return 'Please choose a preferred time';
    if (time === 'Custom time' && !customTime.trim()) return 'Please enter your custom time';
    return null;
  };

  const next = async () => {
    setError(null);
    const err = step === 1 ? validateStep1() : step === 2 ? validateStep2() : validateStep3();
    if (err) {
      setError(err);
      return;
    }
    if (step === 1) {
      setBusy(true);
      const res = await authService.emailExists(form.email.trim());
      setBusy(false);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      if (res.data.exists) {
        setError('An account with this email already exists. Please log in instead.');
        return;
      }
    }
    setStep(step + 1);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const err = validateStep3();
    if (err) {
      setError(err);
      return;
    }
    const parts = form.name.trim().split(/\s+/);
    const grade = GRADE_LEVELS.find((g) => g.label === form.grade_level);
    setBusy(true);
    const res = await register({
      email: form.email.trim(),
      password: form.password,
      first_name: parts.shift(),
      last_name: parts.join(' ') || parts.shift(),
      role: 'student',
      year_level: grade ? grade.level : undefined,
      age: Number(form.age),
      grade_level: form.grade_level,
      school: form.school.trim(),
      strand,
      learning_mode: mode,
      preferred_schedule: schedule,
      preferred_time: time === 'Custom time' ? customTime.trim() : time,
      subjects_needed: subjects
    });
    setBusy(false);
    if (res.ok) navigate('/dashboard');
    else setError(res.message);
  };

  const stepLabels = ['Account', 'Learning profile', 'Preferences'];
  const stepPct = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div className="auth-page royal">
      <div className="auth-card wide">
        <Link to="/" className="back-home"><span aria-hidden="true">←</span> Back to home</Link>
        <div className="brand-side"><span className="logo-dot" /> PeerLink</div>
        <h1>Create your account</h1>
        <p className="muted">
          Join as a student needing help.
        </p>

        <div className="wizard-bars" aria-label={`Step ${step} of 3`}>
          <div className="wizard-bar"><div className="wizard-bar-fill" style={{ width: `${stepPct}%` }} /></div>
          <div className="wizard-steps">
            {stepLabels.map((label, i) => (
              <span key={label} className={`wizard-step ${step === i + 1 ? 'current' : ''} ${step > i + 1 ? 'done' : ''}`}>
                <span className="wizard-step-num">{i + 1}</span> {label}
              </span>
            ))}
          </div>
        </div>

        <Alert type="error">{error}</Alert>

        {step === 1 && (
          <form className="form" onSubmit={(e) => { e.preventDefault(); next(); }}>
            <label>Name</label>
            <input value={form.name} onChange={set('name')} placeholder="Full name" required autoComplete="name" />
            <div className="grid-2">
              <div>
                <label>Age</label>
                <input type="number" min="10" max="100" value={form.age} onChange={set('age')} placeholder="e.g. 16" required />
              </div>
              <div>
                <label>Grade Level</label>
                <select value={form.grade_level} onChange={set('grade_level')} required>
                  <option value="">Select grade level</option>
                  {GRADE_LEVELS.map((g) => <option key={g.label} value={g.label}>{g.label}</option>)}
                </select>
              </div>
            </div>
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
            <label>School</label>
            <input value={form.school} onChange={set('school')} placeholder="e.g. Quezon City High School" required />
            <div className="grid-2">
              <div>
                <label>Password (min 8 chars)</label>
                <input type="password" value={form.password} onChange={set('password')} required autoComplete="new-password" />
              </div>
              <div>
                <label>Confirm password</label>
                <input type="password" value={form.confirm} onChange={set('confirm')} required autoComplete="new-password" />
              </div>
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Checking…' : 'Next'} <span aria-hidden="true">→</span>
            </button>
          </form>
        )}

        {step === 2 && (
          <form className="form" onSubmit={(e) => { e.preventDefault(); next(); }}>
            <h2 className="wizard-heading">Before using PeerLink, please complete your learning profile</h2>

            <fieldset className="wizard-fieldset">
              <legend>What is your strand / level?</legend>
              <div className="day-picker">
                {STRANDS.map((s) => (
                  <Chip key={s} active={strand === s} onClick={() => setStrand(s)}>{STRAND_LABELS[s] || s}</Chip>
                ))}
              </div>
            </fieldset>

            <fieldset className="wizard-fieldset">
              <legend>Subjects I need help with</legend>
              <div className="day-picker">
                {SUBJECT_OPTIONS.map((s) => (
                  <Chip key={s} active={subjects.includes(s)} onClick={() => toggleIn(subjects, setSubjects, s)}>{s}</Chip>
                ))}
              </div>
            </fieldset>

            <div className="wizard-nav">
              <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary">Next <span aria-hidden="true">→</span></button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form className="form" onSubmit={submit}>
            <fieldset className="wizard-fieldset">
              <legend>Preferred Learning Mode</legend>
              <div className="day-picker">
                {LEARNING_MODES.map((m) => (
                  <Chip key={m.value} active={mode === m.value} onClick={() => setMode(m.value)}>{m.label}</Chip>
                ))}
              </div>
            </fieldset>

            <fieldset className="wizard-fieldset">
              <legend>Preferred Schedule</legend>
              <div className="day-picker">
                {SCHEDULE_OPTIONS.map((d) => (
                  <Chip key={d} active={schedule.includes(d)} onClick={() => toggleIn(schedule, setSchedule, d)}>{d}</Chip>
                ))}
              </div>
            </fieldset>

            <fieldset className="wizard-fieldset">
              <legend>Preferred Time</legend>
              <div className="day-picker">
                {TIME_OPTIONS.map((t) => (
                  <Chip key={t} active={time === t} onClick={() => setTime(t)}>{t}</Chip>
                ))}
              </div>
              {time === 'Custom time' && (
                <div className="custom-time-box">
                  <input
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    placeholder="e.g. 10:00 AM - 11:30 AM"
                  />
                </div>
              )}
            </fieldset>

            <div className="wizard-nav">
              <button type="button" className="btn btn-outline" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
            </div>
          </form>
        )}

        <p className="muted small ct-line">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}