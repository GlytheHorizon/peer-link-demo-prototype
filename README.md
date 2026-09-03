# PeerLink — Static Demo (Vercel, No Database)

> A **frontend-only visual demo** of the PeerLink peer-tutoring platform.
> No backend, no database, no emails — every screen runs on **sample/mock data**
> served in the browser (`frontend/src/demo/`).

When the site loads you'll see a **"Static demo version" popup** explaining this.
**Forgot Password / Reset Password are visual only** — no email is ever sent.

---

## Demo accounts (all work — click any row on the Login page to autofill)

| Role | Email | Password |
|---|---|---|
| Student | `student@peerlink.edu` | `Student@123` |
| Tutor | `maria@peerlink.edu` | `Tutor@123` |
| Tutor | `gerome@peerlink.edu` | `Tutor@123` |
| Tutor | `kiel@peerlink.edu` | `Tutor@123` |
| Faculty | `faculty@peerlink.edu` | `Faculty@123` |
| Admin | `admin@peerlink.edu` | `Admin@123` |

Login, register, matching, sessions, messages, admin pages and reports all work
with sample data. Anything you change is stored in `localStorage` (this browser
only) and nothing is really saved or sent.

## Deploy on Vercel (ready to go)

This branch is pre-configured — just point Vercel at it:

1. **Add New Project** → import this repo → select branch **`static-demo`**.
2. Vercel auto-detects `vercel.json`:
   - Build: `cd frontend && npm install && npm run build`
   - Output: `frontend/dist`
   - All routes rewrite to `/index.html` (SPA).
3. No environment variables needed. Hit **Deploy**.

## Run locally

```bat
cd frontend
npm install
npm run dev
```

`npm run dev` uses the live-backend code path (needs the API on `:5000`,
available on the `main` branch). The static mock is active only in production
builds via `frontend/.env.production` (`VITE_STATIC_DEMO=true`); preview it with:

```bat
cd frontend
npm run build
npm run preview
```

## What's inside

```
vercel.json                    Vercel build/output/SPA-rewrite config
frontend/
  .env.production              VITE_STATIC_DEMO=true (production builds only)
  src/demo/
    staticMode.js              isStaticDemo() flag
    demoData.js                sample users, subjects, tutors, sessions, messages
    mockApi.js                 intercepts every /api/* call — no backend needed
  src/components/
    StaticDemoNotice.jsx       "Static demo" popup modal + banner
  src/services/api.js          delegates to mockApi when VITE_STATIC_DEMO=true
  src/pages/ForgotPassword.jsx visual-only flow + "visual representation" popup
  src/pages/ResetPassword.jsx  visual-only flow + "visual representation" popup
```

> Full-stack source (Node + Express + MySQL) lives on the **`main`** branch.
> This `static-demo` branch is frontend-only by design.
