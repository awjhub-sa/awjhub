import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/* Spinner shown while auth resolves */
const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB]">
    <div className="w-10 h-10 border-4 border-[#A98159]/30 border-t-[#A98159] rounded-full animate-spin" />
  </div>
);

/* Protects observer routes — must be logged in */
export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user)   return <Navigate to="/login" replace />;
  return children;
}

/* Protects admin routes — must be logged in AND role is admin-tier
   (admin = full access / "مسؤول",  staff = scoped to assigned_centers / "موظف") */
export function RequireAdmin({ children }) {
  const { user, role, loading } = useAuth();
  if (loading)                                  return <Spinner />;
  if (!user)                                    return <Navigate to="/login" replace />;
  if (role !== 'admin' && role !== 'staff')     return <Navigate to="/home"  replace />;
  return children;
}
