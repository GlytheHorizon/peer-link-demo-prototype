import { isStaticDemo, isDemoActive, isLocalHost, markDemoFallbackEngaged } from '../demo/staticMode';
import { mockApiFetch, getStaticSession } from '../demo/mockApi';

const TOKEN_KEY = 'peerlink_token';

export function getToken() {
  // In static demo there is no JWT — the mock session acts as the token.
  if (isDemoActive() && getStaticSession()) return 'static-demo-token';
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/**
 * Core API client. Attaches the JWT, serializes JSON, and normalizes errors
 * into a consistent shape: { ok, status, message, details, data }.
 */
export async function apiFetch(path, { method = 'GET', body, auth = true } = {}) {
  // Static Vercel demo: no backend — serve mock data so login & all pages work.
  if (isStaticDemo()) return mockApiFetch(path, { method, body, auth });

  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    console.log(`[apiFetch] ${method} ${path} - token:`, token ? 'present' : 'MISSING');
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    // No backend reachable (static host). Auto-switch to mock demo data —
    // but never on localhost, where a missing backend is a real dev error.
    if (!isLocalHost()) {
      console.warn(`[apiFetch] ${method} ${path} - no backend, falling back to static demo mock`);
      markDemoFallbackEngaged();
      return mockApiFetch(path, { method, body, auth });
    }
    console.error(`[apiFetch] ${method} ${path} - network error:`, err);
    return { ok: false, status: 0, message: 'Cannot reach the server. Is the backend running?', data: null };
  }

  // Static hosts answer 404/405 for /api/* (no backend functions deployed).
  // Treat that as "no backend" and serve the mock instead of failing login.
  if ((res.status === 404 || res.status === 405) && !isLocalHost()) {
    console.warn(`[apiFetch] ${method} ${path} - got ${res.status}, falling back to static demo mock`);
    markDemoFallbackEngaged();
    return mockApiFetch(path, { method, body, auth });
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON response */
  }

  console.log(`[apiFetch] ${method} ${path} - response:`, res.status, payload);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: payload?.message || `Request failed (${res.status})`,
      details: payload?.details || null,
      data: payload?.data ?? null
    };
  }
  return { ok: true, status: res.status, message: payload?.message || 'Success', data: payload?.data ?? null };
}