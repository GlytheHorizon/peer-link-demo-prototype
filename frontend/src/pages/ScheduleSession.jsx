import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { subjectService, sessionService, matchService, tutorService } from '../services';
import { Spinner, Alert } from '../components/ui';

const pad = (n) => String(n).padStart(2, '0');

const fmtDate = (d) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}`;
const fmtTime = (d) => {
  const h24 = d.getHours();
  const ap = h24 >= 12 ? 'PM' : 'AM';
  return `${h24 % 12 || 12}:${pad(d.getMinutes())}${ap}`;
};
const fmtRange = (startIso, endIso) => {
  const s = new Date(startIso);
  const e = new Date(endIso);
  return `${fmtDate(s)} – ${fmtTime(s)} – ${fmtTime(e)}`;
};

function nextFreeSlot(mine, offsetHours = 1, maxSlots = 96) {
  const occupied = (mine || []).filter(
    (s) => s.status === 'pending' || s.status === 'accepted'
  );
  for (let i = 0; i < maxSlots; i++) {
    const start = new Date(Date.now() + (offsetHours + i) * 3600000);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    const clashes = occupied.some((s) => {
      const s1 = new Date(s.scheduled_start).getTime();
      const e1 = new Date(s.scheduled_end).getTime();
      return start.getTime() < e1 && end.getTime() > s1;
    });
    if (!clashes) return { start, end };
  }
  const start = new Date(Date.now() + (offsetHours + maxSlots) * 3600000);
  start.setMinutes(0, 0, 0);
  return { start, end: new Date(start.getTime() + 3600000) };
}

export default function ScheduleSession() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const autoTutor = params.get('tutor');
  const autoSubject = params.get('subject');

  const subjects = useApi(subjectService.list);
  const requests = useApi(sessionService.list);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);
  const firedKey = useRef('');

  const pending = (requests.data || []).filter((s) => s.status === 'pending');

  useEffect(() => {
    if (!autoTutor || !autoSubject) return;
    const key = `${autoTutor}:${autoSubject}`;
    if (firedKey.current === key) return;
    firedKey.current = key;
    let cancelled = false;
    const idParam = Number(autoTutor);
    const subjectId = Number(autoSubject);

    (async () => {
      setSending(true);
      setErr(null);

      let uid = Number.isNaN(idParam) ? null : idParam;
      let name = 'this tutor';

      const match = await matchService.list(autoSubject);
      const found = (match?.data || []).find(
        (m) => m.tutor_profile_id === idParam || m.tutor_user_id === idParam
      );
      if (found) {
        uid = Number(found.tutor_user_id);
        name = found.tutor_name;
      } else if (!Number.isNaN(idParam)) {
        const pub = await tutorService.getPublic(idParam);
        if (pub.ok) {
          const p = pub.data || {};
          name = p.tutor_name || p.full_name || p.name || name;
        }
      }

      if (uid == null || Number.isNaN(uid)) {
        if (!cancelled) {
          setErr('Could not identify the tutor — go back to Find Tutors and try again.');
          setSending(false);
        }
        return;
      }

      const mine = await sessionService.list();
      const dup = (mine.data || []).find(
        (s) => Number(s.tutor_id) === uid && Number(s.subject_id) === subjectId && s.status === 'pending'
      );
      if (dup) {
        if (!cancelled) navigate('/sessions');
        return;
      }

      const slot = nextFreeSlot(mine.data);
      const res = await sessionService.create({
        tutor_id: uid,
        subject_id: subjectId,
        scheduled_start: slot.start.toISOString(),
        scheduled_end: slot.end.toISOString()
      });
      if (cancelled) return;
      if (res.ok) {
        setSending(false);
        navigate('/sessions', { state: { note: `Session request sent to ${name} — you'll pick the date and time when you pay.` } });
      } else {
        setSending(false);
        setErr(res.message);
      }
    })();

    return () => { cancelled = true; };
  }, [autoTutor, autoSubject]);

  const subjectName = autoSubject
    ? subjects.data?.find((s) => s.id === Number(autoSubject))?.name
    : null;

  return (
    <div>
      <h2 className="tm-title">Request Session</h2>
      {err && <Alert type="error">{err}</Alert>}

      <div className="request-panel">
        {requests.loading ? (
          <Spinner />
        ) : pending.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            You have no pending session requests.
          </p>
        ) : (
          pending.map((s) => (
            <div className="request-row" key={s.id}>
              <div className="request-row-main">
                <b>{s.tutor_name}</b>
                <span className="muted small">{fmtRange(s.scheduled_start, s.scheduled_end)}</span>
              </div>
              <span className="req-status">Pending Approval</span>
            </div>
          ))
        )}
      </div>

      {sending && (
        <div className="card">
          <Spinner label={autoSubject && subjectName ? `Sending your request for ${subjectName}…` : 'Sending your request…'} />
          <p className="muted small" style={{ marginTop: 10, marginBottom: 0 }}>
            No form needed — after the tutor confirms, you'll pick the exact date and time when you pay.
          </p>
        </div>
      )}

      {!autoTutor && !sending && (
        <div className="card">
          <p className="muted">
            Pick a tutor on the <Link to="/matches">Find Tutors</Link> page or on a tutor's profile to request a session.
          </p>
          <div className="row-actions">
            <Link className="btn btn-primary" to="/matches">Find Tutors</Link>
            <Link className="btn btn-ghost" to="/sessions">Back to sessions</Link>
          </div>
        </div>
      )}
    </div>
  );
}