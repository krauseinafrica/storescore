import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { KnowledgeProvider } from './context/KnowledgeContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuard from './components/RoleGuard';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Stores from './pages/Stores';
import Reports from './pages/Reports';
import Team from './pages/Team';
import WalkList from './pages/walks/WalkList';
import NewWalk from './pages/walks/NewWalk';
import ConductWalk from './pages/walks/ConductWalk';
import WalkReview from './pages/walks/WalkReview';
import WalkDetail from './pages/walks/WalkDetail';
import PlatformAdmin from './pages/PlatformAdmin';
import Settings from './pages/Settings';
import Account from './pages/Account';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Schedules from './pages/Schedules';
import ActionItems from './pages/ActionItems';
import ActionItemDetail from './pages/ActionItemDetail';
import SelfAssessments from './pages/SelfAssessments';
import CorrectiveActions from './pages/CorrectiveActions';
import SOPDocuments from './pages/SOPDocuments';
import SOPDocumentDetail from './pages/SOPDocumentDetail';
import Billing from './pages/Billing';
import KnowledgeBase from './pages/KnowledgeBase';
import KnowledgeArticlePage from './pages/KnowledgeArticlePage';
import GettingStarted from './pages/GettingStarted';
import PublicLayout from './components/PublicLayout';
import Features from './pages/public/Features';
import Pricing from './pages/public/Pricing';
import RequestDemo from './pages/public/RequestDemo';
import IntegrationSettings from './pages/IntegrationSettings';
import DataEntry from './pages/DataEntry';
import DriverManagement from './pages/DriverManagement';
import TemplateLibrary from './pages/TemplateLibrary';
import Departments from './pages/Departments';
import DepartmentEval from './pages/walks/DepartmentEval';

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Public marketing pages */}
      <Route element={<PublicLayout />}>
        <Route path="/features" element={<Features />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/request-demo" element={<RequestDemo />} />
      </Route>

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/walks" element={<WalkList />} />
          <Route path="/walks/new" element={<NewWalk />} />
          <Route path="/walks/:walkId/conduct" element={<ConductWalk />} />
          <Route path="/walks/:walkId/review" element={<WalkReview />} />
          <Route path="/walks/:walkId" element={<WalkDetail />} />
          <Route path="/schedules" element={<RoleGuard minRole="admin"><Schedules /></RoleGuard>} />
          <Route path="/action-items" element={<ActionItems />} />
          <Route path="/action-items/:actionItemId" element={<ActionItemDetail />} />
          <Route path="/self-assessments" element={<SelfAssessments />} />
          <Route path="/corrective-actions" element={<CorrectiveActions />} />
          <Route path="/sop-documents" element={<RoleGuard minRole="admin"><SOPDocuments /></RoleGuard>} />
          <Route path="/sop-documents/:sopId" element={<RoleGuard minRole="admin"><SOPDocumentDetail /></RoleGuard>} />
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
          <Route path="/integrations" element={<RoleGuard minRole="admin"><IntegrationSettings /></RoleGuard>} />
          <Route path="/drivers" element={<RoleGuard minRole="admin"><DriverManagement /></RoleGuard>} />
          <Route path="/template-library" element={<RoleGuard minRole="admin"><TemplateLibrary /></RoleGuard>} />
          <Route path="/departments" element={<RoleGuard minRole="admin"><Departments /></RoleGuard>} />
          <Route path="/department-eval/:walkId" element={<DepartmentEval />} />
          <Route path="/data-entry" element={<DataEntry />} />
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
          <AppRoutes />
        </KnowledgeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
