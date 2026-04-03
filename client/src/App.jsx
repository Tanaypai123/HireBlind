import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './state/auth.jsx';
import { AppShell } from './ui/AppShell.jsx';
import { LoginPage } from './views/LoginPage.jsx';
import { DashboardPage } from './views/DashboardPage.jsx';
import { SessionUploadPage } from './views/SessionUploadPage.jsx';
import { SessionRankingsPage } from './views/SessionRankingsPage.jsx';
import { SessionAuditPage } from './views/SessionAuditPage.jsx';
import { SessionSchedulerPage } from './views/SessionSchedulerPage.jsx';

function Protected({ children }) {
  const { status } = useAuth();
  if (status === 'loading') return null;
  if (status === 'anon') return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { status } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          status === 'authed' ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
        }
      />
      <Route
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/sessions/:id/upload" element={<SessionUploadPage />} />
        <Route path="/sessions/:id/rankings" element={<SessionRankingsPage />} />
        <Route path="/sessions/:id/audit" element={<SessionAuditPage />} />
        <Route path="/sessions/:id/scheduler" element={<SessionSchedulerPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
