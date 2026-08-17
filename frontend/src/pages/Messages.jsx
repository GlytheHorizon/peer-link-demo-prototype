import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useConfirm } from '../context/ConfirmContext';
import { conversationService } from '../services';
import { Spinner, Alert, formatDateTime, EmptyState } from '../components/ui';

/** Renders a single conversation thread. */
function Thread({ conversationId }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [messages, setMessages] = useState([]);
  const [conv, setConv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [c, m] = await Promise.all([
        conversationService.get(conversationId),
        conversationService.getMessages(conversationId)
      ]);
      if (c.ok) setConv(c.data); else setErr(c.message);
      if (m.ok) setMessages(m.data); else setErr(m.message);
      setLoading(false);
    })();
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
    } else setErr(res.message);
  };

  if (loading) return <Spinner />;

  const otherName = conv && (conv.student_id === user.id ? conv.tutor_name : conv.student_name);

  return (
    <div className="thread">
      <div className="thread-head">
        <Link className="btn btn-ghost" to="/messages">← All messages</Link>
        <div>
          <b>{otherName || 'Conversation'}</b>
          <p className="muted small">{conv ? conv.subject_name : ''}</p>
        </div>
      </div>
      {err && <Alert type="error">{err}</Alert>}
      <div className="thread-list">
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
      <form className="thread-input" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={5000}
        />
        <button className="btn btn-primary" disabled={sending || !text.trim()}>{sending ? 'Sending…' : 'Send'}</button>
      </form>
    </div>
  );
}

export default function Messages({ thread }) {
  const { id } = useParams();
  const { user } = useAuth();
  const convos = useApi(conversationService.list);
  const [lastKey, setLastKey] = useState(id);

  useEffect(() => {
    if (id !== lastKey) {
      setLastKey(id);
      convos.reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (thread || id) return <Thread conversationId={id} />;

  return (
    <div>
      <h2>Messages</h2>
      {convos.loading && <Spinner />}
      {convos.error && <Alert type="error">{convos.error.message}</Alert>}
      {convos.data?.length === 0 && !convos.loading && (
        <EmptyState
          title="No conversations yet"
          description="Find a tutor match and send your first message."
          action={<Link className="btn btn-primary" to={user.role_key === 'student' ? '/matches' : '/dashboard'}>Find Tutors</Link>}
        />
      )}
      <div className="conv-list">
        {(convos.data || []).map((c) => {
          const other = c.student_id === user.id ? c.tutor_name : c.student_name;
          return (
            <Link key={c.id} to={`/messages/${c.id}`} className="card conv-row">
              <div className="conv-info">
                <b>{other}</b>
                <span className="muted small">{c.subject_name}</span>
                <span className="muted small truncate">{c.last_message}</span>
              </div>
              <div className="conv-meta">
                {c.unread_count > 0 && <span className="badge badge-pending">{c.unread_count} new</span>}
                <span className="muted small">{formatDateTime(c.updated_at)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}