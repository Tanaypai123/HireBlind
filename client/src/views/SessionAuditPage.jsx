import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../api/http.js';

export function SessionAuditPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const d = await apiFetch(`/api/audit/session/${id}`);
      setData(d);
    } catch (e) {
      setError(e?.message || 'Failed to load audit');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">EU AI Act transparency report</h1>
          <p className="text-sm text-slate-300">Timestamped audit logs for anonymisation and ranking.</p>
        </div>
        <div className="flex gap-2">
          <Link
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            to={`/sessions/${id}/rankings`}
          >
            Back to rankings
          </Link>
          <button
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            onClick={load}
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-slate-300">Loading…</div>
      ) : data ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold text-white">{data.session?.title}</div>
            <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                <div className="text-xs text-slate-400">PII fields removed</div>
                <div className="text-lg font-semibold text-white">{data.total_pii_fields_removed}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                <div className="text-xs text-slate-400">Human overrides</div>
                <div className="text-lg font-semibold text-white">{data.human_overrides_count}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                <div className="text-xs text-slate-400">Compliance</div>
                <div className="text-sm font-semibold text-emerald-200">{data.compliance_statement}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40">
            <div className="border-b border-slate-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-200">Audit log</h2>
            </div>
            <div className="divide-y divide-slate-800">
              {(data.audit_logs || []).map((l) => (
                <details key={l.id} className="px-4 py-4">
                  <summary className="cursor-pointer select-none text-sm text-white">
                    <span className="mr-2 rounded-full border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200">
                      {l.action_type}
                    </span>
                    <span className="text-xs text-slate-400">{new Date(l.logged_at).toLocaleString()}</span>
                  </summary>
                  <pre className="mt-3 overflow-auto rounded-md border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-200">
{JSON.stringify(l, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

