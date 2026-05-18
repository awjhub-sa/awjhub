import { useEffect, useMemo, useState } from 'react';
import {
  collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/db.js';
import { CENTERS, getCaterer } from '../../config/centers.js';
import {
  Users, Plus, X, Save, ChevronDown, UserPlus,
  Eye, ShieldCheck, Pencil, Trash2, Sparkles, Filter, Search,
} from 'lucide-react';

const ROLES = [
  { value: 'observer',   label: 'مراقب', Icon: Eye          },
  { value: 'supervisor', label: 'مشرف',  Icon: ShieldCheck  },
];

const ROLE_META = {
  observer:   { Icon: Eye,         label: 'مراقب', gradient: 'from-[#E9D4B8] to-[#C4A46E]' },
  supervisor: { Icon: ShieldCheck, label: 'مشرف',  gradient: 'from-[#A98159] to-[#7A5A3D]' },
};
const MAX_BULK = 10;

const inputCls =
  'w-full px-4 py-2.5 border border-[#E8DDD4] rounded-xl text-sm text-[#2D2926] outline-none focus:border-[#A98159] transition placeholder-[#6D6E71]/40 bg-white';

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-medium text-[#6D6E71] mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

function MultiCenterSelect({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const toggle = (c) =>
    onChange(selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full px-4 py-2.5 border border-[#D1C4B9] rounded-xl text-sm text-right flex items-center justify-between focus:border-[#A98159] outline-none transition bg-white"
      >
        <span className={selected.length ? 'text-[#2D2926]' : 'text-[#6D6E71]/50'}>
          {selected.length ? selected.join(' - ') : 'اختر مراكز الخدمة'}
        </span>
        <ChevronDown
          size={15}
          className={`text-[#6D6E71] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute z-30 top-full right-0 left-0 mt-1 bg-white border border-[#E8DDD4] rounded-xl shadow-lg max-h-72 overflow-y-auto">
          {CENTERS.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FDF8F0] cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="accent-[#A98159] w-4 h-4"
              />
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

const EMPTY_SINGLE = {
  nameAr: '', nameEn: '', idNumber: '', phone: '',
  role: 'observer', center: '', centers: [], supervisorId: '',
  roleCode: '', bravoCode: '',
};
const emptyBulkRow = () => ({ nameAr: '', idNumber: '', role: 'observer', center: '' });

export default function AdminUsers() {
  const [allUsers, setAllUsers] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [listError, setListError] = useState(null);

  const [mode,   setMode]   = useState('single');   // 'single' | 'bulk'
  const [filter, setFilter] = useState('all');      // 'all' | 'observer' | 'supervisor'
  const [search, setSearch] = useState('');

  // Single add
  const [form,           setForm]           = useState(EMPTY_SINGLE);
  const [singleSaving,   setSingleSaving]   = useState(false);
  const [singleError,    setSingleError]    = useState(null);
  const [singleSuccess,  setSingleSuccess]  = useState(null);

  // Bulk add
  const [rows,        setRows]        = useState([emptyBulkRow()]);
  const [bulkSaving,  setBulkSaving]  = useState(false);
  const [bulkError,   setBulkError]   = useState(null);

  // Edit modal
  const [editTarget, setEditTarget] = useState(null);
  const [editForm,   setEditForm]   = useState(EMPTY_SINGLE);
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setAllUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        setListError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const numOnly = (v) => v.replace(/\D/g, '');

  const users = useMemo(
    () => allUsers.filter((u) => u.role === 'observer' || u.role === 'supervisor'),
    [allUsers],
  );
  const supervisors = useMemo(() => users.filter((u) => u.role === 'supervisor'), [users]);
  const observers   = useMemo(() => users.filter((u) => u.role === 'observer'),   [users]);

  const visible = useMemo(() => {
    const base = filter === 'all' ? users : users.filter((u) => u.role === filter);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((u) => {
      const ar = (u.nameAr || u.name || '').toLowerCase();
      const en = (u.nameEn || '').toLowerCase();
      const id = (u.idNumber || '').toLowerCase();
      return ar.includes(q) || en.includes(q) || id.includes(q);
    });
  }, [users, filter, search]);

  const counts = { all: users.length, observer: observers.length, supervisor: supervisors.length };

  /* ── helpers ─────────────────────────────────────────── */
  const validateSingle = (f) => {
    if (!f.nameAr.trim()) return 'الاسم العربي مطلوب';
    if (!f.idNumber.trim()) return 'رقم الهوية مطلوب';
    if (f.idNumber.length !== 10) return 'رقم الهوية يجب أن يكون 10 أرقام';
    if (!f.phone.trim()) return 'رقم الجوال مطلوب';
    if (f.phone.length !== 10) return 'رقم الجوال يجب أن يكون 10 أرقام';
    if (!f.roleCode.trim()) {
      return f.role === 'observer' ? 'رمز المراقب مطلوب' : 'رمز المشرف مطلوب';
    }
    if (!f.bravoCode.trim()) return 'رمز البرافو مطلوب';
    if (f.role === 'observer' && !f.center) return 'مركز الخدمة مطلوب';
    if (f.role === 'observer' && !f.supervisorId) return 'اختر المشرف المسؤول';
    if (f.role === 'supervisor' && (!f.centers || f.centers.length === 0))
      return 'اختر مركزاً واحداً على الأقل';
    if (allUsers.some((u) => u.idNumber === f.idNumber && u.id !== f.id))
      return 'رقم الهوية مسجل مسبقاً';
    return null;
  };

  const buildPayload = (f) => {
    const isObs = f.role === 'observer';
    const targetCenters = isObs ? [f.center] : f.centers;
    const caterersMap = Object.fromEntries(
      targetCenters.map((cid) => [cid, getCaterer(cid)]),
    );
    return {
      nameAr: f.nameAr.trim(),
      nameEn: (f.nameEn || '').trim(),
      name:   f.nameAr.trim(),
      idNumber: f.idNumber.trim(),
      phone:    (f.phone || '').trim(),
      role:     f.role,
      roleCode:  (f.roleCode  || '').trim(),
      bravoCode: (f.bravoCode || '').trim(),
      ...(isObs
        ? {
            center: f.center,
            caterer: getCaterer(f.center),
            supervisorId: f.supervisorId || '',
          }
        : {
            centers: f.centers,
            center:  f.centers[0] || '',
            caterers: caterersMap,
          }),
    };
  };

  /* ── single add ──────────────────────────────────────── */
  const resetSingle = () => {
    setForm(EMPTY_SINGLE);
    setSingleError(null);
  };

  const handleSingleAdd = async (e) => {
    e.preventDefault();
    setSingleError(null);
    setSingleSuccess(null);
    const err = validateSingle(form);
    if (err) return setSingleError(err);

    setSingleSaving(true);
    try {
      await addDoc(collection(db, 'users'), {
        ...buildPayload(form),
        createdAt: serverTimestamp(),
      });
      setSingleSuccess('تمت الإضافة بنجاح');
      resetSingle();
      setTimeout(() => setSingleSuccess(null), 2500);
    } catch (ex) {
      setSingleError(ex.message);
    }
    setSingleSaving(false);
  };

  /* ── bulk add ────────────────────────────────────────── */
  const updateRow = (i, patch) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () =>
    setRows((prev) => (prev.length >= MAX_BULK ? prev : [...prev, emptyBulkRow()]));
  const removeRow = (i) =>
    setRows((prev) => (prev.length === 1 ? [emptyBulkRow()] : prev.filter((_, idx) => idx !== i)));

  const handleBulkAdd = async (e) => {
    e.preventDefault();
    setBulkError(null);

    const filled = rows
      .map((r) => ({ ...r, nameAr: r.nameAr.trim(), idNumber: r.idNumber.trim() }))
      .filter((r) => r.nameAr || r.idNumber);

    if (filled.length === 0) return setBulkError('أضف بيانات مستخدم واحد على الأقل');

    for (const [i, r] of filled.entries()) {
      if (!r.nameAr || !r.idNumber)
        return setBulkError(`الصف ${i + 1}: الاسم ورقم الهوية مطلوبان`);
      if (r.idNumber.length !== 10) return setBulkError(`الصف ${i + 1}: رقم الهوية 10 أرقام`);
      if (!r.center) return setBulkError(`الصف ${i + 1}: اختر المركز`);
    }

    const ids = filled.map((r) => r.idNumber);
    if (new Set(ids).size !== ids.length) return setBulkError('يوجد رقم هوية مكرر في القائمة');

    for (const r of filled) {
      if (allUsers.some((u) => u.idNumber === r.idNumber))
        return setBulkError(`رقم الهوية ${r.idNumber} مسجل مسبقاً`);
    }

    setBulkSaving(true);
    try {
      await Promise.all(
        filled.map((r) =>
          addDoc(collection(db, 'users'), {
            nameAr: r.nameAr,
            name:   r.nameAr,
            idNumber: r.idNumber,
            role:     r.role,
            ...(r.role === 'observer'
              ? { center: r.center, caterer: getCaterer(r.center), supervisorId: '' }
              : {
                  centers: [r.center],
                  center:  r.center,
                  caterers: { [r.center]: getCaterer(r.center) },
                }),
            createdAt: serverTimestamp(),
          }),
        ),
      );
      setRows([emptyBulkRow()]);
    } catch (ex) {
      setBulkError(ex.message);
    }
    setBulkSaving(false);
  };

  /* ── edit ────────────────────────────────────────────── */
  const openEdit = (u) => {
    setEditTarget(u);
    setEditError(null);
    setEditForm({
      id: u.id,
      nameAr:   u.nameAr || u.name || '',
      nameEn:   u.nameEn || '',
      idNumber: u.idNumber || '',
      phone:    u.phone || '',
      role:     u.role || 'observer',
      center:   u.center || '',
      centers:  u.centers || (u.center ? [u.center] : []),
      supervisorId: u.supervisorId || '',
      roleCode:  u.roleCode  || '',
      bravoCode: u.bravoCode || '',
    });
  };
  const closeEdit = () => { setEditTarget(null); setEditError(null); };

  const handleEditSave = async () => {
    const err = validateSingle(editForm);
    if (err) return setEditError(err);
    setEditSaving(true);
    try {
      await updateDoc(doc(db, 'users', editForm.id), {
        ...buildPayload(editForm),
        updatedAt: serverTimestamp(),
      });
      closeEdit();
    } catch (ex) {
      setEditError(ex.message);
    }
    setEditSaving(false);
  };

  /* ── delete ──────────────────────────────────────────── */
  const handleDelete = async (u) => {
    if (!confirm(`حذف "${u.nameAr || u.name}" نهائياً؟`)) return;
    try {
      await deleteDoc(doc(db, 'users', u.id));
    } catch (ex) {
      setListError(ex.message);
    }
  };

  /* ════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-br from-white via-white to-[#FDF8F0]/40 rounded-2xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] transition-shadow duration-300 hover:shadow-[0_6px_28px_rgba(169,129,89,0.14)] overflow-hidden group">
        <div
          className="flex items-center justify-between px-6 py-4 relative"
          style={{ background: 'linear-gradient(135deg, #FDF8F0 0%, #fff 55%)' }}
        >
          <div className="absolute inset-y-0 right-0 w-32 opacity-30 pointer-events-none"
            style={{ background: 'radial-gradient(circle at top right, rgba(196,164,110,0.4), transparent 70%)' }} />
          <div className="flex items-center gap-3 relative">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-xl blur-xl opacity-50 group-hover:opacity-80 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}
              />
              <div
                className="relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
                style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}
              >
                <Users size={20} className="text-white" strokeWidth={2.25} />
                <Sparkles size={10} className="absolute -top-0.5 -right-0.5 text-yellow-200 drop-shadow" />
              </div>
            </div>
            <div>
              <h1 className="text-base font-bold text-[#2D2926]">إدارة المستخدمين</h1>
              <p className="text-xs text-[#9D8F85] mt-0.5">
                إضافة وإدارة المراقبين والمشرفين الميدانيين
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ── Add panel (left) ─────────────────────────── */}
        <section className="bg-gradient-to-br from-white via-white to-[#FDF8F0]/40 rounded-2xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] transition-shadow duration-300 hover:shadow-[0_6px_28px_rgba(169,129,89,0.14)] lg:col-span-2 h-fit relative">
          <div className="bg-[#FDF8F0] p-1 m-3 rounded-xl flex">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === 'single'
                  ? 'bg-white text-[#A98159] shadow-sm'
                  : 'text-[#6D6E71] hover:text-[#2D2926]'
              }`}
            >
              إضافة فردية
            </button>
            <button
              type="button"
              onClick={() => setMode('bulk')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === 'bulk'
                  ? 'bg-white text-[#A98159] shadow-sm'
                  : 'text-[#6D6E71] hover:text-[#2D2926]'
              }`}
            >
              إضافة متعددة
            </button>
          </div>

          {mode === 'single' ? (
            <form onSubmit={handleSingleAdd} className="p-5 pt-2 space-y-3">
              <Field label="الاسم (عربي)" required>
                <input
                  value={form.nameAr}
                  onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))}
                  placeholder="محمد عبدالله السلمي"
                  className={inputCls}
                />
              </Field>
              <Field label="الاسم (انجليزي)">
                <input
                  value={form.nameEn}
                  onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))}
                  placeholder="Mohammed Abdullah"
                  dir="ltr"
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="رقم الهوية" required>
                  <input
                    value={form.idNumber}
                    onChange={(e) => {
                      const v = numOnly(e.target.value);
                      if (v.length <= 10) setForm((p) => ({ ...p, idNumber: v }));
                    }}
                    placeholder="1xxxxxxxxx"
                    dir="ltr"
                    maxLength={10}
                    inputMode="numeric"
                    className={inputCls}
                  />
                </Field>
                <Field label="رقم الجوال" required>
                  <input
                    value={form.phone}
                    onChange={(e) => {
                      const v = numOnly(e.target.value);
                      if (v.length <= 10) setForm((p) => ({ ...p, phone: v }));
                    }}
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                    maxLength={10}
                    inputMode="numeric"
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="الدور" required>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => {
                    const RIcon = r.Icon;
                    const active = form.role === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, role: r.value }))}
                        className={`group/role relative overflow-hidden px-3 py-2.5 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-2 ${
                          active
                            ? 'border-[#A98159] bg-gradient-to-br from-[#C4A46E] to-[#A98159] text-white shadow-[0_4px_14px_rgba(169,129,89,0.4)] scale-[1.02]'
                            : 'border-[#E8DDD4] bg-white text-[#6D6E71] hover:border-[#A98159]/50 hover:scale-[1.02]'
                        }`}
                      >
                        <RIcon
                          size={16}
                          className={`transition-transform duration-300 ${
                            active ? 'scale-110' : 'group-hover/role:scale-110'
                          }`}
                        />
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              {/* Role-specific code + Bravo code */}
              <div className="grid grid-cols-2 gap-3">
                <Field label={form.role === 'observer' ? 'رمز المراقب' : 'رمز المشرف'} required>
                  <input
                    value={form.roleCode}
                    onChange={(e) => setForm((p) => ({ ...p, roleCode: e.target.value }))}
                    placeholder={form.role === 'observer' ? 'رمز المراقب' : 'رمز المشرف'}
                    dir="ltr"
                    className={inputCls}
                  />
                </Field>
                <Field label="رمز البرافو" required>
                  <input
                    value={form.bravoCode}
                    onChange={(e) => setForm((p) => ({ ...p, bravoCode: e.target.value }))}
                    placeholder="رمز البرافو"
                    dir="ltr"
                    className={inputCls}
                  />
                </Field>
              </div>
              {form.role === 'observer' ? (
                <>
                  <Field label="مركز الخدمة" required>
                    <select
                      value={form.center}
                      onChange={(e) => setForm((p) => ({ ...p, center: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">-- اختر مركزاً --</option>
                      {CENTERS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id} — {c.caterer}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="المشرف" required>
                    <select
                      value={form.supervisorId}
                      onChange={(e) => setForm((p) => ({ ...p, supervisorId: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">-- اختر مشرفاً --</option>
                      {supervisors.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nameAr || s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : (
                <Field label="مراكز الخدمة" required>
                  <MultiCenterSelect
                    selected={form.centers}
                    onChange={(v) => setForm((p) => ({ ...p, centers: v }))}
                  />
                </Field>
              )}

              {singleError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm font-medium">
                  {singleError}
                </div>
              )}
              {singleSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-3 py-2 text-sm font-medium">
                  {singleSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={singleSaving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition shadow-[0_4px_16px_rgba(169,129,89,0.35)]"
                style={{ background: 'linear-gradient(135deg,#C4A46E,#A98159)' }}
              >
                {singleSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جارٍ الإضافة...
                  </>
                ) : (
                  <>
                    <UserPlus size={15} /> إضافة المستخدم
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleBulkAdd} className="p-5 pt-2 space-y-3">
              <p className="text-xs text-[#6D6E71]">
                املأ بيانات حتى {MAX_BULK} مستخدمين وأضفهم بضغطة واحدة. الصفوف الفارغة تُتجاهل.
              </p>
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className="border border-[#E8DDD4] rounded-xl p-3 bg-[#FDF8F0]/40 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#6D6E71]">المستخدم {i + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-red-500 hover:bg-red-50 px-2 py-0.5 rounded text-xs font-semibold"
                      >
                        × إزالة
                      </button>
                    </div>
                    <input
                      value={row.nameAr}
                      onChange={(e) => updateRow(i, { nameAr: e.target.value })}
                      placeholder="الاسم (عربي)"
                      className="w-full border border-[#E8DDD4] rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-[#A98159]"
                    />
                    <input
                      value={row.idNumber}
                      onChange={(e) => {
                        const v = numOnly(e.target.value);
                        if (v.length <= 10) updateRow(i, { idNumber: v });
                      }}
                      placeholder="رقم الهوية"
                      dir="ltr"
                      maxLength={10}
                      inputMode="numeric"
                      className="w-full border border-[#E8DDD4] rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-[#A98159]"
                    />
                    <select
                      value={row.center}
                      onChange={(e) => updateRow(i, { center: e.target.value })}
                      className="w-full border border-[#E8DDD4] rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-[#A98159]"
                    >
                      <option value="">-- اختر المركز --</option>
                      {CENTERS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id} — {c.caterer}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ROLES.map((r) => {
                        const RIcon = r.Icon;
                        const active = row.role === r.value;
                        return (
                          <button
                            key={r.value}
                            type="button"
                            onClick={() => updateRow(i, { role: r.value })}
                            className={`px-2 py-1 rounded-md text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                              active
                                ? 'bg-gradient-to-br from-[#C4A46E] to-[#A98159] text-white border-[#A98159] shadow-sm'
                                : 'bg-white text-[#6D6E71] border-[#E8DDD4] hover:border-[#A98159]/50'
                            }`}
                          >
                            <RIcon size={12} />
                            {r.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addRow}
                disabled={rows.length >= MAX_BULK}
                className="w-full border-2 border-dashed border-[#E8DDD4] text-[#6D6E71] hover:border-[#A98159] hover:text-[#A98159] py-2 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Plus size={14} className="inline mb-0.5" /> إضافة صف ({rows.length}/{MAX_BULK})
              </button>

              {bulkError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm font-medium">
                  {bulkError}
                </div>
              )}

              <button
                type="submit"
                disabled={bulkSaving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition shadow-[0_4px_16px_rgba(169,129,89,0.35)]"
                style={{ background: 'linear-gradient(135deg,#C4A46E,#A98159)' }}
              >
                {bulkSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جارٍ الإضافة...
                  </>
                ) : (
                  <>
                    <UserPlus size={15} /> إضافة الجميع
                  </>
                )}
              </button>
            </form>
          )}
        </section>

        {/* ── List panel (right) ───────────────────────── */}
        <section className="bg-gradient-to-br from-white via-white to-[#FDF8F0]/40 rounded-2xl border border-[#EDE5DC] shadow-[0_2px_12px_rgba(45,41,38,0.07)] transition-shadow duration-300 hover:shadow-[0_6px_28px_rgba(169,129,89,0.14)] overflow-hidden lg:col-span-3">
          <div className="p-4 border-b border-[#EDE5DC] space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-[#A98159]">
                المستخدمون ({visible.length}
                {(filter !== 'all' || search) && ` من ${counts.all}`})
              </h2>
            </div>

            {/* Search bar */}
            <div className="relative">
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <Search size={15} className="text-[#A98159]" strokeWidth={2.25} />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم العربي أو الانجليزي أو رقم الهوية..."
                className="w-full pr-10 pl-10 py-2.5 border border-[#E8DDD4] rounded-xl text-sm text-[#2D2926] outline-none focus:border-[#A98159] focus:shadow-[0_0_0_3px_rgba(169,129,89,0.1)] transition-all bg-white placeholder-[#6D6E71]/40"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 left-3 flex items-center text-[#6D6E71] hover:text-[#A98159] transition-colors"
                  title="مسح البحث"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <FilterChip
                active={filter === 'all'}
                onClick={() => setFilter('all')}
                count={counts.all}
                Icon={Filter}
              >
                الكل
              </FilterChip>
              <FilterChip
                active={filter === 'observer'}
                onClick={() => setFilter('observer')}
                count={counts.observer}
                Icon={Eye}
              >
                المراقبون
              </FilterChip>
              <FilterChip
                active={filter === 'supervisor'}
                onClick={() => setFilter('supervisor')}
                count={counts.supervisor}
                Icon={ShieldCheck}
              >
                المشرفون
              </FilterChip>
            </div>
          </div>

          {listError && (
            <div className="m-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm font-medium">
              {listError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead
                className="text-[#6D6E71] text-xs border-b border-[#EDE5DC]"
                style={{ background: 'linear-gradient(135deg, #FDF8F0 0%, #fff 60%)' }}
              >
                <tr>
                  <th className="px-4 py-3 text-right font-semibold">الاسم</th>
                  <th className="px-4 py-3 text-right font-semibold">الهوية</th>
                  <th className="px-4 py-3 text-right font-semibold">الجوال</th>
                  <th className="px-4 py-3 text-right font-semibold">الدور</th>
                  <th className="px-4 py-3 text-right font-semibold">المركز/المراكز</th>
                  <th className="px-4 py-3 text-right font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE5DC]">
                {loading && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#6D6E71]">
                      جارٍ التحميل...
                    </td>
                  </tr>
                )}
                {!loading && visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#6D6E71]">
                      {search ? `لم يتم العثور على نتائج لـ "${search}"` : 'لا يوجد مستخدمون'}
                    </td>
                  </tr>
                )}
                {visible.map((u) => {
                  const meta = ROLE_META[u.role] || ROLE_META.observer;
                  const RoleIcon = meta.Icon;
                  return (
                    <tr
                      key={u.id}
                      className="group/row hover:bg-[#FDF8F0] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-[#2D2926]">
                        <div className="flex items-center gap-2.5">
                          <div className="relative flex-shrink-0">
                            <div
                              className={`absolute inset-0 rounded-full blur-md opacity-0 group-hover/row:opacity-60 transition-opacity bg-gradient-to-br ${meta.gradient}`}
                            />
                            <div
                              className={`relative w-8 h-8 rounded-full bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-white text-xs font-bold shadow-sm ring-2 ring-white`}
                            >
                              {(u.nameAr || u.name)?.charAt(0) || '؟'}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate">{u.nameAr || u.name || '—'}</div>
                            {u.nameEn && (
                              <div className="text-[#6D6E71] text-xs truncate" dir="ltr">
                                {u.nameEn}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#6D6E71]" dir="ltr">
                        {u.idNumber || '—'}
                      </td>
                      <td className="px-4 py-3 text-[#6D6E71]" dir="ltr">
                        {u.phone || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                            u.role === 'supervisor'
                              ? 'bg-gradient-to-r from-[#C4A46E] to-[#A98159] text-white shadow-sm'
                              : 'bg-[#A98159]/10 text-[#A98159] border border-[#A98159]/20'
                          }`}
                        >
                          <RoleIcon size={11} strokeWidth={2.5} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#6D6E71] text-xs">
                        {u.role === 'observer'
                          ? u.center || '—'
                          : u.centers?.join('، ') || u.center || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEdit(u)}
                            className="group/edit flex items-center gap-1 text-[#A98159] hover:text-white text-xs font-bold px-2 py-1 rounded-lg border border-[#A98159]/20 hover:bg-gradient-to-br hover:from-[#C4A46E] hover:to-[#A98159] hover:border-transparent transition-all hover:shadow-md"
                            title="تعديل"
                          >
                            <Pencil size={12} className="group-hover/edit:rotate-12 transition-transform" />
                            تعديل
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            className="group/del flex items-center gap-1 text-red-500 hover:text-white text-xs font-bold px-2 py-1 rounded-lg border border-red-200 hover:bg-red-500 hover:border-red-500 transition-all hover:shadow-md"
                            title="حذف"
                          >
                            <Trash2 size={12} className="group-hover/del:rotate-6 transition-transform" />
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ── Edit modal ───────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeEdit} />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            dir="rtl"
          >
            <div
              className="flex items-center justify-between px-6 py-4 border-b border-[#EDE5DC]"
              style={{ background: 'linear-gradient(135deg, #FDF8F0 0%, #fff 55%)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #C4A46E, #A98159)' }}
                >
                  <Users size={16} className="text-white" strokeWidth={2} />
                </div>
                <h2 className="font-bold text-[#2D2926] text-sm">تعديل بيانات المستخدم</h2>
              </div>
              <button
                onClick={closeEdit}
                className="w-8 h-8 rounded-xl border border-[#EDE5DC] flex items-center justify-center hover:bg-[#F5F0EB] transition-colors"
              >
                <X size={15} className="text-[#6D6E71]" strokeWidth={1.75} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-3">
              <Field label="الاسم (عربي)" required>
                <input
                  value={editForm.nameAr}
                  onChange={(e) => setEditForm((p) => ({ ...p, nameAr: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="الاسم (انجليزي)">
                <input
                  value={editForm.nameEn}
                  onChange={(e) => setEditForm((p) => ({ ...p, nameEn: e.target.value }))}
                  dir="ltr"
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="رقم الهوية" required>
                  <input
                    value={editForm.idNumber}
                    onChange={(e) => {
                      const v = numOnly(e.target.value);
                      if (v.length <= 10) setEditForm((p) => ({ ...p, idNumber: v }));
                    }}
                    dir="ltr"
                    maxLength={10}
                    inputMode="numeric"
                    className={inputCls}
                  />
                </Field>
                <Field label="رقم الجوال" required>
                  <input
                    value={editForm.phone}
                    onChange={(e) => {
                      const v = numOnly(e.target.value);
                      if (v.length <= 10) setEditForm((p) => ({ ...p, phone: v }));
                    }}
                    dir="ltr"
                    maxLength={10}
                    inputMode="numeric"
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="الدور" required>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => {
                    const RIcon = r.Icon;
                    const active = editForm.role === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setEditForm((p) => ({ ...p, role: r.value }))}
                        className={`group/role relative overflow-hidden px-3 py-2.5 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-2 ${
                          active
                            ? 'border-[#A98159] bg-gradient-to-br from-[#C4A46E] to-[#A98159] text-white shadow-[0_4px_14px_rgba(169,129,89,0.4)] scale-[1.02]'
                            : 'border-[#E8DDD4] bg-white text-[#6D6E71] hover:border-[#A98159]/50 hover:scale-[1.02]'
                        }`}
                      >
                        <RIcon
                          size={16}
                          className={`transition-transform duration-300 ${
                            active ? 'scale-110' : 'group-hover/role:scale-110'
                          }`}
                        />
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              {/* Role-specific code + Bravo code */}
              <div className="grid grid-cols-2 gap-3">
                <Field label={editForm.role === 'observer' ? 'رمز المراقب' : 'رمز المشرف'} required>
                  <input
                    value={editForm.roleCode}
                    onChange={(e) => setEditForm((p) => ({ ...p, roleCode: e.target.value }))}
                    placeholder={editForm.role === 'observer' ? 'رمز المراقب' : 'رمز المشرف'}
                    dir="ltr"
                    className={inputCls}
                  />
                </Field>
                <Field label="رمز البرافو" required>
                  <input
                    value={editForm.bravoCode}
                    onChange={(e) => setEditForm((p) => ({ ...p, bravoCode: e.target.value }))}
                    placeholder="رمز البرافو"
                    dir="ltr"
                    className={inputCls}
                  />
                </Field>
              </div>
              {editForm.role === 'observer' ? (
                <>
                  <Field label="مركز الخدمة" required>
                    <select
                      value={editForm.center}
                      onChange={(e) => setEditForm((p) => ({ ...p, center: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">-- اختر مركزاً --</option>
                      {CENTERS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id} — {c.caterer}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="المشرف">
                    <select
                      value={editForm.supervisorId}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, supervisorId: e.target.value }))
                      }
                      className={inputCls}
                    >
                      <option value="">-- اختر مشرفاً --</option>
                      {supervisors.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nameAr || s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : (
                <Field label="مراكز الخدمة" required>
                  <MultiCenterSelect
                    selected={editForm.centers}
                    onChange={(v) => setEditForm((p) => ({ ...p, centers: v }))}
                  />
                </Field>
              )}

              {editError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm font-medium">
                  {editError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition"
                  style={{ background: 'linear-gradient(135deg,#C4A46E,#A98159)' }}
                >
                  {editSaving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جارٍ الحفظ...
                    </>
                  ) : (
                    <>
                      <Save size={15} /> حفظ التعديلات
                    </>
                  )}
                </button>
                <button
                  onClick={closeEdit}
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

function FilterChip({ active, count, onClick, Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group/chip px-3 py-1.5 rounded-xl text-sm font-bold border transition-all flex items-center gap-1.5 ${
        active
          ? 'bg-gradient-to-br from-[#C4A46E] to-[#A98159] text-white border-[#A98159] shadow-[0_3px_10px_rgba(169,129,89,0.35)] scale-[1.03]'
          : 'bg-white text-[#2D2926] border-[#E8DDD4] hover:border-[#A98159]/50 hover:scale-[1.02]'
      }`}
    >
      {Icon && (
        <Icon
          size={14}
          className={`transition-transform duration-300 ${
            active ? 'scale-110' : 'group-hover/chip:scale-110 text-[#A98159]'
          }`}
        />
      )}
      {children}
      <span
        className={`px-1.5 py-0.5 rounded-full text-xs ${
          active ? 'bg-white/25 text-white' : 'bg-[#FDF8F0] text-[#A98159]'
        }`}
      >
        {count}
      </span>
    </button>
  );
}
