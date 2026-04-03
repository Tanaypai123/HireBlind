import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth.jsx';

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@hireblind.local');
  const [password, setPassword] = useState('admin12345');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const disabled = useMemo(() => busy || status === 'loading', [busy, status]);

  return (
    <div className="mx-auto grid min-h-[80vh] max-w-md place-items-center">
      <div className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 p-6 shadow">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">HireBlind</h1>
          <p className="text-sm text-slate-300">Bias-free resume screening (demo)</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setBusy(true);
            try {
              await login(email, password);
              navigate('/dashboard');
            } catch (err) {
              setError(err?.message || 'Login failed');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm text-slate-200">Email</span>
            <input
              className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-white outline-none ring-indigo-500 focus:ring-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-200">Password</span>
            <input
              className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-white outline-none ring-indigo-500 focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>

          {error ? (
            <div className="rounded-md border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <button
            className="w-full rounded-md bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            type="submit"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="text-xs text-slate-400">
            Demo defaults (auto-created on first server start if the database has no users):{' '}
            <span className="text-slate-200">admin@hireblind.local</span> /{' '}
            <span className="text-slate-200">admin12345</span>
          </div>
        </form>
      </div>
    </div>
  );
}

