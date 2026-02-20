import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { KnowledgeProvider } from './context/KnowledgeContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuard from './components/RoleGuard';
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';
import OfflineBanner from './components/OfflineBanner';

// Auto-reload on chunk load failure (stale deployment cache)
function lazyRetry(factory: () => Promise<{ default: React.ComponentType<unknown> }>) {
  return lazy(() =>
    factory().catch(() => {
      // Old chunk gone after deploy — reload once to get fresh assets
      const key = 'chunk_reload';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
      }
      // Clear flag so future deploys also retry
      sessionStorage.removeItem(key);
      return factory();
    }),
  );
}

// Lazy-loaded pages — public marketing
const Home = lazyRetry(() => import('./pages/public/Home'));
const Features = lazyRetry(() => import('./pages/public/Features'));
const Tour = lazyRetry(() => import('./pages/public/Tour'));
const Pricing = lazyRetry(() => import('./pages/public/Pricing'));
const RequestDemo = lazyRetry(() => import('./pages/public/RequestDemo'));
const Signup = lazyRetry(() => import('./pages/public/Signup'));
const Compare = lazyRetry(() => import('./pages/public/Compare'));
const Enterprise = lazyRetry(() => import('./pages/public/Enterprise'));

// Lazy-loaded pages — auth
const Login = lazyRetry(() => import('./pages/Login'));
const ForgotPassword = lazyRetry(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyRetry(() => import('./pages/ResetPassword'));

// Lazy-loaded pages — app
const Dashboard = lazyRetry(() => import('./pages/Dashboard'));
const Stores = lazyRetry(() => import('./pages/Stores'));
const Reports = lazyRetry(() => import('./pages/Reports'));
const Team = lazyRetry(() => import('./pages/Team'));
const Evaluations = lazyRetry(() => import('./pages/Evaluations'));
const NewWalk = lazyRetry(() => import('./pages/walks/NewWalk'));
const ConductWalk = lazyRetry(() => import('./pages/walks/ConductWalk'));
const WalkReview = lazyRetry(() => import('./pages/walks/WalkReview'));
const WalkDetail = lazyRetry(() => import('./pages/walks/WalkDetail'));
const PlatformAdmin = lazyRetry(() => import('./pages/PlatformAdmin'));
const Settings = lazyRetry(() => import('./pages/Settings'));
const Account = lazyRetry(() => import('./pages/Account'));
const ActionItemDetail = lazyRetry(() => import('./pages/ActionItemDetail'));
const SOPDocumentDetail = lazyRetry(() => import('./pages/SOPDocumentDetail'));
const Billing = lazyRetry(() => import('./pages/Billing'));
const KnowledgeBase = lazyRetry(() => import('./pages/KnowledgeBase'));
const KnowledgeArticlePage = lazyRetry(() => import('./pages/KnowledgeArticlePage'));
const GettingStarted = lazyRetry(() => import('./pages/GettingStarted'));
const Departments = lazyRetry(() => import('./pages/Departments'));
const DepartmentEval = lazyRetry(() => import('./pages/walks/DepartmentEval'));
const Gamification = lazyRetry(() => import('./pages/Gamification'));
const FollowUps = lazyRetry(() => import('./pages/FollowUps'));
const Templates = lazyRetry(() => import('./pages/Templates'));
const DataIntegrations = lazyRetry(() => import('./pages/DataIntegrations'));
const Support = lazyRetry(() => import('./pages/Support'));

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Public marketing pages */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/tour" element={<Tour />} />
        <Route path="/features" element={<Features />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/request-demo" element={<RequestDemo />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/compare/:slug" element={<Compare />} />
        <Route path="/enterprise" element={<Enterprise />} />
      </Route>

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/evaluations" element={<Evaluations />} />
          <Route path="/walks/new" element={<NewWalk />} />
          <Route path="/walks/:walkId/conduct" element={<ConductWalk />} />
          <Route path="/walks/:walkId/review" element={<WalkReview />} />
          <Route path="/walks/:walkId" element={<WalkDetail />} />

          {/* Consolidated pages */}
          <Route path="/follow-ups" element={<FollowUps />} />
          <Route path="/templates" element={<RoleGuard minRole="admin"><Templates /></RoleGuard>} />
          <Route path="/data-integrations" element={<DataIntegrations />} />

          {/* Detail routes (kept intact) */}
          <Route path="/action-items/:actionItemId" element={<ActionItemDetail />} />
          <Route path="/sop-documents/:sopId" element={<RoleGuard minRole="admin"><SOPDocumentDetail /></RoleGuard>} />

          {/* Redirects for old URLs */}
          <Route path="/action-items" element={<Navigate to="/follow-ups" replace />} />
          <Route path="/corrective-actions" element={<Navigate to="/follow-ups" replace />} />
          <Route path="/template-library" element={<Navigate to="/templates" replace />} />
          <Route path="/drivers" element={<Navigate to="/templates" replace />} />
          <Route path="/sop-documents" element={<Navigate to="/templates" replace />} />
          <Route path="/reference-images" element={<Navigate to="/templates" replace />} />
          <Route path="/walks" element={<Navigate to="/evaluations" replace />} />
          <Route path="/schedules" element={<Navigate to="/evaluations#schedules" replace />} />
          <Route path="/data-entry" element={<Navigate to="/data-integrations" replace />} />
          <Route path="/integrations" element={<Navigate to="/data-integrations" replace />} />

          <Route path="/self-assessments" element={<Navigate to="/evaluations#assessments" replace />} />
          <Route
            path="/team"
            element={
              <RoleGuard minRole="admin">
                <Team />
              </RoleGuard>
            }
          />
          <Route
            path="/settings"
            element={
              <RoleGuard minRole="admin">
                <Settings />
              </RoleGuard>
            }
          />
          <Route
            path="/billing"
            element={
              <RoleGuard minRole="admin">
                <Billing />
              </RoleGuard>
            }
          />
          <Route path="/getting-started" element={<GettingStarted />} />
          <Route path="/help" element={<KnowledgeBase />} />
          <Route path="/help/:slug" element={<KnowledgeArticlePage />} />
          <Route path="/account" element={<Account />} />
          <Route path="/departments" element={<RoleGuard minRole="admin"><Departments /></RoleGuard>} />
          <Route path="/department-eval/:walkId" element={<DepartmentEval />} />
          <Route path="/gamification" element={<Gamification />} />
          <Route path="/support" element={<Support />} />
          <Route path="/admin" element={<PlatformAdmin />} />
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
        <KnowledgeProvider>
          <OfflineBanner />
          <Suspense fallback={<div className="min-h-screen" />}>
            <AppRoutes />
          </Suspense>
        </KnowledgeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
