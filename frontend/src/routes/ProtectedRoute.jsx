import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui';

/** Guards routes: requires authentication and optionally one of the roles. */
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session…" />;
  if (!user) {
    const target = roles && roles.includes('admin') ? '/admin/login' : '/login';
    return <Navigate to={target} state={{ from: location.pathname }} replace />;
  }
  if (roles && !roles.includes(user.role_key)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

/** Redirects authenticated users away from auth pages. */
export function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading…" />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}