import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { InfoBox } from '../components/ui';

const SAMPLE = {
  fullName: 'Anne Curtis',
  email: 'anne@gmail.com',
  subjects: 'Mathematics',
  licenseNumber: '2024-123456',
  institution: 'PRC',
  experience: '6 years'
};

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TutorStatus() {
  const location = useLocation();
  const app = location.state?.application || {};

  const data = {
    fullName: app.fullName || SAMPLE.fullName,
    email: app.email || SAMPLE.email,
    subjects: app.subjects || SAMPLE.subjects,
    licenseNumber: app.licenseNumber || SAMPLE.licenseNumber,
    institution: app.institution || SAMPLE.institution,
    experience: app.experience || SAMPLE.experience
  };

  const submittedOn = app.created_at
    ? new Date(app.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const estDate = new Date();
  estDate.setDate(estDate.getDate() + 2);
  const estimated = estDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="status-page">
      <div className="status-header">
        <Link to="/" className="back-home"><span aria-hidden="true">←</span> Back to home</Link>
        <div className="brand-side"><span className="logo-dot" /> PeerLink</div>
      </div>

      <div className="status-card">
        <div className="status-icon">
          <ClockIcon />
        </div>
        <h1 className="status-title">Waiting for Approval</h1>
        <p className="status-text">
          Our team is reviewing your credentials and documents. This usually takes 24–48 hours.
          We'll notify you once you've verified.
        </p>
        <span className="status-badge">Under Review</span>
      </div>

      <div className="application-card">
        <h2 className="application-title">Your Submitted Application</h2>

        <div className="review-grid">
          <InfoBox label="Full Name" value={data.fullName} />
          <InfoBox label="Email" value={data.email} />
          <InfoBox label="Subjects" value={data.subjects} />
          <InfoBox label="License Number" value={data.licenseNumber} />
          <InfoBox label="Institution" value={data.institution} />
          <InfoBox label="Teaching Experience" value={data.experience} />
        </div>

        <div className="doc-section">
          <h3 className="doc-title">Document Submitted</h3>
          <div className="doc-row">
            <div>
              <span className="doc-name">Teaching License / Government ID</span>
              <span className="doc-date">Submitted on {submittedOn}</span>
            </div>
            <span className="doc-badge">Submitted</span>
          </div>
        </div>

        <div className="est-section">
          <ClockIcon />
          <div>
            <strong>Estimated approval: {estimated}</strong>
            <span className="muted">You'll receive an email notification.</span>
          </div>
        </div>

        <div className="status-footer">
          <Link className="btn btn-outline" to="/login">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}