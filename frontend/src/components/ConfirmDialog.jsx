import React from 'react';

export default function ConfirmDialog({
  title = 'Are you sure?',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm,
  onCancel
}) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>×</button>
        </div>
        <div className="confirm-message">{message}</div>
        <div className="confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{cancelText}</button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}