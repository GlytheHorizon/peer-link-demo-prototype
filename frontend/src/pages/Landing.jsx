import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { title: 'Smart Matching', text: 'Automated 0–100 compatibility scoring across subject, proficiency, course level, availability & ratings.' },
  { title: 'Messaging', text: 'Chat directly with tutors before booking so you can confirm the right fit.' },
  { title: 'Scheduling', text: 'Request sessions, get tutor confirmation, and prevent overlapping bookings automatically.' },
  { title: 'Ratings & Reports', text: 'Evaluate sessions after completion; faculty and admins get live tutoring reports.' }
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand">
          <span className="logo-dot" /> PeerLink
        </div>
        <div>
          {user ? (
            <Link className="btn btn-primary" to="/dashboard">Go to Dashboard</Link>
          ) : (
            <>
              <Link className="btn btn-ghost" to="/login">Log in</Link>
              <Link className="btn btn-primary" to="/register">Register</Link>
            </>
          )}
        </div>
      </header>

      <section className="hero">
        <h1>Find the right tutor.<br />Get the help you need.</h1>
        <p className="hero-sub">
          PeerLink connects students with verified peer tutors using an automated compatibility
          engine — message, schedule, and evaluate sessions all in one place.
        </p>
        <div className="hero-actions">
          {user ? (
            <Link className="btn btn-primary btn-lg" to="/dashboard">Open Dashboard</Link>
          ) : (
            <>
              <Link className="btn btn-primary btn-lg" to="/register">Get Started — it's free</Link>
              <Link className="btn btn-outline btn-lg" to="/login">I have an account</Link>
            </>
          )}
        </div>
      </section>

      <section className="features">
        {FEATURES.map((f) => (
          <div className="feature-card" key={f.title}>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </section>

      <section className="how">
        <h2>How it works</h2>
        <ol className="how-list">
          <li>Register as a student or tutor</li>
          <li>Complete your profile & pick your subjects</li>
          <li>Run automatic matching and browse your best-fit tutors</li>
          <li>Message, schedule, attend, and evaluate your sessions</li>
        </ol>
        <div className="quote muted">Demo accounts (passwords in the Login page dropdown): student@peerlink.edu ·
          tutor@peerlink.edu · faculty@peerlink.edu · admin@peerlink.edu</div>
      </section>

      <footer className="landing-footer muted">
        Peerlink Demo (JC)
      </footer>
    </div>
  );
}