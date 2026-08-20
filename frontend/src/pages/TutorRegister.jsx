import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, InfoBox } from '../components/ui';
import { SUBJECT_OPTIONS } from '../constants/learningProfile';
import { authService } from '../services/auth';

const STEPS = [
  { n: 1, label: 'Account Info' },
  { n: 2, label: 'Credentials & IDs' },
  { n: 3, label: 'Review & Submit' }
];

function UploadIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 16V4m0 0 4 4m-4-4L8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const formatSize = (bytes) => {
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

function UploadDrop({ title, primary, hint, meta, file, onFile }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = (list) => {
    const f = list && list[0];
    if (!f) return;
    if (!/\.(jpe?g|png|pdf)$/i.test(f.name)) {
      onFile({ name: f.name, size: f.size, valid: false, reason: 'Unsupported file type. Use .JPG, .PNG or .PDF.' });
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      onFile({ name: f.name, size: f.size, valid: false, reason: 'File is larger than 10MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onFile({ name: f.name, size: f.size, dataUrl: reader.result, valid: true });
    reader.readAsDataURL(f);
  };

  const openPicker = () => { if (inputRef.current) inputRef.current.click(); };

  return (
    <div className="upload-group">
      <span className="upload-title">{title}</span>
      <div
        className={`upload-drop ${over ? 'over' : ''} ${file ? (file.valid ? 'has-file' : 'has-error') : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={openPicker}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } }}
        role="button"
        tabIndex={0}
        aria-label={title}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          className="upload-input"
          onChange={(e) => handleFiles(e.target.files)}
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
        />
        {file && file.valid ? (
          <>
            <span className="upload-check">✓</span>
            <span className="upload-filename">{file.name}</span>
            <span className="upload-meta">{formatSize(file.size)} · click to replace</span>
          </>
        ) : (
          <>
            <UploadIcon />
            <span className="upload-primary">{primary}</span>
            <span className="upload-meta">{hint}</span>
            <span className="upload-meta">{meta}</span>
          </>
        )}
      </div>
      {file && !file.valid && <span className="upload-error">{file.reason}</span>}
    </div>
  );
}

export default function TutorRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    address: '',
    phone: '',
    hourlyRate: '',
    licenseNumber: '',
    institution: '',
    specialization: '',
    yearsTeaching: ''
  });
  const [subjects, setSubjects] = useState(['']);
  const [licenseFile, setLicenseFile] = useState(null);
  const [idFile, setIdFile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const setSubject = (i) => (e) => {
    const next = [...subjects];
    next[i] = e.target.value;
    setSubjects(next);
  };

  const addSubject = () => setSubjects([...subjects, '']);

  const removeSubject = (i) => setSubjects(subjects.filter((_, idx) => idx !== i));

  const validateStep1 = () => {
    if (!form.fullName.trim()) return 'Please enter your full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address';
    if (form.password.length < 8) return 'Password must be at least 8 characters';
    if (!form.phone.trim()) return 'Please enter your phone number';
    if (!form.hourlyRate || Number(form.hourlyRate) <= 0) return 'Please enter a valid hourly rate';
    return null;
  };

  const next = (e) => {
    e.preventDefault();
    setError(null);
    const err = validateStep1();
    if (err) {
      setError(err);
      return;
    }
    setStep(2);
  };

  const validateStep2 = () => {
    if (!licenseFile || !licenseFile.valid) return 'Please upload your teaching license / certification';
    if (!idFile || !idFile.valid) return 'Please upload your government-issued ID';
    return null;
  };

  const nextToReview = (e) => {
    e.preventDefault();
    setError(null);
    const err = validateStep2();
    if (err) {
      setError(err);
      return;
    }
    setStep(3);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await authService.applyTutor({
      full_name: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      hourly_rate: Number(form.hourlyRate),
      subjects: subjects.map((s) => s.trim()).filter(Boolean),
      license_number: form.licenseNumber.trim(),
      institution: form.institution.trim(),
      specialization: form.specialization.trim(),
      years_teaching: form.yearsTeaching,
      license_file: licenseFile?.dataUrl,
      license_file_name: licenseFile?.name,
      id_file: idFile?.dataUrl,
      id_file_name: idFile?.name
    });
    setBusy(false);
    if (res.ok) {
      setApplicationId(res.data?.id);
      setSubmitted(true);
    } else {
      setError(res.message);
    }
  };

  const applicationState = {
    application: {
      id: applicationId,
      fullName: form.fullName,
      email: form.email,
      subjects: subjects.filter(Boolean).join(', '),
      licenseNumber: form.licenseNumber,
      institution: form.institution,
      experience: form.yearsTeaching ? `${form.yearsTeaching} years` : ''
    }
  };

  return (
    <div className="tutor-reg-page">
      <div className="tutor-reg-card">
        <Link to="/" className="back-home"><span aria-hidden="true">←</span> Back to home</Link>
        <div className="brand-side"><span className="logo-dot" /> PeerLink</div>
        {!submitted && (
          <>
            <h1 className="tutor-reg-title">Create Your Tutor Account</h1>
            <p className="muted tutor-reg-sub">
              Join PeerLink as a tutor and help students reach their goals.
            </p>
          </>
        )}

        <div className="tutor-stepper" aria-label="Tutor registration progress">
          {STEPS.map((s, i) => {
            const active = step === s.n;
            const done = step > s.n;
            return (
              <React.Fragment key={s.n}>
                <div className={`tutor-step ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
                  <span className="tutor-step-dot">{done ? '✓' : s.n}</span>
                  <span className="tutor-step-label">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <span className={`tutor-step-line ${active || done ? 'on' : ''}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {!submitted && (
          <div className="tutor-approval-note">
            Tutor applications are reviewed and approved by PeerLink admin before you can start teaching.
          </div>
        )}

        {step === 1 && (
          <form className="form" onSubmit={next}>
            <label htmlFor="tutor-full-name">Full Name</label>
            <input
              id="tutor-full-name"
              value={form.fullName}
              onChange={set('fullName')}
              placeholder="e.g. Maria Santos"
              autoComplete="name"
              required
            />

            <div className="tutor-grid-2">
              <div>
                <label htmlFor="tutor-email">Email</label>
                <input
                  id="tutor-email"
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="you@peerlink.edu"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label htmlFor="tutor-password">Password</label>
                <input
                  id="tutor-password"
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <div className="tutor-grid-2">
              <div>
                <label htmlFor="tutor-address">Address</label>
                <input
                  id="tutor-address"
                  value={form.address}
                  onChange={set('address')}
                  placeholder="e.g. Barangay, City"
                  autoComplete="street-address"
                />
              </div>
              <div>
                <label htmlFor="tutor-phone">Phone Number</label>
                <input
                  id="tutor-phone"
                  type="tel"
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="e.g. 0917 123 4567"
                  autoComplete="tel"
                  required
                />
              </div>
            </div>

            <label>Subjects You Teach</label>
            {subjects.map((s, i) => (
              <div className="subject-row" key={i}>
                <select value={s} onChange={setSubject(i)} aria-label={`Subject ${i + 1}`}>
                  <option value="">Select a subject</option>
                  {SUBJECT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                {subjects.length > 1 && (
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={() => removeSubject(i)}
                    aria-label="Remove subject"
                  >×</button>
                )}
              </div>
            ))}
            <button type="button" className="add-subject" onClick={addSubject}>
              <span aria-hidden="true">+</span> Add another subject
            </button>

            <label htmlFor="tutor-rate">Hourly Rate</label>
            <div className="rate-wrap">
              <span className="rate-prefix">₱</span>
              <input
                id="tutor-rate"
                type="number"
                min="0"
                step="50"
                value={form.hourlyRate}
                onChange={set('hourlyRate')}
                placeholder="e.g. 300"
                inputMode="numeric"
              />
            </div>

            <Alert type="error">{error}</Alert>

            <div className="tutor-form-actions">
              <button className="btn btn-primary" type="submit">
                Next: Credential &amp; IDs <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form className="form" onSubmit={nextToReview}>
            <h2 className="tutor-step-heading">Verify Your Identity</h2>
            <p className="muted tutor-step-sub">
              We need to verify you're a qualified educator. Upload your teaching license
              and valid government ID.
            </p>

            <UploadDrop
              title="Teaching License / Certification"
              primary="Upload Teaching License"
              hint="Drag & drop or click to browse"
              meta=".JPG, .PNG, PDF · Max 10MB"
              file={licenseFile}
              onFile={setLicenseFile}
            />

            <UploadDrop
              title="Government-issued ID"
              primary="Upload Government ID"
              hint="Drag & drop or click to browse"
              meta="e.g. Passport, National ID, Driver's License · .JPG, .PNG, PDF · Max 10MB"
              file={idFile}
              onFile={setIdFile}
            />

            <h3 className="license-heading">License Details</h3>
            <div className="tutor-grid-2">
              <div>
                <label htmlFor="license-number">License Number</label>
                <input
                  id="license-number"
                  value={form.licenseNumber}
                  onChange={set('licenseNumber')}
                  placeholder="e.g. 1234567"
                />
              </div>
              <div>
                <label htmlFor="license-institution">Issuing Institution</label>
                <input
                  id="license-institution"
                  value={form.institution}
                  onChange={set('institution')}
                  placeholder="e.g. Professional Regulation Commission"
                />
              </div>
            </div>
            <div className="tutor-grid-2">
              <div>
                <label htmlFor="license-specialization">Specialization</label>
                <input
                  id="license-specialization"
                  value={form.specialization}
                  onChange={set('specialization')}
                  placeholder="e.g. Mathematics"
                />
              </div>
              <div>
                <label htmlFor="license-years">Years of Teaching</label>
                <input
                  id="license-years"
                  type="number"
                  min="0"
                  value={form.yearsTeaching}
                  onChange={set('yearsTeaching')}
                  placeholder="e.g. 3"
                  inputMode="numeric"
                />
              </div>
            </div>

            <Alert type="error">{error}</Alert>

            <div className="tutor-form-actions-between">
              <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary">Next: Review <span aria-hidden="true">→</span></button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form className="form" onSubmit={submit}>
            <h2 className="tutor-step-heading">Review Your Application</h2>
            <p className="muted tutor-step-sub">
              Double-check everything before submitting. This will be sent for approval.
            </p>

            {!submitted && (
              <>
                <div className="review-section">
                  <div className="review-section-head">
                    <h3 className="review-section-title">Account Information</h3>
                    <button type="button" className="edit-link" onClick={() => setStep(1)}>Edit</button>
                  </div>
                  <div className="review-grid">
                    <InfoBox label="Full Name" value={form.fullName || '—'} />
                    <InfoBox label="Phone" value={form.phone || '—'} />
                    <InfoBox label="Address" value={form.address || '—'} />
                    <InfoBox label="Hourly Rate" value={form.hourlyRate ? `₱${form.hourlyRate}` : '—'} />
                    <InfoBox label="Subjects" value={subjects.filter(Boolean).join(', ') || '—'} />
                  </div>
                </div>

                <div className="review-section">
                  <div className="review-section-head">
                    <h3 className="review-section-title">Credentials &amp; IDs</h3>
                    <button type="button" className="edit-link" onClick={() => setStep(2)}>Edit</button>
                  </div>
                  <div className="review-grid">
                    <InfoBox label="License Number" value={form.licenseNumber || '—'} />
                    <InfoBox label="Issuing Institution" value={form.institution || '—'} />
                    <InfoBox label="Specialization" value={form.specialization || '—'} />
                    <InfoBox label="Years of Teaching" value={form.yearsTeaching ? `${form.yearsTeaching} Years` : '—'} />
                    <InfoBox label="Teaching License" value={licenseFile && licenseFile.valid ? `${licenseFile.name} (${formatSize(licenseFile.size)})` : '—'} />
                    <InfoBox label="Government ID" value={idFile && idFile.valid ? `${idFile.name} (${formatSize(idFile.size)})` : '—'} />
                  </div>
                </div>

                <div className="review-warning">
                  <strong>Important</strong>
                  <p>
                    Your application will be reviewed by our team within 24–48 hours. You won't be
                    able to access the tutor dashboard until approved. Make sure all information is
                    accurate to avoid delays.
                  </p>
                </div>

                <Alert type="error">{error}</Alert>

                <div className="tutor-form-actions-between">
                  <button type="button" className="btn btn-outline" onClick={() => setStep(2)}>← Back</button>
                  <button className="btn btn-primary" disabled={busy}>
                    {busy ? 'Submitting…' : 'Submit for Approval'}
                  </button>
                </div>
              </>
            )}
            {submitted && (
              <div className="confirm-wrap">
                <div className="success-circle">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2 className="confirm-title">Application Submitted</h2>
                <p className="confirm-text">
                  Your credentials have been sent for review. Our team will verify your information
                  within 24–48 hours.
                </p>
                <Link
                  className="status-pill"
                  to="/register/tutor/status"
                  state={applicationState}
                >
                  <span className="status-dot" />
                  Setting up your status page...
                </Link>
              </div>
            )}
          </form>
        )}

        {!submitted && (
          <p className="muted small ct-line">
            Already registered? <Link to="/login">Log in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
