import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../config/db.js';

const AuthContext = createContext(null);

/* localStorage key for observer/supervisor sessions */
const MONITOR_SESSION_KEY = 'moraqeb_monitor_session_v1';

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [role,    setRole]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  /* On mount: check the lightweight monitor session FIRST; otherwise fall back
     to Firebase Auth (admin). */
  useEffect(() => {
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

    // 2) Firebase Auth listener (admin / staff)
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          const data = snap.exists() ? snap.data() : {};
          setRole(data.role || 'observer');
          setProfile({ uid: firebaseUser.uid, email: firebaseUser.email, ...data });
        } catch {
          setRole('observer');
          setProfile({ uid: firebaseUser.uid, email: firebaseUser.email });
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
        setRole(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  /* Sign-in a monitor/supervisor by national ID.
     - expectedRole: 'observer' | 'supervisor' (used to gate the wrong-tab case)
     Throws a localized message on failure. */
  const loginAsMonitor = async (idNumber, expectedRole) => {
    const id = (idNumber || '').trim();
    if (!id) throw new Error('أدخل رقم الهوية');
    if (id.length !== 10) throw new Error('رقم الهوية يجب أن يكون 10 أرقام');

    const q    = query(collection(db, 'users'), where('idNumber', '==', id));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('رقم الهوية غير مسجل في النظام');

    const docSnap = snap.docs[0];
    const data    = { uid: docSnap.id, ...docSnap.data() };

    if (data.role !== 'observer' && data.role !== 'supervisor') {
      throw new Error('هذا الحساب غير صالح للدخول بهذه الطريقة');
    }
    if (expectedRole && data.role !== expectedRole) {
      const label = expectedRole === 'observer' ? 'كمراقب' : 'كمشرف';
      throw new Error(`هذا الحساب غير مسجّل ${label} ميداني`);
    }

    localStorage.setItem(MONITOR_SESSION_KEY, JSON.stringify(data));
    setUser({ uid: data.uid, idNumber: data.idNumber });
    setRole(data.role);
    setProfile(data);
    return data;
  };

  /* Universal logout — clears both session types. */
  const logout = async () => {
    localStorage.removeItem(MONITOR_SESSION_KEY);
    setUser(null);
    setRole(null);
    setProfile(null);
    await signOut(auth).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, logout, loginAsMonitor }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
