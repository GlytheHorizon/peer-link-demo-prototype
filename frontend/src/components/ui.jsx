import React from 'react';

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" aria-label={label} />
      <p>{label}</p>
    </div>
  );
}

export function Alert({ type = 'error', children }) {
  if (!children) return null;
  return <div className={`alert alert-${type}`}>{children}</div>;
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function InfoBox({ label, value }) {
  return (
    <div className="info-box">
      <span className="info-box-label">{label}</span>
      <span className="info-box-value">{value}</span>
    </div>
  );
}

export function Modal({ title, onClose, children, className = '' }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${className}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function RatingStars({ rating }) {
  if (!rating) return <span className="muted">No ratings yet</span>;
  const full = Math.round(rating);
  return (
    <span className="stars" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= full ? 'star on' : 'star'}>★</span>
      ))}
      <span className="muted"> {Number(rating).toFixed(1)}</span>
    </span>
  );
}

export function StatusBadge({ status }) {
  const labels = {
    pending: 'Pending',
    accepted: 'Confirmed',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    completed: 'Completed'
  };
  return <span className={`badge badge-${status}`}>{labels[status] || status}</span>;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' });
}