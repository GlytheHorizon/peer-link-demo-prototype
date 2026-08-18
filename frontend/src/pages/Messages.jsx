import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useConfirm } from '../context/ConfirmContext';
import { conversationService, userService } from '../services';
import { Spinner, Alert, formatDateTime, EmptyState } from '../components/ui';

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

/** Payment / clearance box shown above the composer. */
function PaymentBox({ conversationId, conv, user }) {
  const confirm = useConfirm();
  const isTutor = conv.tutor_id === user.id || user.role_key === 'tutor';
  const isStudent = user.role_key === 'student';
  const [payments, setPayments] = useState([]);
  const [err, setErr] = useState(null);
  const [paying, setPaying] = useState(false);
  const [form, setForm] = useState({ amount: '', reference: '' });
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const load = async () => {
    const res = await conversationService.payments(conversationId);
    if (res.ok) setPayments(res.data);
    else setErr(res.message);
  };

  useEffect(() => { load(); }, [conversationId]);

  const latest = payments[0] || null;

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await conversationService.pay(conversationId, {
      amount: form.amount,
      reference: form.reference
    });
    setBusy(false);
    if (res.ok) {
      setForm({ amount: '', reference: '' });
      setPaying(false);
      load();
    } else setErr(res.message);
  };

  const accept = async () => {
    const ok = await confirm({
      title: 'Confirm payment?',
      message: `Clear this payment${latest.amount ? ` of ₱${latest.amount}` : ''}?`,
      confirmText: 'Accept payment'
    });
    if (!ok) return;
    setBusy(true);
    const res = await conversationService.acceptPayment(conversationId, latest.id);
    setBusy(false);
    if (res.ok) load();
    else setErr(res.message);
  };

  const reject = async () => {
    const ok = await confirm({
      title: 'Reject payment?',
      message: 'Rejecting lets the student send a new payment.',
      confirmText: 'Reject',
      danger: true
    });
    if (!ok) return;
    setBusy(true);
    const res = await conversationService.rejectPayment(conversationId, latest.id, reason);
    setBusy(false);
    if (res.ok) { setRejecting(false); setReason(''); load(); }
    else setErr(res.message);
  };

  const summary = (p) => (
    <span className="muted small">
      {p.amount ? <>₱{p.amount} · </> : null}{p.reference ? `${p.reference} · ` : ''}{formatDateTime(p.created_at)}
    </span>
  );

  let body;
  if (!latest || latest.status === 'rejected') {
    body = (
      <>
        <div className="payment-head">
          <b>{latest ? 'Payment rejected' : 'Send payment for clearance'}</b>
          {latest && <span className="badge badge-rejected">Rejected</span>}
        </div>
        {latest && latest.reject_reason && <p className="muted small">Reason: {latest.reject_reason}</p>}
        {latest && summary(latest)}
        {isStudent && !paying && (
          <div className="row-actions">
            <button className="btn btn-outline btn-sm" onClick={() => setPaying(true)}>
              {latest ? 'Make payment again' : 'I have paid'}
            </button>
          </div>
        )}
        {isStudent && paying && (
          <form className="payment-form" onSubmit={send}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Amount (optional)"
            />
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="Reference / proof (e.g. GCash ref)"
              maxLength={150}
            />
            <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Sending…' : 'Send payment'}</button>
          </form>
        )}
      </>
    );
  } else if (latest.status === 'pending') {
    body = (
      <>
        <div className="payment-head">
          <b>{isTutor ? 'Payment awaiting your confirmation' : 'Payment sent — waiting for the tutor'}</b>
          <span className="badge badge-pending">Pending</span>
        </div>
        {summary(latest)}
        {isTutor && (
          <div className="row-actions">
            <button className="btn btn-primary btn-sm" onClick={accept} disabled={busy}>Accept</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setRejecting(!rejecting)}>Reject</button>
          </div>
        )}
        {isTutor && rejecting && (
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
      </>
    );
  } else {
    body = (
      <>
        <div className="payment-head">
          <b>Payment cleared</b>
          <span className="badge badge-completed">Accepted</span>
        </div>
        {summary(latest)}
      </>
    );
  }

  return (
    <div className={`payment-box payment-${latest ? latest.status : 'none'}`}>
      {err && <Alert type="error">{err}</Alert>}
      {body}
    </div>
  );
}

/** Right-hand chat panel: header, message list, payment box, composer. */
function Thread({ conversationId, onChanged }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [conv, setConv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [c, m] = await Promise.all([
        conversationService.get(conversationId),
        conversationService.getMessages(conversationId)
      ]);
      if (cancelled) return;
      if (c.ok) setConv(c.data); else setErr(c.message);
      if (m.ok) setMessages(m.data); else setErr(m.message);
      setLoading(false);
    };
    setLoading(true);
    setErr(null);
    load();
    const timer = setInterval(load, PRESENCE_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  if (loading) return <div className="chat-loading"><Spinner /></div>;

  const otherName = conv && (conv.student_id === user.id ? conv.tutor_name : conv.student_name);
  const online = isOnline(conv, user);

  return (
    <div className="chat">
      <div className="chat-head">
        <Link className="btn btn-ghost back-link" to="/messages">← Back</Link>
        <MiniAvatar name={otherName} />
        <div className="chat-head-info">
          <div className="chat-head-name">
            <b>{otherName || 'Conversation'}</b>
            <OnlineStatus online={online} />
          </div>
          <span className="muted small">{conv ? conv.subject_name : ''}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm chat-delete" onClick={removeConversation}>Delete</button>
      </div>
      {err && <Alert type="error">{err}</Alert>}
      <div className="chat-body">
        {messages.length === 0 && <p className="muted center">No messages yet — say hello!</p>}
        {messages.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`msg-row ${mine ? 'mine' : ''}`}>
              <div className={`bubble ${mine ? 'mine' : ''}`}>
                <div className="bubble-meta">
                  <span className="muted small">{mine ? 'You' : m.sender_name} · {formatDateTime(m.created_at)}</span>
                  {mine && (
                    <button type="button" className="unsend-btn" onClick={() => unsend(m)} title="Unsend message">Unsend</button>
                  )}
                </div>
                <p>{m.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {conv && <PaymentBox conversationId={conversationId} conv={conv} user={user} />}
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
            return (
              <Link key={c.id} to={`/messages/${c.id}`} className={`msg-item ${active ? 'active' : ''}`}>
                <MiniAvatar name={other} />
                <div className="msg-item-main">
                  <div className="msg-item-top">
                    <b className="msg-item-name truncate">{other}</b>
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