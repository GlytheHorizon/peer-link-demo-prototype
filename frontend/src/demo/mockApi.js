// Static-demo API mock. Intercepts every /api/* call when VITE_STATIC_DEMO=true
// so the whole SPA (login, register, dashboard, matches, sessions, messages,
// admin, reports…) works on Vercel with NO backend / NO database.
// Session + registered users persist in localStorage only.

import {
  DEMO_USERS, DEMO_SUBJECTS, DEMO_TUTORS, DEMO_MATCHES,
  DEMO_SESSIONS, DEMO_CONVERSATIONS, DEMO_MESSAGES, DEMO_RESOURCES,
  publicUser,
} from './demoData';

const SESSION_KEY = 'peerlink_static_user';
const EXTRA_USERS_KEY = 'peerlink_static_extra_users';
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

const ok = (data = null, message = 'Success') => ({ ok: true, status: 200, message, data });
const fail = (message = 'Request failed', status = 400, data = null) => ({ ok: false, status, message, details: null, data });

function readExtraUsers() {
  try { return JSON.parse(localStorage.getItem(EXTRA_USERS_KEY) || '[]'); } catch { return []; }
}

function allUsers() {
  return [...DEMO_USERS, ...readExtraUsers()];
}

function findUserByEmail(email) {
  return allUsers().find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
}

export function getStaticSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setStaticSession(user) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(publicUser(user)));
  else localStorage.removeItem(SESSION_KEY);
}

function fakeToken(user) {
  return `static-demo-token-${user.role_key}-${user.id}`;
}

function currentUser() {
  return getStaticSession();
}

function requireAuth() {
  const u = currentUser();
  if (!u) return { error: fail('Not authenticated. Please log in (static demo).', 401) };
  return { user: u };
}

export async function mockApiFetch(path, { method = 'GET', body } = {}) {
  await delay();
  const [rawPath, rawQs] = String(path).split('?');
  const q = new URLSearchParams(rawQs || '');

  // ─── AUTH ──────────────────────────────────────────────
  if (rawPath === '/auth/login' && method === 'POST') {
    const user = findUserByEmail(body?.email);
    if (!user || user.password !== body?.password) {
      return fail('Invalid email or password. (Static demo — click a demo account on the Login page.)', 401);
    }
    setStaticSession(user);
    return ok({ token: fakeToken(user), user: publicUser(user) }, 'Login successful (static demo)');
  }

  if (rawPath === '/auth/admin-login' && method === 'POST') {
    const user = findUserByEmail(body?.email);
    if (!user || user.password !== body?.password || user.role_key !== 'admin') {
      return fail('Invalid admin credentials. Try admin@peerlink.edu / Admin@123 (static demo).', 401);
    }
    setStaticSession(user);
    return ok({ token: fakeToken(user), user: publicUser(user) }, 'Admin login successful (static demo)');
  }

  if (rawPath === '/auth/register' && method === 'POST') {
    if (findUserByEmail(body?.email)) return fail('Email already exists (static demo).', 409);
    const extras = readExtraUsers();
    const id = 1000 + extras.length + 1;
    const user = {
      id,
      email: String(body?.email || `demo${id}@peerlink.edu`),
      password: body?.password || 'Demo@123',
      role_key: 'student',
      first_name: body?.first_name || 'Demo',
      last_name: body?.last_name || 'Student',
      verification_status: 'approved',
    };
    extras.push(user);
    localStorage.setItem(EXTRA_USERS_KEY, JSON.stringify(extras));
    setStaticSession(user);
    return ok({ token: fakeToken(user), user: publicUser(user) }, 'Registered (static demo — saved in this browser only)');
  }

  if (rawPath === '/auth/tutor-apply' && method === 'POST') {
    if (findUserByEmail(body?.email)) return fail('Email already exists (static demo).', 409);
    const extras = readExtraUsers();
    const id = 2000 + extras.length + 1;
    const user = {
      id, email: String(body?.email || `tutor${id}@peerlink.edu`),
      password: body?.password || 'Tutor@123', role_key: 'tutor',
      first_name: body?.first_name || 'Demo', last_name: body?.last_name || 'Tutor',
      verification_status: 'pending',
    };
    extras.push(user);
    localStorage.setItem(EXTRA_USERS_KEY, JSON.stringify(extras));
    return ok({ application_id: id, verification_status: 'pending' }, 'Application received (static demo — visual only)');
  }

  if (rawPath === '/auth/logout' && method === 'POST') {
    setStaticSession(null);
    return ok(null, 'Logged out (static demo)');
  }

  if (rawPath === '/auth/me') {
    const { user, error } = requireAuth();
    if (error) return error;
    return ok(user);
  }

  if (rawPath === '/auth/email-exists') {
    return ok({ exists: Boolean(findUserByEmail(q.get('email'))) });
  }

  // Forgot / reset password — VISUAL ONLY in static demo (no email is sent).
  if (rawPath === '/auth/forgot-password' && method === 'POST') {
    return ok({ visualOnly: true }, 'Static demo: no reset email is actually sent. This is for visual representation only.');
  }
  if (rawPath === '/auth/reset-password' && method === 'POST') {
    return ok({ visualOnly: true }, 'Static demo: password was not really changed. Visual representation only.');
  }
  if (rawPath === '/auth/tutor-application') {
    const { user, error } = requireAuth();
    if (error) return error;
    return ok({ verification_status: user.verification_status || 'approved' });
  }

  // ─── WARNINGS / MISC USER ──────────────────────────────
  if (rawPath === '/users/me/warnings/unacknowledged') return ok([]);
  if (rawPath === '/users/heartbeat' && method === 'POST') return ok({ ok: true });
  if (rawPath === '/users/me' && method === 'PUT') {
    const { user, error } = requireAuth();
    if (error) return error;
    const merged = { ...user, ...(body || {}) };
    setStaticSession(merged);
    return ok(merged, 'Profile updated (static demo — browser only)');
  }
  if (rawPath === '/users/me/name' && method === 'PATCH') {
    const { user, error } = requireAuth();
    if (error) return error;
    const merged = { ...user, ...(body || {}) };
    setStaticSession(merged);
    return ok(merged, 'Name updated (static demo)');
  }
  if (rawPath === '/users/me/email' && method === 'PATCH') {
    const { user, error } = requireAuth();
    if (error) return error;
    const merged = { ...user, email: body?.email || user.email };
    setStaticSession(merged);
    return ok(merged, 'Email updated (static demo — browser only)');
  }
  if (rawPath === '/users/me/password' && method === 'PATCH') {
    return ok(null, 'Password updated (static demo — visual only, not really saved)');
  }
  if (/^\/users\/warnings\/[^/]+\/acknowledge$/.test(rawPath)) return ok(null, 'Acknowledged (static demo)');

  // ─── PROFILE / SUBJECTS ────────────────────────────────
  if (rawPath === '/students/me') {
    const { user, error } = requireAuth();
    if (error) return error;
    if (method === 'GET') return ok({ user, subjects_needed: [1, 5], year_level: '2nd Year', course: 'BSIT' });
    return ok({ user: { ...user, ...(body || {}) } }, 'Student profile saved (static demo — browser only)');
  }
  if (rawPath === '/students/me/subjects') {
    if (method === 'GET') return ok([{ id: 1, name: 'Mathematics' }, { id: 5, name: 'Programming' }]);
    return ok(body, 'Subjects saved (static demo)');
  }
  if (/^\/students\/\d+$/.test(rawPath)) {
    return ok({ id: 1, name: 'Sample Student', subjects_needed: ['Mathematics'] });
  }
  if (rawPath === '/tutors/me') {
    const { user, error } = requireAuth();
    if (error) return error;
    if (method === 'GET') return ok({ user, bio: 'Sample tutor bio (static demo).', hourly_rate: 150, availability: 'Mon–Fri 4pm–8pm' });
    return ok({ user: { ...user, ...(body || {}) } }, 'Tutor profile saved (static demo — browser only)');
  }
  if (rawPath === '/tutors/me/subjects') {
    if (method === 'GET') return ok([{ id: 1, name: 'Mathematics', proficiency: 5 }]);
    return ok(body, 'Tutor subjects saved (static demo)');
  }
  if (rawPath === '/tutors/me/subject-requests') {
    if (method === 'GET') return ok([]);
    return ok({ id: 1, ...(body || {}), status: 'pending' }, 'Subject request sent (static demo — visual only)');
  }
  if (rawPath === '/tutors') return ok(DEMO_TUTORS);
  if (/^\/tutors\/\d+$/.test(rawPath)) {
    const id = Number(rawPath.split('/')[2]);
    return ok(DEMO_TUTORS.find((t) => t.id === id || t.user_id === id) || DEMO_TUTORS[0]);
  }

  if (rawPath === '/subjects') {
    if (method === 'GET') return ok(DEMO_SUBJECTS);
    if (method === 'POST') return ok({ id: Date.now(), ...(body || {}) }, 'Subject created (static demo — not saved)');
  }
  if (/^\/subjects\/\d+$/.test(rawPath)) {
    return ok({ id: Number(rawPath.split('/')[2]), ...(body || {}), name: body?.name || 'Sample Subject' }, 'Subject updated (static demo — visual only)');
  }

  // ─── MATCHES ───────────────────────────────────────────
  if (rawPath === '/matches/generate' && method === 'POST') return ok(DEMO_MATCHES, 'Matches generated (sample data)');
  if (rawPath === '/matches/search' || rawPath === '/matches/browse' || rawPath === '/matches') return ok(DEMO_MATCHES);
  if (/^\/matches\/\d+$/.test(rawPath)) {
    const m = DEMO_MATCHES.find((x) => x.id === Number(rawPath.split('/')[2])) || DEMO_MATCHES[0];
    return ok(m);
  }

  // ─── CONVERSATIONS / MESSAGES ──────────────────────────
  if (rawPath === '/conversations') {
    if (method === 'GET') return ok(DEMO_CONVERSATIONS);
    return ok({ id: 399, ...(body || {}) }, 'Conversation started (static demo — browser only)');
  }
  if (rawPath === '/conversations/unread-count') return ok({ unread: 1 });
  if (/^\/conversations\/\d+$/.test(rawPath)) {
    const id = Number(rawPath.split('/')[2]);
    return ok(DEMO_CONVERSATIONS.find((c) => c.id === id) || DEMO_CONVERSATIONS[0]);
  }
  if (/^\/conversations\/\d+\/messages$/.test(rawPath)) {
    const id = Number(rawPath.split('/')[2]);
    if (method === 'GET') return ok(DEMO_MESSAGES[id] || []);
    const msg = { id: Date.now(), sender_id: currentUser()?.id || 1, sender_name: 'You', body: body?.body || '', created_at: new Date().toISOString() };
    (DEMO_MESSAGES[id] = DEMO_MESSAGES[id] || []).push(msg);
    return ok(msg, 'Sent (static demo — not really saved)');
  }
  if (/^\/conversations\/\d+\/messages\/\d+$/.test(rawPath)) return ok(null, 'Message deleted (static demo — visual only)');
  if (/^\/conversations\/\d+\/payments$/.test(rawPath)) {
    if (method === 'GET') return ok([]);
    return ok({ id: Date.now(), ...(body || {}), status: 'pending' }, 'Payment recorded (static demo — visual only)');
  }
  if (/^\/conversations\/\d+\/payments\/\d+\/(accept|reject)$/.test(rawPath)) {
    return ok(null, 'Payment updated (static demo — visual only)');
  }

  // ─── SESSIONS ──────────────────────────────────────────
  if (rawPath === '/sessions') {
    if (method === 'GET') return ok(DEMO_SESSIONS);
    return ok({ id: Date.now(), ...(body || {}), status: 'pending' }, 'Session requested (static demo — visual only)');
  }
  if (rawPath === '/sessions/conflicts') return ok({ conflicts: [] });
  if (/^\/sessions\/\d+$/.test(rawPath)) {
    const id = Number(rawPath.split('/')[2]);
    if (method === 'DELETE') return ok(null, 'Session deleted (static demo — visual only)');
    return ok(DEMO_SESSIONS.find((s) => s.id === id) || DEMO_SESSIONS[0]);
  }
  if (/^\/sessions\/\d+\/(respond|complete-confirm|cancel|pay)$/.test(rawPath)) {
    return ok(null, 'Session updated (static demo — visual only)');
  }
  if (/^\/sessions\/\d+\/reschedule-requests$/.test(rawPath)) {
    if (method === 'GET') return ok([]);
    return ok({ id: Date.now(), ...(body || {}), status: 'pending' }, 'Reschedule requested (static demo — visual only)');
  }
  if (/^\/sessions\/\d+\/reschedule-requests\/.+\/respond$/.test(rawPath)) {
    return ok(null, 'Reschedule updated (static demo — visual only)');
  }

  // ─── PAYMENTS / EVALUATIONS ────────────────────────────
  if (rawPath === '/payments/mine') {
    return ok([
      { id: 501, amount: 150, subject_name: 'Mathematics', status: 'paid', created_at: new Date().toISOString() },
      { id: 502, amount: 200, subject_name: 'Programming', status: 'paid', created_at: new Date().toISOString() },
    ]);
  }
  if (rawPath === '/evaluations' && method === 'POST') return ok({ id: Date.now(), ...(body || {}) }, 'Evaluation submitted (static demo — visual only)');
  if (rawPath === '/evaluations/mine') return ok([]);
  if (/^\/evaluations\/tutor\/\d+$/.test(rawPath)) {
    return ok([{ id: 601, rating: 5, comment: 'Great tutor! (sample review)', student_name: 'Alex' }]);
  }
  if (/^\/evaluations\/\d+$/.test(rawPath)) return ok(null);

  // ─── ADMIN ─────────────────────────────────────────────
  if (rawPath === '/admin/stats') {
    return ok({ users: 128, students: 80, tutors: 32, sessions: 214, subjects: DEMO_SUBJECTS.length, pending_verifications: 3 });
  }
  if (rawPath === '/admin/users') {
    if (method === 'GET') return ok({ users: allUsers().map(publicUser), total: allUsers().length });
    return ok(publicUser({ id: Date.now(), ...(body || {}) }), 'User created (static demo — visual only)');
  }
  if (/^\/admin\/users\/[^/]+$/.test(rawPath)) {
    return ok(publicUser({ id: rawPath.split('/')[3], ...(body || {}) }), 'User updated (static demo — visual only)');
  }
  if (/^\/admin\/users\/[^/]+\/(warn|suspend|ban)$/.test(rawPath)) {
    return ok(null, 'Moderation action recorded (static demo — visual only)');
  }
  if (rawPath === '/admin/subjects') return ok(DEMO_SUBJECTS);
  if (rawPath === '/admin/sessions') return ok({ sessions: DEMO_SESSIONS, total: DEMO_SESSIONS.length });
  if (rawPath === '/admin/subject-requests') return ok([]);
  if (/^\/admin\/subject-requests\/.+\/(approve|reject)$/.test(rawPath)) return ok(null, 'Subject request updated (static demo — visual only)');
  if (rawPath === '/admin/tutor-applications') return ok({ applications: [], total: 0 });
  if (/^\/admin\/tutor-applications\/.+$/.test(rawPath)) {
    if (rawPath.endsWith('/approve') || rawPath.endsWith('/reject')) return ok(null, 'Application updated (static demo — visual only)');
    return ok({ id: 1, status: 'pending', applicant: 'Sample Applicant (static demo)' });
  }

  // ─── REPORTS / LOGS / MISC ─────────────────────────────
  if (rawPath === '/reports/overview') {
    return ok({ total_sessions: 214, completed: 168, active_tutors: 32, avg_rating: 4.7 });
  }
  if (rawPath === '/reports/sessions') {
    return ok([{ subject: 'Mathematics', count: 64 }, { subject: 'Programming', count: 52 }, { subject: 'Chemistry', count: 38 }]);
  }
  if (rawPath === '/reports/tutors') return ok(DEMO_TUTORS);
  if (rawPath === '/reports/students') {
    return ok([{ name: 'Alex Student', sessions: 12 }, { name: 'Mike Chen', sessions: 8 }]);
  }
  if (rawPath === '/reports/user' && method === 'POST') return ok({ id: Date.now() }, 'Report submitted (static demo — visual only)');
  if (rawPath === '/reports/user') return ok([]);
  if (/^\/reports\/user\/.+$/.test(rawPath)) return ok(null, 'Report resolved (static demo — visual only)');
  if (rawPath === '/activity-logs') {
    return ok({ logs: [{ id: 1, action: 'login', entity: 'user', actor: 'demo (sample)', created_at: new Date().toISOString() }], total: 1 });
  }
  if (rawPath === '/tab-updates') return ok({ unread_messages: 1, pending_sessions: 1 });
  if (rawPath === '/resources') {
    if (method === 'GET') return ok(DEMO_RESOURCES);
    return ok({ id: Date.now(), ...(body || {}) }, 'Resource added (static demo — visual only)');
  }
  if (rawPath === '/resources/folders') return ok([{ id: 1, name: 'Sample Folder' }]);
  if (/^\/resources\/\d+$/.test(rawPath)) return ok(null, 'Resource deleted (static demo — visual only)');

  // Fallback: succeed with empty data so static pages render instead of crashing.
  if (method === 'GET') return ok(Array.isArray(body) ? [] : null, 'Static demo sample response');
  return ok(null, 'Done (static demo — visual only, nothing was saved)');
}
