// Static-demo flag. Active when built with VITE_STATIC_DEMO=true
// (frontend/.env.production) — the Vercel static deployment has no backend/DB.
export function isStaticDemo() {
  try {
    return (
      import.meta?.env?.VITE_STATIC_DEMO === 'true' ||
      import.meta?.env?.VITE_STATIC_DEMO === true
    );
  } catch {
    return false;
  }
}

// ─── Runtime fallback ─────────────────────────────────────────────
// Even if the build-time flag is missing (e.g. Vercel served a build
// without the env var), the app auto-switches to mock data the moment it
// detects there is no backend (network error or HTTP 404/405 from a static
// host). Localhost is excluded so local dev still shows honest errors.
let fallbackEngaged = false;

export function markDemoFallbackEngaged() {
  if (!fallbackEngaged) {
    fallbackEngaged = true;
    try {
      window.dispatchEvent(new Event('peerlink-demo-engaged'));
    } catch { /* non-browser */ }
  }
}

/** True when the mock layer is in effect (build flag OR runtime fallback). */
export function isDemoActive() {
  return isStaticDemo() || fallbackEngaged;
}

export function isLocalHost() {
  try {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '' || h.endsWith('.local');
  } catch {
    return true;
  }
}

export const STATIC_DEMO_MESSAGE =
  'Static demo version — no database or backend. Data is sample/mock data stored only in your browser (localStorage). Nothing is really saved or emailed.';
