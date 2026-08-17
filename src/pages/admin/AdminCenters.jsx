import { useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/db.js';
import { NATIONALITIES } from '../../config/nationalities.js';
import { COLORS } from '../../config/brand.js';
import {
  MapPinArea,
  Plus,
  X,
  FloppyDisk as Save,
  Pencil,
  Trash as Trash2,
  MagnifyingGlass as Search,
  Buildings as Building2,
  UsersThree,
  User,
  Phone,
  WhatsappLogo,
  NavigationArrow,
  Warning,
  CalendarBlank,
  LinkSimpleBreak,
  Certificate,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader.jsx';

/* Grading bands the customer uses. Colour runs green → red so a season's
   quality mix is readable from the column alone, without reading each cell. */
const CATEGORIES = [
  { value: 'A',  color: '#15803D' },
  { value: 'A+', color: '#16A34A' },
  { value: 'B',  color: '#4D7C0F' },
  { value: 'B+', color: '#65A30D' },
  { value: 'C',  color: '#CA8A04' },
  { value: 'C+', color: '#F59E0B' },
  { value: 'D',  color: '#EA580C' },
  { value: 'D+', color: '#DC2626' },
];
const CAT_COLOR = Object.fromEntries(CATEGORIES.map(c => [c.value, c.color]));

const inputCls =
  'w-full px-4 py-2.5 border border-line rounded-xl text-sm text-ink outline-none focus:border-primary transition placeholder-muted/40 bg-white';

const EMPTY_FORM = {
  id: null,
  code: '', catererId: '', facilityName: '', facilityLicense: '',
  pilgrimsCount: '', pilgrimsNationality: '', category: '',
  shakhisMina: '', shakhisArafat: '', murabbaMina: '',
  kitchenLocationMina: '', kitchenLocationArafat: '',
  headName: '', headPhone: '',
};

const EMPTY_SEASON = { name: '', hijriYear: '', gregorianYear: '', isActive: true };

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-xs font-medium text-muted mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-muted mt-1">{hint}</p>}
  </div>
);

const SectionRule = ({ children }) => (
  <div className="pt-2 pb-0.5 flex items-center gap-2">
    <span className="h-px flex-1 bg-line" />
    <span className="text-[10px] font-bold text-muted whitespace-nowrap">{children}</span>
    <span className="h-px flex-1 bg-line" />
  </div>
);

const PhoneLink = ({ phone }) => (
  <a href={`https://wa.me/966${phone.slice(1)}`} target="_blank" rel="noreferrer"
    className="inline-flex items-center gap-1.5 text-muted hover:text-green-600 transition-colors" dir="ltr">
    <WhatsappLogo size={12} className="flex-shrink-0" />
    {phone}
  </a>
);

export default function AdminCenters() {
  const [seasons,   setSeasons]   = useState([]);
  const [centers,   setCenters]   = useState([]);
  const [caterers,  setCaterers]  = useState([]);
  const [officials, setOfficials] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [listError, setListError] = useState(null);

  const [seasonId, setSeasonId] = useState(null);
  const [search,   setSearch]   = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form,   setForm]   = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const [seasonModal, setSeasonModal]   = useState(false);
  const [seasonForm,  setSeasonForm]    = useState(EMPTY_SEASON);
  const [seasonSaving, setSeasonSaving] = useState(false);
  const [seasonError, setSeasonError]   = useState(null);

  useEffect(() => {
    const unsubS = db.seasons.subscribe(rows => {
      setSeasons(rows);
      /* Land on the active season the first time round, but never yank the
         admin off a season they picked themselves. */
      setSeasonId(prev => prev ?? (rows.find(s => s.isActive) || rows[0])?.id ?? null);
      setLoading(false);
    }, { orderBy: 'hijriYear', ascending: false });
    const unsubC  = db.centers.subscribe(setCenters);
    const unsubCa = db.caterers.subscribe(setCaterers, { orderBy: 'name', ascending: true });
    const unsubO  = db.center_officials.subscribe(setOfficials);
    return () => { unsubS(); unsubC(); unsubCa(); unsubO(); };
  }, []);

  const season = seasons.find(s => s.id === seasonId) || null;

  const seasonCenters = useMemo(
    () => centers.filter(c => c.seasonId === seasonId),
    [centers, seasonId],
  );

  const primaryByCenter = useMemo(() => {
    const map = {};
    for (const o of officials) if (o.isPrimary) map[o.centerId] = o;
    return map;
  }, [officials]);

  const catererName = (id) => caterers.find(c => c.id === id)?.name || null;

  const stats = useMemo(() => ({
    total:      seasonCenters.length,
    assigned:   seasonCenters.filter(c => c.catererId).length,
    unassigned: seasonCenters.filter(c => !c.catererId).length,
    pilgrims:   seasonCenters.reduce((sum, c) => sum + (Number(c.pilgrimsCount) || 0), 0),
  }), [seasonCenters]);

  const visible = useMemo(() => {
    const q = search.trim();
    const rows = q
      ? seasonCenters.filter(c =>
          [c.code, c.catererName, c.facilityName, c.facilityLicense,
           c.pilgrimsNationality, c.category, c.shakhisMina, c.shakhisArafat,
           c.murabbaMina, primaryByCenter[c.id]?.name]
            .some(v => String(v || '').includes(q)))
      : seasonCenters;
    /* Natural order: مركز 5 before مركز 20, which a plain string sort gets wrong. */
    return [...rows].sort((a, b) => {
      const na = parseInt(String(a.code).replace(/\D/g, ''), 10) || 0;
      const nb = parseInt(String(b.code).replace(/\D/g, ''), 10) || 0;
      return na - nb || String(a.code).localeCompare(String(b.code), 'ar');
    });
  }, [seasonCenters, search, primaryByCenter]);

  /* ── Center modal ─────────────────────────── */
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (c) => {
    const head = primaryByCenter[c.id];
    setForm({
      id:                    c.id,
      code:                  c.code                  || '',
      catererId:             c.catererId             || '',
      facilityName:          c.facilityName          || '',
      facilityLicense:       c.facilityLicense       || '',
      pilgrimsCount:         c.pilgrimsCount ?? '',
      pilgrimsNationality:   c.pilgrimsNationality   || '',
      category:              c.category              || '',
      shakhisMina:           c.shakhisMina           || '',
      shakhisArafat:         c.shakhisArafat         || '',
      murabbaMina:           c.murabbaMina           || '',
      kitchenLocationMina:   c.kitchenLocationMina   || '',
      kitchenLocationArafat: c.kitchenLocationArafat || '',
      headName:              head?.name  || '',
      headPhone:             head?.phone || '',
    });
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setError(null); };

  const validate = (f) => {
    if (!seasonId) return 'اختر موسماً أولاً';
    if (!f.code.trim()) return 'رقم المركز مطلوب';
    const dupe = seasonCenters.some(
      c => c.id !== f.id && String(c.code).trim() === f.code.trim(),
    );
    if (dupe) return `المركز "${f.code.trim()}" مسجّل مسبقاً في ${season?.name || 'هذا الموسم'}`;
    if (f.pilgrimsCount !== '' && Number(f.pilgrimsCount) < 0)
      return 'عدد الحجاج لا يكون سالباً';
    if (f.headPhone && !/^05\d{8}$/.test(f.headPhone))
      return 'جوال رئيس المركز يبدأ بـ 05 ويتكوّن من 10 أرقام';
    return null;
  };

  const handleSave = async () => {
    const err = validate(form);
    if (err) return setError(err);

    setSaving(true);
    const t = (v) => String(v).trim() || null;
    const payload = {
      seasonId,
      code:                  form.code.trim(),
      catererId:             form.catererId || null,
      /* Denormalised alongside the id so legacy reads that only know the
         caterer as a string keep resolving without a join. */
      catererName:           catererName(form.catererId),
      facilityName:          t(form.facilityName),
      facilityLicense:       t(form.facilityLicense),
      pilgrimsCount:         form.pilgrimsCount === '' ? null : Number(form.pilgrimsCount),
      pilgrimsNationality:   t(form.pilgrimsNationality),
      category:              t(form.category),
      shakhisMina:           t(form.shakhisMina),
      shakhisArafat:         t(form.shakhisArafat),
      murabbaMina:           t(form.murabbaMina),
      kitchenLocationMina:   t(form.kitchenLocationMina),
      kitchenLocationArafat: t(form.kitchenLocationArafat),
    };

    try {
      const saved = form.id
        ? await db.centers.update(form.id, payload)
        : await db.centers.insert(payload);

      /* The head of the center is one row in center_officials flagged primary,
         so the same table can later hold shift supervisors and liaisons too. */
      const existing = form.id ? primaryByCenter[form.id] : null;
      const name = form.headName.trim();
      if (name) {
        const head = { name, phone: form.headPhone.trim() || null, role: 'رئيس مركز', isPrimary: true };
        if (existing) await db.center_officials.update(existing.id, head);
        else          await db.center_officials.insert({ ...head, centerId: saved.id });
      } else if (existing) {
        await db.center_officials.delete(existing.id);
      }
      closeModal();
    } catch (ex) {
      setError(ex.message || 'تعذّر الحفظ');
    }
    setSaving(false);
  };

  const handleDelete = async (c) => {
    if (!confirm(`حذف "${c.code}" من موسم ${season?.name}؟\nالبلاغات والتقييمات المسجّلة عليه تبقى كما هي.`)) return;
    setListError(null);
    try {
      await db.centers.delete(c.id);   // officials cascade
    } catch (ex) {
      setListError(ex.message);
    }
  };

  /* ── Season modal ─────────────────────────── */
  const handleSeasonSave = async () => {
    if (!seasonForm.name.trim()) return setSeasonError('اسم الموسم مطلوب');
    if (seasons.some(s => s.name.trim() === seasonForm.name.trim()))
      return setSeasonError('يوجد موسم بنفس الاسم');

    setSeasonSaving(true);
    try {
      /* Only one season may be active — the database enforces it with a partial
         unique index, so stand the others down before claiming the flag. */
      if (seasonForm.isActive) {
        await Promise.all(
          seasons.filter(s => s.isActive).map(s => db.seasons.update(s.id, { isActive: false })),
        );
      }
      const created = await db.seasons.insert({
        name:           seasonForm.name.trim(),
        hijriYear:      seasonForm.hijriYear      ? Number(seasonForm.hijriYear)      : null,
        gregorianYear:  seasonForm.gregorianYear  ? Number(seasonForm.gregorianYear)  : null,
        isActive:       seasonForm.isActive,
      });
      setSeasonId(created.id);
      setSeasonModal(false);
      setSeasonForm(EMPTY_SEASON);
      setSeasonError(null);
    } catch (ex) {
      setSeasonError(ex.message || 'تعذّر إنشاء الموسم');
    }
    setSeasonSaving(false);
  };

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        Icon={MapPinArea}
        title="المراكز"
        subtitle="مراكز منى وعرفة الممنوحة للشركة في كل موسم"
        gradient={{ from: COLORS.accent, to: COLORS.accent600 }}
        glowColor="rgb(var(--c-accent) / 0.4)"
        right={
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <CalendarBlank size={14} className="text-accent-600" />
              </div>
              <select
                value={seasonId || ''}
                onChange={(e) => setSeasonId(e.target.value || null)}
                className="pr-9 pl-3 py-2.5 border border-line rounded-xl text-sm font-bold text-ink bg-white outline-none focus:border-primary transition"
              >
                {seasons.length === 0 && <option value="">لا مواسم</option>}
                {seasons.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.isActive ? ' • نشط' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => { setSeasonForm(EMPTY_SEASON); setSeasonError(null); setSeasonModal(true); }}
              title="إضافة موسم"
              className="w-11 h-11 rounded-xl border border-line bg-white flex items-center justify-center text-muted hover:text-primary hover:border-primary/40 transition-colors"
            >
              <CalendarBlank size={17} />
            </button>
            <button
              onClick={openAdd}
              disabled={!seasonId}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-40 transition shadow-[0_4px_16px_rgb(var(--c-primary)/0.35)]"
              style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}
            >
              <Plus size={15} weight="bold" />
              <span className="hidden sm:inline">إضافة مركز</span>
            </button>
          </div>
        }
      />

      {seasons.length === 0 && !loading ? (
        <div className="bg-white rounded-2xl border border-line p-12 text-center">
          <CalendarBlank size={38} className="mx-auto text-muted/30 mb-3" />
          <h3 className="font-bold text-ink text-sm mb-1">ابدأ بإنشاء موسم</h3>
          <p className="text-muted text-xs mb-5 max-w-sm mx-auto leading-relaxed">
            المراكز تُمنح للشركة سنةً بسنة، فكل مركز يسكن داخل موسمه.
            أنشئ موسم هذا العام ثم أضف مراكزه.
          </p>
          <button
            onClick={() => { setSeasonForm(EMPTY_SEASON); setSeasonModal(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm hover:opacity-90 transition"
            style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}
          >
            <Plus size={15} weight="bold" /> إنشاء موسم
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="مراكز الموسم"   value={stats.total}      Icon={MapPinArea}      color={COLORS.accent600} />
            <StatCard label="مُسندة لمتعهد"  value={stats.assigned}   Icon={Building2}       color={COLORS.success} />
            <StatCard label="بدون متعهد"     value={stats.unassigned} Icon={LinkSimpleBreak} color={COLORS.warning} />
            <StatCard label="إجمالي الحجاج"  value={stats.pilgrims.toLocaleString('ar-SA')} Icon={UsersThree} color={COLORS.primary} />
          </div>

          <section className="bg-gradient-to-br from-white via-white to-background/40 rounded-2xl border border-line shadow-[0_2px_12px_rgb(var(--c-ink)/0.07)] transition-shadow duration-300 hover:shadow-[0_6px_28px_rgb(var(--c-primary)/0.14)]">
            <div className="p-4 border-b border-line flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-primary">
                {season?.name} — {visible.length} مركز
              </h2>
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <Search size={14} className="text-muted" />
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث برقم المركز أو المتعهد أو الشاخص"
                  className={`${inputCls} pr-9`}
                />
              </div>
            </div>

            {listError && (
              <div className="m-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2.5 text-sm font-medium flex items-start gap-2">
                <Warning size={15} className="mt-0.5 flex-shrink-0" />
                <span className="flex-1">{listError}</span>
                <button onClick={() => setListError(null)} className="text-amber-600 hover:text-amber-900">
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted text-xs border-b border-line"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--c-bg)) 0%, #fff 60%)' }}>
                  <tr>
                    <th className="px-4 py-3 text-right font-semibold">المركز</th>
                    <th className="px-4 py-3 text-right font-semibold">المتعهد</th>
                    <th className="px-4 py-3 text-right font-semibold">المنشأة</th>
                    <th className="px-4 py-3 text-right font-semibold">الحجاج</th>
                    <th className="px-4 py-3 text-right font-semibold">الشاخص / المربع</th>
                    <th className="px-4 py-3 text-right font-semibold">رئيس المركز</th>
                    <th className="px-4 py-3 text-right font-semibold">المطبخ</th>
                    <th className="px-4 py-3 text-right font-semibold">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {loading && (
                    <tr><td colSpan={8} className="p-8 text-center text-muted">جارٍ التحميل...</td></tr>
                  )}
                  {!loading && visible.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-10 text-center">
                        <MapPinArea size={34} className="mx-auto text-muted/30 mb-2" />
                        <p className="text-muted text-sm">
                          {seasonCenters.length === 0
                            ? `لا مراكز في ${season?.name} بعد — أضف أول مركز.`
                            : 'لا نتائج مطابقة للبحث'}
                        </p>
                      </td>
                    </tr>
                  )}
                  {visible.map((c) => {
                    const head = primaryByCenter[c.id];
                    const catColor = CAT_COLOR[c.category];
                    return (
                      <tr key={c.id} className="group/row hover:bg-background transition-colors align-top">
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2.5">
                            <div className="relative flex-shrink-0 mt-0.5">
                              <div className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover/row:opacity-50 transition-opacity"
                                style={{ background: catColor || COLORS.muted }} />
                              <div className="relative w-8 h-8 rounded-xl flex items-center justify-center text-white text-[11px] font-black shadow-sm ring-2 ring-white"
                                style={{ background: `linear-gradient(135deg, ${catColor || COLORS.muted}, ${(catColor || COLORS.muted)}DD)` }}>
                                {c.category || '—'}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-ink whitespace-nowrap">{c.code}</div>
                              {c.category && (
                                <div className="text-[10px] text-muted mt-0.5">الفئة {c.category}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-xs max-w-[210px]">
                          {c.catererId ? (
                            <span className="text-ink leading-snug">{catererName(c.catererId) || c.catererName}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                              <LinkSimpleBreak size={11} /> غير مُسند
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-xs max-w-[180px]">
                          {c.facilityName || c.facilityLicense ? (
                            <div className="space-y-1">
                              {c.facilityName && <div className="text-ink leading-snug">{c.facilityName}</div>}
                              {c.facilityLicense && (
                                <div className="inline-flex items-center gap-1 text-muted" dir="ltr">
                                  <Certificate size={11} className="flex-shrink-0" />
                                  {c.facilityLicense}
                                </div>
                              )}
                            </div>
                          ) : <span className="text-muted/40">—</span>}
                        </td>

                        <td className="px-4 py-3 text-xs">
                          {c.pilgrimsCount != null || c.pilgrimsNationality ? (
                            <div className="space-y-1">
                              {c.pilgrimsCount != null && (
                                <div className="text-ink font-bold">{Number(c.pilgrimsCount).toLocaleString('ar-SA')}</div>
                              )}
                              {c.pilgrimsNationality && (
                                <div className="text-muted">{c.pilgrimsNationality}</div>
                              )}
                            </div>
                          ) : <span className="text-muted/40">—</span>}
                        </td>

                        <td className="px-4 py-3 text-xs" dir="ltr">
                          {c.shakhisMina || c.shakhisArafat || c.murabbaMina ? (
                            <div className="space-y-0.5 text-muted">
                              {c.shakhisMina   && <div><span className="text-muted/60">منى </span>{c.shakhisMina}</div>}
                              {c.shakhisArafat && <div><span className="text-muted/60">عرفة </span>{c.shakhisArafat}</div>}
                              {c.murabbaMina   && <div><span className="text-muted/60">مربع </span>{c.murabbaMina}</div>}
                            </div>
                          ) : <span className="text-muted/40">—</span>}
                        </td>

                        <td className="px-4 py-3 text-xs">
                          {head ? (
                            <div className="space-y-1">
                              <div className="text-ink font-medium flex items-center gap-1.5">
                                <User size={11} className="text-muted flex-shrink-0" />
                                {head.name}
                              </div>
                              {head.phone && <PhoneLink phone={head.phone} />}
                            </div>
                          ) : <span className="text-muted/40">—</span>}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <MapLink url={c.kitchenLocationMina}   label="منى" />
                            <MapLink url={c.kitchenLocationArafat} label="عرفة" />
                            {!c.kitchenLocationMina && !c.kitchenLocationArafat && (
                              <span className="text-muted/40 text-xs">—</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openEdit(c)}
                              className="group/edit flex items-center gap-1 text-primary hover:text-white text-xs font-bold px-2 py-1 rounded-lg border border-primary/20 hover:bg-gradient-to-br hover:from-primary-400 hover:to-primary hover:border-transparent transition-all hover:shadow-md"
                            >
                              <Pencil size={12} className="group-hover/edit:rotate-12 transition-transform" />
                              تعديل
                            </button>
                            <button
                              onClick={() => handleDelete(c)}
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
        </>
      )}

      {/* ── Center modal ───────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-line"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-bg)) 0%, #fff 55%)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent600})` }}>
                  {form.id ? <Pencil size={15} className="text-white" /> : <Plus size={15} className="text-white" weight="bold" />}
                </div>
                <div>
                  <h2 className="font-bold text-ink text-sm">
                    {form.id ? 'تعديل بيانات المركز' : 'إضافة مركز جديد'}
                  </h2>
                  <p className="text-[10px] text-muted">موسم {season?.name}</p>
                </div>
              </div>
              <button onClick={closeModal}
                className="w-8 h-8 rounded-xl border border-line flex items-center justify-center hover:bg-background transition-colors">
                <X size={15} className="text-muted" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="رقم المركز" required>
                  <input
                    value={form.code}
                    onChange={(e) => setForm(p => ({ ...p, code: e.target.value }))}
                    placeholder="مركز 45"
                    className={inputCls}
                  />
                </Field>

                <Field label="الفئة">
                  <select
                    value={form.category}
                    onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">— اختر —</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.value}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="عدد الحجاج">
                  <input
                    value={form.pilgrimsCount}
                    onChange={(e) => setForm(p => ({ ...p, pilgrimsCount: e.target.value.replace(/\D/g, '') }))}
                    placeholder="1200"
                    dir="ltr"
                    inputMode="numeric"
                    className={inputCls}
                  />
                </Field>

                <Field label="جنسية الحجاج">
                  <input
                    value={form.pilgrimsNationality}
                    onChange={(e) => setForm(p => ({ ...p, pilgrimsNationality: e.target.value }))}
                    list="nationality-options"
                    placeholder="إندونيسيا"
                    className={inputCls}
                  />
                  <datalist id="nationality-options">
                    {NATIONALITIES.map(n => <option key={n.key} value={n.label} />)}
                  </datalist>
                </Field>
              </div>

              <SectionRule>المتعهد ومنشأته</SectionRule>

              <Field
                label="المتعهد المسؤول"
                hint="اتركه فارغاً إن لم يُسنَد المركز بعد — يظهر في القائمة كـ «غير مُسند»."
              >
                <select
                  value={form.catererId}
                  onChange={(e) => setForm(p => ({ ...p, catererId: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— بدون متعهد —</option>
                  {caterers.filter(c => c.status !== 'archived').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="اسم المنشأة">
                  <input
                    value={form.facilityName}
                    onChange={(e) => setForm(p => ({ ...p, facilityName: e.target.value }))}
                    placeholder="مطبخ ..."
                    className={inputCls}
                  />
                </Field>

                <Field label="رقم الترخيص">
                  <input
                    value={form.facilityLicense}
                    onChange={(e) => setForm(p => ({ ...p, facilityLicense: e.target.value }))}
                    placeholder="xxxxxxxx"
                    dir="ltr"
                    className={inputCls}
                  />
                </Field>
              </div>

              <SectionRule>الشواخص والمواقع</SectionRule>

              <div className="grid grid-cols-3 gap-3">
                <Field label="الشاخص (منى)">
                  <input
                    value={form.shakhisMina}
                    onChange={(e) => setForm(p => ({ ...p, shakhisMina: e.target.value }))}
                    placeholder="20/62"
                    dir="ltr"
                    className={inputCls}
                  />
                </Field>

                <Field label="الشاخص (عرفة)">
                  <input
                    value={form.shakhisArafat}
                    onChange={(e) => setForm(p => ({ ...p, shakhisArafat: e.target.value }))}
                    placeholder="—"
                    dir="ltr"
                    className={inputCls}
                  />
                </Field>

                <Field label="المربع (منى)">
                  <input
                    value={form.murabbaMina}
                    onChange={(e) => setForm(p => ({ ...p, murabbaMina: e.target.value }))}
                    placeholder="—"
                    dir="ltr"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="موقع المطبخ (منى)">
                <div className="relative">
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    <NavigationArrow size={14} className="text-accent-600" />
                  </div>
                  <input
                    value={form.kitchenLocationMina}
                    onChange={(e) => setForm(p => ({ ...p, kitchenLocationMina: e.target.value }))}
                    placeholder="https://maps.google.com/..."
                    dir="ltr"
                    className={`${inputCls} pr-9`}
                  />
                </div>
              </Field>

              <Field label="موقع المطبخ (عرفة)">
                <div className="relative">
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    <NavigationArrow size={14} className="text-accent-600" />
                  </div>
                  <input
                    value={form.kitchenLocationArafat}
                    onChange={(e) => setForm(p => ({ ...p, kitchenLocationArafat: e.target.value }))}
                    placeholder="https://maps.google.com/..."
                    dir="ltr"
                    className={`${inputCls} pr-9`}
                  />
                </div>
              </Field>

              <SectionRule>رئيس المركز</SectionRule>

              <div className="grid grid-cols-2 gap-3">
                <Field label="الاسم">
                  <div className="relative">
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                      <User size={14} className="text-primary" />
                    </div>
                    <input
                      value={form.headName}
                      onChange={(e) => setForm(p => ({ ...p, headName: e.target.value }))}
                      placeholder="اسم رئيس المركز"
                      className={`${inputCls} pr-9`}
                    />
                  </div>
                </Field>

                <Field label="رقم التواصل">
                  <div className="relative">
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                      <Phone size={14} className="text-primary" />
                    </div>
                    <input
                      value={form.headPhone}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '');
                        if (v.length <= 10) setForm(p => ({ ...p, headPhone: v }));
                      }}
                      placeholder="05xxxxxxxx"
                      dir="ltr"
                      maxLength={10}
                      inputMode="numeric"
                      className={`${inputCls} pr-9`}
                    />
                  </div>
                </Field>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition"
                  style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}
                >
                  {saving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جارٍ الحفظ...
                    </>
                  ) : (
                    <><Save size={15} /> {form.id ? 'حفظ التعديلات' : 'إضافة المركز'}</>
                  )}
                </button>
                <button
                  onClick={closeModal}
                  className="px-5 py-3 rounded-xl border border-line text-muted text-sm font-medium hover:bg-background transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Season modal ───────────────────────── */}
      {seasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSeasonModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm" dir="rtl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line"
              style={{ background: 'linear-gradient(135deg, rgb(var(--c-bg)) 0%, #fff 55%)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary-400)), rgb(var(--c-primary)))' }}>
                  <CalendarBlank size={15} className="text-white" />
                </div>
                <h2 className="font-bold text-ink text-sm">موسم جديد</h2>
              </div>
              <button onClick={() => setSeasonModal(false)}
                className="w-8 h-8 rounded-xl border border-line flex items-center justify-center hover:bg-background transition-colors">
                <X size={15} className="text-muted" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-3">
              <Field label="اسم الموسم" required>
                <input
                  value={seasonForm.name}
                  onChange={(e) => setSeasonForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="١٤٤٧هـ"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="السنة الهجرية">
                  <input
                    value={seasonForm.hijriYear}
                    onChange={(e) => setSeasonForm(p => ({ ...p, hijriYear: e.target.value.replace(/\D/g, '') }))}
                    placeholder="1447"
                    dir="ltr"
                    maxLength={4}
                    inputMode="numeric"
                    className={inputCls}
                  />
                </Field>
                <Field label="السنة الميلادية">
                  <input
                    value={seasonForm.gregorianYear}
                    onChange={(e) => setSeasonForm(p => ({ ...p, gregorianYear: e.target.value.replace(/\D/g, '') }))}
                    placeholder="2026"
                    dir="ltr"
                    maxLength={4}
                    inputMode="numeric"
                    className={inputCls}
                  />
                </Field>
              </div>

              <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-line cursor-pointer hover:bg-background transition-colors">
                <input
                  type="checkbox"
                  checked={seasonForm.isActive}
                  onChange={(e) => setSeasonForm(p => ({ ...p, isActive: e.target.checked }))}
                  className="accent-primary w-4 h-4"
                />
                <span className="text-sm text-ink font-medium">اجعله الموسم النشط</span>
              </label>
              {seasonForm.isActive && seasons.some(s => s.isActive) && (
                <p className="text-[10px] text-muted -mt-1">
                  سيُلغى تنشيط «{seasons.find(s => s.isActive)?.name}» — موسم نشط واحد فقط.
                </p>
              )}

              {seasonError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm font-medium">
                  {seasonError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSeasonSave}
                  disabled={seasonSaving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition"
                  style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}
                >
                  {seasonSaving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جارٍ الإنشاء...
                    </>
                  ) : (
                    <><Save size={15} /> إنشاء</>
                  )}
                </button>
                <button
                  onClick={() => setSeasonModal(false)}
                  className="px-5 py-3 rounded-xl border border-line text-muted text-sm font-medium hover:bg-background transition-colors"
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

function MapLink({ url, label }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-accent/10 text-accent-600 hover:bg-accent/20 transition-colors whitespace-nowrap"
    >
      <NavigationArrow size={11} weight="bold" />
      {label}
    </a>
  );
}

function StatCard({ label, value, Icon, color }) {
  return (
    <div className="group/stat bg-white rounded-2xl border border-line px-4 py-3.5 shadow-[0_2px_12px_rgb(var(--c-ink)/0.07)] hover:shadow-[0_6px_24px_rgb(var(--c-primary)/0.14)] transition-shadow duration-300 flex items-center gap-3">
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 rounded-xl blur-lg opacity-40 group-hover/stat:opacity-70 transition-opacity"
          style={{ background: color }} />
        <div className="relative w-10 h-10 rounded-xl flex items-center justify-center group-hover/stat:scale-110 transition-transform duration-300"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}DD)` }}>
          <Icon size={18} className="text-white" weight="bold" />
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black text-ink leading-none">{value}</p>
        <p className="text-[11px] text-muted mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}
