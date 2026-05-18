import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabase.js';
import { db } from '../lib/db.js';

const AuthContext = createContext(null);

/* localStorage key for observer/supervisor sessions */
const MONITOR_SESSION_KEY = 'moraqeb_monitor_session_v1';

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [role,    setRole]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  /* On mount: check the lightweight monitor session FIRST; otherwise fall back
     to Supabase Auth (admin/staff). */
  useEffect(() => {
    let mounted = true;

    // 1) Monitor session in localStorage takes precedence
    const stored = localStorage.getItem(MONITOR_SESSION_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data && (data.role === 'observer' || data.role === 'supervisor')) {
          setUser({ uid: data.uid, idNumber: data.idNumber });
          setRole(data.role);
          setProfile(data);
          setLoading(false);
          return;
        }
        localStorage.removeItem(MONITOR_SESSION_KEY);
      } catch {
        localStorage.removeItem(MONITOR_SESSION_KEY);
      }
    }

    // 2) Supabase Auth session (admin / staff)
    const hydrateFromSession = async (session) => {
      if (!mounted) return;
      if (!session?.user) {
        setUser(null); setRole(null); setProfile(null); setLoading(false);
        return;
      }
      const authUser = session.user;
      try {
        // Look up the user's profile row by auth_uid
        const profileRow = await db.users.findBy('authUid', authUser.id);
        if (!mounted) return;
        if (profileRow) {
          setUser({ uid: profileRow.uid, email: authUser.email });
          setRole(profileRow.role || 'observer');
          setProfile({ ...profileRow, email: authUser.email });
        } else {
          // Auth user with no profile row — treat as observer placeholder
          setUser({ uid: authUser.id, email: authUser.email });
          setRole('observer');
          setProfile({ uid: authUser.id, email: authUser.email });
        }
      } catch (e) {
        console.error('[AuthContext] profile lookup failed:', e);
        setUser({ uid: authUser.id, email: authUser.email });
        setRole('observer');
        setProfile({ uid: authUser.id, email: authUser.email });
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => hydrateFromSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateFromSession(session);
    });

    return () => { mounted = false; sub?.subscription?.unsubscribe(); };
  }, []);

  /* Sign-in a monitor/supervisor by national ID.
     - expectedRole: 'observer' | 'supervisor' (used to gate the wrong-tab case)
     Throws a localized message on failure. */
  const loginAsMonitor = async (idNumber, expectedRole) => {
    const id = (idNumber || '').trim();
    if (!id) throw new Error('أدخل رقم الهوية');
    if (id.length !== 10) throw new Error('رقم الهوية يجب أن يكون 10 أرقام');

    const row = await db.users.findBy('idNumber', id);
    if (!row) throw new Error('رقم الهوية غير مسجل في النظام');

    if (row.role !== 'observer' && row.role !== 'supervisor') {
      throw new Error('هذا الحساب غير صالح للدخول بهذه الطريقة');
    }
    if (expectedRole && row.role !== expectedRole) {
      const label = expectedRole === 'observer' ? 'كمراقب' : 'كمشرف';
      throw new Error(`هذا الحساب غير مسجّل ${label} ميداني`);
    }

    localStorage.setItem(MONITOR_SESSION_KEY, JSON.stringify(row));
    setUser({ uid: row.uid, idNumber: row.idNumber });
    setRole(row.role);
    setProfile(row);
    return row;
  };

  /* Admin/staff login with email + password through Supabase Auth */
  const loginAsAdmin = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: (email || '').trim(),
      password,
    });
    if (error) {
      if (error.message?.includes('Invalid')) throw new Error('بيانات الدخول غير صحيحة');
      throw new Error(error.message || 'فشل تسجيل الدخول');
    }
    return data.user;
  };

  /* Universal logout — clears both session types. */
  const logout = async () => {
    localStorage.removeItem(MONITOR_SESSION_KEY);
    setUser(null);
    setRole(null);
    setProfile(null);
    await supabase.auth.signOut().catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, logout, loginAsMonitor, loginAsAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
