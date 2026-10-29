import React, { useEffect, useRef, useState } from 'react';

const JITSI_HOST = 'meet.jit.si';
const SCRIPT_SRC = `https://${JITSI_HOST}/external_api.js`;

let scriptPromise = null;

function loadJitsiScript() {
  if (window.JitsiMeetExternalAPI) return Promise.resolve(true);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve) => {
      const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(true));
        existing.addEventListener('error', () => resolve(false));
        return;
      }
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/**
 * JitsiMeetModal
 * Embeds a Jitsi Meet video conference room inside a full-screen modal.
 *
 * Props:
 *   roomName   – the unique Jitsi room name (e.g. "peerlink-42-a1b2c3")
 *   displayName – the current user's display name shown in the call
 *   onClose    – called when the user clicks the X button
 */
export default function JitsiMeetModal({ roomName, displayName, onClose }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomName) return;
    let disposed = false;

    async function initJitsi() {
      const ok = await loadJitsiScript();
      if (disposed) return;
      if (!ok) {
        setError('Failed to load Jitsi Meet. Please check your connection.');
        setLoading(false);
        return;
      }
      if (!containerRef.current) return;

      try {
        const api = new window.JitsiMeetExternalAPI(JITSI_HOST, {
          roomName,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableDeepLinking: true,
            prejoinPageEnabled: false,
            toolbarButtons: [
              'microphone', 'camera', 'desktop', 'participants-pane',
              'chat', 'recording', 'raisehand', 'tileview', 'fullscreen',
              'fodeviceselection', 'settings', 'videoquality', 'hangup'
            ]
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            TOOLBAR_ALWAYS_VISIBLE: true,
            HIDE_INVITE_MORE_HEADER: true,
            APP_NAME: 'PeerLink Session',
            NATIVE_APP_NAME: 'PeerLink',
            DEFAULT_BACKGROUND: '#1a1930'
          },
          userInfo: {
            displayName: displayName || 'PeerLink User'
          }
        });

        if (disposed) {
          try { api.dispose(); } catch { /* already disposed */ }
          return;
        }

        apiRef.current = api;
        setLoading(false);
        api.addEventListener('readyToClose', () => {
          onClose && onClose();
        });
        // Jitsi holds fresh conferences in a "waiting for moderator" state
        // until a moderator arrives. Make sure the local participant can start
        // the conference as moderator so joining never gets stuck waiting.
        try {
          const localId = api.myUserId;
          if (localId) {
            api.executeCommand('grantModerator', { participantID: localId });
          }
        } catch { /* best effort — first joiner is moderator by default */ }
      } catch (err) {
        if (disposed) return;
        setError('Failed to start video session: ' + (err?.message || 'unknown error'));
        setLoading(false);
      }
    }

    initJitsi();

    return () => {
      disposed = true;
      if (apiRef.current) {
        try { apiRef.current.dispose(); } catch { /* already disposed */ }
        apiRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName]);

  return (
    <div className="jitsi-overlay" role="dialog" aria-modal="true" aria-label="Video Session">
      <div className="jitsi-overlay-header">
        <div className="jitsi-overlay-title">
          <span className="jitsi-live-dot" aria-hidden="true" />
          <span>Live Video Session</span>
        </div>
        <button
          type="button"
          className="jitsi-close-btn"
          onClick={onClose}
          aria-label="End and close video session"
          title="End session"
        >
          ✕ End Session
        </button>
      </div>

      {loading && !error && (
        <div className="jitsi-loading">
          <div className="jitsi-spinner" />
          <p>Connecting to video session…</p>
        </div>
      )}
      {error && (
        <div className="jitsi-error">
          <p>{error}</p>
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      )}

      <div
        ref={containerRef}
        className="jitsi-frame-container"
        style={{ visibility: loading || error ? 'hidden' : 'visible' }}
      />
    </div>
  );
}
