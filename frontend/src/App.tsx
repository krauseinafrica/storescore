import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { KnowledgeProvider } from './context/KnowledgeContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuard from './components/RoleGuard';
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';

// Lazy-loaded pages — public marketing
const Home = lazy(() => import('./pages/public/Home'));
const Features = lazy(() => import('./pages/public/Features'));
const Tour = lazy(() => import('./pages/public/Tour'));
const Pricing = lazy(() => import('./pages/public/Pricing'));
const RequestDemo = lazy(() => import('./pages/public/RequestDemo'));
const Signup = lazy(() => import('./pages/public/Signup'));

// Lazy-loaded pages — auth
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

// Lazy-loaded pages — app
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Stores = lazy(() => import('./pages/Stores'));
const Reports = lazy(() => import('./pages/Reports'));
const Team = lazy(() => import('./pages/Team'));
const Evaluations = lazy(() => import('./pages/Evaluations'));
const NewWalk = lazy(() => import('./pages/walks/NewWalk'));
const ConductWalk = lazy(() => import('./pages/walks/ConductWalk'));
const WalkReview = lazy(() => import('./pages/walks/WalkReview'));
const WalkDetail = lazy(() => import('./pages/walks/WalkDetail'));
const PlatformAdmin = lazy(() => import('./pages/PlatformAdmin'));
const Settings = lazy(() => import('./pages/Settings'));
const Account = lazy(() => import('./pages/Account'));
const ActionItemDetail = lazy(() => import('./pages/ActionItemDetail'));
const SOPDocumentDetail = lazy(() => import('./pages/SOPDocumentDetail'));
const Billing = lazy(() => import('./pages/Billing'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const KnowledgeArticlePage = lazy(() => import('./pages/KnowledgeArticlePage'));
const GettingStarted = lazy(() => import('./pages/GettingStarted'));
const Departments = lazy(() => import('./pages/Departments'));
const DepartmentEval = lazy(() => import('./pages/walks/DepartmentEval'));
const Gamification = lazy(() => import('./pages/Gamification'));
const FollowUps = lazy(() => import('./pages/FollowUps'));
const Templates = lazy(() => import('./pages/Templates'));
const DataIntegrations = lazy(() => import('./pages/DataIntegrations'));
const Support = lazy(() => import('./pages/Support'));

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
          <Suspense fallback={<div className="min-h-screen" />}>
            <AppRoutes />
          </Suspense>
        </KnowledgeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
