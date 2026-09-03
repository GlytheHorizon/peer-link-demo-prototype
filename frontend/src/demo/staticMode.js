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

export const STATIC_DEMO_MESSAGE =
  'Static demo version — no database or backend. Data is sample/mock data stored only in your browser (localStorage). Nothing is really saved or emailed.';
