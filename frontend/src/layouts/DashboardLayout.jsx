import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { conversationService, tabUpdateService } from '../services';

const SEEN_PREFIX = 'peerlink_tab_seen';

const getSeen = (uid) => {
  try { return JSON.parse(localStorage.getItem(`${SEEN_PREFIX}_${uid}`) || '{}'); }
  catch { return {}; }
};

const saveSeen = (uid, map) => {
  try { localStorage.setItem(`${SEEN_PREFIX}_${uid}`, JSON.stringify(map)); } catch {}
};

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
    { to: '/students', label: 'My Student', icon: '☻' },
    { to: '/sessions', label: 'Sessions', icon: '◷' },
    { to: '/messages', label: 'Messages', icon: '✉' },
    { to: '/resources', label: 'Resources', icon: '☷' },
    { to: '/calendar', label: 'Calendar', icon: '▦' },
    { to: '/earnings', label: 'Earnings', icon: '¤' },
    { to: '/profile', label: 'Profile', icon: '✎' },
    { to: '/verification', label: 'Verification', icon: '✓' }
  ],
  faculty: [
    { to: '/dashboard', label: 'Dashboard', icon: '▤' },
    { to: '/reports', label: 'Reports', icon: '◫' }
  ],
  admin: [
    { to: '/admin/verifications', label: 'Tutor Verifications', icon: '✓' },
    { to: '/admin/users', label: 'User Management', icon: '☻' },
    { to: '/admin/sessions', label: 'Manage Session', icon: '◷' },
    { to: '/reports', label: 'Reports', icon: '◫' },
    { to: '/profile', label: 'Profile', icon: '✎' }
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
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [tabUpdates, setTabUpdates] = useState({});
  const [open, setOpen] = useState(false);

  const refreshUnread = () => {
    conversationService.unreadCount().then((res) => {
      if (res.ok) setUnread(res.data.unread || 0);
    });
  };

  const refreshTabUpdates = () => {
    tabUpdateService.latest().then((res) => {
      if (!res.ok) return;
      const tabs = res.data.tabs || {};
      setTabUpdates(tabs);
      const uid = user?.id;
      if (!uid) return;
      const seen = getSeen(uid);
      if (!seen._init) {
        const init = { _init: true };
        for (const [k, v] of Object.entries(tabs)) init[k] = v;
        saveSeen(uid, init);
      }
    });
  };

  useEffect(() => {
    refreshUnread();
    refreshTabUpdates();
    const t = setInterval(() => {
      refreshUnread();
      refreshTabUpdates();
    }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Visiting a tab counts as "seen" — its red dot goes away.
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    const seen = getSeen(uid);
    if (!seen._init) return;
    seen[location.pathname] = tabUpdates[location.pathname] || new Date().toISOString();
    saveSeen(uid, seen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, tabUpdates, user?.id]);

  const isNew = (key) => {
    const latest = tabUpdates[key];
    if (!latest) return false;
    const seen = getSeen(user?.id);
    const seenTs = seen[key];
    return !seenTs || new Date(latest).getTime() > new Date(seenTs).getTime();
  };

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
              {item.to !== '/messages' && isNew(item.to) && <span className="nav-dot" aria-label="New updates" />}
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