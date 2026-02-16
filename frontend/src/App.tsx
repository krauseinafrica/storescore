import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuard from './components/RoleGuard';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Team from './pages/Team';
import WalkList from './pages/walks/WalkList';
import NewWalk from './pages/walks/NewWalk';
import ConductWalk from './pages/walks/ConductWalk';
import WalkReview from './pages/walks/WalkReview';
import WalkDetail from './pages/walks/WalkDetail';

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/walks" element={<WalkList />} />
          <Route path="/walks/new" element={<NewWalk />} />
          <Route path="/walks/:walkId/conduct" element={<ConductWalk />} />
          <Route path="/walks/:walkId/review" element={<WalkReview />} />
          <Route path="/walks/:walkId" element={<WalkDetail />} />
          <Route
            path="/team"
            element={
              <RoleGuard minRole="admin">
                <Team />
              </RoleGuard>
            }
          />
        </Route>
      </Route>

      {/* Catch-all: redirect to dashboard (ProtectedRoute will handle auth) */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
