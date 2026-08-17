import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute, { GuestRoute } from './routes/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import RoleDashboard from './pages/RoleDashboard';
import Profile from './pages/Profile';
import Subjects from './pages/Subjects';
import MatchingResults from './pages/MatchingResults';
import TutorProfile from './pages/TutorProfile';
import Messages from './pages/Messages';
import ScheduleSession from './pages/ScheduleSession';
import Sessions from './pages/Sessions';
import SessionDetails from './pages/SessionDetails';
import Reports from './pages/Reports';
import UserManagement from './pages/UserManagement';
import SubjectManagement from './pages/SubjectManagement';
import ActivityLogs from './pages/ActivityLogs';

const shell = (roles, page) => (
  <ProtectedRoute roles={roles}>
    <DashboardLayout>{page}</DashboardLayout>
  </ProtectedRoute>
);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

      <Route path="/dashboard" element={shell(null, <RoleDashboard />)} />

      <Route path="/profile" element={shell(null, <Profile />)} />
      <Route path="/subjects" element={shell(null, <Subjects />)} />

      <Route path="/matches" element={shell(['student'], <MatchingResults />)} />
      <Route path="/tutors/:id" element={shell(null, <TutorProfile />)} />

      <Route path="/messages" element={shell(['student', 'tutor'], <Messages />)} />
      <Route path="/messages/:id" element={shell(['student', 'tutor'], <Messages thread />)} />

      <Route path="/sessions" element={shell(['student', 'tutor'], <Sessions />)} />
      <Route path="/sessions/new" element={shell(['student'], <ScheduleSession />)} />
      <Route path="/sessions/:id" element={shell(['student', 'tutor'], <SessionDetails />)} />

      <Route path="/reports" element={shell(['faculty', 'admin'], <Reports />)} />
      <Route path="/admin/users" element={shell(['admin'], <UserManagement />)} />
      <Route path="/admin/subjects" element={shell(['admin'], <SubjectManagement />)} />
      <Route path="/admin/logs" element={shell(['admin'], <ActivityLogs />)} />

      <Route path="*" element={<Landing />} />
    </Routes>
  );
}