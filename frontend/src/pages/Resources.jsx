import React, { useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useApi } from '../hooks/useApi';
import { resourceService, tutorService } from '../services';
import { Spinner, Alert, Modal } from '../components/ui';

const MAX_BYTES = 500 * 1024 * 1024;
const DESCRIPTION_MAX = 500;

const TYPE_OPTIONS = [
  { key: 'PDF', label: 'PDF Document' },
  { key: 'VIDEO', label: 'Video Tutorial' },
  { key: 'TEXT', label: 'Text Document' },
  { key: 'SLIDES', label: 'Presentation Slides' }
];

/* ---------- small inline icons ---------- */

function UploadIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function SearchIcon({ className = '' }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CloudUploadIcon({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2" />
      <polyline points="12 12 12 21" />
      <polyline points="8 16 12 12 16 16" />
    </svg>
  );
}

function DownloadIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function TrashIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

const TYPE_GLYPHS = {
  PDF: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><polyline points="9 15 12 12 15 15" /></>,
  VIDEO: <><rect x="2" y="6" width="14" height="12" rx="2" /><polygon points="16 10 22 12.5 16 15" /></>,
  TEXT: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="14" y2="17" /></>,
  SLIDES: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><rect x="8" y="12" width="8" height="4" /></>,
  DOC: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="12" y2="17" /></>,
  SHEET: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /><line x1="12" y1="13" x2="12" y2="17" /></>,
  AUDIO: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /><path d="M13 16V9l4 1" /></>,
  IMAGE: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>
};

const BADGE_LABELS = {
  PDF: 'PDF',
  VIDEO: 'Video',
  DOC: 'Document',
  SHEET: 'Sheet',
  SLIDES: 'Slides',
  AUDIO: 'Audio',
  IMAGE: 'Image',
  TEXT: 'Text'
};

function FileGlyph({ type, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TYPE_GLYPHS[type] || TYPE_GLYPHS.TEXT}
    </svg>
  );
}

function extOf(name) {
  const i = String(name || '').lastIndexOf('.');
  return i < 0 ? '' : String(name).slice(i + 1).toLowerCase();
}

function typeForExt(ext) {
  if (ext === 'pdf') return 'PDF';
  if (['mp4', 'mov', 'webm', 'mkv'].includes(ext)) return 'VIDEO';
  if (['txt', 'md', 'doc', 'docx'].includes(ext)) return 'TEXT';
  if (['ppt', 'pptx'].includes(ext)) return 'SLIDES';
  return null;
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/* ---------- Upload Resource modal ---------- */

function UploadModal({ mySubjects, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [type, setType] = useState('PDF');
  const [description, setDescription] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const inputRef = useRef(null);

  const accept = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.mp4,.mov,.webm,.mkv,.mp3,.wav,.jpg,.jpeg,.png,.gif,.webp,.txt,.md';

  const acceptFile = (f) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setErrors((prev) => ({ ...prev, file: 'File exceeds the 500 MB maximum size.' }));
      setFile(null);
      return;
    }
    const matched = typeForExt(extOf(f.name));
    if (matched) setType(matched);
    setErrors((prev) => ({ ...prev, file: null }));
    setFile(f);
  };

  const pick = (e) => {
    acceptFile(e.target.files && e.target.files[0]);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    acceptFile(e.dataTransfer.files && e.dataTransfer.files[0]);
  };

  const validate = () => {
    const next = {};
    if (!file) next.file = 'Please choose a file to upload.';
    if (!title.trim()) next.title = 'Resource title is required.';
    if (!subjectId) next.subject = 'Please select a subject.';
    if (!description.trim()) next.description = 'Description is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!validate()) return;
    setBusy(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await resourceService.upload({
        title: title.trim(),
        file_name: file.name,
        subject_id: subjectId,
        file_type: type,
        description: description.trim(),
        data: reader.result
      });
      setBusy(false);
      if (res.ok) {
        onUploaded(res.data);
      } else {
        setErr(res.message);
      }
    };
    reader.onerror = () => {
      setBusy(false);
      setErr('Could not read the file');
    };
    reader.readAsDataURL(file);
  };

  return (
    <Modal title="Upload Resource" onClose={onClose} className="upload-modal">
      <form className="form" onSubmit={submit} noValidate>
        <div
          className={`dropzone ${dragOver ? 'dropzone-over' : ''} ${file ? 'dropzone-has-file' : ''}`}
          onClick={() => inputRef.current && inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current && inputRef.current.click(); }}
        >
          <input ref={inputRef} type="file" accept={accept} onChange={pick} hidden />
          {file ? (
            <>
              <div className="dropzone-file-icon"><FileGlyph type={type} size={22} /></div>
              <b className="dropzone-file-name">{file.name}</b>
              <span className="dropzone-file-meta">{file.type || `${extOf(file.name).toUpperCase()} file`} · {formatBytes(file.size)}</span>
              <span className="dropzone-change">Click or drop a new file to replace it</span>
            </>
          ) : (
            <>
              <CloudUploadIcon />
              <b>Drag &amp; drop your file here</b>
              <span>or click to browse</span>
              <span className="dropzone-hint">Support PDF, DOC, PPT, MP4, TXT &amp; more (Max 500 MB)</span>
            </>
          )}
        </div>
        {errors.file && <p className="field-error">{errors.file}</p>}

        <label htmlFor="resource-title">Resource Title <span className="req-star">*</span></label>
        <input
          id="resource-title"
          type="text"
          placeholder="e.g. Calculus Fundamentals Guide"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={255}
        />
        {errors.title && <p className="field-error">{errors.title}</p>}

        <label htmlFor="resource-subject">Subject <span className="req-star">*</span></label>
        <select id="resource-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Select Subject</option>
          {(mySubjects.data || []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {errors.subject && <p className="field-error">{errors.subject}</p>}

        <label>Resource Type <span className="req-star">*</span></label>
        <div className="resource-type-options">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`resource-type-option ${type === opt.key ? 'on' : ''}`}
              onClick={() => setType(opt.key)}
            >
              <FileGlyph type={opt.key} size={16} />
              {opt.label}
            </button>
          ))}
        </div>

        <label htmlFor="resource-description">Description <span className="req-star">*</span></label>
        <textarea
          id="resource-description"
          rows={4}
          placeholder="Brief description of what this resource covers..."
          value={description}
          maxLength={DESCRIPTION_MAX}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p className={`field-counter ${description.length >= DESCRIPTION_MAX ? 'over' : ''}`}>{description.length}/{DESCRIPTION_MAX}</p>
        {errors.description && <p className="field-error">{errors.description}</p>}

        {err && <Alert type="error">{err}</Alert>}

        <button type="submit" className="btn btn-primary btn-block btn-lg resource-submit" disabled={busy}>
          <UploadIcon />
          {busy ? 'Uploading…' : 'Upload Resource'}
        </button>
      </form>
    </Modal>
  );
}

/* ---------- single resource row ---------- */

function ResourceRow({ r, isOwn, onDelete }) {
  const name = r.file_name || r.title;
  const type = r.file_type || typeForExt(extOf(name)) || 'TEXT';
  const typeClass = String(type).toLowerCase();

  return (
    <div className="resource-row">
      <div className={`resource-row-icon type-${typeClass}`}>
        <FileGlyph type={type} size={20} />
      </div>
      <div className="resource-row-main">
        <span className="resource-row-name">
          {name}
          <span className={`resource-type-badge type-${typeClass}`}>{BADGE_LABELS[type] || type}</span>
        </span>
        {r.title && r.file_name && r.title !== r.file_name && (
          <span className="resource-row-title">{r.title}{r.size_bytes ? ` · ${formatBytes(r.size_bytes)}` : ''}</span>
        )}
      </div>
      <div className="resource-row-actions">
        <a
          className="resource-icon-btn"
          href={`/api/resources/${r.id}/file`}
          target="_blank"
          rel="noreferrer"
          title="Download"
        >
          <DownloadIcon />
        </a>
        {isOwn && (
          <button
            type="button"
            className="resource-icon-btn danger"
            title="Delete"
            onClick={() => onDelete(r)}
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default function Resources() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const data = useApi(resourceService.folders);
  const mySubjects = useApi(tutorService.getSubjects);
  const [query, setQuery] = useState('');
  const [openTutorIds, setOpenTutorIds] = useState(new Set());
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null);

  const isTutor = user.role_key === 'tutor';
  const isAdmin = user.role_key === 'admin';
  const q = query.trim().toLowerCase();

  const myResources = useMemo(() => {
    const all = (data.data?.resources || []).filter((r) => Number(r.tutor_id) === Number(user.id));
    const sorted = all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (!q) return sorted;
    return sorted.filter((r) => {
      const name = (r.file_name || r.title || '').toLowerCase();
      const type = (r.file_type || '').toLowerCase();
      return name.includes(q) || type.includes(q);
    });
  }, [data.data, q, user.id]);

  const folders = useMemo(() => {
    const byTutor = new Map();
    for (const r of data.data?.resources || []) {
      if (!byTutor.has(r.tutor_id)) byTutor.set(r.tutor_id, []);
      byTutor.get(r.tutor_id).push(r);
    }
    const tutorRows = (data.data?.tutors || []).map((t) => {
      const tutorFiles = (byTutor.get(Number(t.user_id)) || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const visible = q
        ? tutorFiles.filter((r) => (r.file_name || r.title || '').toLowerCase().includes(q) || (r.file_type || '').toLowerCase().includes(q))
        : tutorFiles;
      const first = (t.subjects && t.subjects[0] && t.subjects[0].name) || null;
      return {
        tutor_profile_id: t.tutor_profile_id,
        user_id: t.user_id,
        name: `${t.first_name} ${t.last_name}`,
        subject: first ? `${first} Tutor` : 'Tutor',
        files: tutorFiles,
        visible,
        count: tutorFiles.length
      };
    });
    if (q) return tutorRows.filter((f) => f.visible.length > 0);
    return tutorRows;
  }, [data.data, q]);

  const toggle = (userId) => {
    setOpenTutorIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const remove = async (r) => {
    const ok = await confirm({
      title: 'Delete resource?',
      message: `"${r.file_name || r.title}" will be permanently removed. This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true
    });
    if (!ok) return;
    const res = await resourceService.remove(r.id);
    if (res.ok) { setNotice({ type: 'success', text: res.message }); data.reload(); }
    else setNotice({ type: 'error', text: res.message });
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Resources</h2>
          <p className="page-sub">{isTutor ? `${myResources.length} resource${myResources.length === 1 ? '' : 's'} in your library` : 'Browse shared learning materials'}</p>
        </div>
        {isTutor && (
          <button className="btn btn-primary" onClick={() => setUploading(true)}>
            <UploadIcon /> Upload Resource
          </button>
        )}
      </div>

      {data.loading ? <Spinner /> : null}
      {data.error && <Alert type="error">{data.error.message}</Alert>}
      {notice && <Alert type={notice.type}>{notice.text}</Alert>}

      <div className="card resource-search-bar">
        <SearchIcon className="search-icon" />
        <input
          type="search"
          placeholder="Search resources..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search resources"
        />
        {query && (
          <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>
        )}
      </div>

      {isTutor ? (
        myResources.length === 0 ? (
          <div className="card empty-state">
            <h3>{q ? 'No matching resources' : 'No resources yet'}</h3>
            <p>{q ? 'Try a different search term.' : 'Upload your first resource to share it with your students.'}</p>
          </div>
        ) : (
          <div className="resource-library">
            {myResources.map((r) => (
              <ResourceRow key={r.id} r={r} isOwn onDelete={remove} />
            ))}
          </div>
        )
      ) : (
        <div className="resource-folders">
          {folders.length === 0 && (
            <div className="card empty-state">
              <h3>{q ? 'No matching resources' : 'No resources available'}</h3>
              <p>{q ? 'Try a different search term.' : 'Resources will appear here once tutors share them.'}</p>
            </div>
          )}
          {folders.map((folder) => {
            const isOpen = openTutorIds.has(folder.user_id);
            return (
              <div className="resource-folder" key={folder.tutor_profile_id}>
                <div className="resource-folder-head">
                  <div>
                    <b className="resource-tutor">{folder.name}</b>
                    <p className="resource-subject">{folder.subject}</p>
                  </div>
                  <button
                    type="button"
                    className="resource-view"
                    onClick={() => toggle(folder.user_id)}
                  >
                    {isOpen ? 'Hide Files' : 'View Folder'}
                  </button>
                </div>

                {isOpen && (
                  folder.visible.length === 0 ? (
                    <p className="muted small" style={{ margin: '10px 0 2px' }}>
                      {q ? 'No files match your search.' : 'No files in this folder yet.'}
                    </p>
                  ) : (
                    <div className="resource-library" style={{ marginTop: 12 }}>
                      {folder.visible.map((r) => (
                        <ResourceRow
                          key={r.id}
                          r={r}
                          isOwn={(isTutor && Number(r.tutor_id) === Number(user.id)) || isAdmin}
                          onDelete={remove}
                        />
                      ))}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {uploading && (
        <UploadModal
          mySubjects={mySubjects}
          onClose={() => setUploading(false)}
          onUploaded={() => { setUploading(false); data.reload(); }}
        />
      )}
    </div>
  );
}