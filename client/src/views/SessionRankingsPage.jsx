import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ApiError, apiFetch } from '../api/http.js';
import { useAuth } from '../state/auth.jsx';

function ScoreBars({ breakdown }) {
  const skills = breakdown?.skills_match ?? 0;
  const exp = breakdown?.experience_relevance ?? 0;
  const yrs = breakdown?.years_of_experience ?? 0;
  const items = [
    { label: 'Skills', v: skills, color: 'bg-indigo-500' },
    { label: 'Experience', v: exp, color: 'bg-emerald-500' },
    { label: 'Years', v: yrs, color: 'bg-amber-500' },
  ];
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>{it.label}</span>
            <span>{Math.round(it.v)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-slate-900">
            <div className={clsx('h-2', it.color)} style={{ width: `${Math.max(0, Math.min(100, it.v))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SessionRankingsPage() {
  const { id: sessionId } = useParams();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyRank, setBusyRank] = useState(false);
  const [toast, setToast] = useState(null);

  const [resumeModal, setResumeModal] = useState(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState(null);
  const [resumePayload, setResumePayload] = useState(null);

  const [overrideModal, setOverrideModal] = useState(null);
  const [overrideNewRank, setOverrideNewRank] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideError, setOverrideError] = useState(null);

  const canRank = user?.role === 'admin';
  const canOverride = user?.role === 'admin' || user?.role === 'recruiter';

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/api/screening/sessions/${sessionId}/rankings`);
      setSession(data.session);
      setRankings(data.rankings || []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e?.message || 'Failed to load rankings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const topRank = useMemo(() => rankings.find((r) => r.rank === 1), [rankings]);
  const rankMax = rankings.length;

  async function openResumeModal(resumeId, candidateCode) {
    setResumeModal({ resumeId, candidateCode });
    setResumePayload(null);
    setResumeError(null);
    setResumeLoading(true);
    try {
      const data = await apiFetch(`/api/resumes/${resumeId}`);
      setResumePayload(data);
    } catch (e) {
      setResumeError(e instanceof ApiError ? e.message : e?.message || 'Failed to load resume');
    } finally {
      setResumeLoading(false);
    }
  }

  function openOverrideModal(r) {
    setOverrideModal({
      rankingId: r.id,
      resumeId: r.resume_id,
      candidateCode: r.candidate_code,
      currentRank: r.rank,
    });
    let suggested = r.rank;
    if (rankMax > 1) {
      suggested = r.rank === 1 ? 2 : r.rank - 1;
    }
    setOverrideNewRank(String(suggested));
    setOverrideReason('');
    setOverrideError(null);
  }

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-emerald-700/60 bg-emerald-950/95 px-4 py-3 text-sm text-emerald-100 shadow-lg">
          {toast}
        </div>
      ) : null}

      {resumeModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-modal-title"
          onClick={(e) => e.target === e.currentTarget && setResumeModal(null)}
          onKeyDown={(e) => e.key === 'Escape' && setResumeModal(null)}
        >
          <div className="flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div>
                <h2 id="resume-modal-title" className="text-lg font-semibold text-white">
                  Anonymised resume
                </h2>
                <p className="mt-0.5 text-sm text-slate-400">
                  {resumePayload?.candidate_code || resumeModal.candidateCode}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-750"
                onClick={() => setResumeModal(null)}
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              {resumeLoading ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : resumeError ? (
                <p className="text-sm text-rose-300">{resumeError}</p>
              ) : (
                <pre className="whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
                  {resumePayload?.anonymised_text || ''}
                </pre>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {overrideModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="override-modal-title"
          onClick={(e) => e.target === e.currentTarget && !overrideSubmitting && setOverrideModal(null)}
          onKeyDown={(e) => e.key === 'Escape' && !overrideSubmitting && setOverrideModal(null)}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
            <h2 id="override-modal-title" className="text-lg font-semibold text-white">
              Manual rank override
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              #{overrideModal.currentRank} · {overrideModal.candidateCode}
            </p>
            <p className="mt-2 text-xs text-amber-200/80">
              You are overriding an AI ranking decision. A reason is required (min. 10 characters).
            </p>

            <label className="mt-4 block">
              <span className="mb-1 block text-xs text-slate-300">New rank (1–{rankMax})</span>
              <input
                type="number"
                min={1}
                max={rankMax}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                value={overrideNewRank}
                onChange={(e) => setOverrideNewRank(e.target.value)}
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-xs text-slate-300">Reason</span>
              <textarea
                className="min-h-24 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why the shortlist order should change…"
              />
            </label>

            {overrideError ? (
              <p className="mt-3 text-sm text-rose-300">{overrideError}</p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200"
                disabled={overrideSubmitting}
                onClick={() => setOverrideModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                disabled={overrideSubmitting}
                onClick={async () => {
                  const reason = overrideReason.trim();
                  if (reason.length < 10) {
                    setOverrideError('Reason must be at least 10 characters.');
                    return;
                  }
                  const nr = parseInt(overrideNewRank, 10);
                  if (!Number.isFinite(nr) || nr < 1 || nr > rankMax) {
                    setOverrideError(`Enter a rank between 1 and ${rankMax}.`);
                    return;
                  }
                  setOverrideError(null);
                  setOverrideSubmitting(true);
                  try {
                    await apiFetch('/api/overrides', {
                      method: 'POST',
                      body: {
                        rankingId: overrideModal.rankingId,
                        newRank: nr,
                        reason,
                      },
                    });
                    setOverrideModal(null);
                    setToast('Shortlist updated — rank override applied');
                    await load();
                  } catch (e) {
                    setOverrideError(e instanceof ApiError ? e.message : e?.message || 'Override failed');
                  } finally {
                    setOverrideSubmitting(false);
                  }
                }}
              >
                {overrideSubmitting ? 'Applying…' : 'Apply override'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Ranked shortlist</h1>
          <p className="text-sm text-slate-300">
            Candidate codes only. Explainability tags are required for every score.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            to={`/sessions/${sessionId}/upload`}
          >
            Upload
          </Link>
          <Link
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            to={`/sessions/${sessionId}/audit`}
          >
            Audit
          </Link>
          <button
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canRank || busyRank}
            onClick={async () => {
              setBusyRank(true);
              setError(null);
              try {
                await apiFetch(`/api/screening/sessions/${sessionId}/rank`, { method: 'POST' });
                await load();
              } catch (e) {
                setError(e instanceof ApiError ? e.message : e?.message || 'Ranking failed');
              } finally {
                setBusyRank(false);
              }
            }}
          >
            {busyRank ? 'Ranking…' : 'Trigger AI ranking'}
          </button>
        </div>
      </div>

      {session ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold text-white">{session.title}</div>
            <div className="mt-1 text-xs text-slate-400">Status: {session.status}</div>
          </div>
          {session.status === 'ranked' ? (
            <div className="rounded-lg border border-indigo-600/40 bg-indigo-950/30 px-4 py-3 text-sm text-indigo-100">
              <span className="font-medium text-indigo-50">Next step: </span>
              <Link
                className="font-medium underline decoration-indigo-400/80 hover:text-white"
                to={`/sessions/${sessionId}/scheduler`}
              >
                Proceed to blind interview scheduling
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4">
        {loading ? (
          <div className="text-sm text-slate-300">Loading…</div>
        ) : rankings.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
            No rankings yet. Upload at least 5 resumes, then trigger ranking.
          </div>
        ) : (
          rankings.map((r) => {
            const isTop = topRank?.resume_id === r.resume_id;
            return (
              <div
                key={r.id}
                className={clsx(
                  'rounded-xl border bg-slate-950/40 p-4',
                  isTop ? 'border-indigo-500' : 'border-slate-800',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      #{r.rank} · {r.candidate_code}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Overall score:{' '}
                      <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-200">
                        {Math.round(r.score)}
                      </span>{' '}
                      · Confidence:{' '}
                      <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-200">
                        {Math.round(r.score_breakdown?.confidence ?? 0)}
                      </span>
                      {r.override ? (
                        <>
                          {' '}
                          · <span className="rounded-full bg-amber-950 px-2 py-1 text-amber-200">OVERRIDDEN</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs font-medium text-amber-100 hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!canOverride || session?.status !== 'ranked' || rankMax < 2}
                      title={
                        session?.status !== 'ranked'
                          ? 'Run ranking first'
                          : rankMax < 2
                            ? 'Need at least two candidates to reorder ranks'
                            : !canOverride
                              ? 'Sign in as admin or recruiter'
                              : 'Change rank with a documented reason'
                      }
                      onClick={() =>
                        canOverride && session?.status === 'ranked' && rankMax >= 2 && openOverrideModal(r)
                      }
                    >
                      Manual override
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800"
                      onClick={() => openResumeModal(r.resume_id, r.candidate_code)}
                    >
                      View anonymised resume
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-semibold text-slate-300">Explainability</div>
                    <div className="flex flex-wrap gap-2">
                      {(r.explainability_tags || []).map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-semibold text-slate-300">Score breakdown</div>
                    <ScoreBars breakdown={r.score_breakdown} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
