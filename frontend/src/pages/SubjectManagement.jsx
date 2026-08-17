import React, { useState } from 'react';
import { useConfirm } from '../context/ConfirmContext';
import { adminService, subjectService } from '../services';
import { Spinner, Alert, Modal } from '../components/ui';

export default function SubjectManagement() {
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await adminService.listSubjects();
    if (res.ok) setData(res.data);
    else setErr(res.message);
    setLoading(false);
  };

  useState(() => {
    load();
  }, []);

  const deal = (res, okText) => {
    if (res.ok) {
      setMsg({ type: 'success', text: okText });
      load();
    } else setMsg({ type: 'error', text: res.message });
  };

  const removeSubject = async (s) => {
    const ok = await confirm({ title: 'Delete subject?', message: `Delete ${s.name}? Students and tutors will lose it.`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    const res = await subjectService.remove(s.id);
    deal(res, 'Subject deleted');
  };

  return (
    <div>
      <div className="page-head">
        <h2>Subject Management</h2>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ New subject</button>
      </div>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {err && <Alert type="error">{err}</Alert>}
      {loading && !data && <Spinner />}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th><th>Name</th><th>Description</th>
              <th>Students</th><th>Tutors</th><th>Sessions</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((s) => (
              <tr key={s.id}>
                <td><b className="cap">{s.code}</b></td>
                <td>{s.name}</td>
                <td className="muted">{s.description}</td>
                <td>{Number(s.student_count)}</td>
                <td>{Number(s.tutor_count)}</td>
                <td>{Number(s.session_count)}</td>
                <td>
                  <div className="row-actions inline">
                    <button className="btn btn-outline btn-sm" onClick={() => setEditing(s)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeSubject(s)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <SubjectFormModal
          subject={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onDone={(res) => { deal(res, editing ? 'Subject updated' : 'Subject created'); setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function SubjectFormModal({ subject, onClose, onDone }) {
  const confirm = useConfirm();
  const [form, setForm] = useState({
    code: subject?.code || '',
    name: subject?.name || '',
    description: subject?.description || ''
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const ok = await confirm(subject
      ? { title: 'Save changes?', message: `Save changes to ${subject.name}?`, confirmText: 'Save subject' }
      : { title: 'Create subject?', message: 'Create this subject now?', confirmText: 'Create subject' });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    const res = subject
      ? await subjectService.update(subject.id, form)
      : await subjectService.create(form);
    setBusy(false);
    if (res.ok) onDone(res);
    else setErr(res.message);
  };

  return (
    <Modal title={subject ? `Edit ${subject.name}` : 'New subject'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="grid-2">
          <div>
            <label>Code</label>
            <input value={form.code} onChange={set('code')} placeholder="e.g. MATH101" required maxLength={20} />
          </div>
          <div>
            <label>Name</label>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Calculus I" required maxLength={150} />
          </div>
        </div>
        <label>Description</label>
        <textarea rows="3" value={form.description || ''} onChange={set('description')} placeholder="Short description…" />
        {err && <Alert type="error">{err}</Alert>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving…' : 'Save subject'}</button>
      </form>
    </Modal>
  );
}