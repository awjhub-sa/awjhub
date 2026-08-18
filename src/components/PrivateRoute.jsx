import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/* Spinner shown while auth resolves */
const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
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

/* Protects the caterer portal.
 *
 * A caterer is an outside company, so the national-ID sign-in the field team
 * uses is not enough here — that path stores a row in localStorage and anyone
 * who knows an ID number is in. Caterers authenticate through Supabase Auth
 * with a password, which is why this guard checks the role rather than merely
 * that somebody is signed in. */
export function RequireCaterer({ children }) {
  const { user, role, loading } = useAuth();
  if (loading)           return <Spinner />;
  if (!user)             return <Navigate to="/login" replace />;
  if (role !== 'caterer') return <Navigate to="/" replace />;
  return children;
}
