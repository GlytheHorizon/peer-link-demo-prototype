// Sample dataset used ONLY by the static Vercel demo (no DB).
// Passwords mirror the README demo accounts so the Login page "just works".

export const DEMO_USERS = [
  {
    id: 1, email: 'student@peerlink.edu', password: 'Student@123',
    role_key: 'student', first_name: 'Alex', last_name: 'Student',
    verification_status: 'approved',
  },
  {
    id: 2, email: 'mike.chen@peerlink.edu', password: 'Student@123',
    role_key: 'student', first_name: 'Mike', last_name: 'Chen',
    verification_status: 'approved',
  },
  {
    id: 3, email: 'maria@peerlink.edu', password: 'Tutor@123',
    role_key: 'tutor', first_name: 'Maria', last_name: 'Santos',
    verification_status: 'approved',
  },
  {
    id: 4, email: 'gerome@peerlink.edu', password: 'Tutor@123',
    role_key: 'tutor', first_name: 'Gerome', last_name: 'Reyes',
    verification_status: 'approved',
  },
  {
    id: 5, email: 'kiel@peerlink.edu', password: 'Tutor@123',
    role_key: 'tutor', first_name: 'Kiel', last_name: 'Dela Cruz',
    verification_status: 'approved',
  },
  {
    id: 6, email: 'faculty@peerlink.edu', password: 'Faculty@123',
    role_key: 'faculty', first_name: 'Dr. Faculty', last_name: 'Member',
    verification_status: 'approved',
  },
  {
    id: 7, email: 'admin@peerlink.edu', password: 'Admin@123',
    role_key: 'admin', first_name: 'Site', last_name: 'Admin',
    verification_status: 'approved',
  },
];

export const DEMO_SUBJECTS = [
  { id: 1, name: 'Mathematics', code: 'MATH 101', description: 'Algebra, calculus and problem solving.' },
  { id: 2, name: 'Physics', code: 'PHYS 101', description: 'Mechanics, waves and thermodynamics.' },
  { id: 3, name: 'Chemistry', code: 'CHEM 101', description: 'General and organic chemistry basics.' },
  { id: 4, name: 'English', code: 'ENG 101', description: 'Grammar, writing and literature.' },
  { id: 5, name: 'Programming', code: 'CS 101', description: 'JavaScript, Python and web fundamentals.' },
  { id: 6, name: 'Statistics', code: 'STAT 101', description: 'Probability and data analysis.' },
];

export const DEMO_TUTORS = [
  {
    id: 3, user_id: 3, name: 'Maria Santos', email: 'maria@peerlink.edu',
    bio: 'Math & Physics tutor. 3 years of peer tutoring experience.',
    hourly_rate: 150, rating: 4.8, total_sessions: 42,
    subjects: [1, 2], availability: 'Mon–Fri 4pm–8pm',
  },
  {
    id: 4, user_id: 4, name: 'Gerome Reyes', email: 'gerome@peerlink.edu',
    bio: 'Programming & Statistics tutor. Loves practical examples.',
    hourly_rate: 200, rating: 4.6, total_sessions: 31,
    subjects: [5, 6], availability: 'Tue/Thu/Sat 10am–4pm',
  },
  {
    id: 5, user_id: 5, name: 'Kiel Dela Cruz', email: 'kiel@peerlink.edu',
    bio: 'Chemistry & English tutor. Patient with beginners.',
    hourly_rate: 120, rating: 4.9, total_sessions: 27,
    subjects: [3, 4], availability: 'Mon/Wed/Fri 9am–3pm',
  },
];

export const DEMO_MATCHES = [
  {
    id: 101, tutor_id: 3, tutor_name: 'Maria Santos', subject_id: 1,
    subject_name: 'Mathematics', score: 92, hourly_rate: 150, rating: 4.8,
    breakdown: { subject: 35, proficiency: 22, rate: 12, courseYear: 13, availability: 5, rating: 5 },
  },
  {
    id: 102, tutor_id: 4, tutor_name: 'Gerome Reyes', subject_id: 5,
    subject_name: 'Programming', score: 88, hourly_rate: 200, rating: 4.6,
    breakdown: { subject: 35, proficiency: 20, rate: 10, courseYear: 13, availability: 5, rating: 5 },
  },
  {
    id: 103, tutor_id: 5, tutor_name: 'Kiel Dela Cruz', subject_id: 3,
    subject_name: 'Chemistry', score: 85, hourly_rate: 120, rating: 4.9,
    breakdown: { subject: 35, proficiency: 19, rate: 13, courseYear: 12, availability: 4, rating: 5 },
  },
];

export const DEMO_SESSIONS = [
  {
    id: 201, subject_name: 'Mathematics', tutor_name: 'Maria Santos',
    tutor_id: 3, student_id: 1, status: 'accepted',
    scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    location: 'Library Room 2', notes: 'Bring algebra problem set.',
  },
  {
    id: 202, subject_name: 'Programming', tutor_name: 'Gerome Reyes',
    tutor_id: 4, student_id: 1, status: 'completed',
    scheduled_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    location: 'Online', notes: 'Intro to React hooks.',
  },
  {
    id: 203, subject_name: 'Chemistry', tutor_name: 'Kiel Dela Cruz',
    tutor_id: 5, student_id: 1, status: 'pending',
    scheduled_at: new Date(Date.now() + 3 * 86400000).toISOString(),
    location: 'Science Bldg Rm 5', notes: 'Organic chemistry basics.',
  },
];

export const DEMO_CONVERSATIONS = [
  {
    id: 301, other_name: 'Maria Santos', other_id: 3,
    subject_name: 'Mathematics', last_message: 'See you tomorrow at 4pm!',
    updated_at: new Date().toISOString(), unread: 1,
  },
  {
    id: 302, other_name: 'Gerome Reyes', other_id: 4,
    subject_name: 'Programming', last_message: 'Thanks for the session!',
    updated_at: new Date(Date.now() - 86400000).toISOString(), unread: 0,
  },
];

export const DEMO_MESSAGES = {
  301: [
    { id: 1, sender_id: 1, sender_name: 'You', body: 'Hi! Can you help me with algebra?', created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: 2, sender_id: 3, sender_name: 'Maria Santos', body: 'Of course! What topic exactly?', created_at: new Date(Date.now() - 7000000).toISOString() },
    { id: 3, sender_id: 3, sender_name: 'Maria Santos', body: 'See you tomorrow at 4pm!', created_at: new Date().toISOString() },
  ],
  302: [
    { id: 4, sender_id: 4, sender_name: 'Gerome Reyes', body: 'Thanks for the session!', created_at: new Date(Date.now() - 86400000).toISOString() },
  ],
};

export const DEMO_RESOURCES = [
  { id: 401, title: 'Algebra Cheat Sheet (sample)', type: 'link', subject_name: 'Mathematics', url: '#', created_at: new Date().toISOString() },
  { id: 402, title: 'Intro to React Hooks slides (sample)', type: 'link', subject_name: 'Programming', url: '#', created_at: new Date().toISOString() },
];

export function publicUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}
