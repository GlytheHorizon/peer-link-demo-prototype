import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { conversationService } from '../services';

const NAV = {
  student: [
    { to: '/dashboard', label: 'Dashboard', icon: '▤' },
    { to: '/profile', label: 'Profile', icon: '✎' },
    { to: '/subjects', label: 'Subjects', icon: '☰' },
    { to: '/matches', label: 'Find Tutors', icon: '⌖' },
    { to: '/messages', label: 'Messages', icon: '✉' },
    { to: '/sessions', label: 'My Sessions', icon: '◷' }
  ],
  tutor: [
    { to: '/dashboard', label: 'Dashboard', icon: '▤' },
    { to: '/profile', label: 'Profile', icon: '✎' },
    { to: '/subjects', label: 'Subjects I Teach', icon: '☰' },
    { to: '/messages', label: 'Messages', icon: '✉' },
    { to: '/sessions', label: 'My Sessions', icon: '◷' }
  ],
  faculty: [
    { to: '/dashboard', label: 'Dashboard', icon: '▤' },
    { to: '/reports', label: 'Reports', icon: '◫' }
  ],
  admin: [
    { to: '/dashboard', label: 'Dashboard', icon: '▤' },
    { to: '/admin/users', label: 'User Management', icon: '☻' },
    { to: '/admin/subjects', label: 'Subjects', icon: '☰' },
    { to: '/reports', label: 'Reports', icon: '◫' },
    { to: '/admin/logs', label: 'Activity Logs', icon: '☷' }
  ]
};

export default function DashboardLayout({ children }) {
  const { user, logout, roleLabel } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const refreshUnread = () => {
    conversationService.unreadCount().then((res) => {
      if (res.ok) setUnread(res.data.unread || 0);
    });
  };

  useEffect(() => {
    refreshUnread();
    const t = setInterval(refreshUnread, 30000);
    return () => clearInterval(t);
  }, []);

  const items = NAV[user?.role_key] || NAV.student;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand-side">
          <span className="logo-dot" /> PeerLink
        </div>
        <nav>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.to === '/messages' && unread > 0 && <span className="nav-unread">{unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p className="muted">{user ? `${user.first_name} ${user.last_name}` : ''}</p>
          <p className="muted small">{roleLabel}</p>
          <button className="btn btn-ghost btn-block" onClick={handleLogout}>Log out</button>
        </div>
      </aside>
      <div className="main-col">
        <header className="topbar">
          <button className="btn btn-ghost burger" onClick={() => setOpen(!open)}>☰</button>
          <span className="topbar-title">PeerLink</span>
          <span className="topbar-user muted">{user ? `${user.first_name} ${user.last_name}` : ''}</span>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}