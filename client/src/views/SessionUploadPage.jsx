import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getToken() {
  try {
    return localStorage.getItem('hb_token');
  } catch {
    return null;
  }
}

export function SessionUploadPage() {
  const { id } = useParams();
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const tooFew = files.length > 0 && files.length < 5;
  const canUpload = useMemo(() => files.length >= 5 && !busy, [files.length, busy]);

  async function upload() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const token = getToken();
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      const res = await fetch(`${API_BASE}/api/resumes/upload/${id}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = data?.detail ? ` — ${data.detail}` : '';
        throw new Error((data?.error || 'Upload failed') + detail);
      }
      setResult(data);
    } catch (e) {
      setError(e?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Upload resumes</h1>
          <p className="text-sm text-slate-300">PDF/DOCX only. Minimum 5 files per batch.</p>
        </div>
        <div className="flex gap-2">
          <Link
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            to={`/sessions/${id}/rankings`}
          >
            Go to rankings
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800">
            <input
              className="hidden"
              type="file"
              multiple
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const next = Array.from(e.target.files || []);
                setFiles(next);
                setResult(null);
                setError(null);
              }}
            />
            Choose files
          </label>
          <button
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canUpload}
            onClick={upload}
          >
            {busy ? 'Uploading…' : 'Upload + anonymise'}
          </button>
        </div>

        {tooFew ? (
          <div className="mt-3 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
            Select at least 5 files to upload.
          </div>
        ) : null}
        {error ? (
          <div className="mt-3 rounded-md border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          <div className="text-xs font-semibold text-slate-300">Selected files ({files.length})</div>
          {files.length === 0 ? (
            <div className="text-sm text-slate-400">No files selected.</div>
          ) : (
            <ul className="divide-y divide-slate-800 rounded-md border border-slate-800">
              {files.map((f) => (
                <li key={`${f.name}-${f.size}`} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-slate-200">{f.name}</span>
                  <span className="text-xs text-slate-400">{Math.round(f.size / 1024)} KB</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {result ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-200">Upload results</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {(result.files || []).map((r, idx) => (
              <div key={`${r.originalName}-${idx}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white">{r.originalName}</div>
                  <div className="break-words text-xs text-slate-400">
                    {r.status === 'stored' ? (
                      <>
                        Stored as {r.candidateCode}
                        {r.anonymisation?.usedClaude ? ' · PII pass: Claude + regex' : ' · PII pass: regex only'}
                      </>
                    ) : (
                      <>
                        {r.stage ? <span className="mr-1 font-mono text-amber-200/90">[{r.stage}]</span> : null}
                        {r.error || 'Unknown error'}
                      </>
                    )}
                  </div>
                </div>
                <div className="text-xs">
                  {r.status === 'stored' ? (
                    <span className="rounded-full bg-emerald-950 px-2 py-1 text-emerald-200">OK</span>
                  ) : (
                    <span className="rounded-full bg-rose-950 px-2 py-1 text-rose-200">FAILED</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

