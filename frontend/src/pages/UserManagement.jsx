import React, { useState } from 'react';
import { useConfirm } from '../context/ConfirmContext';
import { useAuth } from '../context/AuthContext';
import { adminService } from '../services';
import { Spinner, Alert, Modal, formatDateTime } from '../components/ui';

const ROLES = ['student', 'tutor', 'faculty', 'admin'];

export default function UserManagement() {
  const confirm = useConfirm();
  const { user: me } = useAuth();
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    setState((s) => ({ ...s, loading: true }));
    const res = await adminService.listUsers({
      role: roleFilter || undefined,
      search: search || undefined,
      page
    });
    if (res.ok) setState({ data: res.data, loading: false, error: null });
    else setState({ data: null, loading: false, error: res.message });
  };

  useState(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runLoad = () => load();
  const deal = (res, okText) => {
    if (res.ok) {
      setMsg({ type: 'success', text: okText });
      runLoad();
    } else setMsg({ type: 'error', text: res.message });
  };

  if (state.loading && !state.data) return <Spinner />;

  return (
    <div>
      <div className="page-head">
        <h2>User Management</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Create user</button>
      </div>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {state.error && <Alert type="error">{state.error}</Alert>}

      <div className="card filter-bar">
        <label>Role</label>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setTimeout(runLoad, 0); }}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <label>Search</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runLoad()}
          placeholder="Name or email…"
        />
        <button className="btn btn-outline" onClick={runLoad}>Search</button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {(state.data?.rows || []).map((u) => (
              <tr key={u.id}>
                <td>{u.first_name} {u.last_name}</td>
                <td>{u.email}</td>
                <td className="cap">{u.role}</td>
                <td>
                  <span className={`badge ${u.is_active ? 'badge-accepted' : 'badge-rejected'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="muted small">{formatDateTime(u.created_at)}</td>
                <td>
                  <div className="row-actions inline">
                    {u.id !== me?.id && (
                      <>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={async () => {
                            const ok = await confirm({
                              title: u.is_active ? 'Deactivate user?' : 'Activate user?',
                              message: `${u.is_active ? 'Deactivate' : 'Activate'} ${u.first_name} ${u.last_name}?`,
                              confirmText: u.is_active ? 'Deactivate' : 'Activate'
                            });
                            if (!ok) return;
                            const res = await adminService.updateUser(u.id, { is_active: u.is_active ? 0 : 1 });
                            deal(res, u.is_active ? 'User deactivated' : 'User activated');
                          }}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Delete user?',
                              message: `Delete ${u.first_name} ${u.last_name} (${u.email})? This cannot be undone.`,
                              confirmText: 'Delete',
                              danger: true
                            });
                            if (!ok) return;
                            const res = await adminService.deleteUser(u.id);
                            deal(res, 'User deleted');
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {u.id === me?.id && <span className="muted small">You</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {state.data && (
          <div className="pager">
            <span className="muted small">Page {state.data.page} · {state.data.total} users</span>
            <div>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => { setPage(page - 1); setTimeout(runLoad, 0); }}>← Prev</button>
              <button className="btn btn-ghost btn-sm" disabled={page >= Math.ceil(state.data.total / state.data.limit)} onClick={() => { setPage(page + 1); setTimeout(runLoad, 0); }}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onDone={(res) => {
            deal(res, 'User created');
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onDone }) {
  const confirm = useConfirm();
  const [form, setForm] = useState({ role: 'student', year_level: 1, course: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const ok = await confirm({ title: 'Create user?', message: `Create ${form.role} account for ${form.email?.trim()}?`, confirmText: 'Create user' });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    const res = await adminService.createUser({
      email: form.email?.trim(),
      password: form.password,
      first_name: form.first_name?.trim(),
      last_name: form.last_name?.trim(),
      role: form.role,
      year_level: form.role === 'student' ? Number(form.year_level) : undefined,
      course: form.course?.trim() || undefined
    });
    setBusy(false);
    if (res.ok) onDone(res);
    else setErr(res.message);
  };

  return (
    <Modal title="Create user" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Role</label>
        <select value={form.role} onChange={set('role')}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="grid-2">
          <div><label>First name</label><input value={form.first_name || ''} onChange={set('first_name')} required /></div>
          <div><label>Last name</label><input value={form.last_name || ''} onChange={set('last_name')} required /></div>
        </div>
        <label>Email</label>
        <input type="email" value={form.email || ''} onChange={set('email')} required />
        <label>Password (min 8 chars)</label>
        <input type="password" value={form.password || ''} onChange={set('password')} required minLength={8} />
        {form.role === 'student' && (
          <div>
            <label>Year level</label>
            <select value={form.year_level} onChange={set('year_level')}>
              {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
        )}
        <label>Course (optional)</label>
        <input value={form.course || ''} onChange={set('course')} placeholder="e.g. Computer Science" />
        {err && <Alert type="error">{err}</Alert>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
      </form>
    </Modal>
  );
}