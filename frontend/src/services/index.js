import { apiFetch, getToken } from './api';

/** Builds a query string, dropping empty values (URLSearchParams would send them as "undefined"). */
const toQuery = (params = {}) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  return qs.toString();
};

export const authService = {
  requestPasswordReset: (email) => apiFetch('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token, password) => apiFetch('/auth/reset-password', { method: 'POST', body: { token, password } }),
  checkEmailExists: (email) => apiFetch(`/auth/email-exists?email=${encodeURIComponent(email)}`)
};

export const userService = {
  updateMe: (payload) => apiFetch('/users/me', { method: 'PUT', body: payload }),
  heartbeat: () => apiFetch('/users/heartbeat', { method: 'POST' }),
  getUnacknowledgedWarnings: () => apiFetch('/users/me/warnings/unacknowledged'),
  acknowledgeWarning: (id) => apiFetch(`/users/warnings/${id}/acknowledge`, { method: 'POST', body: {} }),
  changeName: (payload) => apiFetch('/users/me/name', { method: 'PATCH', body: payload }),
  changeEmail: (payload) => apiFetch('/users/me/email', { method: 'PATCH', body: payload }),
  changePassword: (payload) => apiFetch('/users/me/password', { method: 'PATCH', body: payload })
};

export const studentService = {
  getMe: () => apiFetch('/students/me'),
  updateMe: (payload) => apiFetch('/students/me', { method: 'PUT', body: payload }),
  getSubjects: () => apiFetch('/students/me/subjects'),
  setSubjects: (subjectIds) => apiFetch('/students/me/subjects', { method: 'PUT', body: { subject_ids: subjectIds } }),
  getPublic: (id) => apiFetch(`/students/${id}`)
};

export const tutorService = {
  getMe: () => apiFetch('/tutors/me'),
  updateMe: (payload) => apiFetch('/tutors/me', { method: 'PUT', body: payload }),
  getSubjects: () => apiFetch('/tutors/me/subjects'),
  setSubjects: (subjects) => apiFetch('/tutors/me/subjects', { method: 'PUT', body: { subjects } }),
  addSubjectRequest: (payload) => apiFetch('/tutors/me/subject-requests', { method: 'POST', body: payload }),
  listSubjectRequests: () => apiFetch('/tutors/me/subject-requests'),
  getPublic: (id) => apiFetch(`/tutors/${id}`),
  list: () => apiFetch('/tutors')
};

export const resourceService = {
  list: () => apiFetch('/resources'),
  folders: () => apiFetch('/resources/folders'),
  upload: (payload) => apiFetch('/resources', { method: 'POST', body: payload }),
  remove: (id) => apiFetch(`/resources/${id}`, { method: 'DELETE' })
};

export const subjectService = {
  list: () => apiFetch('/subjects'),
  create: (payload) => apiFetch('/subjects', { method: 'POST', body: payload }),
  update: (id, payload) => apiFetch(`/subjects/${id}`, { method: 'PUT', body: payload }),
  remove: (id) => apiFetch(`/subjects/${id}`, { method: 'DELETE' })
};

export const matchService = {
  generate: (subjectId) => apiFetch('/matches/generate', { method: 'POST', body: subjectId ? { subject_id: subjectId } : {} }),
  search: (q, subjectId) => apiFetch(`/matches/search?q=${encodeURIComponent(q)}${subjectId ? `&subject_id=${subjectId}` : ''}`),
  browse: (subjectId) => apiFetch(`/matches/browse${subjectId ? `?subject_id=${subjectId}` : ''}`),
  list: (subjectId) => apiFetch(`/matches${subjectId ? `?subject_id=${subjectId}` : ''}`),
  get: (id) => apiFetch(`/matches/${id}`)
};

export const conversationService = {
  list: () => apiFetch('/conversations'),
  start: (otherId, subjectId, as = 'student') => apiFetch('/conversations', { method: 'POST', body: as === 'tutor'
    ? { student_id: otherId, subject_id: subjectId }
    : { tutor_id: otherId, subject_id: subjectId } }),
  get: (id) => apiFetch(`/conversations/${id}`),
  deleteConversation: (id) => apiFetch(`/conversations/${id}`, { method: 'DELETE' }),
  getMessages: (id) => apiFetch(`/conversations/${id}/messages`),
  sendMessage: (id, body) => apiFetch(`/conversations/${id}/messages`, { method: 'POST', body: { body } }),
  deleteMessage: (id, messageId) => apiFetch(`/conversations/${id}/messages/${messageId}`, { method: 'DELETE' }),
  unreadCount: () => apiFetch('/conversations/unread-count'),
  payments: (id) => apiFetch(`/conversations/${id}/payments`),
  pay: (id, payload) => apiFetch(`/conversations/${id}/payments`, { method: 'POST', body: payload }),
  acceptPayment: (id, paymentId) => apiFetch(`/conversations/${id}/payments/${paymentId}/accept`, { method: 'POST', body: {} }),
  rejectPayment: (id, paymentId, reason) => apiFetch(`/conversations/${id}/payments/${paymentId}/reject`, { method: 'POST', body: { reason } })
};

export const sessionService = {
  list: () => apiFetch('/sessions'),
  get: (id) => apiFetch(`/sessions/${id}`),
  create: (payload) => apiFetch('/sessions', { method: 'POST', body: payload }),
  checkConflicts: (params) => {
    const qs = toQuery(params);
    return apiFetch(`/sessions/conflicts${qs ? `?${qs}` : ''}`);
  },
  respond: (id, decision, reason) => apiFetch(`/sessions/${id}/respond`, { method: 'PATCH', body: { decision, reason } }),
  confirmComplete: (id) => apiFetch(`/sessions/${id}/complete-confirm`, { method: 'POST', body: {} }),
  cancel: (id, reason) => apiFetch(`/sessions/${id}/cancel`, { method: 'PATCH', body: { reason } }),
  rescheduleRequests: {
    create: (id, payload) => apiFetch(`/sessions/${id}/reschedule-requests`, { method: 'POST', body: payload }),
    list: (id) => apiFetch(`/sessions/${id}/reschedule-requests`),
    respond: (id, requestId, decision) => apiFetch(`/sessions/${id}/reschedule-requests/${requestId}/respond`, { method: 'POST', body: { decision } })
  },
  remove: (id) => apiFetch(`/sessions/${id}`, { method: 'DELETE' }),
  pay: (id, payload) => apiFetch(`/sessions/${id}/pay`, { method: 'POST', body: payload })
};

export const paymentService = {
  mine: () => apiFetch('/payments/mine')
};

export const evaluationService = {
  create: (sessionId, rating, comment) => apiFetch('/evaluations', { method: 'POST', body: { session_id: sessionId, rating, comment } }),
  mine: () => apiFetch('/evaluations/mine'),
  forTutor: (tutorId) => apiFetch(`/evaluations/tutor/${tutorId}`),
  getForSession: (sessionId) => apiFetch(`/evaluations/${sessionId}`)
};

export const adminService = {
  stats: () => apiFetch('/admin/stats'),
  listUsers: (params = {}) => {
    const qs = toQuery(params);
    return apiFetch(`/admin/users${qs ? `?${qs}` : ''}`);
  },
  createUser: (payload) => apiFetch('/admin/users', { method: 'POST', body: payload }),
  updateUser: (id, payload) => apiFetch(`/admin/users/${id}`, { method: 'PATCH', body: payload }),
  deleteUser: (id) => apiFetch(`/admin/users/${id}`, { method: 'DELETE' }),
  listSubjects: () => apiFetch('/admin/subjects'),
  listSessions: (params = {}) => {
    const qs = toQuery(params);
    return apiFetch(`/admin/sessions${qs ? `?${qs}` : ''}`);
  },
  listSubjectRequests: () => apiFetch('/admin/subject-requests'),
  approveSubjectRequest: (id) => apiFetch(`/admin/subject-requests/${id}/approve`, { method: 'POST', body: {} }),
  rejectSubjectRequest: (id) => apiFetch(`/admin/subject-requests/${id}/reject`, { method: 'POST', body: {} }),
  listApplications: (params = {}) => {
    const qs = toQuery(params);
    return apiFetch(`/admin/tutor-applications${qs ? `?${qs}` : ''}`);
  },
  getApplication: (id) => apiFetch(`/admin/tutor-applications/${id}`),
  approveApplication: (id) => apiFetch(`/admin/tutor-applications/${id}/approve`, { method: 'POST', body: {} }),
  rejectApplication: (id) => apiFetch(`/admin/tutor-applications/${id}/reject`, { method: 'POST', body: {} }),
  warnUser: (id, reason) => apiFetch(`/admin/users/${id}/warn`, { method: 'POST', body: { reason } }),
  suspendUser: (id, payload) => apiFetch(`/admin/users/${id}/suspend`, { method: 'POST', body: payload }),
  banUser: (id, reason) => apiFetch(`/admin/users/${id}/ban`, { method: 'POST', body: { reason } }),
  getApplicationFile: async (id, field) => {
    const token = getToken();
    const res = await fetch(`/api/admin/tutor-applications/${id}/file/${field}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
};

export const reportService = {
  overview: () => apiFetch('/reports/overview'),
  sessions: () => apiFetch('/reports/sessions'),
  tutors: () => apiFetch('/reports/tutors'),
  students: () => apiFetch('/reports/students'),
  createUserReport: (payload) => apiFetch('/reports/user', { method: 'POST', body: payload }),
  listUserReports: (status) => apiFetch(`/reports/user${status ? `?status=${status}` : ''}`),
  resolveUserReport: (id, payload) => apiFetch(`/reports/user/${id}`, { method: 'PATCH', body: typeof payload === 'string' ? { action: payload } : payload })
};

export const activityLogService = {
  list: (params = {}) => {
    const qs = toQuery(params);
    return apiFetch(`/activity-logs${qs ? `?${qs}` : ''}`);
  }
};

export const tabUpdateService = {
  latest: () => apiFetch('/tab-updates')
};