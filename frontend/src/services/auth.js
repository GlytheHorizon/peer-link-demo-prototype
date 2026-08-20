import { apiFetch } from './api';

export const authService = {
  register: (payload) => apiFetch('/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => apiFetch('/auth/login', { method: 'POST', body: payload, auth: false }),
  adminLogin: (payload) => apiFetch('/auth/admin-login', { method: 'POST', body: payload, auth: false }),
  applyTutor: (payload) => apiFetch('/auth/tutor-apply', { method: 'POST', body: payload, auth: false }),
  emailExists: (email) => apiFetch(`/auth/email-exists?email=${encodeURIComponent(email)}`, { auth: false }),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
  me: () => apiFetch('/auth/me'),
  myApplication: () => apiFetch('/auth/tutor-application')
};