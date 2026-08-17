import { useEffect, useMemo, useState } from 'react';
import { db, serverTimestamp } from '../../lib/db.js';
import { supabase } from '../../config/supabase.js';
import { CENTERS, getCaterer } from '../../config/centers.js';
import {
  UserGear as UserCog,
  Plus,
  X,
  FloppyDisk as Save,
  CaretDown as ChevronDown,
  Eye,
  EyeSlash as EyeOff,
  ShieldCheck,
  Crown,
  Pencil,
  Trash as Trash2,
  Sparkle as Sparkles,
  Funnel as Filter,
  Envelope as Mail,
  Lock,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';

/* Create the staff/admin account end-to-end:
   1. Save the current admin's auth tokens so we can restore the session
      after signUp (which auto-signs-in the newly-created user).
   2. Call supabase.auth.signUp to create an entry in auth.users.
   3. Insert the matching public.users row, linking via auth_uid.
   4. Restore the admin session so the admin remains logged in.

   Note: this assumes Supabase email confirmation is disabled (Project
   Settings → Authentication → "Email Confirmations" off). If enabled,
   the new user must confirm their email before they can log in. */
async function createStaffRow(email, password, userData) {
  /* 1. Snapshot the current admin session */
  const { data: sessionData } = await supabase.auth.getSession();
  const adminSession = sessionData?.session
    ? {
        access_token:  sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      }
    : null;

  /* 2. Create auth.users entry */
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email,
    password,
  });
  if (signUpErr) {
    /* Make sure the admin session is intact before re-throwing */
    if (adminSession) await supabase.auth.setSession(adminSession).catch(() => {});
    throw new Error(signUpErr.message || 'تعذّر إنشاء حساب المصادقة');
  }

  const authUid = signUpData?.user?.id || null;

  /* 3. Insert public.users row — link to auth account if we got an id */
  try {
    await db.users.insert({
      email,
      ...userData,
      ...(authUid ? { authUid } : {}),
    });
  } catch (insertErr) {
    /* Restore admin session even on failure so they aren't stuck logged out */
    if (adminSession) await supabase.auth.setSession(adminSession).catch(() => {});
    throw insertErr;
  }

  /* 4. Restore the admin's session (signUp auto-logged in the new user) */
  if (adminSession) {
    await supabase.auth.setSession(adminSession).catch(() => {});
  }
}

const ROLES = [
  { value: 'admin', label: 'مسؤول', Icon: Crown,       color: '#9E5741' },
  { value: 'staff', label: 'موظف',  Icon: ShieldCheck, color: 'rgb(var(--c-primary))' },
];
const ROLE_META = Object.fromEntries(ROLES.map(r => [r.value, r]));

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
          {selected.length ? `${selected.length} مركز محدد` : 'اختر المراكز المخصصة'}
        </span>
        <ChevronDown size={15} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
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

const EMPTY_FORM = {
  nameAr: '', nameEn: '', email: '', password: '', phone: '',
  role: 'staff', assigned_centers: [],
};

export default function AdminStaff() {
  const [allUsers, setAllUsers] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [listError, setListError] = useState(null);

  const [filter, setFilter] = useState('all');

  /* Add form */
  const [form,          setForm]         = useState(EMPTY_FORM);
  const [showPass,      setShowPass]     = useState(false);
  const [saving,        setSaving]       = useState(false);
  const [error,         setError]        = useState(null);
  const [success,       setSuccess]      = useState(null);

  /* Edit modal */
  const [editTarget, setEditTarget] = useState(null);
  const [editForm,   setEditForm]   = useState(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsub = db.users.subscribe((rows) => {
      setAllUsers(rows);
      setLoading(false);
    });
    return unsub;
  }, []);

  const staff = useMemo(
    () => allUsers.filter((u) => u.role === 'admin' || u.role === 'staff'),
    [allUsers],
  );

  const counts = {
    all:   staff.length,
    admin: staff.filter((u) => u.role === 'admin').length,
    staff: staff.filter((u) => u.role === 'staff').length,
  };

  const visible = useMemo(() => {
    if (filter === 'all') return staff;
    return staff.filter((u) => u.role === filter);
  }, [staff, filter]);

  /* ── Validation ──────────────────────────── */
  const validateCreate = (f) => {
    if (!f.nameAr.trim()) return 'الاسم العربي مطلوب';
    if (!f.email.trim())  return 'البريد الإلكتروني مطلوب';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return 'صيغة البريد الإلكتروني غير صحيحة';
    if (!f.password || f.password.length < 6) return 'كلمة المرور 6 أحرف على الأقل';
    if (f.role === 'staff' && f.assigned_centers.length === 0)
      return 'اختر مركزاً واحداً على الأقل (المسؤول يشوف الكل تلقائياً)';
    if (allUsers.some((u) => u.email === f.email)) return 'البريد الإلكتروني مستخدم مسبقاً';
    return null;
  };

  const validateEdit = (f) => {
    if (!f.nameAr.trim()) return 'الاسم العربي مطلوب';
    if (f.role === 'staff' && f.assigned_centers.length === 0)
      return 'اختر مركزاً واحداً على الأقل';
    return null;
  };

  /* ── Add ──────────────────────────────────── */
  const handleAdd = async (e) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    const err = validateCreate(form);
    if (err) return setError(err);

    setSaving(true);
    try {
      const userData = {
        nameAr:          form.nameAr.trim(),
        name:            form.nameAr.trim(),
        phone:           form.phone.trim(),
        role:            form.role,
        assignedCenters: form.role === 'admin' ? [] : form.assigned_centers,
      };
      await createStaffRow(form.email.trim(), form.password, userData);
      setSuccess('تم إنشاء الحساب بنجاح — يقدر الموظف يسجّل دخوله الآن.');
      setForm(EMPTY_FORM);
      setShowPass(false);
      setTimeout(() => setSuccess(null), 5000);
    } catch (ex) {
      setError(ex.message || 'حدث خطأ غير متوقع');
    }
    setSaving(false);
  };

  /* ── Edit ─────────────────────────────────── */
  const openEdit = (u) => {
    setEditTarget(u);
    setEditError(null);
    setEditForm({
      id:       u.uid || u.id,
      nameAr:   u.nameAr || u.name || '',
      nameEn:   '',
      email:    u.email || '',
      password: '',
      phone:    u.phone || '',
      role:     u.role || 'admin',
      assigned_centers: u.assignedCenters || [],
    });
  };
  const closeEdit = () => { setEditTarget(null); setEditError(null); };

  const handleEditSave = async () => {
    const err = validateEdit(editForm);
    if (err) return setEditError(err);
    setEditSaving(true);
    try {
      await db.users.update(editForm.id, {
        nameAr:          editForm.nameAr.trim(),
        name:            editForm.nameAr.trim(),
        phone:           editForm.phone.trim(),
        role:            editForm.role,
        assignedCenters: editForm.role === 'admin' ? [] : editForm.assigned_centers,
      });
      closeEdit();
    } catch (ex) {
      setEditError(ex.message);
    }
    setEditSaving(false);
  };

  const handleDelete = async (u) => {
    if (!confirm(`حذف الموظف "${u.nameAr || u.name}" نهائياً؟\nملاحظة: حساب المصادقة في Supabase يجب حذفه يدوياً من Studio.`)) return;
    try {
      await db.users.delete(u.uid || u.id);
    } catch (ex) {
      setListError(ex.message);
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        Icon={UserCog}
        title="الموظفين"
        subtitle="حسابات الإداريين والمراكز المخصَّصة لهم"
        gradient={{ from: 'rgb(var(--c-primary-400))', to: 'rgb(var(--c-primary))' }}
        sparkle
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ── Add panel (left) ─────────────────── */}
        <section className="bg-gradient-to-br from-white via-white to-background/40 rounded-2xl border border-line shadow-[0_2px_12px_rgb(var(--c-ink)/0.07)] transition-shadow duration-300 hover:shadow-[0_6px_28px_rgb(var(--c-primary)/0.14)] lg:col-span-2 h-fit relative">
          <div className="px-5 py-4 border-b border-line flex items-center gap-2.5 bg-background/40">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}>
              <Plus size={16} className="text-white" weight="bold" />
            </div>
            <div>
              <h2 className="font-bold text-ink text-sm">إضافة موظف جديد</h2>
              <p className="text-[10px] text-muted">سيتم إنشاء حساب دخول بالبريد الإلكتروني</p>
            </div>
          </div>

          <form onSubmit={handleAdd} className="p-5 space-y-3">
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

            <Field label="البريد الإلكتروني" required>
              <div className="relative">
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <Mail size={14} className="text-primary" />
                </div>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="admin@example.com"
                  dir="ltr"
                  className={`${inputCls} pr-9`}
                />
              </div>
            </Field>

            <Field label="كلمة المرور" required>
              <div className="relative">
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <Lock size={14} className="text-primary" />
                </div>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="6 أحرف على الأقل"
                  dir="ltr"
                  className={`${inputCls} pr-9 pl-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            <Field label="رقم الجوال">
              <input
                value={form.phone}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '');
                  if (v.length <= 10) setForm((p) => ({ ...p, phone: v }));
                }}
                placeholder="05xxxxxxxx"
                dir="ltr"
                maxLength={10}
                inputMode="numeric"
                className={inputCls}
              />
            </Field>

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
                      className={`group/role px-3 py-2.5 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-2 ${
                        active ? 'text-white scale-[1.02] shadow-md' : 'border-line bg-white text-muted hover:scale-[1.02]'
                      }`}
                      style={active ? {
                        borderColor: r.color,
                        background: `linear-gradient(135deg, ${r.color}, ${r.color}DD)`,
                        boxShadow: `0 4px 14px ${r.color}40`,
                      } : {}}
                    >
                      <RIcon size={15} className={`transition-transform ${active ? 'scale-110' : 'group-hover/role:scale-110'}`} />
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            {form.role === 'staff' && (
              <Field label="المراكز المخصصة" required>
                <MultiCenterSelect
                  selected={form.assigned_centers}
                  onChange={(v) => setForm((p) => ({ ...p, assigned_centers: v }))}
                />
              </Field>
            )}
            {form.role === 'admin' && (
              <div className="bg-purple-50 border border-purple-200 text-purple-700 rounded-xl px-3 py-2.5 text-xs font-medium flex items-start gap-2">
                <Crown size={14} className="mt-0.5 flex-shrink-0" />
                <span>المسؤول يرى ويدير <b>جميع المراكز</b> بدون قيود.</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm font-medium">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-3 py-2 text-sm font-medium">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition shadow-[0_4px_16px_rgb(var(--c-primary)/0.35)]"
              style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جارٍ الإضافة...
                </>
              ) : (
                <>
                  <Plus size={15} /> إضافة الموظف
                </>
              )}
            </button>
          </form>
        </section>

        {/* ── List panel (right) ─────────────── */}
        <section className="bg-gradient-to-br from-white via-white to-background/40 rounded-2xl border border-line shadow-[0_2px_12px_rgb(var(--c-ink)/0.07)] transition-shadow duration-300 hover:shadow-[0_6px_28px_rgb(var(--c-primary)/0.14)] lg:col-span-3">
          <div className="p-4 border-b border-line">
            <h2 className="text-lg font-bold text-primary mb-3">
              الموظفون ({visible.length}{filter !== 'all' && ` من ${counts.all}`})
            </h2>
            <div className="flex gap-2 flex-wrap">
              <Chip active={filter === 'all'} onClick={() => setFilter('all')} count={counts.all} Icon={Filter} color="rgb(var(--c-muted))">
                الكل
              </Chip>
              <Chip active={filter === 'admin'} onClick={() => setFilter('admin')} count={counts.admin} Icon={Crown} color="#9E5741">
                المسؤولون
              </Chip>
              <Chip active={filter === 'staff'} onClick={() => setFilter('staff')} count={counts.staff} Icon={ShieldCheck} color="rgb(var(--c-primary))">
                الموظفون
              </Chip>
            </div>
          </div>

          {listError && (
            <div className="m-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm font-medium">
              {listError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted text-xs border-b border-line"
                style={{ background: 'linear-gradient(135deg, rgb(var(--c-bg)) 0%, #fff 60%)' }}>
                <tr>
                  <th className="px-4 py-3 text-right font-semibold">الاسم</th>
                  <th className="px-4 py-3 text-right font-semibold">البريد</th>
                  <th className="px-4 py-3 text-right font-semibold">الدور</th>
                  <th className="px-4 py-3 text-right font-semibold">المراكز</th>
                  <th className="px-4 py-3 text-right font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted">جارٍ التحميل...</td></tr>
                )}
                {!loading && visible.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted">لا يوجد موظفون</td></tr>
                )}
                {visible.map((u) => {
                  const meta = ROLE_META[u.role] || ROLE_META.staff;
                  const RoleIcon = meta.Icon;
                  const assignedCenters = u.assignedCenters || [];
                  return (
                    <tr key={u.uid || u.id} className="group/row hover:bg-background transition-colors">
                      <td className="px-4 py-3 font-medium text-ink">
                        <div className="flex items-center gap-2.5">
                          <div className="relative flex-shrink-0">
                            <div className="absolute inset-0 rounded-full blur-md opacity-0 group-hover/row:opacity-60 transition-opacity"
                              style={{ background: meta.color }} />
                            <div className="relative w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm ring-2 ring-white"
                              style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}DD)` }}>
                              {(u.nameAr || u.name)?.charAt(0) || '؟'}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate">{u.nameAr || u.name || '—'}</div>
                            {u.nameEn && (
                              <div className="text-muted text-xs truncate" dir="ltr">{u.nameEn}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs" dir="ltr">{u.email || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full text-white shadow-sm"
                          style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}DD)` }}
                        >
                          <RoleIcon size={11} weight="bold" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 font-bold text-purple-600">
                            <Crown size={10} /> كل المراكز
                          </span>
                        ) : assignedCenters.length > 0 ? (
                          <span title={assignedCenters.join('، ')}>
                            {assignedCenters.length} مركز
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEdit(u)}
                            className="group/edit flex items-center gap-1 text-primary hover:text-white text-xs font-bold px-2 py-1 rounded-lg border border-primary/20 hover:bg-gradient-to-br hover:from-primary-400 hover:to-primary hover:border-transparent transition-all hover:shadow-md"
                          >
                            <Pencil size={12} className="group-hover/edit:rotate-12 transition-transform" />
                            تعديل
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            className="group/del flex items-center gap-1 text-red-500 hover:text-white text-xs font-bold px-2 py-1 rounded-lg border border-red-200 hover:bg-red-500 hover:border-red-500 transition-all hover:shadow-md"
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

      {/* ── Edit modal ─────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeEdit} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-bg)) 0%, #fff 55%)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}>
                  <Pencil size={15} className="text-white" />
                </div>
                <h2 className="font-bold text-ink text-sm">تعديل بيانات الموظف</h2>
              </div>
              <button onClick={closeEdit}
                className="w-8 h-8 rounded-xl border border-line flex items-center justify-center hover:bg-[rgb(var(--c-primary-50))]">
                <X size={15} className="text-muted" />
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
              <Field label="البريد الإلكتروني">
                <input
                  value={editForm.email}
                  disabled
                  dir="ltr"
                  className={`${inputCls} bg-gray-50 text-muted`}
                />
                <p className="text-[10px] text-muted mt-1">البريد لا يمكن تغييره بعد إنشاء الحساب.</p>
              </Field>
              <Field label="رقم الجوال">
                <input
                  value={editForm.phone}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    if (v.length <= 10) setEditForm((p) => ({ ...p, phone: v }));
                  }}
                  dir="ltr"
                  maxLength={10}
                  inputMode="numeric"
                  className={inputCls}
                />
              </Field>
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
                        className={`group/role px-3 py-2.5 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-2 ${
                          active ? 'text-white scale-[1.02]' : 'border-line bg-white text-muted hover:scale-[1.02]'
                        }`}
                        style={active ? {
                          borderColor: r.color,
                          background: `linear-gradient(135deg, ${r.color}, ${r.color}DD)`,
                          boxShadow: `0 4px 14px ${r.color}40`,
                        } : {}}
                      >
                        <RIcon size={15} />
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              {editForm.role === 'staff' && (
                <Field label="المراكز المخصصة" required>
                  <MultiCenterSelect
                    selected={editForm.assigned_centers}
                    onChange={(v) => setEditForm((p) => ({ ...p, assigned_centers: v }))}
                  />
                </Field>
              )}
              {editForm.role === 'admin' && (
                <div className="bg-purple-50 border border-purple-200 text-purple-700 rounded-xl px-3 py-2.5 text-xs font-medium flex items-start gap-2">
                  <Crown size={14} className="mt-0.5 flex-shrink-0" />
                  <span>المسؤول يرى ويدير جميع المراكز.</span>
                </div>
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
                  className="px-5 py-3 rounded-xl border border-line text-muted text-sm font-medium hover:bg-gray-50"
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

function Chip({ active, count, onClick, Icon, color = 'rgb(var(--c-primary))', children }) {
  const activeStyle = active
    ? {
        background: `linear-gradient(135deg, ${color}DD, ${color})`,
        borderColor: color,
        color: '#fff',
        boxShadow: `0 3px 10px ${color}55`,
      }
    : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      style={activeStyle}
      className={`group/chip px-3 py-1.5 rounded-xl text-sm font-bold border transition-all flex items-center gap-1.5 ${
        active ? 'scale-[1.03]' : 'bg-white text-ink border-line hover:scale-[1.02]'
      }`}
    >
      {Icon && (
        <Icon
          size={14}
          className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover/chip:scale-110'}`}
          style={!active ? { color } : undefined}
        />
      )}
      {children}
      {count !== undefined && (
        <span className={`px-1.5 py-0.5 rounded-full text-xs ${active ? 'bg-white/25 text-white' : 'bg-background'}`}
          style={!active ? { color } : undefined}>
          {count}
        </span>
      )}
    </button>
  );
}
