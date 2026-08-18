import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { conversationService } from '../services';

const NAV = {
  student: [
    { to: '/dashboard', label: 'Dashboard', icon: '▤' },
    { to: '/matches', label: 'Find Tutor', icon: '⌖' },
    { to: '/sessions', label: 'My Sessions', icon: '◷' },
    { to: '/messages', label: 'Messages', icon: '✉' },
    { to: '/resources', label: 'Resources', icon: '☷' },
    { to: '/calendar', label: 'Calendar', icon: '▦' },
    { to: '/payment', label: 'Payment', icon: '¤' },
    { to: '/profile', label: 'Profile', icon: '✎' }
  ],
  tutor: [
    { to: '/dashboard', label: 'Dashboard', icon: '▤' },
    { to: '/profile', label: 'Profile', icon: '✎' },
    { to: '/subjects', label: 'Subjects I Teach', icon: '☰' },
    { to: '/messages', label: 'Messages', icon: '✉' },
    { to: '/sessions', label: 'My Sessions', icon: '◷' },
    { to: '/calendar', label: 'Calendar', icon: '▦' }
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

function LogoNode() {
  return (
    <svg className="logo-node" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <line x1="13" y1="5" x2="6" y2="19" stroke="#c9d2e8" strokeWidth="2" />
      <line x1="13" y1="5" x2="21" y2="19" stroke="#c9d2e8" strokeWidth="2" />
      <line x1="6" y1="19" x2="21" y2="19" stroke="#c9d2e8" strokeWidth="2" />
      <circle cx="13" cy="5" r="4" fill="#4361ee" />
      <circle cx="13" cy="3.6" r="1.5" fill="#7c93f5" />
      <circle cx="6" cy="21" r="4" fill="#22c55e" />
      <circle cx="6" cy="19.6" r="1.5" fill="#6ee7a7" />
      <circle cx="21" cy="21" r="4" fill="#f59e0b" />
      <circle cx="21" cy="19.6" r="1.5" fill="#fcd34d" />
    </svg>
  );
}

export default function DashboardLayout({ children }) {
  const { user, logout, roleLabel } = useAuth();
  const confirm = useConfirm();
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
    const ok = await confirm({
      title: 'Log out?',
      message: `Are you sure you want to log out of PeerLink${user ? `, ${user.first_name}` : ''}?`,
      confirmText: 'Log out',
      cancelText: 'Stay logged in',
      danger: true
    });
    if (!ok) return;
    await logout();
    navigate('/');
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand-side">
          <LogoNode />
          <span>PeerLink</span>
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
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </aside>
      <div className="main-col">
        <header className="topbar">
          <button className="btn btn-ghost burger" onClick={() => setOpen(!open)}>☰</button>
          <span className="topbar-title">PeerLink</span>
          <span className="topbar-user">
            {user ? `${user.first_name} ${user.last_name}` : ''}
            {roleLabel && <span className="role-tag">{roleLabel}</span>}
          </span>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}