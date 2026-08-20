import React, { useState, useCallback, useEffect } from 'react';
import { useConfirm } from '../context/ConfirmContext';
import { Modal, Alert, InfoBox, Spinner, EmptyState, formatDateTime } from '../components/ui';
import { adminService } from '../services';

const STATUS_META = {
  pending: { label: 'Pending', className: 'badge-pending' },
  approved: { label: 'Approved', className: 'badge-approved' },
  rejected: { label: 'Rejected', className: 'badge-rejected' }
};

function initials(name) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function VerifyDocs({ app }) {
  const [licenseUrl, setLicenseUrl] = useState(null);
  const [idUrl, setIdUrl] = useState(null);

  useEffect(() => {
    if (app?.license_file) adminService.getApplicationFile(app.id, 'license').then(setLicenseUrl);
    if (app?.id_file) adminService.getApplicationFile(app.id, 'id').then(setIdUrl);
  }, [app?.id, app?.license_file, app?.id_file]);

  const doc = (url, name) =>
    url ? (
      <div className="verify-doc">
        <span className="verify-doc-name">{name}</span>
        {/\.pdf$/i.test(name) ? (
          <a className="btn btn-outline btn-sm" href={url} target="_blank" rel="noreferrer">Open PDF</a>
        ) : (
          <img src={url} alt={name} />
        )}
      </div>
    ) : (
      <div className="verify-doc">
        <span className="verify-doc-name">{name || 'Not uploaded'}</span>
        <span className="muted small">Preview unavailable</span>
      </div>
    );

  return (
    <div className="verify-doc-grid">
      {doc(licenseUrl, app.license_file || 'Teaching License')}
      {doc(idUrl, app.id_file || 'Government ID')}
    </div>
  );
}

export default function TutorVerifications() {
  const confirm = useConfirm();
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const res = await adminService.listApplications({ status: statusFilter || undefined, limit: 100 });
    if (res.ok) setState({ data: res.data, loading: false, error: null });
    else setState({ data: null, loading: false, error: res.message });
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  if (state.loading && !state.data) return <Spinner />;

  const tutors = state.data?.rows || [];
  const pendingCount = tutors.filter((t) => t.status === 'pending').length;

  const approve = async (tutor) => {
    const ok = await confirm({
      title: 'Approve tutor?',
      message: `Approve ${tutor.full_name} as a verified PeerLink tutor?\nA tutor account will be created for ${tutor.email}.`,
      confirmText: 'Approve',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    const res = await adminService.approveApplication(tutor.id);
    if (res.ok) {
      setMsg({ type: 'success', text: `${tutor.full_name} was approved and granted tutor dashboard access.` });
      load();
    } else setMsg({ type: 'error', text: res.message });
  };

  const reject = async (tutor) => {
    const ok = await confirm({
      title: 'Reject tutor?',
      message: `Reject ${tutor.full_name}\u2019s verification?\nThey will not receive access to the tutor dashboard.`,
      confirmText: 'Reject',
      cancelText: 'Cancel',
      danger: true
    });
    if (!ok) return;
    const res = await adminService.rejectApplication(tutor.id);
    if (res.ok) {
      setMsg({ type: 'success', text: `${tutor.full_name}\u2019s verification was rejected.` });
      load();
    } else setMsg({ type: 'error', text: res.message });
  };

  const renderStatusAction = (tutor) => {
    if (tutor.status === 'approved') return <span className="muted small">Access granted</span>;
    if (tutor.status === 'rejected') return <span className="muted small">Verification closed</span>;
    return (
      <>
        <button type="button" className="btn btn-reject btn-sm" onClick={() => reject(tutor)}>Reject</button>
        <button type="button" className="btn btn-approve btn-sm" onClick={() => approve(tutor)}>Approve</button>
      </>
    );
  };

  return (
    <div>
      <h1 className="dash-greeting">
        Welcome back <span className="greet-name">Admin!</span>
      </h1>

      <div className="page-head">
        <div>
          <h2>Tutor Verifications</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            {pendingCount > 0
              ? `${pendingCount} tutor${pendingCount > 1 ? 's' : ''} waiting for review`
              : 'No tutors waiting for review'}
          </p>
        </div>
      </div>

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {state.error && <Alert type="error">{state.error}</Alert>}

      <div className="card filter-bar">
        <label>Status</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <span className="muted small">{state.data?.total ?? 0} application{state.data?.total === 1 ? '' : 's'}</span>
      </div>

      <div className="card verify-table-card">
        {tutors.length === 0 ? (
          <div className="verify-empty">
            <EmptyState
              title="No tutor applications found"
              description="Applications will appear here once a tutor submits their credentials for review."
            />
          </div>
        ) : (
          <table className="table verify-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Institution</th>
                <th>Subjects</th>
                <th>Status</th>
                <th>Profile</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tutors.map((tutor) => (
                <tr key={tutor.id}>
                  <td className="verify-name">{tutor.full_name}</td>
                  <td>{tutor.institution || '—'}</td>
                  <td className="verify-subject">{(tutor.subjects || []).join(', ') || '—'}</td>
                  <td>
                    <span className={`badge ${STATUS_META[tutor.status].className}`}>
                      {STATUS_META[tutor.status].label}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="view-profile-link"
                      onClick={() => setSelected(tutor)}
                    >
                      View Profile
                    </button>
                  </td>
                  <td>
                    <div className="verify-actions">{renderStatusAction(tutor)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <Modal title="Tutor Application" onClose={() => setSelected(null)} className="verify-modal">
          <div className="verify-profile">
            <div className="verify-profile-head">
              <div className="verify-avatar">{initials(selected.full_name)}</div>
              <div>
                <h3>{selected.full_name}</h3>
                <p className="muted">{(selected.subjects || []).join(', ') || '—'} · {selected.institution || '—'}</p>
              </div>
            </div>

            <div className="review-grid">
              <InfoBox label="Email" value={selected.email} />
              <InfoBox label="Contact number" value={selected.phone || '—'} />
              <InfoBox label="Address" value={selected.address || '—'} />
              <InfoBox label="Hourly rate" value={selected.hourly_rate != null ? `₱${selected.hourly_rate}` : '—'} />
              <InfoBox label="Subjects taught" value={(selected.subjects || []).join(', ') || '—'} />
              <InfoBox label="License number" value={selected.license_number || '—'} />
              <InfoBox label="Institution" value={selected.institution || '—'} />
              <InfoBox label="Specialization" value={selected.specialization || '—'} />
              <InfoBox label="Years of teaching" value={selected.years_teaching != null ? `${selected.years_teaching} Years` : '—'} />
              <InfoBox label="Date applied" value={formatDateTime(selected.created_at)} />
            </div>

            <div className="verify-bio">
              <span className="info-box-label">Uploaded documents</span>
              <VerifyDocs app={selected} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}