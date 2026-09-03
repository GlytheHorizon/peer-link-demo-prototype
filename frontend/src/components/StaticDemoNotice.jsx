import React, { useEffect, useState } from 'react';
import { isDemoActive, STATIC_DEMO_MESSAGE } from '../demo/staticMode';
import { Modal } from './ui';

const SEEN_KEY = 'peerlink_static_demo_seen';

/**
 * Static-demo notice: a popup modal on first visit + a persistent banner.
 * Shows when the demo mock is active — via the VITE_STATIC_DEMO build flag
 * or the runtime fallback (no backend detected on a deployed host).
 */
export default function StaticDemoNotice() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => isDemoActive());

  useEffect(() => {
    if (isDemoActive() && !localStorage.getItem(SEEN_KEY)) setOpen(true);
    // The fallback can engage after mount (first failed /api call) — listen for it.
    const onEngaged = () => {
      setActive(true);
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    };
    window.addEventListener('peerlink-demo-engaged', onEngaged);
    return () => window.removeEventListener('peerlink-demo-engaged', onEngaged);
  }, []);

  if (!active) return null;

  const dismiss = () => {
    localStorage.setItem(SEEN_KEY, '1');
    setOpen(false);
  };

  return (
    <>
      <div className="static-demo-banner" role="status">
        <span>
          <strong>Static demo</strong> — sample data only, no database. Login works with the demo accounts.
        </span>
        <button type="button" className="static-demo-banner-btn" onClick={() => setOpen(true)}>
          Details
        </button>
      </div>

      {open && (
        <Modal title="Static demo version" onClose={dismiss}>
          <p>{STATIC_DEMO_MESSAGE}</p>
          <ul className="static-demo-list">
            <li><strong>Login / Register</strong> works with sample accounts (data stays in this browser).</li>
            <li><strong>Forgot password</strong> is visual only — no email is sent.</li>
            <li>Matches, sessions, messages, admin &amp; reports show <strong>sample data</strong>.</li>
          </ul>
          <p className="muted">Demo logins: <code>student@peerlink.edu / Student@123</code> · <code>maria@peerlink.edu / Tutor@123</code> · <code>admin@peerlink.edu / Admin@123</code></p>
          <button type="button" className="btn btn-primary btn-block" onClick={dismiss}>
            Got it — explore the demo
          </button>
        </Modal>
      )}
    </>
  );
}
