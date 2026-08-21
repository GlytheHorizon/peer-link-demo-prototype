import { useEffect, useRef, useCallback } from 'react';

/**
 * useIdleTimeout
 *
 * Detects user inactivity and fires callbacks at two thresholds:
 *   1. `onWarn`  — fires at (timeoutMs - warningMs) of inactivity → show "you'll be logged out soon" dialog
 *   2. `onLogout` — fires at timeoutMs of inactivity → auto-logout
 *
 * Activity events that reset the timer: mousemove, keydown, mousedown, touchstart, scroll, wheel, visibilitychange
 *
 * @param {object} options
 * @param {number}   options.timeoutMs   Total idle ms before auto-logout        (default: 15 * 60_000)
 * @param {number}   options.warningMs   How many ms before logout to warn user  (default:  2 * 60_000)
 * @param {Function} options.onWarn      Called when warning threshold is reached
 * @param {Function} options.onLogout    Called when logout threshold is reached
 * @param {boolean}  options.enabled     Whether the hook is active              (default: true)
 */
export default function useIdleTimeout({
  timeoutMs = 15 * 60 * 1000,
  warningMs = 2 * 60 * 1000,
  onWarn,
  onLogout,
  enabled = true
}) {
  const warnTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const warnFiredRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (warnTimerRef.current)   clearTimeout(warnTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
  }, []);

  const resetTimers = useCallback(() => {
    if (!enabled) return;
    clearTimers();
    warnFiredRef.current = false;

    // Set warn timer
    const warnDelay = timeoutMs - warningMs;
    if (warnDelay > 0 && onWarn) {
      warnTimerRef.current = setTimeout(() => {
        warnFiredRef.current = true;
        onWarn();
      }, warnDelay);
    }

    // Set logout timer
    if (onLogout) {
      logoutTimerRef.current = setTimeout(() => {
        onLogout();
      }, timeoutMs);
    }
  }, [enabled, timeoutMs, warningMs, onWarn, onLogout, clearTimers]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    const ACTIVITY_EVENTS = [
      'mousemove',
      'keydown',
      'mousedown',
      'touchstart',
      'scroll',
      'wheel',
    ];

    const handleActivity = () => {
      // Only reset if we haven't already fired the warning —
      // once the warning is shown, user must interact with the dialog, not just move their mouse
      if (!warnFiredRef.current) {
        resetTimers();
      }
    };

    // Handle tab becoming visible again — re-evaluate idle state
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !warnFiredRef.current) {
        resetTimers();
      }
    };

    // Kick off
    resetTimers();

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, resetTimers, clearTimers]);

  /** Call this to manually reset the idle timer (e.g. after user clicks "Stay logged in") */
  const resetIdle = useCallback(() => {
    warnFiredRef.current = false;
    resetTimers();
  }, [resetTimers]);

  return { resetIdle };
}
