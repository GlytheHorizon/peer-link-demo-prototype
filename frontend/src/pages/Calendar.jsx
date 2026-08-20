import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { sessionService } from '../services';
import { Spinner, Alert } from '../components/ui';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const fmtTime12 = (iso) => {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${h}:${pad(d.getMinutes())}${ampm}`;
};

const fmtDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

export default function Calendar() {
  const { user } = useAuth();
  const sessions = useApi(sessionService.list, [], 30000);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState(dateKey(today));

  const all = sessions.data || [];
  const isTutor = user?.role_key === 'tutor';

  const upcoming = useMemo(
    () => all.filter(
      (s) => (s.status === 'pending' || s.status === 'accepted') && new Date(s.scheduled_start) > new Date()
    ),
    [all]
  );

  const byDate = useMemo(() => {
    const map = {};
    for (const s of upcoming) {
      const k = dateKey(new Date(s.scheduled_start));
      (map[k] = map[k] || []).push(s);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start));
    }
    return map;
  }, [upcoming]);

  const cells = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const lead = new Date(viewYear, viewMonth, 1).getDay();
    const out = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(viewYear, viewMonth, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewYear, viewMonth]);

  const monthLabel = new Date(viewYear, viewMonth, 1)
    .toLocaleString('en-US', { month: 'long', year: 'numeric' })
    .toUpperCase();

  const selectedSessions = selected ? byDate[selected] || [] : [];

  const goToMonth = (delta) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const selectDate = (date) => {
    setSelected(dateKey(date));
  };

  return (
    <div>
      <div className="page-head">
        <h2>Calendar</h2>
      </div>

      {sessions.loading && <Spinner />}
      {sessions.error && <Alert type="error">{sessions.error.message}</Alert>}

      <div className="calendar-layout">
        <section className="calendar-panel">
          <div className="calendar-head">
            <h3 className="calendar-month">{monthLabel}</h3>
            <div className="calendar-nav">
              <button type="button" className="calendar-nav-btn" onClick={() => goToMonth(-1)} aria-label="Previous month">‹</button>
              <button type="button" className="calendar-nav-btn" onClick={() => goToMonth(1)} aria-label="Next month">›</button>
            </div>
          </div>

          <div className="calendar-grid">
            {WEEKDAYS.map((w) => (
              <div className="calendar-weekday" key={w}>{w}</div>
            ))}
            {cells.map((date, i) => {
              if (!date) return <div className="calendar-day blank" key={`blank-${i}`} />;
              const key = dateKey(date);
              const isToday = key === dateKey(today);
              const isSelected = key === selected;
              const hasSessions = !!byDate[key]?.length;
              return (
                <button
                  type="button"
                  key={key}
                  className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => selectDate(date)}
                >
                  <span className="day-num">{date.getDate()}</span>
                  {hasSessions && <span className="calendar-dot" />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="sessions-panel">
          <h3 className="sessions-panel-title">Upcoming Session</h3>
          {!selected ? (
            <p className="sessions-panel-date">Select a date to view your sessions</p>
          ) : (
            <p className="sessions-panel-date">{fmtDate(selected)}</p>
          )}

          {selectedSessions.length === 0 ? (
            <div className="calendar-empty">
              No sessions scheduled for this date.
            </div>
          ) : (
            <div className="calendar-session-list">
              {selectedSessions.map((s) => (
                <Link className="calendar-session-card" key={s.id} to={`/sessions/${s.id}`}>
                  <div className="calendar-session-main">
                    <span className="calendar-session-name">{s.subject_name} Tutoring Session</span>
                    <span className="calendar-session-subject">{s.subject_name}</span>
                  </div>
                  <span className="calendar-session-time">
                    {fmtTime12(s.scheduled_start)}
                    <span className="calendar-session-with">
                      with {isTutor ? s.student_name : s.tutor_name}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
