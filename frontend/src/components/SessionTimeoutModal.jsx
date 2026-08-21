import React, { useState, useEffect, useRef } from 'react';

/**
 * SessionTimeoutModal
 *
 * A full-screen overlay that warns the user they're about to be auto-logged out.
 * Shows a live countdown and offers "Stay Logged In" / "Log Out Now" actions.
 *
 * Props:
 *   isOpen       {boolean}   – whether the modal is visible
 *   secondsLeft  {number}    – countdown value in seconds (counts down to 0)
 *   onStay       {Function}  – called when user clicks "Stay Logged In"
 *   onLogout     {Function}  – called when user clicks "Log Out Now"
 */
export default function SessionTimeoutModal({ isOpen, secondsLeft, onStay, onLogout }) {
  if (!isOpen) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = mins > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${secs}s`;

  // progress bar 0→1 over warningMs (120s)
  const progress = Math.max(0, Math.min(1, secondsLeft / 120));

  return (
    <div className="session-timeout-overlay" role="dialog" aria-modal="true" aria-labelledby="session-timeout-title">
      <div className="session-timeout-modal">
        {/* Icon */}
        <div className="session-timeout-icon-wrap">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <circle cx="24" cy="24" r="22" stroke="#f59e0b" strokeWidth="3" fill="rgba(245,158,11,0.1)" />
            <path d="M24 14v12l7 4" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h2 id="session-timeout-title" className="session-timeout-title">
          Session Expiring Soon
        </h2>
        <p className="session-timeout-subtitle">
          You've been inactive for a while. For your security, you'll be automatically logged out in:
        </p>

        {/* Countdown */}
        <div className="session-timeout-countdown" aria-live="polite" aria-atomic="true">
          {timeStr}
        </div>

        {/* Progress bar */}
        <div className="session-timeout-progress-track" aria-hidden="true">
          <div
            className="session-timeout-progress-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Actions */}
        <div className="session-timeout-actions">
          <button
            id="session-timeout-stay-btn"
            type="button"
            className="btn btn-primary session-timeout-stay-btn"
            onClick={onStay}
            autoFocus
          >
            Stay Logged In
          </button>
          <button
            id="session-timeout-logout-btn"
            type="button"
            className="btn btn-outline session-timeout-logout-btn"
            onClick={onLogout}
          >
            Log Out Now
          </button>
        </div>
      </div>
    </div>
  );
}
