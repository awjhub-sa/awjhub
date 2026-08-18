/**
 * src/pages/admin/UsersPage.jsx
 *
 * One field role, one screen.
 *
 * Observers and supervisors used to share a table behind a filter chip. They
 * are not the same record: an observer works one centre and answers to a
 * supervisor; a supervisor covers many centres and has observers under them.
 * Holding both in one table meant every row carried the other's columns as a
 * dash — a supervisor with an empty "bravo code" and an empty "reports to",
 * an observer with a centre count of one.
 *
 * So the page takes the role as a parameter and the two routes render it with
 * theirs. The forms, the bulk add and the edit dialog are shared because they
 * genuinely are the same work; the columns, the counts and the wording are not,
 * and those follow the role.
 */

import { useEffect, useMemo, useState } from 'react';
import { db, serverTimestamp } from '../../lib/db.js';
import PageHeader from '../../components/PageHeader.jsx';
import { CENTERS, getCaterer } from '../../config/centers.js';
import {
  Users,
  Plus,
  X,
  FloppyDisk as Save,
  CaretDown as ChevronDown,
  UserPlus,
  Eye,
  ShieldCheck,
  Pencil,
  Trash as Trash2,
  MagnifyingGlass as Search,
} from '@phosphor-icons/react';

const ROLE_META = {
  observer:   { Icon: Eye,         label: 'مراقب', gradient: 'from-line to-primary-400' },
  supervisor: { Icon: ShieldCheck, label: 'مشرف',  gradient: 'from-primary to-[rgb(var(--c-primary-700))]' },
};
const MAX_BULK = 10;

/* Everything that differs between the two screens, in one place. */
const PAGE = {
  observer: {
    Icon: Eye,
    title: 'المراقبون',
    subtitle: 'حسابات المراقبين الميدانيين والمركز المسنَد لكل منهم',
    one: 'مراقب',
    many: 'مراقبين',
    codeLabel: 'رمز المراقب',
    addTitle: 'إضافة مراقب',
    emptyText: 'لا يوجد مراقبون',
  },
  supervisor: {
    Icon: ShieldCheck,
    title: 'المشرفون',
    subtitle: 'حسابات المشرفين والمراكز التي يغطّيها كل مشرف',
    one: 'مشرف',
    many: 'مشرفين',
    codeLabel: 'رمز المشرف',
    addTitle: 'إضافة مشرف',
    emptyText: 'لا يوجد مشرفون',
  },
};

const AR = (n) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

const inputCls =
  'w-full px-4 py-2.5 border border-line rounded-xl text-sm text-ink outline-none focus:border-primary transition placeholder-muted/40 bg-white';

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-medium text-muted mb-1.5">
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
        className="w-full px-4 py-2.5 border border-line rounded-xl text-sm text-right flex items-center justify-between focus:border-primary outline-none transition bg-white"
      >
        <span className={selected.length ? 'text-ink' : 'text-muted/50'}>
          {selected.length ? selected.join(' - ') : 'اختر مراكز الخدمة'}
        </span>
        <ChevronDown
          size={15}
          className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute z-30 top-full right-0 left-0 mt-1 bg-white border border-line rounded-xl shadow-lg max-h-72 overflow-y-auto">
          {CENTERS.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-background cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="accent-primary w-4 h-4"
              />
              <div className="min-w-0">
                <span className="text-ink font-medium">{c.id}</span>
                <span className="text-muted text-xs block truncate">{c.caterer}</span>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* Collapsible centers cell — shows count chip + expandable list */
function CentersCell({ user }) {
  const [open, setOpen] = useState(false);
  if (user.role === 'observer') {
    return user.center
      ? <span className="text-ink">{user.center}</span>
      : <span>—</span>;
  }
  const centers = user.assignedCenters || user.centers || [];
  if (centers.length === 0) {
    return user.center
      ? <span className="text-ink">{user.center}</span>
      : <span>—</span>;
  }
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-br from-background to-white border border-line hover:border-primary hover:shadow-sm font-bold text-primary tabular-nums transition-all"
      >
        <ChevronDown size={11} weight="bold"
          className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        {centers.length} {centers.length === 1 ? 'مركز' : 'مراكز'}
      </button>
      {open && (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {centers.map(c => (
            <span key={c}
              className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-line text-ink">
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const emptySingle = (role) => ({
  nameAr: '', nameEn: '', idNumber: '', phone: '',
  role, center: '', centers: [], supervisorId: '',
  roleCode: '', bravoCode: '',
});
const emptyBulkRow = (role) => ({
  nameAr: '', nameEn: '', idNumber: '', phone: '',
  role,
  center: '', centers: [], supervisorId: '',
  roleCode: '', bravoCode: '',
});

/** @param {{role: 'observer'|'supervisor'}} props */
export default function UsersPage({ role }) {
  const isObserver = role === 'observer';
  const page = PAGE[role];
  const EMPTY_SINGLE = useMemo(() => emptySingle(role), [role]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [listError, setListError] = useState(null);

  const [mode,   setMode]   = useState('single');   // 'single' | 'bulk'
  const [search, setSearch] = useState('');

  // Single add
  const [form,           setForm]           = useState(EMPTY_SINGLE);
  const [singleSaving,   setSingleSaving]   = useState(false);
  const [singleError,    setSingleError]    = useState(null);
  const [singleSuccess,  setSingleSuccess]  = useState(null);

  // Bulk add
  const [rows,        setRows]        = useState([emptyBulkRow(role)]);
  const [bulkSaving,  setBulkSaving]  = useState(false);
  const [bulkError,   setBulkError]   = useState(null);

  // Edit modal
  const [editTarget, setEditTarget] = useState(null);
  const [editForm,   setEditForm]   = useState(EMPTY_SINGLE);
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState(null);

  /* Landing on the other role resets the form to that role's blank record —
     otherwise a half-typed supervisor would be submitted as an observer. */
  useEffect(() => {
    setForm(emptySingle(role));
    setRows([emptyBulkRow(role)]);
    setSearch('');
  }, [role]);

  useEffect(() => {
    setLoading(true);
    return db.users.subscribe((rows) => {
      setAllUsers(rows.map(r => ({ ...r, id: r.uid })));
      setLoading(false);
    });
  }, []);

  const numOnly = (v) => v.replace(/\D/g, '');

  const users = useMemo(
    () => allUsers.filter((u) => u.role === 'observer' || u.role === 'supervisor'),
    [allUsers],
  );
  const supervisors = useMemo(() => users.filter((u) => u.role === 'supervisor'), [users]);
  const observers   = useMemo(() => users.filter((u) => u.role === 'observer'),   [users]);

  /* The rows this page owns. */
  const mine = useMemo(() => users.filter((u) => u.role === role), [users, role]);

  const visible = useMemo(() => {
    const base = mine;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((u) => {
      const ar = (u.nameAr || u.name || '').toLowerCase();
      const en = (u.nameEn || '').toLowerCase();
      const id = (u.idNumber || '').toLowerCase();
      return ar.includes(q) || en.includes(q) || id.includes(q);
    });
  }, [mine, search]);

  /* Build center → supervisor map so observer rows can show their supervisor.
     A supervisor's assigned_centers array tells us which centers they cover. */
  const centerToSupervisor = useMemo(() => {
    const map = new Map();
    supervisors.forEach((s) => {
      const centers = s.assignedCenters || s.centers || (s.center ? [s.center] : []);
      centers.forEach((c) => { if (c && !map.has(c)) map.set(c, s); });
    });
    return map;
  }, [supervisors]);

  /* The mirror of the map above: how many observers a supervisor carries.
     It is the one number that says whether a supervisor is over-loaded, and
     the combined table had nowhere to put it. */
  const observerLoad = useMemo(() => {
    const counts = new Map();
    observers.forEach((o) => {
      const sup = centerToSupervisor.get(o.center);
      if (sup) counts.set(sup.id, (counts.get(sup.id) || 0) + 1);
    });
    return counts;
  }, [observers, centerToSupervisor]);

  /* name, id, phone, role code, bravo, centres, [supervisor | observers], actions */
  const colCount = 8;

  const coveredCenters = useMemo(() => {
    const set = new Set();
    mine.forEach((u) => {
      (u.assignedCenters || u.centers || (u.center ? [u.center] : []))
        .forEach((c) => c && set.add(c));
    });
    return set.size;
  }, [mine]);

  const unassigned = useMemo(
    () => (isObserver
      ? observers.filter((o) => !centerToSupervisor.get(o.center)).length
      : supervisors.filter((sv) => !(sv.assignedCenters || sv.centers || []).length).length),
    [isObserver, observers, supervisors, centerToSupervisor],
  );

  
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
          }
        : {
            assignedCenters: f.centers,
            center:          f.centers[0] || '',
          }),
    };
  };

  
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
      await db.users.insert({
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

  
  const updateRow = (i, patch) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () =>
    setRows((prev) => (prev.length >= MAX_BULK ? prev : [...prev, emptyBulkRow(role)]));
  const removeRow = (i) =>
    setRows((prev) => (prev.length === 1 ? [emptyBulkRow(role)] : prev.filter((_, idx) => idx !== i)));

  const handleBulkAdd = async (e) => {
    e.preventDefault();
    setBulkError(null);

    const filled = rows
      .map((r) => ({
        ...r,
        nameAr:    r.nameAr.trim(),
        nameEn:    (r.nameEn || '').trim(),
        idNumber:  r.idNumber.trim(),
        phone:     (r.phone || '').trim(),
        roleCode:  (r.roleCode  || '').trim(),
        bravoCode: (r.bravoCode || '').trim(),
      }))
      .filter((r) => r.nameAr || r.idNumber);

    if (filled.length === 0) return setBulkError('أضف بيانات مستخدم واحد على الأقل');

    for (const [i, r] of filled.entries()) {
      if (!r.nameAr)                return setBulkError(`الصف ${i + 1}: الاسم العربي مطلوب`);
      if (!r.idNumber)              return setBulkError(`الصف ${i + 1}: رقم الهوية مطلوب`);
      if (r.idNumber.length !== 10) return setBulkError(`الصف ${i + 1}: رقم الهوية يجب أن يكون 10 أرقام`);
      if (!r.phone)                 return setBulkError(`الصف ${i + 1}: رقم الجوال مطلوب`);
      if (r.phone.length !== 10)    return setBulkError(`الصف ${i + 1}: رقم الجوال يجب أن يكون 10 أرقام`);
      if (!r.roleCode)              return setBulkError(`الصف ${i + 1}: ${r.role === 'observer' ? 'رمز المراقب' : 'رمز المشرف'} مطلوب`);
      if (!r.bravoCode)             return setBulkError(`الصف ${i + 1}: رمز البرافو مطلوب`);
      if (r.role === 'observer') {
        if (!r.center)              return setBulkError(`الصف ${i + 1}: مركز الخدمة مطلوب`);
      } else {
        if (!r.centers || r.centers.length === 0)
                                    return setBulkError(`الصف ${i + 1}: اختر مركزاً واحداً على الأقل`);
      }
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
          db.users.insert({
            nameAr:    r.nameAr,
            name:      r.nameAr,
            idNumber:  r.idNumber,
            phone:     r.phone,
            role:      r.role,
            roleCode:  r.roleCode,
            bravoCode: r.bravoCode,
            ...(r.role === 'observer'
              ? { center: r.center, caterer: getCaterer(r.center) }
              : { assignedCenters: r.centers, center: r.centers[0] || '' }),
            createdAt: serverTimestamp(),
          }),
        ),
      );
      setRows([emptyBulkRow(role)]);
    } catch (ex) {
      setBulkError(ex.message);
    }
    setBulkSaving(false);
  };

  
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
      centers:  u.assignedCenters || u.centers || (u.center ? [u.center] : []),
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
      await db.users.update(editForm.id, {
        ...buildPayload(editForm),
      });
      closeEdit();
    } catch (ex) {
      setEditError(ex.message);
    }
    setEditSaving(false);
  };

  
  const handleDelete = async (u) => {
    if (!confirm(`حذف "${u.nameAr || u.name}" نهائياً؟`)) return;
    try {
      await db.users.delete(u.id);
    } catch (ex) {
      setListError(ex.message);
    }
  };

  
  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        kicker="المستخدمين"
        Icon={page.Icon}
        title={page.title}
        subtitle={page.subtitle}
        /* The third tile appears only when there is something wrong to
           report. A permanent "active" count would have to be invented —
           the users table carries no such flag — and a number that always
           equals the one beside it teaches the reader to stop looking. */
        stats={[
          { value: AR(mine.length), label: page.one },
          { value: AR(coveredCenters), label: isObserver ? 'مركز مغطّى' : 'مركز يُغطّى', tone: 'gold' },
          ...(unassigned > 0
            ? [{
                value: AR(unassigned),
                label: isObserver ? 'بلا مشرف' : 'بلا مراكز',
                tone: 'alert',
              }]
            : []),
        ]}
      />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {}
        <section className="bg-gradient-to-br from-white via-white to-background/40 rounded-2xl border border-line shadow-[0_2px_12px_rgb(var(--c-ink)/0.07)] transition-shadow duration-300 hover:shadow-[0_6px_28px_rgb(var(--c-primary)/0.14)] lg:col-span-2 h-fit relative">
          <div className="bg-background p-1 m-3 rounded-xl flex">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === 'single'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              إضافة فردية
            </button>
            <button
              type="button"
              onClick={() => setMode('bulk')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === 'bulk'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-muted hover:text-ink'
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
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition shadow-[0_4px_16px_rgb(var(--c-primary)/0.35)]"
                style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}
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
              <p className="text-xs text-muted">
                املأ بيانات حتى {MAX_BULK} مستخدمين وأضفهم بضغطة واحدة. الصفوف الفارغة تُتجاهل.
              </p>
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className="border border-line rounded-xl p-3 bg-background/40 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted">المستخدم {i + 1}</span>
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
                      className="w-full border border-line rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-primary"
                    />
                    <input
                      value={row.nameEn}
                      onChange={(e) => updateRow(i, { nameEn: e.target.value })}
                      placeholder="الاسم (إنجليزي — اختياري)"
                      dir="ltr"
                      className="w-full border border-line rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-primary"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
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
                        className="w-full border border-line rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-primary"
                      />
                      <input
                        value={row.phone}
                        onChange={(e) => {
                          const v = numOnly(e.target.value);
                          if (v.length <= 10) updateRow(i, { phone: v });
                        }}
                        placeholder="رقم الجوال"
                        dir="ltr"
                        maxLength={10}
                        inputMode="numeric"
                        className="w-full border border-line rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        value={row.roleCode}
                        onChange={(e) => updateRow(i, { roleCode: e.target.value })}
                        placeholder={row.role === 'observer' ? 'رمز المراقب' : 'رمز المشرف'}
                        className="w-full border border-line rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-primary"
                      />
                      <input
                        value={row.bravoCode}
                        onChange={(e) => updateRow(i, { bravoCode: e.target.value })}
                        placeholder="رمز البرافو"
                        className="w-full border border-line rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-primary"
                      />
                    </div>
                    {row.role === 'observer' ? (
                      <>
                        <select
                          value={row.center}
                          onChange={(e) => updateRow(i, { center: e.target.value })}
                          className="w-full border border-line rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-primary"
                        >
                          <option value="">-- اختر مركز الخدمة --</option>
                          {CENTERS.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.id} — {c.caterer}
                            </option>
                          ))}
                        </select>
                        <select
                          value={row.supervisorId}
                          onChange={(e) => updateRow(i, { supervisorId: e.target.value })}
                          className="w-full border border-line rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-primary"
                        >
                          <option value="">-- اختر المشرف المسؤول --</option>
                          {supervisors.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nameAr || s.name}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <MultiCenterSelect
                        selected={row.centers}
                        onChange={(v) => updateRow(i, { centers: v })}
                      />
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addRow}
                disabled={rows.length >= MAX_BULK}
                className="w-full border-2 border-dashed border-line text-muted hover:border-primary hover:text-primary py-2 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
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
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition shadow-[0_4px_16px_rgb(var(--c-primary)/0.35)]"
                style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}
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

        {}
        <section className="bg-gradient-to-br from-white via-white to-background/40 rounded-2xl border border-line shadow-[0_2px_12px_rgb(var(--c-ink)/0.07)] transition-shadow duration-300 hover:shadow-[0_6px_28px_rgb(var(--c-primary)/0.14)] overflow-hidden lg:col-span-3">
          <div className="p-4 border-b border-line space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-primary">
                {page.title} ({AR(visible.length)}
                {search && ` من ${AR(mine.length)}`})
              </h2>
            </div>

            {/* Search bar */}
            <div className="relative">
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <Search size={15} className="text-primary" weight="bold" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم العربي أو الانجليزي أو رقم الهوية..."
                className="w-full pr-10 pl-10 py-2.5 border border-line rounded-xl text-sm text-ink outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.1)] transition-all bg-white placeholder-muted/40"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 left-3 flex items-center text-muted hover:text-primary transition-colors"
                  title="مسح البحث"
                >
                  <X size={14} weight="bold" />
                </button>
              )}
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
                className="text-muted text-xs border-b border-line"
                style={{ background: 'linear-gradient(135deg, rgb(var(--c-bg)) 0%, #fff 60%)' }}
              >
                <tr>
                  <th className="px-4 py-3 text-right font-semibold">الاسم</th>
                  <th className="px-4 py-3 text-right font-semibold">الهوية</th>
                  <th className="px-4 py-3 text-right font-semibold">الجوال</th>
                  <th className="px-4 py-3 text-right font-semibold">{page.codeLabel}</th>
                  {/* Both roles carry one — every supervisor on file has a
                      bravo code, so this is not an observer-only field. */}
                  <th className="px-4 py-3 text-right font-semibold">رمز البرافو</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    {isObserver ? 'المركز' : 'المراكز'}
                  </th>
                  {isObserver ? (
                    <th className="px-4 py-3 text-right font-semibold">المشرف المسؤول</th>
                  ) : (
                    <th className="px-4 py-3 text-right font-semibold">المراقبون</th>
                  )}
                  <th className="px-4 py-3 text-right font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading && (
                  <tr>
                    <td colSpan={colCount} className="p-8 text-center text-muted">
                      جارٍ التحميل...
                    </td>
                  </tr>
                )}
                {!loading && visible.length === 0 && (
                  <tr>
                    <td colSpan={colCount} className="p-8 text-center text-muted">
                      {search ? `لم يتم العثور على نتائج لـ "${search}"` : page.emptyText}
                    </td>
                  </tr>
                )}
                {visible.map((u) => {
                  const meta = ROLE_META[u.role] || ROLE_META.observer;
                  return (
                    <tr
                      key={u.id}
                      className="group/row hover:bg-background transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-ink">
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
                              <div className="text-muted text-xs truncate" dir="ltr">
                                {u.nameEn}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted" dir="ltr">
                        {u.idNumber || '—'}
                      </td>
                      <td className="px-4 py-3 text-muted" dir="ltr">
                        {u.phone || '—'}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {u.roleCode ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-background border border-line text-primary font-bold">
                            {u.roleCode}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs" dir="ltr">
                        {u.bravoCode ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-50 border border-violet-200 text-violet-700 font-bold tabular-nums">
                            {u.bravoCode}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        <CentersCell user={u} />
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {isObserver ? (() => {
                          const sup = centerToSupervisor.get(u.center);
                          return sup ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-br from-background to-white border border-line">
                              <ShieldCheck size={11} className="text-primary" weight="bold" />
                              <span className="font-bold text-ink">{sup.nameAr || sup.name}</span>
                            </div>
                          ) : (
                            /* Worth naming: an observer whose centre no
                               supervisor covers reports to nobody. */
                            <span className="text-amber-700 font-bold">— بلا مشرف —</span>
                          );
                        })() : (() => {
                          const n = observerLoad.get(u.id) || 0;
                          return n ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-br from-background to-white border border-line">
                              <Eye size={11} className="text-primary" weight="bold" />
                              <span className="font-bold text-ink tabular-nums">{AR(n)}</span>
                              <span className="text-muted">مراقب</span>
                            </div>
                          ) : (
                            <span className="text-muted">— لا مراقبين —</span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEdit(u)}
                            className="group/edit flex items-center gap-1 text-primary hover:text-white text-xs font-bold px-2 py-1 rounded-lg border border-primary/20 hover:bg-gradient-to-br hover:from-primary-400 hover:to-primary hover:border-transparent transition-all hover:shadow-md"
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

      {}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeEdit} />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            dir="rtl"
          >
            <div
              className="flex items-center justify-between px-6 py-4 border-b border-line"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-bg)) 0%, #fff 55%)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}
                >
                  <Users size={16} className="text-white" weight="regular" />
                </div>
                <h2 className="font-bold text-ink text-sm">تعديل بيانات المستخدم</h2>
              </div>
              <button
                onClick={closeEdit}
                className="w-8 h-8 rounded-xl border border-line flex items-center justify-center hover:bg-[rgb(var(--c-primary-50))] transition-colors"
              >
                <X size={15} className="text-muted" weight="regular" />
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
              {/* Role-specific code + Bravo code */}
              <div className="grid grid-cols-2 gap-3">
                <Field label={page.codeLabel} required>
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
                  style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}
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
                  className="px-5 py-3 rounded-xl border border-line text-muted text-sm font-medium hover:bg-gray-50 transition"
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

