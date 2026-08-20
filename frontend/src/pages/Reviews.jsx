import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { tutorService, evaluationService } from '../services';
import { Spinner, Alert, RatingStars, formatDate, formatDateTime, EmptyState } from '../components/ui';

const FILTERS = [
  { key: 'latest', label: 'Latest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'highest', label: 'Highest stars' },
  { key: 'lowest', label: 'Lowest stars' }
];

const initialsOf = (name) => (
  (name || '?').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
);

export default function Reviews() {
  const { id } = useParams();
  const [tutor, setTutor] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState('latest');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      const [t, r] = await Promise.all([
        tutorService.getPublic(id),
        evaluationService.forTutor(id)
      ]);
      if (cancelled) return;
      if (t.ok) setTutor(t.data);
      else if (!err) setErr(t.message);
      if (r.ok) setReviews(r.data);
      else if (!err) setErr(r.message);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const sorted = useMemo(() => {
    const copy = [...(reviews || [])];
    const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at);
    if (filter === 'oldest') return copy.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (filter === 'highest') return copy.sort((a, b) => b.rating - a.rating || byNewest(a, b));
    if (filter === 'lowest') return copy.sort((a, b) => a.rating - b.rating || byNewest(a, b));
    return copy.sort(byNewest);
  }, [reviews, filter]);

  if (loading) return <Spinner />;
  if (err && !tutor) return <Alert type="error">{err}</Alert>;

  const count = reviews?.length ?? 0;

  return (
    <div>
      <Link className="btn btn-ghost" to={tutor ? `/tutors/${tutor.user_id}` : '/matches'}>← Back to profile</Link>

      <div className="reviews-summary card">
        <div className="profile-avatar" aria-hidden="true">{initialsOf(tutor?.full_name)}</div>
        <div className="reviews-summary-main">
          <h3>{tutor ? tutor.full_name : 'Tutor'} — Reviews</h3>
          <RatingStars rating={tutor?.avg_rating} />
          <span className="muted small">({count} review{count === 1 ? '' : 's'})</span>
        </div>
      </div>

      <div className="review-filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`review-filter ${filter === f.key ? 'on' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="No reviews yet"
          description="This tutor has not received any ratings yet. Once a student completes a session and rates them, the review will show up here."
        />
      ) : (
        <div className="review-list">
          {sorted.map((r) => (
            <div className="review-card" key={r.id}>
              <span className="mini-avatar review-avatar" aria-hidden="true">{initialsOf(r.student_name)}</span>
              <div className="review-card-main">
                <div className="review-card-top">
                  <b>{r.student_name}</b>
                  <span className="stars-inline">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`star ${n <= r.rating ? 'on' : ''}`}>★</span>
                    ))}
                  </span>
                </div>
                <div className="muted small">
                  {r.subject_name ? `${r.subject_name} session` : 'Session'}
                  {r.scheduled_start ? ` · ${formatDate(r.scheduled_start)}` : ''}
                  {' · '}{formatDateTime(r.created_at)}
                </div>
                {r.comment && <p className="review-comment">{r.comment}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}