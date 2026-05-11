import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { RequireAuth, RequireAdmin } from './components/PrivateRoute.jsx';

// Observer pages
import Login           from './pages/Login';
import Home            from './pages/Home';
import Profile         from './pages/Profile'; // ✅ تم إضافة الاستيراد
import Mealcheck       from './pages/Mealcheck';
import Report          from './pages/Report';
import MinaReadiness   from './pages/MinaReadiness';
import ArafatReadiness from './pages/ArafatReadiness';
import LogisticsRequest from './pages/LogisticsRequest';

// Admin pages
import AdminLayout     from './pages/admin/AdminLayout';
import AdminDashboard  from './pages/admin/AdminDashboard';
import AdminReports    from './pages/admin/AdminReports';
import AdminLogistics  from './pages/admin/AdminLogistics';
import AdminAnalytics  from './pages/admin/AdminAnalytics';
import AdminUsers           from './pages/admin/AdminUsers';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminTaskAssign   from './pages/admin/AdminTaskAssign';

/* Root redirect based on role */
function RootRedirect() {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (!user)            return <Navigate to="/login" replace />;
  if (role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/home" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/"      element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />

        {/* Observer (protected) */}
        <Route path="/home"             element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/profile"          element={<RequireAuth><Profile /></RequireAuth>} /> {/* ✅ تمت إضافة المسار */}
        <Route path="/mealcheck"        element={<RequireAuth><Mealcheck /></RequireAuth>} />
        <Route path="/report"           element={<RequireAuth><Report /></RequireAuth>} />
        <Route path="/mina-readiness"   element={<RequireAuth><MinaReadiness /></RequireAuth>} />
        <Route path="/arafat-readiness" element={<RequireAuth><ArafatReadiness /></RequireAuth>} />
        <Route path="/logistics"        element={<RequireAuth><LogisticsRequest /></RequireAuth>} />
        
        {/* Admin (protected — admin role only) */}
        <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index                element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"     element={<AdminDashboard />} />
          <Route path="reports"       element={<AdminReports />} />
          <Route path="logistics"     element={<AdminLogistics />} />
          <Route path="analytics"     element={<AdminAnalytics />} />
          <Route path="users"         element={<AdminUsers />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="tasks"         element={<AdminTaskAssign />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}