# PeerLink — Peer Tutoring Platform (96% Complete)

> A full-stack web-based peer tutoring platform with role-based access, automated matching, real-time messaging, admin moderation, and tutor verification.

**Four-Tier Architecture**

| Layer | Technology |
|-------|------------|
| User Layer | Students · Tutors · Faculty · Administrators |
| Presentation | React 18 + Vite (SPA) |
| Application | Node.js + Express REST API |
| Database | MySQL 5.7+ / 8.0+ / MariaDB (`mysql2` driver) |

---

## ✨ Features

### Core Platform
- **Registration & Login** — JWT + bcrypt, role-based access control (student, tutor, faculty, admin)
- **Student Profiles** — subjects needed, course, year level, strand, learning preferences
- **Tutor Profiles** — subjects taught with proficiency ratings (1–5), weekly availability, bio
- **Automated Matching Engine** — 0–100 compatibility score per subject:
  `subject 40% · proficiency 20% · course/year 15% · availability 15% · rating 10%`
- **Messaging** — real-time-style conversation threads, unread counts, unsend
- **Session Workflow** — request → accept/reject → complete → evaluate; conflict prevention
- **Evaluations** — one per completed session; feed the tutor's rating in the matching engine
- **Resources** — shared file/link library accessible to all roles
- **Calendar** — session schedule view
- **Earnings** — tutor earnings tracker

### Admin Features
- **User Management** — create, edit, deactivate, delete users; search + pagination
- **Subject Management** — full CRUD for the subject catalog
- **Session Monitoring** — view all platform sessions with filters
- **Activity Logs** — full audit trail (action, entity, actor, IP, timestamp)
- **Tutor Verification** — review and approve/reject tutor credential submissions
- **Moderation System** *(new)*:
  - **Warn User** — issue a warning with a required reason; user sees a toast notification within ~5 seconds
  - **Suspend Account** — set duration (1/3/7/14/30 days) with required reason; blocks login automatically
  - **Ban Account** — permanent ban with required reason; blocks login permanently

### User-Side Moderation (new)
- **Warning Toast** — floating bottom-right notification: *"You have received a warning from the admin: [Reason]"*
  - Dismiss triggers confirmation: *"Have you read and understood this warning?"*
  - Toast only closes after clicking **Yes / I Understand** (acknowledged in DB)
  - Polls every **5 seconds** for new warnings
- **Login Restrictions** — suspended/banned users are blocked at login with the admin's reason shown:
  - Suspended: *"Your account has been suspended until [Date]. Reason: [Reason]."*
  - Banned: *"Your account has been permanently banned. Reason: [Reason]."*
  - Expired suspensions are automatically lifted on the next login attempt

### Faculty Features
- Academic & tutoring reports: overview stats, sessions by subject/tutor, tutor performance, student activity

### Security
- bcrypt password hashing (cost 10)
- JWT with configurable secret/expiry; fresh user lookup on every request
- Role-based middleware (`restrictTo`), protected routes on every endpoint
- Parameterized SQL everywhere — no string-built queries
- Input validation before any DB access; safe, generic error messages
- CORS limited to `CLIENT_URL`; secrets only via `.env` (never committed)
- Admins cannot modify or delete their own account (enforced server-side)
- Every mutating action uses a custom confirm modal — no browser alerts

---

## 🎨 Customization Guide

### Changing the App Name & Brand

| What to Change | File | Where |
|---|---|---|
| Sidebar logo icon (SVG triangle nodes) | `frontend/src/layouts/DashboardLayout.jsx` | `LogoNode()` function — lines ~54–68 |
| Sidebar app name ("PeerLink") | `frontend/src/layouts/DashboardLayout.jsx` | Search for `PeerLink` in the sidebar render section |
| Login page logo (left panel) | `frontend/src/pages/Login.jsx` | Look for `brand-side` div containing the SVG |
| Admin login page logo | `frontend/src/pages/AdminLogin.jsx` | Look for `brand-side` div |
| Register page logo | `frontend/src/pages/Register.jsx` | Look for `brand-side` div |
| Forgot Password page logo | `frontend/src/pages/ForgotPassword.jsx` | Look for `brand-side` SVG block |
| Landing page hero title | `frontend/src/pages/Landing.jsx` | Top of the return JSX |
| Browser tab title | `frontend/index.html` | `<title>` tag |

### Changing Colors & Theme

| What to Change | File | Where |
|---|---|---|
| Primary blue accent (`#4361ee`) | `frontend/src/styles.css` | CSS variable `--primary` at the top `:root` block |
| Sidebar background | `frontend/src/styles.css` | `.sidebar` selector |
| Registration/Login background gradient | `frontend/src/styles.css` | `.auth-page.royal` selector (~line 847) |
| Global font | `frontend/src/styles.css` | `font-family` in `body` / `:root` |
| Warning toast colors | `frontend/src/styles.css` | `.warning-toast-card` selector |

### Changing Navigation Links (Sidebar)

Edit the `NAV` object in `frontend/src/layouts/DashboardLayout.jsx` (lines ~19–51):

```js
const NAV = {
  student: [ /* student sidebar links */ ],
  tutor:   [ /* tutor sidebar links   */ ],
  faculty: [ /* faculty sidebar links */ ],
  admin:   [ /* admin sidebar links   */ ],
};
```

Each entry: `{ to: '/route', label: 'Label', icon: '▤' }`

### Changing Warning Poll Speed

In `frontend/src/components/WarningToast.jsx` line ~24:
```js
const interval = setInterval(fetchWarnings, 5000); // Change 5000 to any ms value
```

### Changing Matching Weights

In `backend/src/services/matchingService.js` — the `WEIGHTS` object:
```js
const WEIGHTS = {
  subject: 40, proficiency: 20, courseYear: 15, availability: 15, rating: 10
};
```

### Changing Demo Seed Data

Re-run `database/schema.sql` or `database/reset.sql` in phpMyAdmin (SQL tab) after editing the `INSERT` blocks.

---

## 🗂 Project Structure

```
peerlink/
├── .env.example              Environment variable template
├── .gitignore                Ignores: node_modules/, dist/, .env, *.log
├── vercel.json               Vercel Services config (frontend + backend on shared domain)
├── README.md                 This file
│
├── database/
│   ├── schema.sql            Full MySQL schema (21 tables) + demo seed data
│   └── reschema.sql          Incremental migration patches (run after schema.sql)
│
├── backend/                  Node.js + Express REST API
│   ├── .env                  Local secrets — never committed
│   ├── .env.example          Template for backend env vars
│   ├── package.json
│   └── src/
│       ├── server.js         Entry point — HTTP server on :5000
│       ├── app.js            Express app — CORS, JSON, routes, error handler
│       │
│       ├── config/
│       │   ├── index.js      Central env config (port, CLIENT_URL, JWT)
│       │   └── db.js         mysql2 connection pool + query helper
│       │
│       ├── middleware/
│       │   ├── auth.js       JWT protect + restrictTo role guard
│       │   └── errorHandler.js  404 + central error handler
│       │
│       ├── utils/
│       │   ├── http.js       ApiError, asyncHandler, ok()
│       │   └── jwt.js        signToken / verifyToken
│       │
│       ├── validators/
│       │   └── validate.js   Chainable validators (required, email, minLen…)
│       │
│       ├── routes/
│       │   ├── authRoutes.js            /api/auth
│       │   ├── userRoutes.js            /api/users  (+ warnings)
│       │   ├── studentRoutes.js         /api/students
│       │   ├── tutorRoutes.js           /api/tutors
│       │   ├── subjectRoutes.js         /api/subjects
│       │   ├── matchRoutes.js           /api/matches
│       │   ├── conversationRoutes.js    /api/conversations
│       │   ├── messageRoutes.js         /api/conversations/:id/messages
│       │   ├── sessionRoutes.js         /api/sessions
│       │   ├── evaluationRoutes.js      /api/evaluations
│       │   ├── reportRoutes.js          /api/reports
│       │   ├── adminRoutes.js           /api/admin  (+ warn/suspend/ban)
│       │   └── activityLogRoutes.js     /api/activity-logs
│       │
│       ├── controllers/
│       │   ├── authController.js       register, login, logout, me,
│       │   │                           adminLogin, checkUserAccountStatus
│       │   ├── userController.js       getMe, updateMe, listUsers, getUser,
│       │   │                           getWarnings, acknowledgeWarning
│       │   ├── studentController.js    profile CRUD + subjects
│       │   ├── tutorController.js      profile CRUD + subjects + public profile
│       │   ├── subjectController.js    list, search, CRUD (admin)
│       │   ├── matchController.js      generate, listMyMatches, getMatch
│       │   ├── conversationController.js  listMine, start, getOne
│       │   ├── messageController.js    list, send, delete, unreadCount
│       │   ├── sessionController.js    list, get, create, respond, complete, cancel
│       │   ├── evaluationController.js create, listMine, getForSession
│       │   ├── reportController.js     overview, sessions, tutors, students,
│       │   │                           listUserReports, resolveUserReport
│       │   ├── adminController.js      user/subject/session CRUD + stats,
│       │   │                           warnUser, suspendUser, banUser
│       │   └── activityLogController.js  listLogs
│       │
│       ├── models/
│       │   ├── userModel.js           findByEmail, findById, create, update,
│       │   │                           list, countByRole, warnUser,
│       │   │                           getUnacknowledgedWarnings, acknowledgeWarning,
│       │   │                           suspendUser, banUser, clearSuspension
│       │   ├── studentModel.js        profile CRUD + subjects
│       │   ├── tutorModel.js          profile CRUD + subjects + public
│       │   ├── subjectModel.js        getAll, findById, create, update, remove, search
│       │   ├── matchModel.js          upsert, findByStudent, findById
│       │   ├── conversationModel.js   findOrCreate, findById, listForUser
│       │   ├── messageModel.js        list, create, markRead, countUnread, remove
│       │   ├── sessionModel.js        findById, create, listForStudent, listForTutor,
│       │   │                           updateStatus, hasOverlap, countByStatus
│       │   ├── evaluationModel.js     create, findBySession, listReceived, listGiven,
│       │   │                           ratingSummaryByTutor, listAll
│       │   └── activityLogModel.js    insert, list
│       │
│       └── services/
│           ├── matchingService.js     WEIGHTS, computeScore, generateMatches
│           └── activityLogService.js  log()
│
└── frontend/                 React SPA (Vite)
    ├── index.html            Vite entry — mounts #root, set browser tab <title> here
    ├── vite.config.js        Dev proxy /api → localhost:5000
    ├── package.json
    └── src/
        ├── main.jsx          ReactDOM bootstrap — AuthProvider + ConfirmProvider
        ├── App.jsx           Router + full route table
        ├── styles.css        Global design system — variables, layout, components
        │
        ├── constants/
        │   └── learningProfile.js   STRANDS, SUBJECTS, GRADE_LEVELS, SCHEDULES…
        │
        ├── routes/
        │   └── ProtectedRoute.jsx   ProtectedRoute + GuestRoute
        │
        ├── context/
        │   ├── AuthContext.jsx      login, register, logout, restore, useAuth
        │   └── ConfirmContext.jsx   async confirm() modal, useConfirm hook
        │
        ├── hooks/
        │   └── useApi.js            { data, loading, error, reload }
        │
        ├── services/
        │   ├── api.js               fetch wrapper + token storage, 401 handling
        │   ├── auth.js              authService: register, login, logout, me
        │   └── index.js            All resource services: user, student, tutor,
        │                            subject, match, conversation, message, session,
        │                            evaluation, admin, report, activityLog
        │                            (includes getUnacknowledgedWarnings, acknowledgeWarning,
        │                             warnUser, suspendUser, banUser)
        │
        ├── layouts/
        │   └── DashboardLayout.jsx  Authenticated shell: sidebar (NAV per role),
        │                            topbar, unread badge, WarningToast integration
        │                            ← EDIT SIDEBAR LOGO & NAV LINKS HERE
        │
        ├── components/
        │   ├── ui.jsx               Spinner, Alert, EmptyState, Modal, InfoBox,
        │   │                        RatingStars, StatusBadge, formatDateTime, formatDate
        │   ├── ConfirmDialog.jsx     Custom confirm modal (replaces window.confirm)
        │   ├── ReportModal.jsx       Student/tutor report submission modal
        │   └── WarningToast.jsx      Admin warning toast + acknowledgment flow
        │                             ← EDIT POLL SPEED HERE (default: 5 seconds)
        │
        └── pages/
            ├── Landing.jsx           Public landing page
            ├── Login.jsx             Login — ← EDIT LOGIN LOGO (brand-side div)
            ├── AdminLogin.jsx        Admin login — ← EDIT ADMIN LOGIN LOGO
            ├── Register.jsx          Student registration (3-step wizard)
            ├── TutorRegister.jsx     Tutor registration
            ├── ForgotPassword.jsx    Password reset request
            ├── ResetPassword.jsx     Password reset (token link)
            ├── RoleDashboard.jsx     Role-aware home dashboard
            ├── Profile.jsx           View/edit own profile
            ├── Subjects.jsx          Subject catalog + tutor self-add
            ├── MatchingResults.jsx   Ranked tutor matches with score breakdown
            ├── Messages.jsx          Conversation list + chat thread
            ├── ScheduleSession.jsx   Book a session (conflict detection)
            ├── Sessions.jsx          My sessions with statuses & actions
            ├── SessionDetails.jsx    Session detail — respond, complete, cancel, evaluate
            ├── TutorProfile.jsx      Public tutor profile (report button)
            ├── StudentProfile.jsx    Public student profile (report button)
            ├── Reports.jsx           Faculty academic reports / Admin user reports
            ├── SubjectManagement.jsx Admin subject CRUD
            ├── UserManagement.jsx    Admin user management + moderation actions
            │                         (Warn / Suspend / Ban per user row)
            ├── AdminSessions.jsx     Admin session monitor
            ├── TutorVerifications.jsx  Admin tutor verification review
            ├── ActivityLogs.jsx      Admin audit log viewer
            ├── Calendar.jsx          Session calendar view
            ├── Resources.jsx         Shared resource library
            ├── Earnings.jsx          Tutor earnings tracker
            ├── MyStudents.jsx        Tutor's student list
            ├── Reviews.jsx           Tutor reviews page
            └── Payment.jsx           Payment page
```

---

## 🗄 Database Schema

21 tables in MySQL (phpMyAdmin ready):

| Table | Purpose |
|---|---|
| `users` | Core user accounts (all roles) — includes `suspended_until`, `is_banned`, `ban_reason`, `suspension_reason` |
| `student_profiles` | Student learning preferences & strand |
| `tutor_profiles` | Tutor bio, availability, verification status |
| `subjects` | Subject catalog |
| `student_subjects` | Student ↔ subject (subjects needed) |
| `tutor_subjects` | Tutor ↔ subject with proficiency score |
| `matches` | Computed compatibility scores per student+subject+tutor |
| `conversations` | Message threads between two users |
| `messages` | Individual messages |
| `sessions` | Tutoring session records with status workflow |
| `evaluations` | Post-session student→tutor reviews |
| `user_reports` | Reports submitted by students/tutors |
| `user_warnings` | Admin-issued warnings with acknowledgment tracking |
| `activity_logs` | Full admin audit trail |
| `tab_updates` | Badge tracking for sidebar notifications |

---

## 🚀 Setup

### 1. Database (MySQL / phpMyAdmin)

1. Open **phpMyAdmin** (e.g. `http://localhost/phpmyadmin`) or MySQL CLI
2. Create a database named `peerlink`
3. Select `peerlink`, go to the **Import** tab (or **SQL** tab), paste/select `database/schema.sql`, and execute
4. If updating existing database structure, execute `database/reschema.sql`

### 2. Backend

```bat
cd backend
copy .env.example .env
:: Fill in DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET in .env
npm install
npm start
:: Runs on http://localhost:5000
```

**Required `.env` variables:**

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=peerlink
JWT_SECRET=your-long-random-secret
CLIENT_URL=http://localhost:5173
PORT=5000
```

### 3. Frontend

```bat
cd frontend
npm install
npm run dev
:: Runs on http://localhost:5173 (proxies /api → :5000)
```

---

## ☁️ Deploy to Vercel

The repo includes a `vercel.json` defining two services on one shared domain:

- **`frontend`** — Vite SPA
- **`backend`** — Express API (entrypoint: `src/app.js`)

All `/api/*` requests rewrite to the backend; everything else serves the SPA.

**Steps:**

1. Import this repo into [Vercel](https://vercel.com)
2. In **Project Settings → Build & Deployment**, set **Framework Preset** to **Services**
3. Add these environment variables in Vercel:

   | Variable | Value |
   |---|---|
   | `DB_HOST` | MySQL host / address |
   | `DB_USER` | MySQL username |
   | `DB_PASSWORD` | MySQL password |
   | `DB_NAME` | `peerlink` |
   | `JWT_SECRET` | A long random secret |
   | `CLIENT_URL` | `https://your-app.vercel.app` |

4. Deploy. The Express app runs as a Vercel Function with Fluid compute.

---

## 👤 Demo Accounts

| Role | Email | Password | Access |
|---|---|---|---|
| Student | `student@peerlink.edu` | `Student@123` | Matching, sessions, messages, resources, calendar, payment |
| Tutor | `tutor@peerlink.edu` | `Tutor@123` | Sessions, students, earnings, verification, messages |
| Faculty | `faculty@peerlink.edu` | `Faculty@123` | Academic reports (overview, sessions, tutors, students) |
| Admin | `admin@peerlink.edu` | `Admin@123` | Full platform management + moderation |

Additional seeded accounts: `david.garcia@peerlink.edu`, `sara.kim@peerlink.edu` (tutors), `mike.chen@peerlink.edu` (student) — same password pattern.

---

## 🔌 REST API Summary

| Resource | Endpoints |
|---|---|
| Auth | `POST /api/auth/register` · `/login` · `/admin-login` · `/logout` · `GET /api/auth/me` |
| Users | `GET/PUT /api/users/me` · `GET /api/users` (faculty+admin) |
| Warnings | `GET /api/users/me/warnings/unacknowledged` · `POST /api/users/warnings/:id/acknowledge` |
| Students | `GET/PUT /api/students/me` · `GET/PUT /api/students/me/subjects` |
| Tutors | `GET/PUT /api/tutors/me` · subjects · `GET /api/tutors/:id` |
| Subjects | `GET /api/subjects` · `POST/PUT/DELETE` (admin) |
| Matches | `POST /api/matches/generate` · `GET /api/matches` · `GET /api/matches/:id` |
| Conversations | `GET/POST /api/conversations` · `GET /api/conversations/:id` |
| Messages | `GET/POST /api/conversations/:id/messages` · `DELETE` · unread count |
| Sessions | `GET/POST /api/sessions` · respond · complete · cancel |
| Evaluations | `POST /api/evaluations` · `GET /api/evaluations/mine` |
| Reports | `GET /api/reports/overview` · sessions · tutors · students · user-reports |
| Admin | Users CRUD · subjects · sessions · stats · `POST /api/admin/users/:id/warn` · `/suspend` · `/ban` |
| Activity Logs | `GET /api/activity-logs` (admin) |

All protected endpoints require `Authorization: Bearer <jwt>`.  
All responses use: `{ success: bool, message: string, data: any }`

---

## ⚙️ Matching Algorithm

```
Score = subject(40) + proficiency(20) + course/year(15) + availability(15) + rating(10)
```

Computed per student+subject pair against every available tutor. Results are stored in the `matches` table and returned sorted highest-first with a score breakdown for transparency.

## 📋 Session Workflow

```
Student selects tutor → subject → date/time → request
→ Tutor accepts/rejects
→ Accepted → Tutor marks complete
→ Student evaluates (once per session, feeds tutor rating)
```

Scheduling conflicts (exact, partial, overlapping) are blocked while sessions are `pending` or `accepted`.

---

## 🔒 Security Notes

- Passwords hashed with bcrypt (cost 10) — never stored plain
- JWT HS256 signed; user re-fetched from DB on every protected request
- Role guards enforce access at both route and controller level
- All DB queries use parameterized placeholders (`?`) — zero SQL injection risk
- Admins cannot deactivate/delete their own account — enforced server-side
- Suspend/ban checks run at login time — not just on page load

---

## ⚠️ Known Issues

- Ensure MySQL server (XAMPP / WAMP / Apache MySQL) is running before starting the backend API server.

---

## 🗺 What's Left (Remaining ~4%)

- Payment gateway integration (PayPal / GCash)
- Push / email notifications for session requests and warnings
- Tutor earnings payout flow
- Mobile-responsive polish on a few dense admin tables
