import React, { useState, useEffect, useCallback } from 'react';
import { userService } from '../services';

export default function WarningToast({ userId }) {
  const [warnings, setWarnings] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [activeWarning, setActiveWarning] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchWarnings = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await userService.getUnacknowledgedWarnings();
      if (res.ok && Array.isArray(res.data)) {
        setWarnings(res.data);
      }
    } catch (err) {
      console.error('[WarningToast] Error fetching warnings:', err);
    }
  }, [userId]);

  useEffect(() => {
    fetchWarnings();
    const interval = setInterval(fetchWarnings, 5000);
    return () => clearInterval(interval);
  }, [fetchWarnings]);

  if (!warnings || warnings.length === 0) return null;

  const current = warnings[0];

  const handleDismissClick = () => {
    setActiveWarning(current);
    setShowConfirmModal(true);
  };

  const handleConfirmAcknowledge = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const res = await userService.acknowledgeWarning(current.id);
      if (res.ok) {
        setWarnings((prev) => prev.filter((w) => w.id !== current.id));
        setShowConfirmModal(false);
        setActiveWarning(null);
      }
    } catch (err) {
      console.error('[WarningToast] Error acknowledging warning:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Toast Notification Container */}
      <div className="warning-toast-card" role="alert" aria-live="assertive">
        <div className="warning-toast-header">
          <div className="warning-toast-badge">
            <span className="warning-toast-icon">⚠️</span>
            <span className="warning-toast-title">Admin Notification</span>
          </div>
          <button
            type="button"
            className="warning-toast-close"
            onClick={handleDismissClick}
            title="Dismiss warning"
            aria-label="Close warning notification"
          >
            ✕
          </button>
        </div>
        <div className="warning-toast-body">
          <p className="warning-toast-text">
            You have received a warning from the admin: <strong className="warning-toast-reason">&ldquo;{current.reason}&rdquo;</strong>
          </p>
        </div>
        {warnings.length > 1 && (
          <div className="warning-toast-footer">
            <span className="warning-toast-count">
              1 of {warnings.length} unacknowledged warnings
            </span>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && activeWarning && (
        <div className="warning-modal-overlay">
          <div className="warning-modal-box">
            <div className="warning-modal-icon-wrap">
              <span className="warning-modal-icon">⚠️</span>
            </div>
            <h3 className="warning-modal-title">Acknowledge Warning</h3>
            <p className="warning-modal-prompt">
              Have you read and understood this warning?
            </p>
            <div className="warning-modal-reason-box">
              &ldquo;{activeWarning.reason}&rdquo;
            </div>
            <div className="warning-modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowConfirmModal(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-warning-ack"
                onClick={handleConfirmAcknowledge}
                disabled={busy}
              >
                {busy ? 'Acknowledging…' : 'Yes / I Understand'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
