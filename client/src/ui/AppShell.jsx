import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/auth.jsx';
import clsx from 'clsx';

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'rounded-md px-3 py-2 text-sm font-medium transition',
          isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900 hover:text-white',
        )
      }
    >
      {children}
    </NavLink>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-800 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              HB
            </span>
            HireBlind
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-slate-300 sm:block">
              {user?.email} · {user?.role}
            </span>
            <button
              className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Logout
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl items-center gap-2 px-4 pb-3">
          <NavItem to="/dashboard">Dashboard</NavItem>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

