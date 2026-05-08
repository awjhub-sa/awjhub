import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { db } from '../../config/db.js';
import { CENTERS, getCaterer } from '../../config/centers.js';
import { Users, Plus, X, Save, Eye, EyeOff, ChevronDown } from 'lucide-react';

/* ── Firebase secondary app ── */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDuLOt2vtIU1unFc6lR-ZSixntCrCW685c",
  authDomain: "hajj-2026-70c2b.firebaseapp.com",
  projectId: "hajj-2026-70c2b",
  storageBucket: "hajj-2026-70c2b.firebasestorage.app",
  messagingSenderId: "834784102995",
  appId: "1:834784102995:web:629acdcfb8a1984af814a6",
};

async function createAccount(email, password, userData) {
  const tempApp  = initializeApp(FIREBASE_CONFIG, `temp_${Date.now()}`);
  const tempAuth = getAuth(tempApp);
  try {
    const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), {
      ...userData, email, createdAt: serverTimestamp(),
    });
    return { success: true, uid: cred.user.uid };
  } finally {
    await tempAuth.signOut().catch(() => {});
    await deleteApp(tempApp).catch(() => {});
  }
}

/* getCaterer imported from centers.js */

/* ── حقل إدخال مشترك ── */
const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-medium text-[#6D6E71] mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full px-4 py-2.5 border border-[#D1C4B9] rounded-xl text-sm text-[#2D2926] outline-none focus:border-[#A98159] transition placeholder-[#6D6E71]/40";

/* ── Multi-Select للمراكز — خارج AdminUsers لتجنّب إعادة التهيئة ── */
function MultiCenterSelect({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const toggle = (c) =>
    onChange(selected.includes(c) ? selected.filter(x => x !== c) : [...selected, c]);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="w-full px-4 py-2.5 border border-[#D1C4B9] rounded-xl text-sm text-right flex items-center justify-between focus:border-[#A98159] outline-none transition bg-white">
        <span className={selected.length ? 'text-[#2D2926]' : 'text-[#6D6E71]/50'}>
          {selected.length ? selected.join(' - ') : 'اختر مراكز الخدمة'}
        </span>
        <ChevronDown size={15} className={`text-[#6D6E71] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 top-full right-0 left-0 mt-1 bg-white border border-[#D1C4B9] rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {CENTERS.map(c => (
            <label key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FDF8F0] cursor-pointer text-sm">
              <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)}
                className="accent-[#A98159] w-4 h-4" />
              <div className="min-w-0">
                <span className="text-[#2D2926] font-medium">{c.id}</span>
                <span className="text-[#6D6E71] text-xs block truncate">{c.caterer}</span>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function AdminUsers() {
  const [tab,       setTab]       = useState('observers');
  const [allUsers,  setAllUsers]  = useState([]);
  const [modal,     setModal]     = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [feedback,  setFeedback]  = useState(null);
  const [showPass,  setShowPass]  = useState(false);
  const [editId,    setEditId]    = useState(null);

  const EMPTY_OBS = { nameAr: '', nameEn: '', idNumber: '', phone: '', email: '', password: '', center: '', supervisorId: '' };
  const EMPTY_SUP = { nameAr: '', nameEn: '', idNumber: '', phone: '', email: '', password: '', centers: [] };
  const [obsForm, setObsForm] = useState(EMPTY_OBS);
  const [supForm, setSupForm] = useState(EMPTY_SUP);

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), snap =>
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, []);

  const observers   = allUsers.filter(u => u.role === 'observer');
  const supervisors = allUsers.filter(u => u.role === 'supervisor' || u.role === 'admin');

  const openNew = () => {
    setEditId(null); setFeedback(null); setShowPass(false);
    if (tab === 'observers') setObsForm(EMPTY_OBS);
    else                     setSupForm(EMPTY_SUP);
    setModal(true);
  };

  const openEdit = (u) => {
    setEditId(u.id); setFeedback(null); setShowPass(false);
    if (tab === 'observers') {
      setObsForm({
        nameAr: u.nameAr || u.name || '', nameEn: u.nameEn || '',
        idNumber: u.idNumber || '', phone: u.phone || '',
        email: u.email || '', password: '',
        center: u.center || '', supervisorId: u.supervisorId || '',
      });
    } else {
      setSupForm({
        nameAr: u.nameAr || u.name || '', nameEn: u.nameEn || '',
        idNumber: u.idNumber || '', phone: u.phone || '',
        email: u.email || '', password: '',
        centers: u.centers || (u.center ? [u.center] : []),
      });
    }
    setModal(true);
  };

  const closeModal = () => { setModal(false); setEditId(null); setFeedback(null); };

  /* ── حفظ ── */
  const handleSave = async () => {
    const isObs = tab === 'observers';
    const form  = isObs ? obsForm : supForm;

    if (!form.nameAr)  { setFeedback({ type: 'error', msg: 'الاسم الرباعي (عربي) مطلوب' }); return; }
    if (!form.email)   { setFeedback({ type: 'error', msg: 'البريد الإلكتروني مطلوب' }); return; }
    if (form.idNumber && form.idNumber.length !== 10) {
      setFeedback({ type: 'error', msg: 'رقم الهوية يجب أن يكون 10 أرقام بالضبط' }); return;
    }
    if (form.phone && form.phone.length !== 10) {
      setFeedback({ type: 'error', msg: 'رقم الجوال يجب أن يكون 10 أرقام بالضبط' }); return;
    }
    if (!form.idNumber) { setFeedback({ type: 'error', msg: 'رقم الهوية مطلوب' }); return; }
    if (!form.phone)    { setFeedback({ type: 'error', msg: 'رقم الجوال مطلوب' }); return; }
    if (isObs && !form.center)  { setFeedback({ type: 'error', msg: 'مركز الخدمة مطلوب' }); return; }
    if (!isObs && form.centers.length === 0) { setFeedback({ type: 'error', msg: 'اختر مركزاً واحداً على الأقل' }); return; }
    if (!editId && form.password.length < 6) {
      setFeedback({ type: 'error', msg: 'كلمة المرور 6 أحرف على الأقل' }); return;
    }

    setSaving(true); setFeedback(null);
    try {
      const catereresMap = Object.fromEntries(
        (isObs ? [form.center] : form.centers).map(cid => [cid, getCaterer(cid)])
      );

      if (editId) {
        const payload = isObs
          ? { nameAr: form.nameAr, nameEn: form.nameEn, name: form.nameAr,
              idNumber: form.idNumber, phone: form.phone,
              center: form.center, caterer: getCaterer(form.center),
              supervisorId: form.supervisorId, updatedAt: serverTimestamp() }
          : { nameAr: form.nameAr, nameEn: form.nameEn, name: form.nameAr,
              idNumber: form.idNumber, phone: form.phone,
              centers: form.centers, center: form.centers[0] || '',
              caterers: catereresMap, updatedAt: serverTimestamp() };
        await updateDoc(doc(db, 'users', editId), payload);
        setFeedback({ type: 'success', msg: 'تم تحديث البيانات بنجاح' });
        setTimeout(closeModal, 1500);
      } else {
        const userData = isObs
          ? { nameAr: form.nameAr, nameEn: form.nameEn, name: form.nameAr,
              idNumber: form.idNumber, phone: form.phone,
              center: form.center, caterer: getCaterer(form.center),
              supervisorId: form.supervisorId, role: 'observer' }
          : { nameAr: form.nameAr, nameEn: form.nameEn, name: form.nameAr,
              idNumber: form.idNumber, phone: form.phone,
              centers: form.centers, center: form.centers[0] || '',
              caterers: catereresMap, role: 'supervisor' };
        await createAccount(form.email, form.password, userData);
        setFeedback({ type: 'success', msg: `تم إنشاء حساب ${isObs ? 'المراقب' : 'المشرف'} بنجاح` });
        setTimeout(closeModal, 1500);
      }
    } catch (e) {
      const map = {
        'auth/email-already-in-use': 'البريد الإلكتروني مستخدم مسبقاً',
        'auth/invalid-email':        'صيغة البريد الإلكتروني غير صحيحة',
        'auth/weak-password':        'كلمة المرور ضعيفة جداً',
      };
      setFeedback({ type: 'error', msg: map[e.code] || e.message });
    }
    setSaving(false);
  };

  /* ── جدول ── */
  const renderTable = (list, emptyMsg) => (
    <div className="bg-white rounded-2xl border border-[#D1C4B9] shadow-sm overflow-hidden">
      {list.length === 0 ? (
        <div className="py-14 text-center">
          <Users size={32} className="mx-auto text-[#D1C4B9] mb-3" />
          <p className="text-[#6D6E71] text-sm">{emptyMsg}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FDFCFB] text-[#6D6E71] text-xs border-b border-[#D1C4B9]">
                <th className="px-5 py-3 text-right font-medium">الاسم (عربي)</th>
                <th className="px-5 py-3 text-right font-medium">الاسم (انجليزي)</th>
                <th className="px-5 py-3 text-right font-medium">رقم الهوية</th>
                <th className="px-5 py-3 text-right font-medium">الجوال</th>
                <th className="px-5 py-3 text-right font-medium">البريد</th>
                <th className="px-5 py-3 text-right font-medium">{tab === 'observers' ? 'المركز' : 'المراكز'}</th>
                <th className="px-5 py-3 text-right font-medium">المتعهد</th>
                {tab === 'observers' && <th className="px-5 py-3 text-right font-medium">المشرف</th>}
                <th className="px-5 py-3 text-right font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D1C4B9]/40">
              {list.map(u => {
                const sup = supervisors.find(s => s.id === u.supervisorId);
                return (
                  <tr key={u.id} className="hover:bg-[#FDFCFB] transition-colors">
                    <td className="px-5 py-3.5 font-medium text-[#2D2926]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#A98159]/10 border border-[#A98159]/20 flex items-center justify-center text-[#A98159] text-xs font-bold flex-shrink-0">
                          {(u.nameAr || u.name)?.charAt(0) || '؟'}
                        </div>
                        {u.nameAr || u.name || '—'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[#6D6E71]">{u.nameEn || '—'}</td>
                    <td className="px-5 py-3.5 text-[#6D6E71]" dir="ltr">{u.idNumber || '—'}</td>
                    <td className="px-5 py-3.5 text-[#6D6E71]" dir="ltr">{u.phone || '—'}</td>
                    <td className="px-5 py-3.5 text-[#6D6E71] text-xs" dir="ltr">{u.email || '—'}</td>
                    <td className="px-5 py-3.5 text-[#6D6E71] text-xs">
                      {tab === 'observers' ? u.center || '—' : u.centers?.join('، ') || u.center || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-[#6D6E71] text-xs max-w-[180px] truncate">
                      {tab === 'observers'
                        ? (u.caterer || getCaterer(u.center) || '—')
                        : (u.centers?.map(cid => u.caterers?.[cid] || getCaterer(cid)).filter(Boolean).join(' / ') || '—')}
                    </td>
                    {tab === 'observers' && (
                      <td className="px-5 py-3.5 text-[#6D6E71] text-xs">
                        {sup ? (sup.nameAr || sup.name) : '—'}
                      </td>
                    )}
                    <td className="px-5 py-3.5">
                      <button onClick={() => openEdit(u)} className="text-[#A98159] text-xs font-bold hover:underline">
                        تعديل
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  /* ── مساعد: setter آمن لأرقام فقط ── */
  const numOnly = (val) => val.replace(/\D/g, '');

  return (
    <div className="space-y-5" dir="rtl" style={{ fontFamily: "'IBM Plex Sans Arabic', Tahoma, sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2D2926]">إدارة المستخدمين</h1>
          <p className="text-sm text-[#6D6E71]">{observers.length} مراقب · {supervisors.length} مشرف</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90 transition"
          style={{ background: 'linear-gradient(135deg,#C4A46E,#A98159)' }}>
          <Plus size={16} />
          {tab === 'observers' ? 'إضافة مراقب' : 'إضافة مشرف'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white border border-[#D1C4B9] rounded-2xl p-1.5 w-fit shadow-sm">
        {[
          { key: 'observers',   label: 'المراقبون', count: observers.length   },
          { key: 'supervisors', label: 'المشرفون',  count: supervisors.length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
            style={tab === t.key
              ? { background: 'linear-gradient(135deg,#C4A46E,#A98159)', color: '#fff' }
              : { color: '#6D6E71' }}>
            {t.label}
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${tab === t.key ? 'bg-white/20 text-white' : 'bg-[#F5F0EB] text-[#A98159]'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {tab === 'observers'
        ? renderTable(observers,   'لا يوجد مراقبون بعد — أضف أول مراقب')
        : renderTable(supervisors, 'لا يوجد مشرفون بعد — أضف أول مشرف')
      }

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="h-1 rounded-t-2xl" style={{ background: 'linear-gradient(90deg,#C4A46E,#A98159)' }} />
            <div className="px-6 py-5">

              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-[#2D2926] text-lg">
                  {editId
                    ? `تعديل بيانات ${tab === 'observers' ? 'المراقب' : 'المشرف'}`
                    : `إضافة ${tab === 'observers' ? 'مراقب' : 'مشرف'} جديد`}
                </h2>
                <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                  <X size={18} className="text-[#6D6E71]" />
                </button>
              </div>

              {feedback && (
                <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
                  feedback.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {feedback.msg}
                </div>
              )}

              {/* ══ نموذج المراقب ══ */}
              {tab === 'observers' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="الاسم الرباعي (عربي)" required>
                      <input
                        value={obsForm.nameAr}
                        onChange={e => setObsForm(p => ({ ...p, nameAr: e.target.value }))}
                        placeholder="محمد عبدالله السلمي"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="الاسم (انجليزي)">
                      <input
                        value={obsForm.nameEn}
                        onChange={e => setObsForm(p => ({ ...p, nameEn: e.target.value }))}
                        placeholder="Mohammed Abdullah"
                        dir="ltr"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="رقم الهوية (10 أرقام)" required>
                      <input
                        value={obsForm.idNumber}
                        onChange={e => {
                          const v = numOnly(e.target.value);
                          if (v.length <= 10) setObsForm(p => ({ ...p, idNumber: v }));
                        }}
                        placeholder="1xxxxxxxxx"
                        dir="ltr"
                        maxLength={10}
                        inputMode="numeric"
                        className={`${inputCls} ${obsForm.idNumber && obsForm.idNumber.length !== 10 ? 'border-red-400' : ''}`}
                      />
                      {obsForm.idNumber.length > 0 && obsForm.idNumber.length < 10 && (
                        <p className="text-red-500 text-xs mt-1">{obsForm.idNumber.length}/10 أرقام</p>
                      )}
                    </Field>
                    <Field label="رقم الجوال (10 أرقام)" required>
                      <input
                        value={obsForm.phone}
                        onChange={e => {
                          const v = numOnly(e.target.value);
                          if (v.length <= 10) setObsForm(p => ({ ...p, phone: v }));
                        }}
                        placeholder="05xxxxxxxx"
                        dir="ltr"
                        maxLength={10}
                        inputMode="numeric"
                        className={`${inputCls} ${obsForm.phone && obsForm.phone.length !== 10 ? 'border-red-400' : ''}`}
                      />
                      {obsForm.phone.length > 0 && obsForm.phone.length < 10 && (
                        <p className="text-red-500 text-xs mt-1">{obsForm.phone.length}/10 أرقام</p>
                      )}
                    </Field>
                  </div>
                  <Field label="البريد الإلكتروني" required>
                    <input
                      type="email"
                      value={obsForm.email}
                      onChange={e => setObsForm(p => ({ ...p, email: e.target.value }))}
                      disabled={!!editId}
                      placeholder="observer@moraqeb.sa"
                      dir="ltr"
                      className={`${inputCls} ${editId ? 'bg-gray-50 text-[#6D6E71]' : ''}`}
                    />
                  </Field>
                  {!editId && (
                    <Field label="كلمة المرور" required>
                      <div className="relative">
                        <input
                          type={showPass ? 'text' : 'password'}
                          value={obsForm.password}
                          onChange={e => setObsForm(p => ({ ...p, password: e.target.value }))}
                          placeholder="6 أحرف على الأقل"
                          dir="ltr"
                          className={`${inputCls} pl-10`}
                        />
                        <button type="button" onClick={() => setShowPass(p => !p)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6D6E71] hover:text-[#A98159]">
                          {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </Field>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="مركز الخدمة" required>
                      <select
                        value={obsForm.center}
                        onChange={e => setObsForm(p => ({ ...p, center: e.target.value }))}
                        className={inputCls}
                      >
                        <option value="">-- اختر مركزاً --</option>
                        {CENTERS.map(c => (
                          <option key={c.id} value={c.id}>{c.id} — {c.caterer}</option>
                        ))}
                      </select>
                      {obsForm.center && (
                        <p className="text-xs text-[#A98159] mt-1 font-medium">
                          {getCaterer(obsForm.center)}
                        </p>
                      )}
                    </Field>
                    <Field label="المشرف" required>
                      <select
                        value={obsForm.supervisorId}
                        onChange={e => setObsForm(p => ({ ...p, supervisorId: e.target.value }))}
                        className={inputCls}
                      >
                        <option value="">-- اختر مشرفاً --</option>
                        {supervisors.map(s => (
                          <option key={s.id} value={s.id}>{s.nameAr || s.name}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
              )}

              {/* ══ نموذج المشرف ══ */}
              {tab === 'supervisors' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="الاسم الرباعي (عربي)" required>
                      <input
                        value={supForm.nameAr}
                        onChange={e => setSupForm(p => ({ ...p, nameAr: e.target.value }))}
                        placeholder="محمد عبدالله السلمي"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="الاسم (انجليزي)">
                      <input
                        value={supForm.nameEn}
                        onChange={e => setSupForm(p => ({ ...p, nameEn: e.target.value }))}
                        placeholder="Mohammed Abdullah"
                        dir="ltr"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="رقم الهوية (10 أرقام)" required>
                      <input
                        value={supForm.idNumber}
                        onChange={e => {
                          const v = numOnly(e.target.value);
                          if (v.length <= 10) setSupForm(p => ({ ...p, idNumber: v }));
                        }}
                        placeholder="1xxxxxxxxx"
                        dir="ltr"
                        maxLength={10}
                        inputMode="numeric"
                        className={`${inputCls} ${supForm.idNumber && supForm.idNumber.length !== 10 ? 'border-red-400' : ''}`}
                      />
                      {supForm.idNumber.length > 0 && supForm.idNumber.length < 10 && (
                        <p className="text-red-500 text-xs mt-1">{supForm.idNumber.length}/10 أرقام</p>
                      )}
                    </Field>
                    <Field label="رقم الجوال (10 أرقام)" required>
                      <input
                        value={supForm.phone}
                        onChange={e => {
                          const v = numOnly(e.target.value);
                          if (v.length <= 10) setSupForm(p => ({ ...p, phone: v }));
                        }}
                        placeholder="05xxxxxxxx"
                        dir="ltr"
                        maxLength={10}
                        inputMode="numeric"
                        className={`${inputCls} ${supForm.phone && supForm.phone.length !== 10 ? 'border-red-400' : ''}`}
                      />
                      {supForm.phone.length > 0 && supForm.phone.length < 10 && (
                        <p className="text-red-500 text-xs mt-1">{supForm.phone.length}/10 أرقام</p>
                      )}
                    </Field>
                  </div>
                  <Field label="البريد الإلكتروني" required>
                    <input
                      type="email"
                      value={supForm.email}
                      onChange={e => setSupForm(p => ({ ...p, email: e.target.value }))}
                      disabled={!!editId}
                      placeholder="supervisor@moraqeb.sa"
                      dir="ltr"
                      className={`${inputCls} ${editId ? 'bg-gray-50 text-[#6D6E71]' : ''}`}
                    />
                  </Field>
                  {!editId && (
                    <Field label="كلمة المرور" required>
                      <div className="relative">
                        <input
                          type={showPass ? 'text' : 'password'}
                          value={supForm.password}
                          onChange={e => setSupForm(p => ({ ...p, password: e.target.value }))}
                          placeholder="6 أحرف على الأقل"
                          dir="ltr"
                          className={`${inputCls} pl-10`}
                        />
                        <button type="button" onClick={() => setShowPass(p => !p)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6D6E71] hover:text-[#A98159]">
                          {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </Field>
                  )}
                  <Field label="مراكز الخدمة (يمكن اختيار أكثر من مركز)" required>
                    <MultiCenterSelect
                      selected={supForm.centers}
                      onChange={v => setSupForm(p => ({ ...p, centers: v }))}
                    />
                    {supForm.centers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {supForm.centers.map(c => (
                          <span key={c} className="bg-[#A98159]/10 text-[#A98159] border border-[#A98159]/20 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                            {c}
                            <button type="button" onClick={() => setSupForm(p => ({ ...p, centers: p.centers.filter(x => x !== c) }))}>
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </Field>
                </div>
              )}

              <div className="flex gap-2 mt-6">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition"
                  style={{ background: 'linear-gradient(135deg,#C4A46E,#A98159)' }}>
                  {saving
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جارٍ الحفظ...</>
                    : <><Save size={15} /> {editId ? 'حفظ التعديلات' : 'إنشاء الحساب'}</>}
                </button>
                <button onClick={closeModal}
                  className="px-5 py-3 rounded-xl border border-[#D1C4B9] text-[#6D6E71] text-sm font-medium hover:bg-gray-50 transition">
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
