import { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/db.js';
import {
  Buildings as Building2,
  Plus,
  X,
  FloppyDisk as Save,
  Pencil,
  Trash as Trash2,
  MagnifyingGlass as Search,
  Funnel as Filter,
  CheckCircle as CircleCheck,
  PauseCircle,
  Archive,
  Phone,
  Envelope as Mail,
  IdentificationCard,
  MapPinArea,
  User,
  WhatsappLogo,
  Warning,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';
import CatererAccountDialog from '../../components/caterers/CatererAccountDialog.jsx';
import { Key } from '@phosphor-icons/react';
import { COLORS } from '../../config/brand.js';
import { seasonLabel } from '../../lib/hijri.js';
import DataTable from '../../components/DataTable.jsx';
import FilterChip from '../../components/FilterChip.jsx';
import { IconTile, StatTile } from '../../components/ui/index.jsx';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const STATUSES = [
  { value: 'active',    label: 'نشط',    Icon: CircleCheck,  color: COLORS.success },
  { value: 'suspended', label: 'موقوف',  Icon: PauseCircle,  color: COLORS.warning },
  { value: 'archived',  label: 'مؤرشف',  Icon: Archive,      color: COLORS.muted   },
];
const STATUS_META = Object.fromEntries(STATUSES.map(s => [s.value, s]));

const inputCls =
  'w-full px-3.5 py-2.5 border border-line rounded-[10px] text-[13px] font-medium text-ink outline-none focus:border-primary transition-colors placeholder:text-muted/50 bg-white';

/* Field names track the customer's own sheet (البيانات المركزية، الورقة4), so
   an owner transcribing what they already have on paper finds every column. */
const EMPTY_FORM = {
  id: null,
  name: '', nameShort: '', crNumber: '', municipalLicense: '', address: '',
  ownerName: '', ownerCapacity: '', ownerIdNumber: '', ownerPhone: '',
  email: '', liaisonName: '', liaisonPhone: '',
  status: 'active', notes: '',
};

/* الصفة — the capacity in which the named person signs for the company. */
const CAPACITIES = ['مالك', 'مفوّض', 'وكيل', 'مدير عام'];

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-[11.5px] font-bold text-muted mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10.5px] text-muted mt-1">{hint}</p>}
  </div>
);

/* The sheet has three visually distinct blocks; the form keeps that grouping
   so an owner copying it across can follow along without hunting. */
const SectionRule = ({ children }) => (
  <div className="pt-2 pb-0.5 flex items-center gap-2">
    <span className="h-px flex-1 bg-line" />
    <span className="text-[10.5px] font-bold text-muted whitespace-nowrap">{children}</span>
    <span className="h-px flex-1 bg-line" />
  </div>
);

const PhoneLink = ({ phone }) => (
  <a
    href={`https://wa.me/966${phone.slice(1)}`}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center gap-1.5 text-muted hover:text-green-600 transition-colors"
    dir="ltr"
  >
    <WhatsappLogo size={12} className="shrink-0" />
    {phone}
  </a>
);

export default function AdminCaterers() {
  const [caterers, setCaterers] = useState([]);
  const [centers,  setCenters]  = useState([]);
  const [seasons,  setSeasons]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [listError, setListError] = useState(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  /* One modal serves both add and edit — `form.id` decides which. */
  const [modalOpen, setModalOpen] = useState(false);
  const [form,   setForm]   = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  useEffect(() => {
    const unsubC = db.caterers.subscribe(rows => {
      setCaterers(rows);
      setLoading(false);
    }, { orderBy: 'name', ascending: true });
    const unsubCe = db.centers.subscribe(setCenters);
    const unsubS  = db.seasons.subscribe(setSeasons);
    return () => { unsubC(); unsubCe(); unsubS(); };
  }, []);

  const activeSeason = seasons.find(s => s.isActive) || null;

  /* Counted within the active season only. A caterer who held six centers last
     year and none this year should read as none — the old rows are history,
     not a current assignment. */
  const seasonCenters = useMemo(
    () => (activeSeason ? centers.filter(c => c.seasonId === activeSeason.id) : []),
    [centers, activeSeason],
  );

  const centerCount = useMemo(() => {
    const map = {};
    for (const c of seasonCenters) {
      if (!c.catererId) continue;
      map[c.catererId] = (map[c.catererId] || 0) + 1;
    }
    return map;
  }, [seasonCenters]);

  /* Deletion is blocked by any assignment in any season, not just the active
     one, because deleting would orphan those historical rows too. */
  const everAssigned = useMemo(() => {
    const set = new Set();
    for (const c of centers) if (c.catererId) set.add(c.catererId);
    return set;
  }, [centers]);

  const counts = useMemo(() => ({
    all:       caterers.length,
    active:    caterers.filter(c => c.status === 'active').length,
    suspended: caterers.filter(c => c.status === 'suspended').length,
    archived:  caterers.filter(c => c.status === 'archived').length,
  }), [caterers]);

  const linkedCenters = useMemo(
    () => seasonCenters.filter(c => c.catererId).length,
    [seasonCenters],
  );

  const visible = useMemo(() => {
    const q = search.trim();
    return caterers.filter(c => {
      if (filter !== 'all' && c.status !== filter) return false;
      if (!q) return true;
      return [c.name, c.nameShort, c.crNumber, c.municipalLicense,
              c.ownerName, c.ownerPhone, c.ownerIdNumber,
              c.liaisonName, c.liaisonPhone, c.email]
        .some(v => String(v || '').includes(q));
    });
  }, [caterers, filter, search]);

  /* ── Modal ────────────────────────────────── */
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setModalOpen(true);
  };

  /* Which caterers already hold a sign-in account. Loaded once for the whole
     table rather than per row, and refreshed when the dialog changes one. */
  const [accounts, setAccounts] = useState({});
  const [accountFor, setAccountFor] = useState(null);

  const loadAccounts = useCallback(async () => {
    const rows = await db.users.list({ filter: { role: 'caterer' } });
    setAccounts(Object.fromEntries(
      rows.filter(r => r.catererId).map(r => [r.catererId, r])));
  }, []);
  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const openEdit = (c) => {
    setForm({
      id:               c.id,
      name:             c.name             || '',
      nameShort:        c.nameShort        || '',
      crNumber:         c.crNumber         || '',
      municipalLicense: c.municipalLicense || '',
      address:          c.address          || '',
      ownerName:        c.ownerName        || '',
      ownerCapacity:    c.ownerCapacity    || '',
      ownerIdNumber:    c.ownerIdNumber    || '',
      ownerPhone:       c.ownerPhone       || '',
      email:            c.email            || '',
      liaisonName:      c.liaisonName      || '',
      liaisonPhone:     c.liaisonPhone     || '',
      status:           c.status           || 'active',
      notes:            c.notes            || '',
    });
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setError(null); };

  const validate = (f) => {
    if (!f.name.trim()) return 'اسم المتعهد مطلوب';
    const dupe = caterers.some(
      c => c.id !== f.id && c.name.trim() === f.name.trim(),
    );
    if (dupe) return 'يوجد متعهد مسجّل بنفس الاسم';
    if (f.ownerPhone && !/^05\d{8}$/.test(f.ownerPhone))
      return 'رقم تواصل المالك يبدأ بـ 05 ويتكوّن من 10 أرقام';
    if (f.liaisonPhone && !/^05\d{8}$/.test(f.liaisonPhone))
      return 'جوال ضابط الاتصال يبدأ بـ 05 ويتكوّن من 10 أرقام';
    if (f.ownerIdNumber && !/^[12]\d{9}$/.test(f.ownerIdNumber))
      return 'رقم الهوية يبدأ بـ 1 أو 2 ويتكوّن من 10 أرقام';
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email))
      return 'صيغة البريد الإلكتروني غير صحيحة';
    return null;
  };

  const handleSave = async () => {
    const err = validate(form);
    if (err) return setError(err);

    setSaving(true);
    const t = (v) => v.trim() || null;
    const payload = {
      name:             form.name.trim(),
      nameShort:        t(form.nameShort),
      crNumber:         t(form.crNumber),
      municipalLicense: t(form.municipalLicense),
      address:          t(form.address),
      ownerName:        t(form.ownerName),
      ownerCapacity:    t(form.ownerCapacity),
      ownerIdNumber:    t(form.ownerIdNumber),
      ownerPhone:       t(form.ownerPhone),
      email:            t(form.email),
      liaisonName:      t(form.liaisonName),
      liaisonPhone:     t(form.liaisonPhone),
      status:           form.status,
      notes:            t(form.notes),
    };
    try {
      if (form.id) await db.caterers.update(form.id, payload);
      else         await db.caterers.insert(payload);
      closeModal();
    } catch (ex) {
      setError(ex.message || 'تعذّر الحفظ');
    }
    setSaving(false);
  };

  /* Deleting a caterer that still serves centers would silently null out their
     assignment, so archiving is offered instead. */
  const handleDelete = async (c) => {
    if (everAssigned.has(c.id)) {
      setListError(
        `"${c.name}" مُسنَد إلى مراكز — فكّ الإسناد من صفحة المراكز أولاً، أو غيّر حالته إلى «مؤرشف» للاحتفاظ بسجلّه.`,
      );
      return;
    }
    if (!confirm(`حذف المتعهد "${c.name}" نهائياً؟`)) return;
    setListError(null);
    try {
      await db.caterers.delete(c.id);
    } catch (ex) {
      setListError(ex.message);
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        kicker="إدارة المتعهدين"
        Icon={Building2}
        title="بيانات المتعهدين"
        gradient={{ from: 'rgb(var(--c-primary-400))', to: 'rgb(var(--c-primary))' }}
        right={
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-primary border border-primary text-white font-bold text-[12px] hover:opacity-90 transition-opacity"
          >
            <Plus size={15} weight="bold" />
            <span className="hidden sm:inline">إضافة متعهد</span>
          </button>
        }
      />

      {/* ── Stats ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="إجمالي المتعهدين" value={counts.all}       Icon={Building2}   color={COLORS.primary}
          active={filter === 'all'}       onClick={() => setFilter('all')} />
        <StatTile label="نشط"              value={counts.active}    Icon={CircleCheck} color={COLORS.success}
          active={filter === 'active'}    onClick={() => setFilter('active')} />
        <StatTile label="موقوف"            value={counts.suspended} Icon={PauseCircle} color={COLORS.warning}
          active={filter === 'suspended'} onClick={() => setFilter('suspended')} />
        <StatTile
          label={activeSeason ? `مراكز مُسندة · ${seasonLabel(activeSeason)}` : 'مراكز مُسندة'}
          value={linkedCenters} Icon={MapPinArea} color={COLORS.accent600} />
      </div>

      {/* ── List ───────────────────────────────── */}
      <section className="bg-white rounded-[14px] border border-line shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)]">
        <div className="p-4 border-b border-line space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-[15px] font-bold text-ink">
              المتعهدون ({visible.length}{visible.length !== counts.all && ` من ${counts.all}`})
            </h2>
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <div className="absolute inset-y-0 start-3 flex items-center pointer-events-none">
                <Search size={14} className="text-muted" />
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو السجل أو الجوال"
                className={`${inputCls} ps-9`}
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} count={counts.all} Icon={Filter} color={COLORS.muted}>
              الكل
            </FilterChip>
            {STATUSES.map(s => (
              <FilterChip
                key={s.value}
                active={filter === s.value}
                onClick={() => setFilter(s.value)}
                count={counts[s.value]}
                Icon={s.Icon}
                color={s.color}
              >
                {s.label}
              </FilterChip>
            ))}
          </div>
        </div>

        {listError && (
          <div className="m-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-[10px] px-3 py-2.5 text-[13px] font-medium flex items-start gap-2">
            <Warning size={15} className="mt-0.5 flex-shrink-0" />
            <span className="flex-1">{listError}</span>
            <button onClick={() => setListError(null)} className="text-amber-600 hover:text-amber-900">
              <X size={14} />
            </button>
          </div>
        )}

        <DataTable>
          <table className="w-full text-sm">
            <thead className="text-muted text-[11px] border-b border-line bg-[rgb(var(--c-bg))]">
              <tr>
                <th className="px-4 py-3 text-start font-bold">المتعهد</th>
                <th className="px-4 py-3 text-start font-bold">السجل / الرخصة</th>
                <th className="px-4 py-3 text-start font-bold">المالك</th>
                <th className="px-4 py-3 text-start font-bold">ضابط الاتصال</th>
                <th className="px-4 py-3 text-start font-bold">المراكز</th>
                <th className="px-4 py-3 text-start font-bold">الحالة</th>
                <th className="px-4 py-3 text-start font-bold">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && (
                <tr><td colSpan={7} className="p-8 text-center text-muted">جارٍ التحميل...</td></tr>
              )}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center">
                    <Building2 size={34} className="mx-auto text-muted/30 mb-2" />
                    <p className="text-muted text-sm">
                      {caterers.length === 0
                        ? 'لا يوجد متعهدون بعد — شغّل seedCaterers.mjs أو أضف متعهداً يدوياً.'
                        : 'لا نتائج مطابقة للبحث'}
                    </p>
                  </td>
                </tr>
              )}
              {visible.map((c) => {
                const meta = STATUS_META[c.status] || STATUS_META.active;
                const StatusIcon = meta.Icon;
                const linked = centerCount[c.id] || 0;
                return (
                  <tr key={c.id} className="group/row hover:bg-[rgb(var(--c-bg))] transition-colors align-top">
                    <td className="px-4 py-3 font-medium text-ink max-w-[280px]">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-[10px] border flex items-center justify-center text-[12px] font-bold shrink-0 mt-0.5"
                          style={{ background: tint(meta.color, 12), borderColor: tint(meta.color, 28), color: meta.color }}>
                          {c.name?.replace(/^(شركة|مؤسسة|مطابخ)\s+/, '').charAt(0) || '؟'}
                        </div>
                        <div className="min-w-0">
                          <div className="leading-snug">{c.name}</div>
                          {c.nameShort && (
                            <div className="text-muted text-[11.5px] mt-0.5">{c.nameShort}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs">
                      {c.crNumber || c.municipalLicense ? (
                        <div className="space-y-1" dir="ltr">
                          {c.crNumber && (
                            <div className="text-ink font-medium">{c.crNumber}</div>
                          )}
                          {c.municipalLicense && (
                            <div className="text-muted">
                              {c.municipalLicense}
                              <span className="text-muted/60"> · بلدي</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted/40">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs max-w-[190px]">
                      {c.ownerName ? (
                        <div className="space-y-1">
                          <div className="text-ink font-medium leading-snug">{c.ownerName}</div>
                          <div className="flex items-center gap-2 text-muted">
                            {c.ownerCapacity && <span>{c.ownerCapacity}</span>}
                            {c.ownerPhone && <PhoneLink phone={c.ownerPhone} />}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted/40">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs">
                      {c.liaisonName || c.liaisonPhone ? (
                        <div className="space-y-1">
                          {c.liaisonName && (
                            <div className="text-ink font-medium flex items-center gap-1.5">
                              <User size={11} className="text-muted flex-shrink-0" />
                              {c.liaisonName}
                            </div>
                          )}
                          {c.liaisonPhone && <PhoneLink phone={c.liaisonPhone} />}
                        </div>
                      ) : (
                        <span className="text-muted/40">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {linked > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-bold px-2 py-1 rounded-md border"
                          style={{
                            background: tint('rgb(var(--c-accent-600))', 11),
                            borderColor: tint('rgb(var(--c-accent-600))', 26),
                            color: 'rgb(var(--c-accent-600))',
                          }}>
                          <MapPinArea size={11} weight="bold" />
                          {linked}
                        </span>
                      ) : (
                        <span className="text-muted/40 text-xs">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 text-[11.5px] font-bold px-2.5 py-1 rounded-md border whitespace-nowrap"
                        style={{ background: tint(meta.color, 11), borderColor: tint(meta.color, 26), color: meta.color }}
                      >
                        <StatusIcon size={11} weight="bold" />
                        {meta.label}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* First of the three: issuing a login is the thing an
                            operator comes to this row looking for once the
                            caterer's own details are already right. */}
                        <button
                          onClick={() => setAccountFor(c)}
                          title={accounts[c.id] ? accounts[c.id].email : 'إنشاء حساب دخول للمتعهد'}
                          className={`flex items-center gap-1 text-[11.5px] font-bold px-2 py-1 rounded-md border transition-colors ${
                            accounts[c.id]
                              ? 'border-success/30 text-success bg-success/[0.07] hover:bg-success/[0.13]'
                              : 'border-accent/30 text-accent-600 bg-accent/[0.07] hover:bg-accent/[0.13]'
                          }`}
                        >
                          <Key size={12} weight={accounts[c.id] ? 'fill' : 'bold'} />
                          {accounts[c.id] ? 'الحساب' : 'حساب دخول'}
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="flex items-center gap-1 text-primary text-[11.5px] font-bold px-2 py-1 rounded-md border border-primary/20 bg-primary/[0.06] hover:bg-primary/[0.12] transition-colors"
                        >
                          <Pencil size={12} />
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="flex items-center gap-1 text-red-600 text-[11.5px] font-bold px-2 py-1 rounded-md border border-red-200 bg-red-500/[0.06] hover:bg-red-500/[0.12] transition-colors"
                        >
                          <Trash2 size={12} />
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

      {/* ── Add / edit modal ───────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[rgb(var(--c-ink)/0.45)] backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-[18px] border border-line shadow-[0_24px_60px_-16px_rgb(var(--c-ink)/0.35)] w-full max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
              style={{
                background: tint('rgb(var(--c-primary))', 12),
                borderColor: tint('rgb(var(--c-primary))', 28),
              }}>
              <div className="flex items-center gap-2.5">
                <IconTile Icon={form.id ? Pencil : Plus} size="md" />
                <h2 className="font-bold text-ink text-[14px]">
                  {form.id ? 'تعديل بيانات المتعهد' : 'إضافة متعهد جديد'}
                </h2>
              </div>
              <button onClick={closeModal}
                className="w-8 h-8 rounded-[10px] border border-line bg-white flex items-center justify-center hover:bg-[rgb(var(--c-bg))] transition-colors">
                <X size={15} className="text-muted" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-3">
              <Field
                label="اسم المتعهد (كما في السجل)"
                required
              >
                <input
                  value={form.name}
                  onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="شركة تقنيات الغذاء المتحدة للتصنيع"
                  className={inputCls}
                />
              </Field>

              <Field label="الاسم المختصر">
                <input
                  value={form.nameShort}
                  onChange={(e) => setForm(p => ({ ...p, nameShort: e.target.value }))}
                  placeholder="تقنيات الغذاء"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="رقم السجل التجاري">
                  <div className="relative">
                    <div className="absolute inset-y-0 start-3 flex items-center pointer-events-none">
                      <IdentificationCard size={14} className="text-primary" />
                    </div>
                    <input
                      value={form.crNumber}
                      onChange={(e) => setForm(p => ({ ...p, crNumber: e.target.value.replace(/\D/g, '') }))}
                      placeholder="1010xxxxxx"
                      dir="ltr"
                      inputMode="numeric"
                      className={`${inputCls} ps-9`}
                    />
                  </div>
                </Field>

                <Field label="رقم الرخصة (بلدي)">
                  <input
                    value={form.municipalLicense}
                    onChange={(e) => setForm(p => ({ ...p, municipalLicense: e.target.value }))}
                    placeholder="xxxxxxxx"
                    dir="ltr"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="العنوان الرئيسي">
                <div className="relative">
                  <div className="absolute inset-y-0 start-3 flex items-center pointer-events-none">
                    <MapPinArea size={14} className="text-primary" />
                  </div>
                  <input
                    value={form.address}
                    onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))}
                    placeholder="مكة المكرمة، حي العزيزية"
                    className={`${inputCls} ps-9`}
                  />
                </div>
              </Field>

              <SectionRule>المالك / المفوّض</SectionRule>

              <Field label="الاسم الرباعي">
                <div className="relative">
                  <div className="absolute inset-y-0 start-3 flex items-center pointer-events-none">
                    <User size={14} className="text-primary" />
                  </div>
                  <input
                    value={form.ownerName}
                    onChange={(e) => setForm(p => ({ ...p, ownerName: e.target.value }))}
                    placeholder="عبدالله محمد سعيد الغامدي"
                    className={`${inputCls} ps-9`}
                  />
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="الصفة">
                  <select
                    value={form.ownerCapacity}
                    onChange={(e) => setForm(p => ({ ...p, ownerCapacity: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">اختر</option>
                    {CAPACITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>

                <Field label="رقم الهوية">
                  <input
                    value={form.ownerIdNumber}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '');
                      if (v.length <= 10) setForm(p => ({ ...p, ownerIdNumber: v }));
                    }}
                    placeholder="1xxxxxxxxx"
                    dir="ltr"
                    maxLength={10}
                    inputMode="numeric"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="رقم التواصل">
                <div className="relative">
                  <div className="absolute inset-y-0 start-3 flex items-center pointer-events-none">
                    <Phone size={14} className="text-primary" />
                  </div>
                  <input
                    value={form.ownerPhone}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '');
                      if (v.length <= 10) setForm(p => ({ ...p, ownerPhone: v }));
                    }}
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                    maxLength={10}
                    inputMode="numeric"
                    className={`${inputCls} ps-9`}
                  />
                </div>
              </Field>

              <SectionRule>التواصل الرسمي</SectionRule>

              <Field label="البريد الإلكتروني">
                <div className="relative">
                  <div className="absolute inset-y-0 start-3 flex items-center pointer-events-none">
                    <Mail size={14} className="text-primary" />
                  </div>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="info@example.com"
                    dir="ltr"
                    className={`${inputCls} ps-9`}
                  />
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="ضابط الاتصال">
                  <input
                    value={form.liaisonName}
                    onChange={(e) => setForm(p => ({ ...p, liaisonName: e.target.value }))}
                    placeholder="اسم ضابط الاتصال"
                    className={inputCls}
                  />
                </Field>

                <Field label="رقم جوال ضابط الاتصال">
                  <input
                    value={form.liaisonPhone}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '');
                      if (v.length <= 10) setForm(p => ({ ...p, liaisonPhone: v }));
                    }}
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                    maxLength={10}
                    inputMode="numeric"
                    className={inputCls}
                  />
                </Field>
              </div>

              <SectionRule>الحالة</SectionRule>

              <Field label="الحالة" required>
                <div className="grid grid-cols-3 gap-2">
                  {STATUSES.map(s => {
                    const SIcon = s.Icon;
                    const active = form.status === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, status: s.value }))}
                        className={`px-2 py-2.5 rounded-[10px] text-[12.5px] font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                          active ? 'text-white' : 'border-line bg-white text-muted hover:bg-[rgb(var(--c-bg))]'
                        }`}
                        style={active ? { background: s.color, borderColor: s.color } : undefined}
                      >
                        <SIcon size={14} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="ملاحظات">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  placeholder="أي ملاحظة تعاقدية أو تشغيلية..."
                  className={`${inputCls} resize-none`}
                />
              </Field>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-[10px] px-3 py-2 text-[13px] font-medium">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-[10px] bg-primary border border-primary text-white font-bold text-[13px] hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  {saving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جارٍ الحفظ...
                    </>
                  ) : (
                    <>
                      <Save size={15} /> {form.id ? 'حفظ التعديلات' : 'إضافة المتعهد'}
                    </>
                  )}
                </button>
                <button
                  onClick={closeModal}
                  className="px-5 py-3 rounded-[10px] border border-line bg-white text-muted text-[13px] font-bold hover:bg-[rgb(var(--c-bg))] transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {accountFor && (
        <CatererAccountDialog
          caterer={accountFor}
          onClose={() => setAccountFor(null)}
          onChanged={loadAccounts}
        />
      )}
    </div>
  );
}
