const TOKEN_KEY = 'peerlink_token';

export function getToken() {
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
    console.error(`[apiFetch] ${method} ${path} - network error:`, err);
    return { ok: false, status: 0, message: 'Cannot reach the server. Is the backend running?', data: null };
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