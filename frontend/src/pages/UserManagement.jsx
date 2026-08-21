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
  const [modTarget, setModTarget] = useState(null); // { user, action: 'warn' | 'suspend' | 'ban' }
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
        <div className="table-wrap table-responsive">
          <table className="table">
          <thead>
            <tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {(state.data?.rows || []).map((u) => {
              const isSuspended = u.suspended_until && new Date(u.suspended_until) > new Date();
              return (
                <tr key={u.id}>
                  <td>{u.first_name} {u.last_name}</td>
                  <td>{u.email}</td>
                  <td className="cap">{u.role}</td>
                  <td>
                    {u.is_banned ? (
                      <span className="badge badge-rejected" title={u.ban_reason ? `Reason: ${u.ban_reason}` : 'Banned'}>
                        Banned
                      </span>
                    ) : isSuspended ? (
                      <span className="badge badge-pending" title={`Suspended until ${formatDateTime(u.suspended_until)}. Reason: ${u.suspension_reason || ''}`}>
                        Suspended
                      </span>
                    ) : u.is_active ? (
                      <span className="badge badge-accepted">Active</span>
                    ) : (
                      <span className="badge badge-rejected">Inactive</span>
                    )}
                  </td>
                  <td className="muted small">{formatDateTime(u.created_at)}</td>
                  <td>
                    <div className="row-actions inline" style={{ gap: 4, flexWrap: 'wrap' }}>
                      {u.id !== me?.id && (
                        <>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ borderColor: '#f59e0b', color: '#b45309' }}
                            onClick={() => setModTarget({ user: u, action: 'warn' })}
                            title="Warn user"
                          >
                            Warn
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ borderColor: '#ea580c', color: '#c2410c' }}
                            onClick={() => setModTarget({ user: u, action: 'suspend' })}
                            title="Suspend user account"
                          >
                            Suspend
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setModTarget({ user: u, action: 'ban' })}
                            title="Ban user account permanently"
                          >
                            Ban
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={async () => {
                              const isRestricted = u.is_banned || (u.suspended_until && new Date(u.suspended_until) > new Date());
                              const willActivate = !u.is_active || isRestricted;
                              const ok = await confirm({
                                title: willActivate ? 'Activate user?' : 'Deactivate user?',
                                message: willActivate
                                  ? `Activate ${u.first_name} ${u.last_name}${isRestricted ? ' and lift active suspension/ban' : ''}?`
                                  : `Deactivate ${u.first_name} ${u.last_name}?`,
                                confirmText: willActivate ? 'Activate' : 'Deactivate'
                              });
                              if (!ok) return;
                              const res = await adminService.updateUser(u.id, { is_active: willActivate });
                              deal(res, willActivate ? (isRestricted ? 'User activated and restriction lifted' : 'User activated') : 'User deactivated');
                            }}
                          >
                            {!u.is_active || u.is_banned || (u.suspended_until && new Date(u.suspended_until) > new Date()) ? 'Activate' : 'Deactivate'}
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
              );
            })}
          </tbody>
        </table>
          </div>
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

      {modTarget && (
        <ModerationModal
          user={modTarget.user}
          action={modTarget.action}
          onClose={() => setModTarget(null)}
          onDone={(res, successText) => {
            setModTarget(null);
            deal(res, successText);
          }}
        />
      )}
    </div>
  );
}

function ModerationModal({ user, action, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [customDate, setCustomDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const titles = {
    warn: `Warn User: ${user.first_name} ${user.last_name}`,
    suspend: `Suspend Account: ${user.first_name} ${user.last_name}`,
    ban: `Ban Account: ${user.first_name} ${user.last_name}`
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErr('A reason is required');
      return;
    }
    setBusy(true);
    setErr(null);
    let res;
    if (action === 'warn') {
      res = await adminService.warnUser(user.id, reason.trim());
      setBusy(false);
      onDone(res, `Warning sent to ${user.first_name} ${user.last_name}`);
    } else if (action === 'suspend') {
      const payload = { reason: reason.trim() };
      if (durationDays === 'custom') {
        if (!customDate) {
          setBusy(false);
          setErr('Please select a valid custom date and time');
          return;
        }
        payload.end_date = new Date(customDate).toISOString();
      } else {
        payload.duration_days = Number(durationDays);
      }
      res = await adminService.suspendUser(user.id, payload);
      setBusy(false);
      onDone(res, `Account for ${user.first_name} ${user.last_name} has been suspended`);
    } else if (action === 'ban') {
      res = await adminService.banUser(user.id, reason.trim());
      setBusy(false);
      onDone(res, `Account for ${user.first_name} ${user.last_name} has been permanently banned`);
    }
  };

  return (
    <Modal title={titles[action] || 'Account Moderation'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {action === 'ban' && (
          <Alert type="error">
            <strong>Warning:</strong> Banning will permanently block this user from logging into PeerLink.
          </Alert>
        )}

        {action === 'suspend' && (
          <div>
            <label htmlFor="suspend-duration">Suspension Duration</label>
            <select
              id="suspend-duration"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
            >
              <option value="1">1 Day</option>
              <option value="3">3 Days</option>
              <option value="7">7 Days</option>
              <option value="14">14 Days</option>
              <option value="30">30 Days</option>
              <option value="custom">Custom Date & Time</option>
            </select>
            {durationDays === 'custom' && (
              <div style={{ marginTop: 8 }}>
                <label htmlFor="suspend-date">Custom End Date & Time</label>
                <input
                  id="suspend-date"
                  type="datetime-local"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  required
                />
              </div>
            )}
          </div>
        )}

        <label htmlFor="mod-reason">
          Reason <span style={{ color: 'var(--red)' }}>*</span>
        </label>
        <textarea
          id="mod-reason"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            action === 'warn'
              ? 'Enter warning message detailing what the user should know...'
              : action === 'suspend'
              ? 'Provide the official reason for account suspension...'
              : 'Provide the official reason for permanent ban...'
          }
          required
        />

        {err && <Alert type="error">{err}</Alert>}

        <div className="grid-2" style={{ marginTop: 14 }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            className={`btn ${action === 'ban' ? 'btn-danger' : action === 'suspend' ? 'btn-primary' : 'btn-primary'}`}
            disabled={busy}
          >
            {busy ? 'Processing…' : action === 'warn' ? 'Submit Warning' : action === 'suspend' ? 'Suspend Account' : 'Ban Account'}
          </button>
        </div>
      </form>
    </Modal>
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