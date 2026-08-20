import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useConfirm } from '../context/ConfirmContext';
import { conversationService, sessionService, userService, evaluationService } from '../services';
import { Spinner, Alert, formatDateTime, EmptyState } from '../components/ui';
import RescheduleModal from '../components/RescheduleModal';

const ONLINE_WINDOW_MS = 3 * 60 * 1000;
const PRESENCE_POLL_MS = 30 * 1000;
const HEARTBEAT_MS = 60 * 1000;

/** "2hrs ago" style relative timestamp. */
function timeAgo(value) {
  if (!value) return '';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}hr${hrs > 1 ? 's' : ''} ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Real presence: when was the other participant last seen active. */
function otherSeenAt(conv, user) {
  if (!conv || !user) return null;
  return conv.student_id === user.id ? conv.tutor_last_seen_at : conv.student_last_seen_at;
}

/** Online only when the other participant's own last-seen is recent. */
function isOnline(conv, user) {
  const seen = otherSeenAt(conv, user);
  if (!seen) return false;
  const t = new Date(seen).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < ONLINE_WINDOW_MS;
}

function initialsOf(name) {
  const parts = String(name || '').split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => (p[0] || '').toUpperCase()).join('') || '?';
}

function MiniAvatar({ name }) {
  return <span className="mini-avatar" aria-hidden="true">{initialsOf(name)}</span>;
}

function OnlineStatus({ online }) {
  return (
    <span className={`mini-status ${online ? 'online' : ''}`}>
      <i className="dot" aria-hidden="true" />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

/** Payment / clearance card rendered inside the conversation thread. */
function PaymentCard({ payment, conv, user, session, onChanged }) {
  const confirm = useConfirm();
  const isTutor = conv.tutor_id === user.id;
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState(null);
  const [rescheduling, setRescheduling] = useState(null);

  const amount = payment.amount ? `₱${Number(payment.amount).toLocaleString()}` : null;

  const accept = async () => {
    const ok = await confirm({
      title: 'Confirm payment?',
      message: `Clear this payment${amount ? ` of ${amount}` : ''}?`,
      confirmText: 'Accept payment'
    });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    const res = await conversationService.acceptPayment(conv.id, payment.id);
    setBusy(false);
    if (res.ok) onChanged();
    else setErr(res.message);
  };

  const reject = async () => {
    const ok = await confirm({
      title: 'Reject payment?',
      message: 'Rejecting lets the student pay again from My Sessions.',
      confirmText: 'Reject',
      danger: true
    });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    const res = await conversationService.rejectPayment(conv.id, payment.id, reason);
    setBusy(false);
    if (res.ok) { setRejecting(false); setReason(''); onChanged(); }
    else setErr(res.message);
  };

  const badge = {
    pending: ['badge-pending', 'Pending'],
    accepted: ['badge-accepted', 'Accepted'],
    rejected: ['badge-rejected', 'Rejected']
  }[payment.status] || ['', payment.status];

  return (
    <div className="msg-row payment-row">
      <div className={`payment-card payment-${payment.status}`}>
        <div className="payment-head">
          <b>
            {payment.status === 'pending'
              ? (isTutor ? 'Payment received from ' + payment.student_name : 'Payment sent')
              : payment.status === 'accepted' ? 'Payment accepted' : 'Payment rejected'}
          </b>
          <span className={`badge ${badge[0]}`}>{badge[1]}</span>
        </div>
        <p className="payment-detail muted small">
          {amount ? <>{amount} · </> : null}
          {payment.reference ? <>{payment.reference} · </> : null}
          {formatDateTime(payment.created_at)}
        </p>
        {payment.status === 'pending' && (
          <p className="payment-note">
            {isTutor
              ? 'Waiting for your confirmation — accept or reject the payment below.'
              : 'Waiting for the tutor to accept the payment.'}
          </p>
        )}
        {payment.status === 'rejected' && payment.reject_reason && (
          <p className="muted small">Reason: {payment.reject_reason}</p>
        )}
        {payment.status === 'rejected' && !isTutor && (
          <p className="payment-note">You can send a new payment from <Link to="/sessions">My Sessions</Link>.</p>
        )}
        {payment.status === 'accepted' && (
          <p className="payment-note">
            Payment cleared — the session is confirmed{session ? '. You can reschedule if needed.' : '.'}
          </p>
        )}
        {err && <Alert type="error">{err}</Alert>}
        {isTutor && payment.status === 'pending' && (
          <div className="row-actions">
            <button className="btn btn-primary btn-sm" onClick={accept} disabled={busy}>Accept</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setRejecting(!rejecting)}>Reject</button>
          </div>
        )}
        {isTutor && payment.status === 'pending' && rejecting && (
          <div className="payment-form">
            <textarea
              rows="2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rejecting (optional)"
              maxLength={300}
            />
            <button className="btn btn-danger btn-sm" onClick={reject} disabled={busy}>Reject payment</button>
          </div>
        )}
        {payment.status === 'accepted' && session && (
          <div className="row-actions">
            <button className="btn btn-outline btn-sm" onClick={() => setRescheduling(session)}>
              Reschedule session
            </button>
          </div>
        )}
        {rescheduling && (
          <RescheduleModal
            session={rescheduling}
            otherUserId={user.id === session.student_id ? session.tutor_id : session.student_id}
            onClose={() => setRescheduling(null)}
            onSent={onChanged}
          />
        )}
      </div>
    </div>
  );
}

/** Right-hand chat panel: header, message list, composer. */
function Thread({ conversationId, onChanged }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [payments, setPayments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [conv, setConv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const endRef = useRef(null);
  const cancelledRef = useRef(false);
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    const [c, m, p] = await Promise.all([
      conversationService.get(conversationId),
      conversationService.getMessages(conversationId),
      conversationService.payments(conversationId)
    ]);
    if (cancelledRef.current) return;
    if (c.ok) setConv(c.data); else setErr(c.message);
    if (m.ok) setMessages(m.data); else setErr(m.message);
    if (p.ok) setPayments(p.data); else setErr(p.message);
    const sres = await sessionService.list();
    if (!cancelledRef.current && sres.ok) setSessions(sres.data);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    cancelledRef.current = false;
    setLoading(true);
    setErr(null);
    load();
    const timer = setInterval(load, PRESENCE_POLL_MS);
    return () => { cancelledRef.current = true; clearInterval(timer); };
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, payments]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const res = await conversationService.sendMessage(conversationId, text.trim());
    setSending(false);
    if (res.ok) {
      setMessages((prev) => [...prev, res.data]);
      setText('');
      onChanged?.();
    } else setErr(res.message);
  };

  const unsend = async (m) => {
    const ok = await confirm({
      title: 'Unsend message?',
      message: 'It will be removed for both of you.',
      confirmText: 'Unsend',
      danger: true
    });
    if (!ok) return;
    const res = await conversationService.deleteMessage(conversationId, m.id);
    if (res.ok) {
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
      onChanged?.();
    } else setErr(res.message);
  };

  const removeConversation = async () => {
    const ok = await confirm({
      title: 'Delete conversation?',
      message: `This conversation will only be deleted on your side. ${otherName || 'The other participant'} will still be able to see it.`,
      confirmText: 'Delete conversation',
      danger: true
    });
    if (!ok) return;
    const res = await conversationService.deleteConversation(conversationId);
    if (res.ok) {
      onChanged?.();
      navigate('/messages');
    } else setErr(res.message);
  };

  const confirmCompletion = async () => {
    if (!session) return;
    const ok = await confirm({
      title: 'Confirm session completed?',
      message: otherConfirmed
        ? `${otherName} already confirmed on their side — confirming will complete the session for both of you.`
        : 'Confirm that this session was completed? It finalizes once the other participant confirms too.',
      confirmText: 'Confirm completed'
    });
    if (!ok) return;
    setCompleting(true);
    const res = await sessionService.confirmComplete(session.id);
    setCompleting(false);
    await load();
    onChanged?.();
    if (!res.ok && res.status !== 409) setErr(res.message);
  };

  const submitEvaluation = async (e) => {
    e.preventDefault();
    if (!session) return;
    const ok = await confirm({
      title: 'Submit evaluation?',
      message: `Submit your ${rating}/5 rating of ${conv ? otherName : 'the tutor'} for this session?`,
      confirmText: 'Submit evaluation'
    });
    if (!ok) return;
    setEvaluating(true);
    const res = await evaluationService.create(session.id, rating, comment);
    setEvaluating(false);
    if (res.ok) {
      setRating(5);
      setComment('');
      await load();
      onChanged?.();
    } else setErr(res.message);
  };

  const entries = useMemo(() => {
    const msgs = messages.map((m) => ({ kind: 'message', ts: new Date(m.created_at).getTime(), key: `m-${m.id}`, item: m }));
    const pays = payments.map((p) => ({ kind: 'payment', ts: new Date(p.created_at).getTime(), key: `p-${p.id}`, item: p }));
    return [...msgs, ...pays].sort((a, b) => a.ts - b.ts);
  }, [messages, payments]);

  if (loading) return <div className="chat-loading"><Spinner /></div>;

const otherName = conv && (conv.student_id === user.id ? conv.tutor_name : conv.student_name);
  const online = isOnline(conv, user);
  const session = (conv && sessions.find((s) => Number(s.conversation_id) === Number(conv.id))) || null;
  const isTutor = !!conv && Number(conv.tutor_id) === Number(user.id);
  const isStudent = !!conv && Number(conv.student_id) === Number(user.id);
  const paid = !!session?.payment_id;
  const iConfirmed = session && (isTutor ? session.tutor_complete_confirmed_at : session.student_complete_confirmed_at);
  const otherConfirmed = session && (isTutor ? session.student_complete_confirmed_at : session.tutor_complete_confirmed_at);
  const canComplete = paid && !!session && session.status === 'accepted';
  const completionRequested = canComplete && otherConfirmed && !iConfirmed;

  return (
    <div className="chat">
      <div className="chat-head">
        <Link className="btn btn-ghost back-link" to="/messages">← Back</Link>
        <MiniAvatar name={otherName} />
        <div className="chat-head-info">
          <div className="chat-head-name">
            {conv && <span className="chat-head-subject truncate">{conv.subject_name}</span>}
            <b className="truncate">
              {otherName ? (
                <span
                  className="msg-item-profile-link"
                  onClick={() => {
                    const to = isTutor ? `/students/${conv.student_id}` : `/tutors/${conv.tutor_id}`;
                    navigate(to);
                  }}
                >
                  {otherName}
                </span>
              ) : 'Conversation'}
            </b>
          </div>
          <OnlineStatus online={online} />
        </div>
        <div className="chat-head-actions" ref={menuRef}>
          <button
            type="button"
            className={`chat-menu-btn ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            title="Conversation settings"
            aria-label="Conversation settings"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="12" cy="19" r="1.8" />
            </svg>
          </button>
          {menuOpen && (
            <div className="chat-menu" role="menu">
              {canComplete && (
                <button
                  type="button"
                  role="menuitem"
                  className="chat-menu-item"
                  onClick={() => { setMenuOpen(false); confirmCompletion(); }}
                  disabled={completing || (iConfirmed && !otherConfirmed)}
                >
                  {iConfirmed && !otherConfirmed
                    ? `Waiting for ${otherName} to confirm…`
                    : (completionRequested ? 'Confirm session completed' : 'Request to mark the session as done')}
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className="chat-menu-item chat-menu-item--danger"
                onClick={() => { setMenuOpen(false); removeConversation(); }}
              >
                Delete conversation
              </button>
            </div>
          )}
        </div>
      </div>
      {err && <Alert type="error">{err}</Alert>}
      <div className="chat-body">
        {completionRequested && (
          <div className="msg-complete-request">
            <b>{otherName} has confirmed this session is completed</b>
            <p className="muted small">Accept on your side to finalize the session for both of you.</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={confirmCompletion}
              disabled={completing}
            >
              {completing ? 'Confirming…' : 'Confirm completed'}
            </button>
          </div>
        )}
        {session?.status === 'completed' && isStudent && session.evaluation_id == null && (
          <div className="msg-complete-eval">
            <b>Session completed — rate your tutor</b>
            <p className="muted small">Your rating appears on the tutor's profile.</p>
            <form className="msg-complete-eval-form" onSubmit={submitEvaluation}>
              <div className="rating-picker">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    type="button"
                    key={n}
                    className={`star-btn ${n <= rating ? 'on' : ''}`}
                    onClick={() => setRating(n)}
                    aria-label={`${n} star${n === 1 ? '' : 's'}`}
                  >
                    ★
                  </button>
                ))}
                <span className="muted small">{rating}/5</span>
              </div>
              <textarea
                rows="2"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="How was the session?"
                maxLength={2000}
              />
              <button className="btn btn-primary btn-sm" disabled={evaluating}>
                {evaluating ? 'Submitting…' : 'Submit rating'}
              </button>
            </form>
          </div>
        )}
        {session?.status === 'completed' && (
          (isStudent && session.evaluation_id != null) || isTutor
        ) && (
          <div className="msg-complete-banner">
            <b>✓ Session completed</b>
            {session.evaluation_id != null ? (
              <span className="muted small"> — rated {Number(session.evaluation_rating).toFixed(1)}/5{isStudent ? ' — thank you!' : ' by the student'}</span>
            ) : (
              <span className="muted small"> — waiting for the student's evaluation</span>
            )}
          </div>
        )}
        {messages.length === 0 && <p className="muted center">No messages yet — say hello!</p>}
        {payments.length === 0 && (
          <div className="payment-hint">
            {user.role_key === 'student' ? (
              <span>Pay for the session in <Link to="/sessions">My Sessions</Link> — the payment will appear here for the tutor to confirm.</span>
            ) : session ? (
              <span>When the student pays for the session, the payment will appear here for you to confirm.</span>
            ) : (
              <span>No session is linked to this conversation yet.</span>
            )}
          </div>
        )}
        {entries.map((e) => (
          e.kind === 'message' ? (
            e.item.is_system ? (
              <div key={e.key} className="msg-system">
                <span className="msg-system-text">{e.item.body}</span>
                <span className="muted small">{formatDateTime(e.item.created_at)}</span>
              </div>
            ) : (
              <div key={e.key} className={`msg-row ${e.item.sender_id === user.id ? 'mine' : ''}`}>
                <div className={`bubble ${e.item.sender_id === user.id ? 'mine' : ''}`}>
                  <div className="bubble-meta">
                    <span className="muted small">{e.item.sender_id === user.id ? 'You' : e.item.sender_name} · {formatDateTime(e.item.created_at)}</span>
                    {e.item.sender_id === user.id && (
                      <button type="button" className="unsend-btn" onClick={() => unsend(e.item)} title="Unsend message">Unsend</button>
                    )}
                  </div>
                  <p>{e.item.body}</p>
                </div>
              </div>
            )
          ) : (
            <PaymentCard
              key={e.key}
              payment={e.item}
              conv={conv}
              user={user}
              session={session}
              onChanged={load}
            />
          )
        ))}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={send}>
        <button type="button" className="mic-btn" title="Voice message" aria-label="Voice message">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your messages..."
          maxLength={5000}
        />
        <button className="send-btn" disabled={sending || !text.trim()}>{sending ? 'Sending…' : 'Send'}</button>
      </form>
    </div>
  );
}

export default function Messages() {
  const { id } = useParams();
  const { user } = useAuth();
  const convos = useApi(conversationService.list);
  const [lastKey, setLastKey] = useState(id);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (id !== lastKey) {
      setLastKey(id);
      convos.reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    userService.heartbeat();
    const hb = setInterval(() => userService.heartbeat(), HEARTBEAT_MS);
    const poll = setInterval(() => convos.reload(), PRESENCE_POLL_MS);
    const onVisibility = () => {
      if (!document.hidden) {
        userService.heartbeat();
        convos.reload();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(hb);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const list = convos.data || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const other = c.student_id === user.id ? c.tutor_name : c.student_name;
      return (other || '').toLowerCase().includes(q) || (c.subject_name || '').toLowerCase().includes(q);
    });
  }, [convos.data, query, user]);

  return (
    <div className={`msg-app ${id ? 'has-thread' : ''}`}>
      <aside className="msg-list-panel">
        <div className="msg-search">
          <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Messages..."
            aria-label="Search messages"
          />
        </div>
        <div className="msg-list">
          {convos.loading && <Spinner />}
          {convos.error && <Alert type="error">{convos.error.message}</Alert>}
          {!convos.loading && !convos.error && (convos.data?.length === 0) && (
            <div className="msg-list-empty">
              <EmptyState
                title="No conversations yet"
                description="Find a tutor match and send your first message."
                action={<Link className="btn btn-primary" to={user.role_key === 'student' ? '/matches' : '/dashboard'}>Find Tutors</Link>}
              />
            </div>
          )}
          {!convos.loading && !convos.error && convos.data?.length > 0 && filtered.length === 0 && (
            <p className="muted center msg-no-results">No conversations match your search.</p>
          )}
          {filtered.map((c) => {
            const active = String(c.id) === String(id);
            const other = c.student_id === user.id ? c.tutor_name : c.student_name;
            const otherProfile = c.student_id === user.id ? `/tutors/${c.tutor_id}` : `/students/${c.student_id}`;
            return (
              <Link key={c.id} to={`/messages/${c.id}`} className={`msg-item ${active ? 'active' : ''}`}>
                <MiniAvatar name={other} />
                <div className="msg-item-main">
                  <div className="msg-item-top">
                    <b className="msg-item-name">
                      {c.subject_name && <span className="msg-item-subject truncate">{c.subject_name}</span>}
                      <span
                        className="msg-item-profile-link truncate"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(otherProfile);
                        }}
                      >
                        {other}
                      </span>
                    </b>
                    <OnlineStatus online={isOnline(c, user)} />
                    <span className="msg-time">{timeAgo(c.updated_at)}</span>
                  </div>
                  <div className="msg-item-bottom">
                    <span className="msg-preview truncate">{c.last_message || 'No messages yet'}</span>
                    {c.unread_count > 0 && <span className="badge badge-pending msg-unread">{c.unread_count}</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </aside>
      <section className="msg-chat-panel">
        {id ? (
          <Thread conversationId={id} onChanged={convos.reload} />
        ) : (
          <div className="chat-placeholder">
            <div className="placeholder-icon" aria-hidden="true">✉</div>
            <h3>Select a conversation</h3>
            <p className="muted">Pick a conversation from the list to start chatting.</p>
          </div>
        )}
      </section>
    </div>
  );
}