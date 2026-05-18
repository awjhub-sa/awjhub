import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { RequireAuth, RequireAdmin } from './components/PrivateRoute.jsx';
import React from 'react';

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
import AdminUsers          from './pages/admin/AdminUsers';
import AdminNotifications  from './pages/admin/AdminNotifications';
import AdminTaskAssign     from './pages/admin/AdminTaskAssign';
import AdminPhases         from './pages/admin/AdminPhases';
import AdminReportView     from './pages/admin/AdminReportView';
import AdminStaff          from './pages/admin/AdminStaff';
import AdminMenu           from './pages/admin/AdminMenu';

// شاشة تحميل بسيطة مطابقة لهوية التطبيق
const FullPageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB]">
    <div className="w-10 h-10 border-4 border-[#A98159]/30 border-t-[#A98159] rounded-full animate-spin" />
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

        {/* Admin Routes */}
        <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index                element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"     element={<AdminDashboard />} />
          <Route path="reports"       element={<AdminReports />} />
          <Route path="logistics"     element={<AdminLogistics />} />
          <Route path="analytics"     element={<AdminAnalytics />} />
          <Route path="users"         element={<AdminUsers />} />
          <Route path="staff"         element={<AdminStaff />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="tasks"         element={<AdminTaskAssign />} />
          <Route path="phases"        element={<AdminPhases />} />
          <Route path="menu"          element={<AdminMenu />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}