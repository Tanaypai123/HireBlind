import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/http.js';
import { useAuth } from '../state/auth.jsx';

export function DashboardPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [title, setTitle] = useState('Backend Engineer Screening');
  const [jobDescription, setJobDescription] = useState(
    'Looking for a backend engineer with Node.js, PostgreSQL, APIs, and production experience.',
  );

  const canCreate = user?.role === 'admin';

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/screening/sessions');
      setSessions(data.sessions || []);
    } catch (e) {
      setError(e?.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSessions = useMemo(() => sessions.filter((s) => s.status !== 'closed'), [sessions]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-300">
            {user?.role === 'admin'
              ? 'Create sessions, upload resumes, trigger ranking.'
              : 'View ranked shortlists and transparency reports.'}
          </p>
        </div>
        <button
          className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
          onClick={load}
        >
          Refresh
        </button>
      </div>

      {canCreate ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Create screening session</h2>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                await apiFetch('/api/screening/sessions', {
                  method: 'POST',
                  body: { title, job_description: jobDescription },
                });
                await load();
              } catch (err) {
                setError(err?.message || 'Failed to create session');
              }
            }}
          >
            <label className="block">
              <span className="mb-1 block text-xs text-slate-300">Title</span>
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-indigo-500 focus:ring-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs text-slate-300">Job description</span>
              <textarea
                className="min-h-24 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-indigo-500 focus:ring-2"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </label>
            <div className="md:col-span-2">
              <button className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                Create session
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-800 bg-slate-950/40">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Sessions</h2>
        </div>
        <div className="divide-y divide-slate-800">
          {loading ? (
            <div className="px-4 py-4 text-sm text-slate-300">Loading…</div>
          ) : openSessions.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-300">No sessions yet.</div>
          ) : (
            openSessions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                <div>
                  <div className="font-medium text-white">{s.title}</div>
                  <div className="text-xs text-slate-400">
                    Status: {s.status} · Created {new Date(s.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800"
                    to={`/sessions/${s.id}/upload`}
                  >
                    Upload
                  </Link>
                  <Link
                    className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800"
                    to={`/sessions/${s.id}/rankings`}
                  >
                    Rankings
                  </Link>
                  <Link
                    className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800"
                    to={`/sessions/${s.id}/audit`}
                  >
                    Audit
                  </Link>
                  {s.status === 'ranked' ? (
                    <Link
                      className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800"
                      to={`/sessions/${s.id}/scheduler`}
                      title="Blind interview scheduling"
                    >
                      Scheduler
                    </Link>
                  ) : (
                    <span
                      className="inline-flex cursor-not-allowed items-center rounded-md border border-slate-800/80 bg-slate-900/40 px-3 py-2 text-xs text-slate-500"
                      title="Run ranking first"
                    >
                      Scheduler
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

