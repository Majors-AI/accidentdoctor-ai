import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import PendingSetup from './pages/PendingSetup';
import Login from './pages/Login';

// Pages
import PatientList from './pages/PatientList';
import PatientDetail from './pages/PatientDetail';
import BillingPortal from './pages/BillingPortal';
import PracticesAdmin from './pages/PracticesAdmin';
import PracticeSettings from './pages/PracticeSettings';
import FileCabinet from './pages/FileCabinet';
import PracticeRegistration from './pages/PracticeRegistration';
import NewReferral from './pages/NewReferral';
import Reporting from './pages/Reporting';
import StaffTraining from './pages/StaffTraining';
import PatientIntakeESign from './pages/PatientIntakeESign';
import PatientIntakeAdmin from './pages/PatientIntakeAdmin';

// Shells
import PracticeShell from '@/layout/PracticeShell';
import AppShell from '@/layout/AppShell';

// Journey
import StagePage from '@/journey/StagePage';
import { JOURNEY_STAGES, canAccessStage, homeStage, roleCategory, ADMIN_ONLY_STAGE_IDS } from '@/journey/stages';

// ── STAGE_ELEMENTS: the five wired surfaces ────────────────────────────────
// id 1  → Practice Registration (admin)
// id 5  → Billing Portal  (practice)
// id 6  → Clinical Portal → PatientList  (practice)
// id 7  → File Cabinet    (practice)
// id 9  → Practice Settings (practice)
// id 10 → Admin console → PracticesAdmin (admin)
const STAGE_ELEMENTS = {
  1:  <PracticeRegistration />,
  3:  <PatientIntakeAdmin />,
  5:  <BillingPortal />,
  6:  <PatientList />,
  7:  <FileCabinet />,
  8:  <StaffTraining />,
  9:  <PracticeSettings />,
  10: <PracticesAdmin />,
};

// One route per stage. relative=true → path is relative to parent layout route.
// guard=true → redirect to home if profile can't access; false → always render.
function stageRoute(stage, profile, home, relative, guard = true) {
  const path = relative ? stage.path.replace('/journey/', '') : stage.path;
  const surface = STAGE_ELEMENTS[stage.id] ?? <StagePage title={stage.label} />;
  const element = !guard || canAccessStage(profile, stage)
    ? surface
    : <Navigate to={home.path} replace />;
  return <Route key={stage.id} path={path} element={element} />;
}

// AppShell journey — admins only in Phase 1.
function JourneyRoutes({ profile }) {
  const home = homeStage(profile);
  return (
    <Route element={<AppShell />}>
      <Route index element={<Navigate to={home.path} replace />} />
      {JOURNEY_STAGES.map((stage) => stageRoute(stage, profile, home, true))}
    </Route>
  );
}

const AuthenticatedApp = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Unauthenticated → internal login route (replace → no redirect loop).
  if (!user) return <Navigate to="/login" replace />;

  // profile reads BOTH fields: built-in `role` for platform admin, custom `app_role` for practice staff.
  const profile = { role: user.role ?? 'user', app_role: user.app_role };
  const cat = roleCategory(profile);
  const isPractice = cat === 'practice';
  const isAdmin = cat === 'admin';
  const home = homeStage(profile);

  // No recognised role → show pending setup screen instead of blank/crash.
  if (!cat) return <PendingSetup />;

  // Practice staff: PracticeShell (top header + PracticeBar).
  if (isPractice) {
    return (
      <PracticeShell>
        <Routes>
          {/* Working-nav routes */}
          <Route path="/" element={<PatientList />} />
          <Route path="/patients" element={<PatientList />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/referrals/new" element={<NewReferral />} />
          <Route path="/billing" element={<BillingPortal />} />
          <Route path="/account" element={<PracticeSettings />} />
          <Route path="/reporting" element={profile.app_role === 'practice_admin' ? <Reporting /> : <Navigate to="/" replace />} />
          <Route path="/staff-training" element={<StaffTraining />} />

          {/* Journey stage routes — admin-only stages redirect practice users to home */}
          {JOURNEY_STAGES.map((stage) => stageRoute(stage, profile, home, false, ADMIN_ONLY_STAGE_IDS.has(stage.id)))}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PracticeShell>
    );
  }

  // Admin: AppShell journey.
  return (
    <Routes>
      <Route path="/journey/*">
        {JourneyRoutes({ profile })}
      </Route>
      <Route path="/" element={<Navigate to="/journey" replace />} />
      <Route path="*" element={<Navigate to="/journey" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route path="/intake/:token" element={<PatientIntakeESign />} />
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<AuthenticatedApp />} />
          </Routes>
          <Toaster />
        </Router>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;