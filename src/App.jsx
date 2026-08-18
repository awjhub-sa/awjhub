import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { RequireAuth, RequireAdmin } from './components/PrivateRoute.jsx';
import React, { useEffect } from 'react';
import { loadMenus } from './lib/menuStore.js';
import { loadNationalities } from './lib/nationalityStore.js';

// صفحات المراقب (Observer)
import Login           from './pages/Login';
import Home            from './pages/Home';
import Profile         from './pages/Profile';
import Mealcheck       from './pages/Mealcheck';
import Report          from './pages/Report';
import MinaReadiness   from './pages/MinaReadiness';
import ArafatReadiness from './pages/ArafatReadiness';
import LogisticsRequest from './pages/LogisticsRequest';

// صفحات المشرف (Supervisor)
import SupervisorHome      from './pages/Supervisor/SupervisorHome';
import SupMinaReadiness    from './pages/Supervisor/SupMinaReadiness';
import SupArafatReadiness  from './pages/Supervisor/SupArafatReadiness';
import SupMealcheck        from './pages/Supervisor/SupMealcheck';
import SupReport           from './pages/Supervisor/SupReport';
import SupLogisticsRequest from './pages/Supervisor/SupLogisticsRequest';

// صفحات المسؤول (Admin)
import AdminLayout         from './pages/admin/AdminLayout';
import AdminDashboard      from './pages/admin/AdminDashboard';
import AdminReports        from './pages/admin/AdminReports';
import AdminLogistics      from './pages/admin/AdminLogistics';
import AdminAnalytics      from './pages/admin/AdminAnalytics';
import AdminCaterers       from './pages/admin/AdminCaterers';
import AdminCenters        from './pages/admin/AdminCenters';
import AdminNationalities  from './pages/admin/AdminNationalities';
import AdminEvaluations    from './pages/admin/AdminEvaluations';
import AdminForms          from './pages/admin/AdminForms';
import AdminBrand          from './pages/admin/AdminBrand';
import AdminDrill          from './pages/admin/AdminDrill';
import AdminReportsCenter  from './pages/admin/AdminReportsCenter';
import AdminInsights       from './pages/admin/AdminInsights';
import AdminObservers      from './pages/admin/AdminObservers';
import AdminSupervisors    from './pages/admin/AdminSupervisors';
import AdminNotifications  from './pages/admin/AdminNotifications';
import AdminTaskAssign     from './pages/admin/AdminTaskAssign';
import AdminPhases         from './pages/admin/AdminPhases';
import AdminReportView     from './pages/admin/AdminReportView';
import ReportsViewer       from './pages/admin/ReportsViewer';
import ReportsDeck         from './pages/admin/ReportsDeck';
import LiveScreen          from './pages/admin/LiveScreen';
import AdminStaff          from './pages/admin/AdminStaff';
import AdminMenu           from './pages/admin/AdminMenu';
import StagesReport        from './pages/admin/StagesReport';

// شاشة تحميل بسيطة مطابقة لهوية التطبيق
const FullPageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

function RootRedirect() {
  const { user, role, loading } = useAuth();
  
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  
  if (role === 'admin' || role === 'staff') return <Navigate to="/admin/dashboard" replace />;
  if (role === 'supervisor') return <Navigate to="/supervisor-home" replace />;
  return <Navigate to="/home" replace />;
}

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  return !user ? children : <RootRedirect />;
};

export default function App() {
  /* Saved menus are read synchronously all over the app, so they are fetched
     once here and laid over the built-in ones. Until they land, the built-in
     menu shows — never a blank card. */
  useEffect(() => { loadNationalities().then(() => loadMenus()); }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

        {/* Observer Routes */}
        <Route path="/home"             element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/profile"          element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/mealcheck"        element={<RequireAuth><Mealcheck /></RequireAuth>} />
        <Route path="/report"           element={<RequireAuth><Report /></RequireAuth>} />
        <Route path="/mina-readiness"   element={<RequireAuth><MinaReadiness /></RequireAuth>} />
        <Route path="/arafat-readiness" element={<RequireAuth><ArafatReadiness /></RequireAuth>} />
        <Route path="/logistics"        element={<RequireAuth><LogisticsRequest /></RequireAuth>} />

        {/* Supervisor Routes */}
        <Route path="/supervisor-home"      element={<RequireAuth><SupervisorHome /></RequireAuth>} />
        <Route path="/sup-mina-readiness"   element={<RequireAuth><SupMinaReadiness /></RequireAuth>} />
        <Route path="/sup-arafat-readiness" element={<RequireAuth><SupArafatReadiness /></RequireAuth>} />
        <Route path="/sup-mealcheck"        element={<RequireAuth><SupMealcheck /></RequireAuth>} />
        <Route path="/sup-report"           element={<RequireAuth><SupReport /></RequireAuth>} />
        <Route path="/sup-logistics"        element={<RequireAuth><SupLogisticsRequest /></RequireAuth>} />
        
        {/* Standalone report view — outside AdminLayout so the page prints cleanly without the sidebar */}
        <Route
          path="/admin/report-view"
          element={<RequireAdmin><AdminReportView /></RequireAdmin>}
        />
        <Route
          path="/admin/stages-report"
          element={<RequireAdmin><StagesReport /></RequireAdmin>}
        />
        <Route
          path="/admin/reports-view"
          element={<RequireAdmin><ReportsViewer /></RequireAdmin>}
        />
        <Route
          path="/admin/reports-deck"
          element={<RequireAdmin><ReportsDeck /></RequireAdmin>}
        />
        {/* The operations wall — outside AdminLayout so it takes the whole display. */}
        <Route
          path="/admin/live"
          element={<RequireAdmin><LiveScreen /></RequireAdmin>}
        />

        {/* Admin Routes */}
        <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index                element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"     element={<AdminDashboard />} />
          <Route path="reports"       element={<AdminReports />} />
          <Route path="logistics"     element={<AdminLogistics />} />
          {/* One implementation, pinned to a mash'ar by prop. `analytics` is
              kept so older links and bookmarks still resolve. */}
          <Route path="analytics"          element={<Navigate to="/admin/readiness/mina" replace />} />
          <Route path="readiness/mina"     element={<AdminAnalytics site="mina" />} />
          <Route path="readiness/arafat"   element={<AdminAnalytics site="arafat" />} />
          <Route path="readiness/drill"    element={<AdminDrill />} />
          <Route path="centers"       element={<AdminCenters />} />
          <Route path="nationalities" element={<AdminNationalities />} />
          <Route path="evaluations"   element={<AdminEvaluations />} />
          <Route path="caterers"      element={<AdminCaterers />} />
          <Route path="forms"         element={<AdminForms />} />
          <Route path="observers"     element={<AdminObservers />} />
          <Route path="supervisors"   element={<AdminSupervisors />} />
          {/* The two roles used to share one screen behind a filter. */}
          <Route path="users"         element={<Navigate to="/admin/observers" replace />} />
          <Route path="staff"         element={<AdminStaff />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="reports-center" element={<AdminReportsCenter />} />
          <Route path="insights"      element={<AdminInsights />} />
          <Route path="brand"         element={<AdminBrand />} />
          <Route path="tasks"         element={<AdminTaskAssign />} />
          <Route path="phases"        element={<AdminPhases />} />
          <Route path="menu"          element={<AdminMenu />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}