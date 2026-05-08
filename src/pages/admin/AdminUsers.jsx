import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { db } from '../../config/db.js';
import { Users, Plus, X, Save, Eye, EyeOff } from 'lucide-react';

/* إعداد Firebase لإنشاء مستخدم ثانوي دون تسجيل خروج الأدمن */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDuLOt2vtIU1unFc6lR-ZSixntCrCW685c",
  authDomain: "hajj-2026-70c2b.firebaseapp.com",
  projectId: "hajj-2026-70c2b",
  storageBucket: "hajj-2026-70c2b.firebasestorage.app",
  messagingSenderId: "834784102995",
  appId: "1:834784102995:web:629acdcfb8a1984af814a6",
};

async function createObserverAccount(email, password, userData) {
  const tempApp  = initializeApp(FIREBASE_CONFIG, `temp_${Date.now()}`);
  const tempAuth = getAuth(tempApp);
  try {
    const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
    const uid  = cred.user.uid;
    await setDoc(doc(db, 'users', uid), {
      ...userData,
      email,
      createdAt: serverTimestamp(),
    });
    return { success: true, uid };
  } finally {
    await tempAuth.signOut().catch(() => {});
    await deleteApp(tempApp).catch(() => {});
  }
}

const ROLES  = [
  { value: 'observer', label: 'مراقب ميداني' },
  { value: 'admin',    label: 'مشرف / مدير'  },
];
const EMPTY  = { name: '', email: '', password: '', role: 'observer', center: '', phone: '' };

export default function AdminUsers() {
  const [users,      setUsers]      = useState([]);
  const [modal,      setModal]      = useState(false);
  const [form,       setForm]       = useState(EMPTY);
  const [editId,     setEditId]     = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [showPass,   setShowPass]   = useState(false);
  const [feedback,   setFeedback]   = useState(null); // { type: 'success'|'error', msg }

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), snap =>
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, []);

  const openNew  = () => { setForm(EMPTY); setEditId(null); setShowPass(false); setModal(true); };
  const openEdit = (u) => {
    setForm({ name: u.name||'', email: u.email||'', password: '', role: u.role||'observer', center: u.center||'', phone: u.phone||'' });
    setEditId(u.id);
    setShowPass(false);
    setModal(true);
  };
  const closeModal = () => { setModal(false); setEditId(null); setFeedback(null); };

  const handleSave = async () => {
    if (!form.name)  { setFeedback({ type: 'error', msg: 'الاسم مطلوب' }); return; }
    if (!form.email) { setFeedback({ type: 'error', msg: 'البريد الإلكتروني مطلوب' }); return; }
    if (!editId && form.password.length < 6) {
      setFeedback({ type: 'error', msg: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      if (editId) {
        /* تعديل بيانات Firestore فقط */
        const payload = { name: form.name, role: form.role, center: form.center, phone: form.phone, updatedAt: serverTimestamp() };
        await updateDoc(doc(db, 'users', editId), payload);
        setFeedback({ type: 'success', msg: 'تم تحديث بيانات المستخدم بنجاح' });
      } else {
        /* إنشاء حساب Auth + Firestore */
        const result = await createObserverAccount(form.email, form.password, {
          name: form.name, role: form.role, center: form.center, phone: form.phone,
        });
        if (result.success) {
          setFeedback({ type: 'success', msg: 'تم إنشاء الحساب بنجاح! يمكن للمراقب الدخول الآن' });
          setTimeout(closeModal, 1800);
        }
      }
    } catch (e) {
      const errMap = {
        'auth/email-already-in-use': 'البريد الإلكتروني مستخدم مسبقاً',
        'auth/invalid-email':        'صيغة البريد الإلكتروني غير صحيحة',
        'auth/weak-password':        'كلمة المرور ضعيفة جداً',
      };
      setFeedback({ type: 'error', msg: errMap[e.code] || `خطأ: ${e.message}` });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2D2926]">إدارة المستخدمين</h1>
          <p className="text-sm text-[#6D6E71]">{users.length} مستخدم مسجّل</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition hover:opacity-90"
          style={{ background: 'linear-gradient(135deg,#C4A46E,#A98159)' }}
        >
          <Plus size={16} /> إضافة مستخدم
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#D1C4B9] shadow-[0_2px_16px_rgba(45,41,38,0.07)] overflow-hidden">
        {users.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={36} className="mx-auto text-[#D1C4B9] mb-3" />
            <p className="text-[#6D6E71] text-sm">لا يوجد مستخدمون بعد</p>
            <button onClick={openNew} className="mt-3 text-[#A98159] text-sm font-medium hover:underline">
              أضف أول مستخدم
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FDFCFB] text-[#6D6E71] text-xs border-b border-[#D1C4B9]">
                  <th className="px-5 py-3 text-right font-medium">الاسم</th>
                  <th className="px-5 py-3 text-right font-medium">البريد</th>
                  <th className="px-5 py-3 text-right font-medium">الدور</th>
                  <th className="px-5 py-3 text-right font-medium">مركز الخدمة</th>
                  <th className="px-5 py-3 text-right font-medium">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D1C4B9]/40">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-[#FDFCFB] transition-colors">
                    <td className="px-5 py-3.5 font-medium text-[#2D2926]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#A98159]/10 border border-[#A98159]/20 flex items-center justify-center text-[#A98159] text-xs font-bold flex-shrink-0">
                          {u.name?.charAt(0) || '؟'}
                        </div>
                        {u.name || '—'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[#6D6E71]" dir="ltr">{u.email || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        u.role === 'admin'
                          ? 'bg-[#A98159]/10 text-[#A98159] border border-[#A98159]/20'
                          : 'bg-[#386B41]/10 text-[#386B41] border border-[#386B41]/20'
                      }`}>
                        {ROLES.find(r => r.value === u.role)?.label || u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[#6D6E71]">{u.center || '—'}</td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => openEdit(u)} className="text-[#A98159] text-xs font-medium hover:underline">
                        تعديل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" dir="rtl">
            <div className="h-1" style={{ background: 'linear-gradient(90deg,#C4A46E,#A98159)' }} />
            <div className="px-6 py-5">

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-[#2D2926] text-lg">
                  {editId ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}
                </h2>
                <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                  <X size={18} className="text-[#6D6E71]" />
                </button>
              </div>

              {/* Feedback */}
              {feedback && (
                <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
                  feedback.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {feedback.msg}
                </div>
              )}

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-[#6D6E71] mb-1.5">الاسم الكامل *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="عمر الرفاعي"
                    className="w-full px-4 py-2.5 border border-[#D1C4B9] rounded-xl text-sm text-[#2D2926] outline-none focus:border-[#A98159] transition"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-[#6D6E71] mb-1.5">البريد الإلكتروني *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="observer@moraqeb.sa"
                    disabled={!!editId}
                    dir="ltr"
                    className={`w-full px-4 py-2.5 border border-[#D1C4B9] rounded-xl text-sm text-[#2D2926] outline-none focus:border-[#A98159] transition ${editId ? 'bg-gray-50 text-[#6D6E71]' : ''}`}
                  />
                  {editId && <p className="text-[10px] text-[#6D6E71] mt-1">لا يمكن تغيير البريد الإلكتروني</p>}
                </div>

                {/* Password — only for new users */}
                {!editId && (
                  <div>
                    <label className="block text-xs font-medium text-[#6D6E71] mb-1.5">كلمة المرور *</label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={form.password}
                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                        placeholder="6 أحرف على الأقل"
                        dir="ltr"
                        className="w-full px-4 py-2.5 border border-[#D1C4B9] rounded-xl text-sm text-[#2D2926] outline-none focus:border-[#A98159] transition pl-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(p => !p)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6D6E71] hover:text-[#A98159] transition"
                      >
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Phone */}
                <div>
                  <label className="block text-xs font-medium text-[#6D6E71] mb-1.5">رقم الجوال</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="05xxxxxxxx"
                    className="w-full px-4 py-2.5 border border-[#D1C4B9] rounded-xl text-sm text-[#2D2926] outline-none focus:border-[#A98159] transition"
                  />
                </div>

                {/* Center */}
                <div>
                  <label className="block text-xs font-medium text-[#6D6E71] mb-1.5">مركز الخدمة</label>
                  <input
                    type="text"
                    value={form.center}
                    onChange={e => setForm(p => ({ ...p, center: e.target.value }))}
                    placeholder="مركز ٤٥"
                    className="w-full px-4 py-2.5 border border-[#D1C4B9] rounded-xl text-sm text-[#2D2926] outline-none focus:border-[#A98159] transition"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-medium text-[#6D6E71] mb-1.5">الدور</label>
                  <div className="flex gap-2">
                    {ROLES.map(r => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, role: r.value }))}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                          form.role === r.value
                            ? 'bg-[#A98159] text-white border-[#A98159]'
                            : 'bg-gray-50 text-[#6D6E71] border-gray-200'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm transition hover:opacity-90 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#C4A46E,#A98159)' }}
                >
                  {saving
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جارٍ الحفظ...</>
                    : <><Save size={16} /> {editId ? 'حفظ التعديلات' : 'إنشاء الحساب'}</>
                  }
                </button>
                <button
                  onClick={closeModal}
                  className="px-5 py-3 rounded-xl border border-[#D1C4B9] text-[#6D6E71] text-sm font-medium hover:bg-gray-50 transition"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
