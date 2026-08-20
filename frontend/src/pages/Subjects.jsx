import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { subjectService, studentService, tutorService } from '../services';
import { STRAND_LABELS } from '../constants/learningProfile';
import { Spinner, Alert, EmptyState, Modal } from '../components/ui';

const REQUEST_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected'
};

const STRAND_OPTIONS = [
  { value: '', label: 'General / available to all strands' },
  ...['STEM', 'ICT', 'ABM', 'HUMSS', 'GAS', 'JHS'].map((s) => ({ value: s, label: STRAND_LABELS[s] }))
];

const SECTIONS = [
  { key: null, label: 'General / Core (all strands)' },
  { key: 'STEM', label: 'STEM' },
  { key: 'ICT', label: 'ICT' },
  { key: 'ABM', label: 'ABM' },
  { key: 'HUMSS', label: 'HUMSS' },
  { key: 'GAS', label: 'GAS' },
  { key: 'JHS', label: 'JHS (Grade 7-10)' }
];

export default function Subjects() {
  const { user } = useAuth();
  const isStudent = user.role_key === 'student';
  const confirm = useConfirm();

  const [all, setAll] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [profs, setProfs] = useState({});
  const [rates, setRates] = useState({});
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ code: '', name: '', description: '', proficiency: 3, strand: '' });

  useEffect(() => {
    (async () => {
      if (isStudent) {
        const [subjects, mine] = await Promise.all([subjectService.list(), studentService.getSubjects()]);
        setAll(subjects.ok ? subjects.data : []);
        if (!subjects.ok) setErr(subjects.message);
        if (mine.ok) {
          setSelected(new Set(mine.data.map((s) => s.id)));
        }
      } else {
        const [catalog, mine, reqs] = await Promise.all([
          subjectService.list(), tutorService.getSubjects(), tutorService.listSubjectRequests()
        ]);
        setAll(catalog.ok ? catalog.data : []);
        if (!catalog.ok) setErr(catalog.message);
        if (mine.ok) {
          setSelected(new Set(mine.data.map((s) => s.id)));
          const p = {};
          const r = {};
          mine.data.forEach((s) => {
            p[s.id] = s.proficiency || 3;
            r[s.id] = s.rate_per_hour != null ? Number(s.rate_per_hour) : 100;
          });
          setProfs(p);
          setRates(r);
        }
        if (reqs.ok) setRequests(reqs.data);
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
      message: 'Save your subject selection?',
      confirmText: 'Save'
    });
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await studentService.setSubjects([...selected]);
    setBusy(false);
    if (res.ok) setMsg({ type: 'success', text: res.message });
    else setErr(res.message);
  };

  const requestSubject = async (e) => {
    e.preventDefault();
    const ok = await confirm({
      title: 'Request subject addition?',
      message: `Request ${addForm.name} (${addForm.code}) to be added to the catalog? An administrator will review it.`,
      confirmText: 'Send request'
    });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    const res = await tutorService.addSubjectRequest({
      code: addForm.code,
      name: addForm.name,
      description: addForm.description,
      proficiency: Number(addForm.proficiency),
      strand: addForm.strand || null
    });
    setBusy(false);
    if (res.ok) {
      setMsg({ type: 'success', text: res.message });
      setRequests((prev) => [res.data, ...prev.filter((r) => r.id !== res.data.id)]);
      setAdding(false);
      setAddForm({ code: '', name: '', description: '', proficiency: 3, strand: '' });
    } else setErr(res.message);
  };

  const setProf = (id, n) => setProfs((prev) => ({ ...prev, [id]: n }));
  const setRate = (id, n) => setRates((prev) => ({ ...prev, [id]: n }));

  const saveMine = async () => {
    const ok = await confirm({
      title: 'Save subjects?',
      message: 'Save your teaching subjects, proficiency and rate per hour?',
      confirmText: 'Save'
    });
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await tutorService.setSubjects(
      [...selected].map((id) => ({
        subject_id: id,
        proficiency: profs[id] || 3,
        rate_per_hour: Number(rates[id]) || 100
      }))
    );
    setBusy(false);
    if (res.ok) setMsg({ type: 'success', text: res.message });
    else setErr(res.message);
  };

  if (loading) return <Spinner />;

  if (!isStudent) {
    return (
      <div>
        <h2>Subjects I Teach</h2>
        <p className="muted">
          Pick the subjects you teach from the preset catalog below, set your proficiency (1–5) and
          rate per hour, then save. For a subject that is not in the catalog yet, request it and an administrator will add it.
        </p>
        <Alert type={msg?.type}>{msg ? msg.text : null}</Alert>
        <Alert type="error">{err}</Alert>

        {SECTIONS.map((sec) => {
          const items = all.filter((s) => (s.strand || null) === sec.key);
          if (!items.length) return null;
          return (
            <section className="card" key={sec.key || 'general'}>
              <h3>
                {sec.label} <span className="muted small">({items.length})</span>
              </h3>
              <div className="subject-grid">
                {items.map((s) => {
                  const active = selected.has(s.id);
                  return (
                    <div
                      key={s.id}
                      className={`subject-card ${active ? 'selected' : ''}`}
                      onClick={() => toggle(s.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(s.id); } }}
                    >
                      <b>{s.name || s.code || 'Subject'}</b>
                      <span className="muted small">{s.code}</span>
                      <span className="muted small desc">{s.description}</span>
                      {active ? (
                        <span className="prof-row" onClick={(e) => e.stopPropagation()}>
                          <span className="prof-fields">
                            <label className="muted small">Proficiency</label>
                            <select value={profs[s.id] || 3} onChange={(e) => setProf(s.id, Number(e.target.value))}>
                              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <label className="muted small">Rate / hr (₱)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={rates[s.id] ?? 100}
                              onChange={(e) => setRate(s.id, Number(e.target.value))}
                            />
                          </span>
                        </span>
                      ) : (
                        <span className="code-chip muted">Click to select</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {all.length === 0 && <EmptyState title="No subjects yet" description="An administrator has not set up the subject catalog yet." />}

        <div className="row-actions">
          <button className="btn btn-primary" onClick={saveMine} disabled={busy || selected.size === 0}>
            {busy ? 'Saving…' : `Save my subjects (${selected.size})`}
          </button>
          <button className="btn btn-outline" onClick={() => { setAddForm({ code: '', name: '', description: '', proficiency: 3, strand: '' }); setAdding(true); }}>
            + Request a new subject
          </button>
        </div>

        {requests.length > 0 && (
          <section className="card">
            <h3>My subject addition requests</h3>
            {requests.map((r) => (
              <div className="list-row" key={r.id}>
                <div>
                  <b>{r.name}</b> <span className="muted small cap">({r.code})</span>
                  {r.strand && <span className="code-chip">{STRAND_LABELS[r.strand] || r.strand}</span>}
                  <div className="muted small">{r.description || 'No description'}</div>
                </div>
                <span className={`badge badge-${r.status === 'approved' ? 'completed' : r.status}`}>
                  {REQUEST_LABELS[r.status] || r.status}
                </span>
              </div>
            ))}
          </section>
        )}

{adding && (
          <Modal title="Request a new subject" onClose={() => setAdding(false)}>
            <form className="form" onSubmit={requestSubject}>
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
              <label>Strand (optional)</label>
              <select
                value={addForm.strand}
                onChange={(e) => setAddForm({ ...addForm, strand: e.target.value })}
              >
                {STRAND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <label>Your proficiency in this subject (1–5)</label>
              <select
                value={addForm.proficiency}
                onChange={(e) => setAddForm({ ...addForm, proficiency: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <p className="muted small">
                New subjects are added to the catalog only after an administrator approves your request.
              </p>
              <button className="btn btn-primary btn-block" disabled={busy}>
                {busy ? 'Sending…' : 'Send request'}
              </button>
            </form>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2>Subjects I Need Help With</h2>
      <p className="muted">
        Pick the subjects you are studying — the matching engine will find tutors who teach them.
      </p>
      <Alert type={msg?.type}>{msg ? msg.text : null}</Alert>
      <Alert type="error">{err}</Alert>

      <div className="subject-grid">
        {all.map((s) => {
          const active = selected.has(s.id);
          return (
            <button key={s.id} className={`subject-card ${active ? 'selected' : ''}`} onClick={() => toggle(s.id)}>
              <b>{s.name || s.code || 'Subject'}</b>
              <span className="muted small">{s.code}</span>
              <span className="muted small desc">{s.description}</span>
            </button>
          );
        })}
      </div>

      <div className="row-actions">
        <button className="btn btn-primary" onClick={save} disabled={busy || selected.size === 0}>
          {busy ? 'Saving…' : `Save (${selected.size} selected)`}
        </button>
      </div>

      {all.length === 0 && <EmptyState title="No subjects yet" description="An administrator will add subjects soon." />}
    </div>
  );
}