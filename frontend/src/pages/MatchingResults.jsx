import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useConfirm } from '../context/ConfirmContext';
import { subjectService, matchService, sessionService, conversationService } from '../services';
import { Spinner, Alert, EmptyState } from '../components/ui';

const CARD_VARIANTS = ['royal', 'sky', 'violet'];

export default function MatchingResults() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const subjects = useApi(subjectService.list);
  const sessions = useApi(sessionService.list);
  const [mode, setMode] = useState('smart');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [browseResults, setBrowseResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const run = async (subjectId, quiet = false) => {
    if (!quiet) {
      const ok = await confirm({ title: 'Re-run matching?', message: 'Stored match scores will be recalculated.', confirmText: 'Re-run matching' });
      if (!ok) return;
    }
    setLoading(true);
    setMsg(null);
    setErr(null);
    const res = await matchService.generate(subjectId || null);
    setLoading(false);
    if (res.ok) {
      setMatches(res.data);
      setMsg({ type: 'success', text: res.message });
    } else setErr(res.message);
  };

  useEffect(() => {
    run(null, true);
  }, []);

  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    if (!q) {
      setSearchResults(null);
      setSearching(false);
      return () => { cancelled = true; };
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const res = await matchService.search(q);
      if (cancelled) return;
      setSearchResults(res.ok ? res.data : []);
      setSearching(false);
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    if (query.trim() !== '' || mode !== 'manual') return;
    let cancelled = false;
    setBrowseResults(null);
    (async () => {
      const res = await matchService.browse();
      if (cancelled) return;
      setBrowseResults(res.ok ? res.data : []);
    })();
    return () => { cancelled = true; };
  }, [mode, query]);

  const subjectName = (id) => subjects.data?.find((s) => s.id === id)?.name || `Subject #${id}`;

  const book = async (m) => {
    const ok = await confirm({
      title: 'Book this session?',
      message: `Book a ${subjectName(m.subject_id)} session with ${m.tutor_name}?`,
      confirmText: 'Book Session'
    });
    if (ok) navigate(`/sessions/new?tutor=${m.tutor_user_id ?? m.tutor_profile_id}&subject=${m.subject_id}`);
  };

  const activeSessions = (sessions.data || []).filter(
    (s) => s.status === 'pending' || s.status === 'accepted'
  );

  /** The student's active booking with this tutor for this subject, if any. */
  const bookingFor = (m) =>
    activeSessions.find(
      (s) =>
        Number(s.tutor_id) === Number(m.tutor_user_id ?? m.tutor_profile_id) &&
        Number(s.subject_id) === Number(m.subject_id)
    );

  const chatTutor = async (m) => {
    const b = bookingFor(m);
    if (b?.conversation_id) {
      navigate(`/messages/${b.conversation_id}`);
      return;
    }
    const res = await conversationService.start(Number(m.tutor_user_id ?? m.tutor_profile_id), Number(m.subject_id));
    if (res.ok && res.data?.id) navigate(`/messages/${res.data.id}`);
    else if (res.ok) navigate('/messages');
    else setErr(res.message);
  };

  const q = query.trim().toLowerCase();
  const visible = q
    ? (searchResults ?? matches.filter(
        (m) =>
          m.tutor_name.toLowerCase().includes(q) ||
          subjectName(m.subject_id).toLowerCase().includes(q)
      ))
    : mode === 'manual'
      ? (browseResults ?? [])
      : matches.slice(0, 3);

  return (
    <div>
      <div className="tutor-match-head">
        <h2 className="tm-title">Tutor Matching</h2>
        <Link className="btn btn-request" to="/sessions/new">Book Session Request</Link>
      </div>

      <div className="mode-tabs" role="tablist" aria-label="Search mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'smart'}
          className={`mode-tab ${mode === 'smart' ? 'on' : ''}`}
          onClick={() => setMode('smart')}
        >
          Smart Match
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'manual'}
          className={`mode-tab ${mode === 'manual' ? 'on' : ''}`}
          onClick={() => setMode('manual')}
        >
          Manual Search
        </button>
      </div>

      <div className="card manual-search">
        <input
          type="search"
          placeholder="Search tutors by name or subject…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search tutors"
        />
        {query && (
          <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
            ×
          </button>
        )}
      </div>

      <div className="section-row">
        <span className="section-label">
          {q ? `Results for "${query}"` : mode === 'manual' ? 'Search Results' : 'Top Recommended Tutors'}
        </span>
        <div className="match-tools">
          <button className="btn btn-ghost btn-sm" onClick={() => run(null)} disabled={loading}>
            {loading ? 'Matching…' : 'Refresh'}
          </button>
          <Link className="btn btn-ghost btn-sm" to="/subjects">Edit subjects</Link>
        </div>
      </div>

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {err && <Alert type="error">{err}</Alert>}

      {loading && <Spinner label="Running matching algorithm…" />}
      {searching && <Spinner label="Searching tutors…" />}
      {mode === 'manual' && query.trim() === '' && browseResults === null && <Spinner label="Loading all tutors…" />}

      {!loading && !searching && !(mode === 'manual' && query.trim() === '' && browseResults === null) && visible.length === 0 && (
        <EmptyState
          title="No tutors found"
          description={q
            ? 'No tutor matches your search. Try another subject name or tutor name.'
            : mode === 'manual'
              ? 'No tutors are available yet. Check back later.'
              : 'Add subjects you need help with, or make sure tutors teach them.'}
          action={q || mode === 'manual' ? null : <Link className="btn btn-primary" to="/subjects">Go to Subjects</Link>}
        />
      )}

      <div className="match-list">
        {visible.map((m, i) => {
          const tags = [
            ...(Array.isArray(m.tags) ? m.tags : []),
            ...(m.learning_mode === 'both' ? ['Online & In-Person']
              : m.learning_mode === 'online' ? ['Online Session']
              : m.learning_mode === 'face-to-face' ? ['Face-to-Face'] : [])
          ];
          return (
          <div className={`req-card req-card--${CARD_VARIANTS[i % CARD_VARIANTS.length]}`} key={`${m.tutor_profile_id}-${m.subject_id}`}>
            <div className="req-info">
              <h3 className="req-name">{m.tutor_name}</h3>
              <p className="req-desc">
                Expert {subjectName(m.subject_id)} tutor helping students build strong foundations and improve their grades.
              </p>
              <div className="req-facts">
                <div className="req-fact">
                  <b>{m.avg_rating ? `${Number(m.avg_rating).toFixed(1)}/5.0` : 'No ratings'}</b>
                  <span>{m.rating_count ? `${m.rating_count} rating${m.rating_count === 1 ? '' : 's'}` : 'Rating'}</span>
                </div>
                <div className="req-fact"><b>{Number(m.rate_per_hour) || 100}/hr</b><span>Price</span></div>
                <div className="req-fact"><b>{m.score != null ? `${Number(m.score).toFixed(0)}%` : '—'}</b><span>Match</span></div>
              </div>
              {tags.length > 0 && (
                <div className="req-tags">
                  {tags.slice(0, 4).map((t) => <span key={t} className="req-tag">{t}</span>)}
                </div>
              )}
            </div>
            <div className="req-actions">
              <Link className="req-btn req-btn--outline" to={`/tutors/${m.tutor_profile_id}`}>View Profile</Link>
              {bookingFor(m) ? (
                <>
                  <span className="req-btn req-btn--booked">Already Booked</span>
                  <button className="req-btn req-btn--outline" onClick={() => chatTutor(m)}>
                    Chat Tutor
                  </button>
                </>
              ) : (
                <button
                  className="req-btn req-btn--book"
                  onClick={() => book(m)}
                >
                  Book Session
                </button>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}