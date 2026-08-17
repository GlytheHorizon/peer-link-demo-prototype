import React, { useState } from 'react';
import { activityLogService } from '../services';
import { Spinner, Alert, formatDateTime } from '../components/ui';

export default function ActivityLogs() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    const res = await activityLogService.list({ action: filter || undefined, page, limit: 50 });
    if (res.ok) setData(res.data);
    else setErr(res.message);
    setLoading(false);
  };

  useState(() => {
    load();
  }, []);

  return (
    <div>
      <h2>Activity Logs</h2>
      <p className="muted">Every meaningful action on the platform is recorded here for audit.</p>
      {err && <Alert type="error">{err}</Alert>}

      <div className="card filter-bar">
        <label>Filter by action</label>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="e.g. auth.login, session.request…"
        />
        <button className="btn btn-outline" onClick={load}>Apply</button>
      </div>

      {loading && !data && <Spinner />}

      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>IP</th><th>Details</th></tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((l) => (
              <tr key={l.id}>
                <td className="muted small">{formatDateTime(l.created_at)}</td>
                <td>{l.user_name || <span className="muted">system</span>}</td>
                <td><code className="log-action">{l.action}</code></td>
                <td className="muted small">{l.entity_type ? `${l.entity_type}${l.entity_id ? ` #${l.entity_id}` : ''}` : '—'}</td>
                <td className="muted small">{l.ip_address || '—'}</td>
                <td className="muted small">{l.details ? JSON.stringify(l.details) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && (
          <div className="pager">
            <span className="muted small">Page {data.page} · {data.total} logs</span>
            <div>
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => { setPage(page - 1); setTimeout(load, 0); }}>← Prev</button>
              <button className="btn btn-ghost btn-sm" disabled={page >= Math.ceil(data.total / data.limit)} onClick={() => { setPage(page + 1); setTimeout(load, 0); }}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}