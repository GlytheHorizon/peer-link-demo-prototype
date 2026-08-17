import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { subjectService, studentService, tutorService } from '../services';
import { Spinner, Alert, EmptyState, Modal } from '../components/ui';

export default function Subjects() {
  const { user } = useAuth();
  const isStudent = user.role_key === 'student';
  const confirm = useConfirm();

  const [all, setAll] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [profs, setProfs] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ code: '', name: '', description: '', proficiency: 3 });

  useEffect(() => {
    (async () => {
      const subjects = await subjectService.list();
      const mine = isStudent ? await studentService.getSubjects() : await tutorService.getSubjects();
      setAll(subjects.ok ? subjects.data : []);
      if (!subjects.ok) setErr(subjects.message);
      if (mine.ok) {
        const ids = new Set(mine.data.map((s) => s.id));
        setSelected(ids);
        const p = {};
        mine.data.forEach((s) => { p[s.id] = s.proficiency || 3; });
        setProfs(p);
      }
      setLoading(false);
    })();
  }, [isStudent]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    const ok = await confirm({
      title: 'Save subjects?',
      message: isStudent ? 'Save your subject selection?' : 'Save your teaching subjects and proficiencies?',
      confirmText: 'Save'
    });
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    const ids = [...selected];
    const res = isStudent
      ? await studentService.setSubjects(ids)
      : await tutorService.setSubjects(ids.map((id) => ({ subject_id: id, proficiency: profs[id] || 3 })));
    setBusy(false);
    if (res.ok) setMsg({ type: 'success', text: res.message });
    else setErr(res.message);
  };

  const addSubject = async (e) => {
    e.preventDefault();
    const ok = await confirm({
      title: 'Add subject?',
      message: `Add ${addForm.name} (${addForm.code}) to the catalog and your teaching list?`,
      confirmText: 'Add subject'
    });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    const res = await tutorService.addSubject({
      code: addForm.code,
      name: addForm.name,
      description: addForm.description,
      proficiency: Number(addForm.proficiency)
    });
    setBusy(false);
    if (res.ok) {
      const s = res.data.subject;
      if (s) {
        setAll((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, s]));
        setSelected((prev) => new Set([...prev, s.id]));
        setProfs((prev) => ({ ...prev, [s.id]: Number(addForm.proficiency) }));
      }
      setMsg({ type: 'success', text: res.message });
      setAdding(false);
      setAddForm({ code: '', name: '', description: '', proficiency: 3 });
    } else setErr(res.message);
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <h2>{isStudent ? 'Subjects I Need Help With' : 'Subjects I Teach'}</h2>
      <p className="muted">
        {isStudent
          ? 'Pick the subjects you are studying — the matching engine will find tutors who teach them.'
          : 'Pick the subjects you can teach and rate your proficiency. Higher proficiency boosts your match score (up to 20 points).'}
      </p>
      <Alert type={msg?.type}>{msg ? msg.text : null}</Alert>
      <Alert type="error">{err}</Alert>

      <div className="subject-grid">
        {all.map((s) => {
          const active = selected.has(s.id);
          return (
            <button key={s.id} className={`subject-card ${active ? 'selected' : ''}`} onClick={() => toggle(s.id)}>
              <b>{s.name}</b>
              <span className="muted small">{s.code}</span>
              <span className="muted small desc">{s.description}</span>
              {!isStudent && active && (
                <div className="prof-row" onClick={(e) => e.stopPropagation()}>
                  <span className="muted small">Proficiency</span>
                  <select
                    value={profs[s.id] || 3}
                    onChange={(e) => setProfs({ ...profs, [s.id]: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="row-actions">
        <button className="btn btn-primary" onClick={save} disabled={busy || selected.size === 0}>
          {busy ? 'Saving…' : `Save (${selected.size} selected)`}
        </button>
        {!isStudent && (
          <button className="btn btn-outline" onClick={() => setAdding(true)}>+ Add subject I teach</button>
        )}
      </div>

      {adding && (
        <Modal title="Add a subject I teach" onClose={() => setAdding(false)}>
          <form className="form" onSubmit={addSubject}>
            <label>Subject code</label>
            <input
              value={addForm.code}
              onChange={(e) => setAddForm({ ...addForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. STAT101"
              required
              maxLength={20}
            />
            <label>Name</label>
            <input
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              placeholder="e.g. Statistics I"
              required
              maxLength={150}
            />
            <label>Short description (optional)</label>
            <textarea
              rows="2"
              value={addForm.description || ''}
              onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
              placeholder="What topics does this cover?"
              maxLength={500}
            />
            <label>Your proficiency (1–5)</label>
            <select
              value={addForm.proficiency}
              onChange={(e) => setAddForm({ ...addForm, proficiency: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Adding…' : 'Add subject'}
            </button>
          </form>
        </Modal>
      )}

      {all.length === 0 && <EmptyState title="No subjects yet" description="An administrator will add subjects soon." />}
    </div>
  );
}