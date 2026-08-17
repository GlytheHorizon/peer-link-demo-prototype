import React, { useState } from 'react';
import { useConfirm } from '../context/ConfirmContext';
import { adminService, subjectService } from '../services';
import { Spinner, Alert, Modal, formatDateTime } from '../components/ui';
import { STRAND_LABELS } from '../constants/learningProfile';

const REQUEST_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected'
};

const STRAND_OPTIONS = [
  { value: '', label: 'General (all strands)' },
  ...['STEM', 'ICT', 'ABM', 'HUMSS', 'GAS', 'JHS'].map((s) => ({ value: s, label: STRAND_LABELS[s] }))
];

export default function SubjectManagement() {
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const [subjects, reqs] = await Promise.all([adminService.listSubjects(), adminService.listSubjectRequests()]);
    if (subjects.ok) setData(subjects.data);
    else setErr(subjects.message);
    if (reqs.ok) setRequests(reqs.data);
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

  const approveRequest = async (r) => {
    const ok = await confirm({
      title: 'Approve request?',
      message: `Create ${r.name} (${r.code}) in the catalog and add it to ${r.tutor_name}'s teaching subjects with proficiency ${r.proficiency}?`,
      confirmText: 'Approve'
    });
    if (!ok) return;
    const res = await adminService.approveSubjectRequest(r.id);
    deal(res, res.ok ? res.message : 'Approval failed');
  };

  const rejectRequest = async (r) => {
    const ok = await confirm({
      title: 'Reject request?',
      message: `Reject ${r.name} (${r.code}) requested by ${r.tutor_name}?`,
      confirmText: 'Reject',
      danger: true
    });
    if (!ok) return;
    const res = await adminService.rejectSubjectRequest(r.id);
    deal(res, 'Subject request rejected');
  };

  const pending = requests.filter((r) => r.status === 'pending');

  return (
    <div>
      <div className="page-head">
        <h2>Subject Management</h2>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ New subject</button>
      </div>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {err && <Alert type="error">{err}</Alert>}
      {loading && !data && <Spinner />}

      {requests.length > 0 && (
        <div className="card">
          <h3>Subject addition requests {pending.length > 0 && <span className="badge badge-pending">{pending.length} pending</span>}</h3>
          {pending.length === 0 && <p className="muted small">No pending requests.</p>}
          {pending.map((r) => (
            <div className="list-row" key={r.id}>
              <div>
                <b>{r.name}</b> <span className="muted small cap">({r.code})</span>
                {r.strand && <span className="code-chip">{STRAND_LABELS[r.strand] || r.strand}</span>}
                <div className="muted small">{r.description || 'No description'}</div>
                <div className="muted small">
                  Requested by <b>{r.tutor_name}</b> · proficiency {r.proficiency} · {formatDateTime(r.created_at)}
                </div>
              </div>
              <div className="row-actions">
                <button className="btn btn-outline btn-sm" onClick={() => approveRequest(r)}>Approve</button>
                <button className="btn btn-ghost btn-sm" onClick={() => rejectRequest(r)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th><th>Name</th><th>Strand</th><th>Description</th>
              <th>Students</th><th>Tutors</th><th>Sessions</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((s) => (
              <tr key={s.id}>
                <td><b className="cap">{s.code}</b></td>
                <td>{s.name}</td>
                <td>{s.strand ? STRAND_LABELS[s.strand] || s.strand : <span className="muted">General</span>}</td>
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
    description: subject?.description || '',
    strand: subject?.strand || ''
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
    const payload = { ...form, strand: form.strand || null };
    const res = subject
      ? await subjectService.update(subject.id, payload)
      : await subjectService.create(payload);
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
        <label>Strand (optional)</label>
        <select value={form.strand} onChange={set('strand')}>
          {STRAND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label>Description</label>
        <textarea rows="3" value={form.description || ''} onChange={set('description')} placeholder="Short description…" />
        {err && <Alert type="error">{err}</Alert>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving…' : 'Save subject'}</button>
      </form>
    </Modal>
  );
}