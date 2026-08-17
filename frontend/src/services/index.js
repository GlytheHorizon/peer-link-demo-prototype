import { apiFetch } from './api';

/** Builds a query string, dropping empty values (URLSearchParams would send them as "undefined"). */
const toQuery = (params = {}) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  return qs.toString();
};

export const userService = {
  updateMe: (payload) => apiFetch('/users/me', { method: 'PUT', body: payload })
};

export const studentService = {
  getMe: () => apiFetch('/students/me'),
  updateMe: (payload) => apiFetch('/students/me', { method: 'PUT', body: payload }),
  getSubjects: () => apiFetch('/students/me/subjects'),
  setSubjects: (subjectIds) => apiFetch('/students/me/subjects', { method: 'PUT', body: { subject_ids: subjectIds } })
};

export const tutorService = {
  getMe: () => apiFetch('/tutors/me'),
  updateMe: (payload) => apiFetch('/tutors/me', { method: 'PUT', body: payload }),
  getSubjects: () => apiFetch('/tutors/me/subjects'),
  setSubjects: (payload) => apiFetch('/tutors/me/subjects', { method: 'PUT', body: payload }),
  addSubjectRequest: (payload) => apiFetch('/tutors/me/subject-requests', { method: 'POST', body: payload }),
  listSubjectRequests: () => apiFetch('/tutors/me/subject-requests'),
  getPublic: (id) => apiFetch(`/tutors/${id}`)
};

export const subjectService = {
  list: () => apiFetch('/subjects'),
  create: (payload) => apiFetch('/subjects', { method: 'POST', body: payload }),
  update: (id, payload) => apiFetch(`/subjects/${id}`, { method: 'PUT', body: payload }),
  remove: (id) => apiFetch(`/subjects/${id}`, { method: 'DELETE' })
};

export const matchService = {
  generate: (subjectId) => apiFetch('/matches/generate', { method: 'POST', body: subjectId ? { subject_id: subjectId } : {} }),
  list: (subjectId) => apiFetch(`/matches${subjectId ? `?subject_id=${subjectId}` : ''}`),
  get: (id) => apiFetch(`/matches/${id}`)
};

export const conversationService = {
  list: () => apiFetch('/conversations'),
  start: (tutorId, subjectId) => apiFetch('/conversations', { method: 'POST', body: { tutor_id: tutorId, subject_id: subjectId } }),
  get: (id) => apiFetch(`/conversations/${id}`),
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
  respond: (id, decision) => apiFetch(`/sessions/${id}/respond`, { method: 'PATCH', body: { decision } }),
  complete: (id) => apiFetch(`/sessions/${id}/complete`, { method: 'PATCH', body: {} }),
  cancel: (id) => apiFetch(`/sessions/${id}/cancel`, { method: 'PATCH', body: {} }),
  pay: (id, payload) => apiFetch(`/sessions/${id}/pay`, { method: 'POST', body: payload })
};

export const evaluationService = {
  create: (sessionId, rating, comment) => apiFetch('/evaluations', { method: 'POST', body: { session_id: sessionId, rating, comment } }),
  mine: () => apiFetch('/evaluations/mine'),
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
  rejectSubjectRequest: (id) => apiFetch(`/admin/subject-requests/${id}/reject`, { method: 'POST', body: {} })
};

export const reportService = {
  overview: () => apiFetch('/reports/overview'),
  sessions: () => apiFetch('/reports/sessions'),
  tutors: () => apiFetch('/reports/tutors'),
  students: () => apiFetch('/reports/students')
};

export const activityLogService = {
  list: (params = {}) => {
    const qs = toQuery(params);
    return apiFetch(`/activity-logs${qs ? `?${qs}` : ''}`);
  }
};