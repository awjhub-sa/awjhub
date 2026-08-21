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
import DataTable from '../../components/DataTable.jsx';
import FilterChip from '../../components/FilterChip.jsx';
import { IconTile } from '../../components/ui/index.jsx';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

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
  'w-full px-3.5 py-2.5 border border-line rounded-[10px] text-[13px] font-medium text-ink outline-none focus:border-primary transition-colors placeholder:text-muted/50 bg-white';

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-[11.5px] font-bold text-muted mb-1.5">
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
        className="w-full px-3.5 py-2.5 border border-line rounded-[10px] text-[13px] font-medium text-start flex items-center justify-between focus:border-primary outline-none transition-colors bg-white"
      >
        <span className={selected.length ? 'text-ink' : 'text-muted/50'}>
          {selected.length ? `${selected.length} مركز محدد` : 'اختر المراكز المخصصة'}
        </span>
        <ChevronDown size={15} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 top-full start-0 end-0 mt-1 bg-white border border-line rounded-[12px] shadow-[0_12px_32px_-12px_rgb(var(--c-ink)/0.28)] max-h-72 overflow-y-auto">
          {CENTERS.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-[rgb(var(--c-bg))] cursor-pointer text-[13px]"
            >
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="accent-primary w-4 h-4"
              />
              <div className="min-w-0">
                <span className="text-ink font-semibold">{c.id}</span>
                <span className="text-muted text-[11px] block truncate">{c.caterer}</span>
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
        kicker="المستخدمين"
        Icon={UserCog}
        title="الموظفين"
        gradient={{ from: 'rgb(var(--c-primary-400))', to: 'rgb(var(--c-primary))' }}
        sparkle
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ── Add panel (left) ─────────────────── */}
        <section className="bg-white rounded-[14px] border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200 hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)] lg:col-span-2 h-fit relative overflow-hidden">
          <div
            className="px-4 sm:px-5 py-3.5 border-b flex items-center gap-3"
            style={{
              background: tint('rgb(var(--c-primary))', 12),
              borderColor: tint('rgb(var(--c-primary))', 28),
            }}
          >
            <IconTile Icon={Plus} size="md" />
            <div>
              <h2 className="font-bold text-primary text-[14px]">إضافة موظف جديد</h2>
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
                <div className="absolute inset-y-0 start-3 flex items-center pointer-events-none">
                  <Mail size={14} className="text-muted/60" weight="bold" />
                </div>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="admin@example.com"
                  dir="ltr"
                  className={`${inputCls} ps-9`}
                />
              </div>
            </Field>

            <Field label="كلمة المرور" required>
              <div className="relative">
                <div className="absolute inset-y-0 start-3 flex items-center pointer-events-none">
                  <Lock size={14} className="text-muted/60" weight="bold" />
                </div>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="6 أحرف على الأقل"
                  dir="ltr"
                  className={`${inputCls} ps-9 pe-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
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
                      className={`px-3 py-2.5 rounded-[10px] text-[12.5px] font-bold border transition-colors flex items-center justify-center gap-2 ${
                        active ? 'text-white' : 'border-line bg-white text-muted hover:bg-[rgb(var(--c-bg))]'
                      }`}
                      style={active ? { background: r.color, borderColor: r.color } : undefined}
                    >
                      <RIcon size={14} weight="bold" />
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
              <div
                className="rounded-[10px] border px-3 py-2.5 text-[11.5px] font-semibold flex items-start gap-2"
                style={{ background: tint('#9E5741', 12), borderColor: tint('#9E5741', 28), color: '#9E5741' }}
              >
                <Crown size={14} weight="bold" className="mt-0.5 shrink-0" />
                <span>المسؤول يرى ويدير <b>جميع المراكز</b> بدون قيود.</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] bg-primary border border-primary text-white font-bold text-[13px] hover:opacity-90 disabled:opacity-60 transition-opacity"
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
        <section className="bg-white rounded-[14px] border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow duration-200 hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)] overflow-hidden lg:col-span-3">
          <div
            className="p-4 border-b"
            style={{
              background: tint('rgb(var(--c-primary))', 12),
              borderColor: tint('rgb(var(--c-primary))', 28),
            }}
          >
            <h2 className="text-[14px] font-bold text-primary mb-3">
              الموظفون ({visible.length}{filter !== 'all' && ` من ${counts.all}`})
            </h2>
            <div className="flex gap-2 flex-wrap">
              <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} count={counts.all} Icon={Filter} color="rgb(var(--c-muted))">
                الكل
              </FilterChip>
              <FilterChip active={filter === 'admin'} onClick={() => setFilter('admin')} count={counts.admin} Icon={Crown} color="#9E5741">
                المسؤولون
              </FilterChip>
              <FilterChip active={filter === 'staff'} onClick={() => setFilter('staff')} count={counts.staff} Icon={ShieldCheck} color="rgb(var(--c-primary))">
                الموظفون
              </FilterChip>
            </div>
          </div>

          {listError && (
            <div className="m-3 bg-red-50 border border-red-200 text-red-700 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold">
              {listError}
            </div>
          )}

          <DataTable>
            <table className="w-full text-sm">
              <thead className="text-muted text-[11px] border-b border-line bg-[rgb(var(--c-bg))]">
                <tr>
                  <th className="px-4 py-3 text-start font-bold">الاسم</th>
                  <th className="px-4 py-3 text-start font-bold">البريد</th>
                  <th className="px-4 py-3 text-start font-bold">الدور</th>
                  <th className="px-4 py-3 text-start font-bold">المراكز</th>
                  <th className="px-4 py-3 text-start font-bold">إجراء</th>
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
                    <tr key={u.uid || u.id} className="hover:bg-[rgb(var(--c-bg))] transition-colors">
                      <td className="px-4 py-3 font-semibold text-ink">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-[10px] border flex items-center justify-center text-[12px] font-bold shrink-0"
                            style={{
                              background: tint(meta.color, 12),
                              borderColor: tint(meta.color, 28),
                              color: meta.color,
                            }}
                          >
                            {(u.nameAr || u.name)?.charAt(0) || '؟'}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[13px]">{u.nameAr || u.name || '—'}</div>
                            {u.nameEn && (
                              <div className="text-muted text-[11px] font-medium truncate mt-0.5" dir="ltr">{u.nameEn}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted text-[11.5px]" dir="ltr">{u.email || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 text-[10.5px] font-bold px-1.5 py-[3px] rounded-md whitespace-nowrap leading-none"
                          style={{ background: tint(meta.color, 11), color: meta.color }}
                        >
                          <RoleIcon size={10} weight="bold" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted text-[11.5px]">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 font-bold" style={{ color: '#9E5741' }}>
                            <Crown size={11} weight="bold" /> كل المراكز
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
                            className="flex items-center gap-1 text-primary hover:text-white text-[11px] font-bold px-2 py-1 rounded-[8px] border border-primary/25 bg-[rgb(var(--c-primary)/0.06)] hover:bg-primary hover:border-primary transition-colors"
                          >
                            <Pencil size={12} weight="bold" />
                            تعديل
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            className="flex items-center gap-1 text-red-600 hover:text-white text-[11px] font-bold px-2 py-1 rounded-[8px] border border-red-200 bg-red-50 hover:bg-red-600 hover:border-red-600 transition-colors"
                          >
                            <Trash2 size={12} weight="bold" />
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
        </section>
      </div>

      {/* ── Edit modal ─────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[rgb(var(--c-ink)/0.45)] backdrop-blur-sm" onClick={closeEdit} />
          <div className="relative bg-white rounded-[18px] border border-line shadow-[0_24px_60px_-16px_rgb(var(--c-ink)/0.35)] w-full max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b"
              style={{
                background: tint('rgb(var(--c-primary))', 12),
                borderColor: tint('rgb(var(--c-primary))', 28),
              }}>
              <div className="flex items-center gap-3">
                <IconTile Icon={Pencil} size="md" />
                <h2 className="font-bold text-primary text-[14px]">تعديل بيانات الموظف</h2>
              </div>
              <button onClick={closeEdit}
                className="w-8 h-8 rounded-[10px] border border-line bg-white flex items-center justify-center text-muted hover:text-ink transition-colors">
                <X size={14} weight="bold" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-3">
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
                  className={`${inputCls} bg-[rgb(var(--c-bg))] text-muted`}
                />
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
                        className={`px-3 py-2.5 rounded-[10px] text-[12.5px] font-bold border transition-colors flex items-center justify-center gap-2 ${
                          active ? 'text-white' : 'border-line bg-white text-muted hover:bg-[rgb(var(--c-bg))]'
                        }`}
                        style={active ? { background: r.color, borderColor: r.color } : undefined}
                      >
                        <RIcon size={14} weight="bold" />
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
                <div
                  className="rounded-[10px] border px-3 py-2.5 text-[11.5px] font-semibold flex items-start gap-2"
                  style={{ background: tint('#9E5741', 12), borderColor: tint('#9E5741', 28), color: '#9E5741' }}
                >
                  <Crown size={14} weight="bold" className="mt-0.5 shrink-0" />
                  <span>المسؤول يرى ويدير جميع المراكز.</span>
                </div>
              )}

              {editError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold">
                  {editError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] bg-primary border border-primary text-white font-bold text-[13px] hover:opacity-90 disabled:opacity-60 transition-opacity"
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
                  className="px-5 py-2.5 rounded-[10px] border border-line text-muted text-[13px] font-bold hover:bg-[rgb(var(--c-bg))] transition-colors"
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
