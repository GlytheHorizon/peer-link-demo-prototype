# PeerLink — Peer Tutoring Platform (MVP)

A web-based peer tutoring platform built with a four-tier architecture:

**User Layer** – Students, Tutors, Faculty, Administrators
**Presentation Layer** – React (Vite)
**Application Layer** – Node.js + Express REST API
**Database Layer** – Supabase (PostgreSQL, normalized schema)

## Features

- Registration / login with **JWT + bcrypt**, role-based access control
- Student profiles: subjects they need help with, course, year level
- Tutor profiles: subjects taught (proficiency 1–5), weekly availability — tutors can also add subjects not yet in the catalog
- **Automated matching engine** (backend only) with a 0–100 compatibility score:
  subject 40% · proficiency 20% · course/year 15% · availability 15% · rating 10%
- Messaging between students and tutors (unread counts, unsend)
- Every mutating action asks for confirmation in a custom modal (no browser alerts)
- Session workflow: request → accept/reject → complete → evaluate
- Automatic scheduling-conflict prevention
- Evaluations only after completed sessions, once per session
- Faculty & admin reports (sessions, tutors, students, overview)
- Admin: user management, subject management, session monitoring, activity logs
  (admins cannot delete or deactivate their own account)
- Consistent REST responses, input validation, safe error messages, CORS, env config

## Tech Stack

| Layer   | Technology                          |
| ------- | ----------------------------------- |
| Frontend| React 18, React Router, Vite        |
| Backend | Node.js, Express, JSON Web Token    |
| DB      | Supabase (PostgreSQL 15+, `pg` driver) |
| Auth    | bcryptjs + JWT                      |

## Project Structure (tree + function of each file)

```
peerlink/
├── .env.example              Template for environment variables (DB, JWT, ports)
├── .gitignore                Ignored: node_modules/, dist/, .env, *.log
├── README.md                 This documentation
│
├── database/
│   └── schema.sql            Full Supabase/PostgreSQL schema: 13 normalized tables + demo seed data
│
├── backend/                  Node.js + Express REST API
│   ├── .env                  Local secrets (DB_PASSWORD, JWT_SECRET) — never committed
│   ├── .env.example          Copy of env template specific to the backend
│   ├── package.json          Dependencies + npm scripts (start)
│   └── src/
│       ├── server.js         Entry point — loads env, starts the HTTP server on :5000
│       ├── app.js            Express app — CORS, JSON, routes, 404 + error handler wiring
│       │
│       ├── config/
│       │   ├── index.js      Central env config: port, client URL, JWT secret/expiry
│       │   └── db.js         pg connection pool + query helpers (MySQL-style shim)
│       │                     (query, withTransaction, likeEscape, qex)
│       │
│       ├── middleware/
│       │   ├── auth.js       JWT protection (protect) + role guard (restrictTo)
│       │   └── errorHandler.js  notFound (404) + central error handler (maps ApiError)
│       │
│       ├── utils/
│       │   ├── http.js       ApiError, asyncHandler, ok — consistent { success, message, data }
│       │   └── jwt.js        signToken / verifyToken (HS256)
│       │
│       ├── validators/
│       │   └── validate.js   Chainable validators (required, email, minLen, …) + nextWeek helper
│       │
│       ├── routes/           REST wiring — each file mounts its controller on a path
│       │   ├── authRoutes.js            /api/auth
│       │   ├── userRoutes.js            /api/users
│       │   ├── studentRoutes.js         /api/students
│       │   ├── tutorRoutes.js           /api/tutors
│       │   ├── subjectRoutes.js         /api/subjects
│       │   ├── matchRoutes.js           /api/matches
│       │   ├── conversationRoutes.js    /api/conversations
│       │   ├── messageRoutes.js         /api/conversations/:id/messages
│       │   ├── sessionRoutes.js         /api/sessions
│       │   ├── evaluationRoutes.js      /api/evaluations
│       │   ├── reportRoutes.js          /api/reports
│       │   ├── adminRoutes.js           /api/admin
│       │   └── activityLogRoutes.js     /api/activity-logs
│       │
│       ├── controllers/      HTTP layer — validate input, call models/services, respond
│       │   ├── authController.js       register, login, logout, me (+ ROLE_LABELS)
│       │   ├── userController.js       getMe, updateMe, listUsers, getUser
│       │   ├── studentController.js    getMyProfile, updateMyProfile, setMySubjects, getMySubjects
│       │   ├── tutorController.js      getMyProfile, updateMyProfile, setMySubjects,
│       │   │                           getMySubjects, addMySubject, getPublicTutor
│       │   ├── subjectController.js    listSubjects, searchSubjects, create/update/deleteSubject
│       │   ├── matchController.js      generate, listMyMatches, getMatch
│       │   ├── conversationController.js  listMine, start, getOne
│       │   ├── messageController.js    listMessages, sendMessage, deleteMessage, unreadCount
│       │   ├── sessionController.js    listMine, getOne, createRequest, respond, complete, cancel
│       │   ├── evaluationController.js create, listMine, getForSession
│       │   ├── reportController.js     overview, sessionsReport, tutorsReport, studentsReport
│       │   ├── adminController.js      listUsers, createUser, updateUser, deleteUser,
│       │   │                           listSubjects, listSessions, stats
│       │   │                           (blocks delete/deactivate of the admin's own account)
│       │   └── activityLogController.js  listLogs
│       │
│       ├── models/           Data access — parameterized SQL only, no string-built queries
│       │   ├── userModel.js           findByEmail, findById, create, update, changePassword,
│       │   │                           list (filters + pagination), countByRole
│       │   ├── studentModel.js        findProfileByUserId, createProfile, updateProfile,
│       │   │                           getProfileWithSubjects, getSubjectKeys, replaceSubjects,
│       │   │                           ensureProfile
│       │   ├── tutorModel.js          findProfileByUserId, createProfile, updateProfile,
│       │   │                           getProfileWithSubjects, findProfileById, getPublicTutor,
│       │   │                           getSubjectKeys, replaceSubjects, addSubjectToProfile,
│       │   │                           ensureProfile, getAllTutors
│       │   ├── subjectModel.js        getAll, findById, findByCode, create, update, remove, search
│       │   ├── matchModel.js          upsert, findByStudent, findById,
│       │   │                           findForStudentAndSubject, removeForSubject
│       │   ├── conversationModel.js   findOrCreate, findById, listForUser, isParticipant
│       │   ├── messageModel.js        listByConversation, create, markConversationRead,
│       │   │                           countUnreadForUser, findById, remove
│       │   ├── sessionModel.js        findById, create, listForStudent, listForTutor,
│       │   │                           updateStatus, hasOverlap, countByStatus, countBetween
│       │   ├── evaluationModel.js     create, findBySession, listReceivedByTutor,
│       │   │                           listGivenByStudent, ratingSummaryByTutor, listAll
│       │   └── activityLogModel.js    insert, list
│       │
│       └── services/         Business logic shared by controllers
│           ├── matchingService.js     WEIGHTS, computeScore (0–100 breakdown),
│           │                           generateMatches (scores every tutor per subject,
│           │                           upserts into matches, returns sorted)
│           └── activityLogService.js  log — records { action, entity, entity_id, actor_id, ip }
│                                      into activity_logs
│
└── frontend/                 React SPA (Vite)
    ├── index.html            Vite entry HTML (mounts #root)
    ├── vite.config.js        Vite dev server config — proxies /api → http://localhost:5000
    ├── package.json          Dependencies + scripts (dev, build, preview)
    └── src/
        ├── main.jsx          ReactDOM bootstrap — wraps app in AuthProvider + ConfirmProvider
        ├── App.jsx           Router + route table (landing, auth pages, protected pages,
        │                     role-gated routes)
        ├── styles.css        Global styles — green (#329427) design system,
        │                     dashboard layout, tables, badges, modals, confirm dialog
        │
        ├── routes/
        │   └── ProtectedRoute.jsx    ProtectedRoute (requires auth + optional roles)
        │                             and GuestRoute (redirects logged-in users away)
        │
        ├── context/
        │   ├── AuthContext.jsx       AuthProvider: login, register, logout, restore,
        │   │                         isRole, roleLabel, useAuth hook
        │   └── ConfirmContext.jsx    ConfirmProvider: async confirm(options) modal system,
        │                             useConfirm hook (replaces window.confirm)
        │
        ├── hooks/
        │   └── useApi.js             Hook wrapping async loaders: { data, loading, error, reload }
        │
        ├── services/         API client layer
        │   ├── api.js        fetch wrapper + token storage (getToken/setToken), 401 handling
        │   ├── auth.js       authService: register, login, logout, me
        │   └── index.js      Resource services (user, student, tutor, subject, match,
        │                     conversation, session, evaluation, admin, report,
        │                     activityLog) + toQuery helper that drops empty params
        │
        ├── layouts/
        │   └── DashboardLayout.jsx   Authenticated shell: sidebar navigation, topbar with
        │                             user menu (role-aware links, logout)
        │
        ├── components/
        │   ├── ui.jsx        Reusable UI kit: Spinner, Alert, EmptyState, Modal,
        │                     RatingStars, StatusBadge, formatDateTime, formatDate
        │   └── ConfirmDialog.jsx     Modal confirmation dialog (title, message,
        │                             confirm/cancel, danger variant) used by ConfirmContext
        │
        └── pages/
            ├── Landing.jsx           Public landing page (hero + role cards + CTA)
            ├── Login.jsx             Login form (email/password → AuthContext.login)
            ├── Register.jsx          Registration (student/tutor with profile fields)
            ├── RoleDashboard.jsx     Role-aware dashboard: stats cards + quick actions
            │                         (student: my matches; tutor: requests; faculty/admin: reports)
            ├── Profile.jsx           View/edit profile; student & tutor subject selection
            ├── Subjects.jsx          Subject catalog; tutors can add their own subjects
            ├── MatchingResults.jsx   Run matching, ranked tutor list with score breakdown,
            │                         message / request-session actions
            ├── Messages.jsx          Conversation list + chat thread (send, unsend, unread)
            ├── ScheduleSession.jsx   Session request form (tutor, subject, date/time,
            │                         conflict warnings)
            ├── Sessions.jsx          My sessions (student/tutor) with statuses + actions
            ├── SessionDetails.jsx    Session detail — respond (tutor), complete, cancel,
            │                         evaluation after completion
            ├── TutorProfile.jsx      Public tutor profile (subjects, proficiency, rating)
            ├── Reports.jsx           Faculty/admin reports (overview, sessions, tutors, students)
            ├── SubjectManagement.jsx Admin CRUD for the subject catalog
            ├── UserManagement.jsx    Admin user CRUD + filters/pagination; hides
            │                         deactivate/delete on the admin's own row
            └── ActivityLogs.jsx      Admin audit log viewer (filters, pagination)
```

## Setup

### 1. Database (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the entire contents of `database/schema.sql`,
   and run it — this creates the 13 tables plus demo seed data.
3. Go to **Project Settings → Database → Connection string**, copy the
   **Direct connection** string (port 5432), and use it as `DATABASE_URL`.

### 2. Backend

```bat
cd backend
copy .env.example .env   :: then set DATABASE_URL and JWT_SECRET
npm install
npm start                :: http://localhost:5000
```

### 3. Frontend

```bat
cd frontend
npm install
npm run dev              :: http://localhost:5173 (proxies /api to :5000)
```

## Deploy to Vercel

The repo ships with a `vercel.json` that defines two **services** on one shared
domain (requires Vercel's Services framework preset):

- `frontend` — Vite SPA (root: `frontend`)
- `backend` — Express API (root: `backend`, entrypoint `src/app.js`)

All `/api/*` requests rewrite to the backend service; everything else serves
the SPA. The frontend calls the API with relative `/api` paths, so no base URL
config is needed.

1. Import this repository into Vercel.
2. In **Project Settings → Build and Deployment**, set **Framework Preset** to
   **Services** (required for the `services` key in `vercel.json`).
3. Add the project environment variables (shared by both services):
   - `DATABASE_URL` — Supabase direct connection string
   - `DATABASE_SSL=true`
   - `JWT_SECRET` — a long random string
   - `CLIENT_URL` — your deployed app URL (e.g. `https://your-app.vercel.app`)
4. Deploy. The Express app runs as a single Vercel Function on Fluid compute
   (Supabase connection pooling keeps the DB pool happy across cold starts).

## Demo Accounts

| Role    | Email                | Password      | Function |
| ------- | -------------------- | ------------- | -------- |
| Student | student@peerlink.edu | Student@123   | Requests help: picks subjects, runs matching, messages tutors, books & evaluates sessions |
| Tutor   | tutor@peerlink.edu   | Tutor@123     | Offers help: sets subjects/proficiency/availability, accepts/rejects/completes sessions, tracks ratings |
| Faculty | faculty@peerlink.edu | Faculty@123   | Monitors the program: dashboards + reports (overview, sessions, tutors, students) |
| Admin   | admin@peerlink.edu   | Admin@123     | Runs the system: user & subject management, session monitoring, activity logs, stats |

Plus extra seeded tutors (david.garcia@ / sara.kim@) and a student (mike.chen@)
using the same passwords.

## REST API Summary

| Resource        | Endpoints |
| --------------- | --------- |
| Auth            | POST `/api/auth/register` · `/api/auth/login` · `/api/auth/logout` · GET `/api/auth/me` |
| Users           | GET/PUT `/api/users/me` · GET `/api/users` (faculty+admin) |
| Students        | GET/PUT `/api/students/me` · GET/PUT `/api/students/me/subjects` |
| Tutors          | GET/PUT `/api/tutors/me` · GET/PUT `/api/tutors/me/subjects` · POST `/api/tutors/me/subjects` (add own) · GET `/api/tutors/:id` |
| Subjects        | GET `/api/subjects` · POST/PUT/DELETE (admin) |
| Matches         | POST `/api/matches/generate` · GET `/api/matches` · GET `/api/matches/:id` |
| Conversations   | GET/POST `/api/conversations` · GET `/api/conversations/:id` |
| Messages        | GET/POST `/api/conversations/:id/messages` · DELETE `/api/conversations/:id/messages/:messageId` · GET `/api/conversations/unread-count` |
| Sessions        | GET/POST `/api/sessions` · GET `/api/sessions/:id` · PATCH `:id/respond` `:id/complete` `:id/cancel` |
| Evaluations     | POST `/api/evaluations` · GET `/api/evaluations/mine` |
| Admin           | GET/POST/PATCH/DELETE `/api/admin/users` · GET `/api/admin/subjects` · GET `/api/admin/sessions` · GET `/api/admin/stats` |
| Reports         | GET `/api/reports/overview` · `/sessions` · `/tutors` · `/students` (faculty+admin) |
| Activity Logs   | GET `/api/activity-logs` (admin) |

All protected endpoints require `Authorization: Bearer <jwt>`, and every
response uses the consistent shape `{ success, message, data }`.

## Matching Algorithm (matchingService)

Compatibility = subject(40) + proficiency(20) + course/year(15) + availability(15) + rating(10).
Results are computed on the backend, stored in `matches`, and returned sorted
highest-first with the score breakdown for transparency.

## Session Workflow

```
Student selects tutor → select subject → date/time → request
→ tutor accepts/rejects → accepted → tutor completes → student evaluates
```

- Scheduling conflicts (exact, partial, or overlapping) are blocked for both
  student and tutor while sessions are `pending` or `accepted`.
- Evaluations require a `completed` session, are one-per-session, and feed the
  tutor's rating used by the matching engine.

## Security

- bcrypt password hashing (cost 10), never stored in plain text
- JWT with configurable secret/expiry, fresh user lookup on every request
- Role-based middleware (`restrictTo`), protected routes on every endpoint
- Parameterized SQL everywhere; no string-built queries
- Input validation before any DB access; safe, generic error messages
- CORS limited to `CLIENT_URL`; secrets only via `.env` (never committed)
- Admins cannot modify or delete their own account (enforced in `adminController`)

## Known Issues

- Vercel deployment may return 500 errors on auth endpoints (`/api/auth/login`) due to PostgreSQL connection pool incompatibility with Vercel's serverless functions. Works fine in local development. See: `backend/src/config/db.js` — consider using per-request connections for Vercel compatibility.
