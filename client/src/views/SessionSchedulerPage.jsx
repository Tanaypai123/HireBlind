import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, apiFetch } from '../api/http.js';

function todayIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function interviewsToMap(list) {
  const m = {};
  for (const i of list || []) {
    m[i.resume_id] = i;
  }
  return m;
}

export function SessionSchedulerPage() {
  const { id: sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [shortlist, setShortlist] = useState([]);
  const [interviewsByResume, setInterviewsByResume] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [scheduleModal, setScheduleModal] = useState(null);
  const [modalDate, setModalDate] = useState('');
  const [modalTime, setModalTime] = useState('10:00');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [revealModal, setRevealModal] = useState(null);

  const notRanked = session && session.status !== 'ranked';

  const openScheduleModal = (c) => {
    setModalDate(todayIsoDate());
    setModalTime('10:00');
    setModalError(null);
    setScheduleModal({
      resumeId: c.resume_id,
      candidateCode: c.candidate_code,
      rank: c.rank,
    });
  };

  async function load() {
    setLoading(true);
    setError(null);
    setShortlist([]);
    setInterviewsByResume({});
    try {
      const meta = await apiFetch(`/api/screening/sessions/${sessionId}`);
      setSession(meta.session);

      if (meta.session?.status !== 'ranked') {
        return;
      }

      const [shortlistRes, interviewsRes] = await Promise.all([
        apiFetch(`/api/screening/sessions/${sessionId}/shortlist`),
        apiFetch(`/api/interviews/session/${sessionId}`),
      ]);
      setShortlist(shortlistRes.shortlist || []);
      setInterviewsByResume(interviewsToMap(interviewsRes.interviews));
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e?.message || 'Failed to load';
      const extra =
        e instanceof ApiError && e.details?.detail ? ` ${e.details.detail}` : '';
      setError(`${msg}${extra}`);
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
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const modalSlotLabel = useMemo(() => {
    if (!modalDate || !modalTime) return '';
    return `${modalDate} ${modalTime}`;
  }, [modalDate, modalTime]);

  return (
    <div className="space-y-6">
      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-emerald-700/60 bg-emerald-950/95 px-4 py-3 text-sm text-emerald-100 shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      {scheduleModal ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setScheduleModal(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setScheduleModal(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
            <h2 id="schedule-modal-title" className="text-lg font-semibold text-white">
              Schedule interview
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              #{scheduleModal.rank} · {scheduleModal.candidateCode}
            </p>

            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-300">Date</span>
                <input
                  type="date"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-300">Time</span>
                <input
                  type="time"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={modalTime}
                  onChange={(e) => setModalTime(e.target.value)}
                />
              </label>
            </div>

            {modalError ? (
              <div className="mt-3 rounded-md border border-rose-800/60 bg-rose-950/40 p-2 text-sm text-rose-200">
                {modalError}
              </div>
            ) : null}

            <p className="mt-3 text-xs text-slate-500">Stored slot: {modalSlotLabel || '—'}</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-750"
                onClick={() => setScheduleModal(null)}
                disabled={modalSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                disabled={modalSubmitting || !modalDate || !modalTime}
                onClick={async () => {
                  const slot = `${modalDate} ${modalTime}`.trim();
                  setModalError(null);
                  setModalSubmitting(true);
                  try {
                    await apiFetch('/api/interviews', {
                      method: 'POST',
                      body: {
                        sessionId,
                        resumeId: scheduleModal.resumeId,
                        slot,
                      },
                    });
                    setScheduleModal(null);
                    setToast('Interview scheduled successfully');
                    await load();
                  } catch (err) {
                    const msg =
                      err instanceof ApiError
                        ? err.message
                        : err?.message || 'Could not schedule';
                    setModalError(msg);
                  } finally {
                    setModalSubmitting(false);
                  }
                }}
              >
                {modalSubmitting ? 'Saving…' : 'Confirm schedule'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {revealModal ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reveal-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRevealModal(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setRevealModal(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
            <h2 id="reveal-modal-title" className="text-lg font-semibold text-white">
              Identity reveal (audited)
            </h2>
            <p className="mt-4 text-center text-base text-slate-100">
              <span className="font-semibold text-indigo-200">{revealModal.candidateCode}</span>
              <span className="mx-2 text-slate-500">→</span>
              <span className="font-medium text-white">
                &ldquo;{revealModal.originalName || 'Not detected from resume'}&rdquo;
              </span>
            </p>
            <p className="mt-3 text-center text-xs text-slate-500">
              This action was recorded in the audit log.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                onClick={() => setRevealModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Blind interview scheduler</h1>
          <p className="text-sm text-slate-300">Candidate codes only. Reveal action is always audited.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            onClick={load}
          >
            Refresh
          </button>
          <Link
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            to={`/sessions/${sessionId}/rankings`}
          >
            Back to rankings
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-slate-300">Loading…</div>
      ) : notRanked ? (
        <div className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-5 text-sm text-amber-100">
          <p className="font-medium text-amber-50">Please run ranking before scheduling interviews</p>
          <p className="mt-2 text-amber-100/90">
            This session is <span className="font-mono text-amber-200">{session?.status || '…'}</span>.
            Go to Rankings and trigger AI ranking, then return here.
          </p>
          <Link
            className="mt-4 inline-block rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500"
            to={`/sessions/${sessionId}/rankings`}
            title="Run ranking first"
          >
            Go to rankings
          </Link>
        </div>
      ) : shortlist.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
          No ranked candidates in this session yet. If you just ran ranking, try Refresh. Otherwise trigger
          ranking from the Rankings page.
        </div>
      ) : (
        <div className="grid gap-4">
          {shortlist.map((c) => {
            const scheduled = interviewsByResume[c.resume_id];
            return (
              <div key={c.resume_id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">
                      #{c.rank} · {c.candidate_code}
                    </div>
                    {scheduled ? (
                      <div className="mt-1 text-xs text-emerald-300/90">
                        Scheduled: <span className="font-mono text-emerald-200">{scheduled.slot}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800"
                      onClick={async () => {
                        const ok = window.confirm('Reveal identity? This will be logged.');
                        if (!ok) return;
                        try {
                          const resumeId =
                            typeof c.resume_id === 'string' ? c.resume_id.trim() : '';
                          if (!resumeId) {
                            alert('Missing resume id. Refresh the scheduler and try again.');
                            return;
                          }
                          const data = await apiFetch(
                            `/api/screening/sessions/${sessionId}/reveal`,
                            {
                              method: 'POST',
                              body: { resumeId },
                            },
                          );
                          setRevealModal({
                            candidateCode: data.candidate_code || c.candidate_code,
                            originalName: data.original_name ?? null,
                          });
                        } catch (err) {
                          const m = err instanceof ApiError ? err.message : err?.message || 'Reveal failed';
                          alert(m);
                        }
                      }}
                    >
                      Reveal identity
                    </button>
                    <button
                      type="button"
                      title={scheduled ? 'Interview already scheduled for this candidate' : undefined}
                      className={
                        scheduled
                          ? 'cursor-not-allowed rounded-md border border-slate-800/80 bg-slate-900/40 px-3 py-2 text-xs text-slate-500'
                          : 'rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500'
                      }
                      disabled={Boolean(scheduled)}
                      onClick={() => !scheduled && openScheduleModal(c)}
                    >
                      Schedule
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
