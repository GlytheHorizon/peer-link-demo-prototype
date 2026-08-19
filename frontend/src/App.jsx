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
import StudentProfile from './pages/StudentProfile';
import Messages from './pages/Messages';
import ScheduleSession from './pages/ScheduleSession';
import Sessions from './pages/Sessions';
import SessionDetails from './pages/SessionDetails';
import Payment from './pages/Payment';
import Reports from './pages/Reports';
import UserManagement from './pages/UserManagement';
import SubjectManagement from './pages/SubjectManagement';
import ActivityLogs from './pages/ActivityLogs';
import Resources from './pages/Resources';
import ComingSoon from './pages/ComingSoon';
import Calendar from './pages/Calendar';
import MyStudents from './pages/MyStudents';
import Earnings from './pages/Earnings';
import Verification from './pages/Verification';

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
      <Route path="/students/:id" element={shell(['student', 'tutor'], <StudentProfile />)} />

      <Route path="/messages" element={shell(['student', 'tutor'], <Messages />)} />
      <Route path="/messages/:id" element={shell(['student', 'tutor'], <Messages />)} />

      <Route path="/sessions" element={shell(['student', 'tutor'], <Sessions />)} />
      <Route path="/sessions/new" element={shell(['student'], <ScheduleSession />)} />
      <Route path="/sessions/:id" element={shell(['student', 'tutor'], <SessionDetails />)} />

      <Route path="/reports" element={shell(['faculty', 'admin'], <Reports />)} />
      <Route path="/admin/users" element={shell(['admin'], <UserManagement />)} />
      <Route path="/admin/subjects" element={shell(['admin'], <SubjectManagement />)} />
      <Route path="/admin/logs" element={shell(['admin'], <ActivityLogs />)} />

      <Route path="/resources" element={shell(null, <Resources />)} />
      <Route path="/calendar" element={shell(['student', 'tutor'], <Calendar />)} />
      <Route path="/payment" element={shell(['student'], <Payment />)} />

      <Route path="/students" element={shell(['tutor'], <MyStudents />)} />
      <Route path="/earnings" element={shell(['tutor'], <Earnings />)} />
      <Route path="/verification" element={shell(['tutor'], <Verification />)} />

      <Route path="*" element={<Landing />} />
    </Routes>
  );
}