import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { resourceService, tutorService } from '../services';
import { Spinner, Alert, Modal } from '../components/ui';

const MAX_BYTES = 25 * 1024 * 1024;

function UploadModal({ mySubjects, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [subjectId, setSubjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(false);

  const pick = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return setFile(null);
    if (f.size > MAX_BYTES) {
      setErr('Files are limited to 25 MB');
      setFile(null);
      e.target.value = '';
      return;
    }
    setErr(null);
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) { setErr('Pick a file first'); return; }
    setBusy(true);
    setErr(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await resourceService.upload({
        title: file.name,
        subject_id: subjectId || null,
        data: reader.result
      });
      setBusy(false);
      if (res.ok) {
        setDone(true);
        onUploaded(res.data);
      } else setErr(res.message);
    };
    reader.onerror = () => { setBusy(false); setErr('Could not read the file'); };
    reader.readAsDataURL(file);
  };

  return (
    <Modal title="Upload Resource" onClose={onClose}>
      {done ? (
        <div>
          <Alert type="success">Resource uploaded — it is now listed in your folder.</Alert>
          <div className="row-actions" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <label>File</label>
          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.mp4,.mov,.webm,.mkv,.mp3,.wav,.jpg,.jpeg,.png,.gif,.webp,.txt,.md" onChange={pick} required />
          <p className="muted small">PDFs, documents, videos and images up to 25 MB. The file is stored on the server; only its name is kept in the database.</p>

          <label>Subject (optional)</label>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">General (no subject)</option>
            {(mySubjects.data || []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {err && <Alert type="error">{err}</Alert>}
          <div className="row-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" disabled={busy || !file}>
              {busy ? 'Uploading…' : 'Upload'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function Resources() {
  const { user } = useAuth();
  const data = useApi(resourceService.folders);
  const mySubjects = useApi(tutorService.getSubjects);
  const [query, setQuery] = useState('');
  const [openTutorIds, setOpenTutorIds] = useState(new Set());
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null);

  const isTutor = user.role_key === 'tutor';
  const q = query.trim().toLowerCase();

  const folders = useMemo(() => {
    const byTutor = new Map();
    for (const r of data.data?.resources || []) {
      if (!byTutor.has(r.tutor_id)) byTutor.set(r.tutor_id, []);
      byTutor.get(r.tutor_id).push(r);
    }
    const tutorRows = (data.data?.tutors || []).map((t) => {
      const tutorFiles = (byTutor.get(Number(t.user_id)) || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const visible = q
        ? tutorFiles.filter((r) => r.title.toLowerCase().includes(q))
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
    const res = await resourceService.remove(r.id);
    if (res.ok) { setNotice({ type: 'success', text: res.message }); data.reload(); }
    else setNotice({ type: 'error', text: res.message });
  };

  return (
    <div>
      <div className="page-head">
        <h2>Resources</h2>
        {isTutor && (
          <button className="btn btn-primary" onClick={() => setUploading(true)}>+ Upload Resource</button>
        )}
      </div>
      {data.loading ? <Spinner /> : null}
      {data.error && <Alert type="error">{data.error.message}</Alert>}
      {notice && <Alert type={notice.type}>{notice.text}</Alert>}

      <div className="card resource-search-bar">
        <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          placeholder="Search a file..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search resources"
        />
        {query && (
          <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>
        )}
      </div>

      <div className="resource-folders">
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
                  <div className="resource-files">
                    {folder.visible.map((r) => (
                      <div className="resource-file" key={r.id}>
                        <div className="resource-file-info">
                          <b className="resource-file-name">{r.title}</b>
                          <span className="resource-file-type">{r.file_type}</span>
                        </div>
                        <div className="resource-file-actions">
                          {isTutor && Number(r.tutor_id) === Number(user.id) && (
                            <button type="button" className="resource-open resource-remove" onClick={() => remove(r)}>
                              Remove
                            </button>
                          )}
                          <a className="resource-open" href={`/api/resources/${r.id}/file`} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

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