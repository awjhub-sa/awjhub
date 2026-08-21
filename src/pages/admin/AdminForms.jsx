import { useEffect, useMemo, useState } from 'react';
import { db, uploadFile, asDownload, serverTimestamp } from '../../lib/db.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useBrand } from '../../context/BrandContext.jsx';
import { COLORS } from '../../config/brand.js';
import {
  FORM_STATUSES, STATUS_META, isOverdue, daysLate, visibleFieldKeys, isPrintable,
  signatureKeysFor,
  keysOwnedBy, resolveSources, fieldOwner,
} from '../../config/formSchema.js';
import { LATE, CALM, FORM_STATE, formToneOf, ACTION, actionTone, templateTone } from '../../config/tones.js';
import FormBuilder from '../../components/forms/FormBuilder.jsx';
import FormDocument from '../../components/forms/FormDocument.jsx';
import FormFill from '../../components/forms/FormFill.jsx';
import HijriDateInput from '../../components/forms/HijriDateInput.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { Surface, IconTile, StatTile } from '../../components/ui/index.jsx';
import { seasonLabel } from '../../lib/hijri.js';
import DataTable from '../../components/DataTable.jsx';
import {
  FileText, Plus, X, FloppyDisk as Save, Pencil, Trash as Trash2, Copy, DownloadSimple,
  PaperPlaneTilt, MagnifyingGlass as Search, Eye, Warning, CalendarBlank,
  CheckCircle, Clock, Lock, Buildings as Building2, CaretLeft, Sparkle,
  Printer,
} from '@phosphor-icons/react';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const inputCls =
  'w-full px-3.5 py-2.5 border border-line rounded-[10px] text-[13px] text-ink outline-none focus:border-primary transition-colors placeholder-muted/50 bg-white';

const EMPTY_TEMPLATE = {
  id: null,
  title: '', description: '', category: '',
  requiresSignature: true, requiresAttachment: false,
  definition: { blocks: [], fields: {} },
};

const Field = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-[11.5px] font-bold text-muted mb-1.5">
      {label} {required && <span style={{ color: '#DC2626' }}>*</span>}
    </label>
    {children}
    {hint && <p className="text-[10.5px] font-medium text-muted mt-1">{hint}</p>}
  </div>
);

export default function AdminForms() {
  const { profile } = useAuth();

  const [tab, setTab] = useState('library');
  const [templates,   setTemplates]   = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [caterers,    setCaterers]    = useState([]);
  const [centers,     setCenters]     = useState([]);
  /* Centre heads live in center_officials, one row flagged primary. The minute
     asks for the head by name and number, so they are loaded alongside the
     centres and folded on where a centre is used. */
  const [officials,   setOfficials]   = useState([]);
  const [seasons,     setSeasons]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [notice,      setNotice]      = useState(null);

  const [search, setSearch] = useState('');

  /* Filtering the assignments list. A season produces one row per caterer per
     centre per form, so «كل تكليفات فلان» is the question actually asked of
     this table, and scrolling is not an answer to it. */
  const [byCaterer,  setByCaterer]  = useState('');
  const [byStatus,   setByStatus]   = useState('');
  const [byTemplate, setByTemplate] = useState('');

  /* Builder */
  const [builder, setBuilder] = useState(null);   // the template being authored
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  /* Preview + assign */
  const [preview, setPreview] = useState(null);
  const [assign,  setAssign]  = useState(null);   // { template, catererIds, dueAt, perCenter }
  const [assigning, setAssigning] = useState(false);
  const [openId,  setOpenId]  = useState(null);   // assignment being filled or reviewed

  useEffect(() => {
    const u1 = db.form_templates.subscribe(rows => { setTemplates(rows); setLoading(false); },
      { orderBy: 'createdAt', ascending: false });
    const u2 = db.form_assignments.subscribe(setAssignments, { orderBy: 'assignedAt', ascending: false });
    const u3 = db.caterers.subscribe(setCaterers, { orderBy: 'name', ascending: true });
    const u4 = db.centers.subscribe(setCenters);
    const u5 = db.seasons.subscribe(setSeasons);
    const u6 = db.center_officials.subscribe(setOfficials);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, []);

  const activeSeason = seasons.find(s => s.isActive) || seasons[0] || null;
  const catererById  = useMemo(() => Object.fromEntries(caterers.map(c => [c.id, c])), [caterers]);
  const headByCenter = useMemo(
    () => Object.fromEntries(officials.filter(o => o.isPrimary).map(o => [o.centerId, o])),
    [officials],
  );
  /* Every place a centre feeds a form gets it with its head attached, so no
     call site can forget and print two blanks in an official minute. */
  const withHead = (c) => (c ? { ...c, headName: headByCenter[c.id]?.name, headPhone: headByCenter[c.id]?.phone } : c);

  /* The tenant's own operating identity, from the live record. */
  const { brand } = useBrand();
  const company = useMemo(() => ({
    name:  brand.companyFullAr,
    short: brand.companyName,
    licenseNumber: brand.facility?.licenseNumber,
    facilityName:  brand.facility?.facilityName,
    murabba:       brand.facility?.murabba,
  }), [brand]);

  const centerById   = useMemo(() => Object.fromEntries(centers.map(c => [c.id, c])), [centers]);
  const templateById = useMemo(() => Object.fromEntries(templates.map(t => [t.id, t])), [templates]);

  const seasonAssignments = useMemo(
    () => (activeSeason ? assignments.filter(a => a.seasonId === activeSeason.id) : []),
    [assignments, activeSeason],
  );

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      templates: templates.filter(t => t.active).length,
      pending:   seasonAssignments.filter(a => ['pending', 'draft', 'returned'].includes(a.status)).length,
      submitted: seasonAssignments.filter(a => ['submitted', 'accepted'].includes(a.status)).length,
      overdue:   seasonAssignments.filter(a => isOverdue(a, now) && !['accepted'].includes(a.status)).length,
    };
  }, [templates, seasonAssignments]);

  /* The library and the customer's own templates are two different things and
     are kept apart: the library is read-only and permanent, so mixing them into
     one list would invite editing an original that cannot be edited. */
  const library = useMemo(() => templates.filter(t => t.isStandard),  [templates]);
  const mine    = useMemo(() => templates.filter(t => !t.isStandard), [templates]);

  const visibleTemplates = useMemo(() => {
    const source = tab === 'library' ? library : mine;
    const q = search.trim();
    if (!q) return source;
    return source.filter(t => [t.title, t.category, t.description].some(v => String(v || '').includes(q)));
  }, [library, mine, tab, search]);

  /* ── Template save ────────────────────────── */
  const openNew  = () => { setBuilder({ ...EMPTY_TEMPLATE }); setError(null); };
  const openEdit = (t) => {
    /* A library form has no edit path — the copy is what gets edited, so the
       original stays available to everyone and refreshable by an update. */
    if (t.isStandard) { duplicate(t); return; }
    setBuilder({
      id: t.id,
      title: t.title || '',
      description: t.description || '',
      category: t.category || '',
      requiresSignature: t.requiresSignature ?? true,
      requiresAttachment: t.requiresAttachment ?? false,
      definition: t.definition || { blocks: [], fields: {} },
    });
    setError(null);
  };

  /* Copying a standard form is how a customer adapts it: the original stays
     pristine so a later system update can still refresh it. */
  const duplicate = async (t) => {
    try {
      const copy = await db.form_templates.insert({
        title: `${t.title} (نسخة)`,
        description: t.description ?? null,
        category: t.category ?? null,
        definition: t.definition,
        requiresSignature: t.requiresSignature,
        requiresAttachment: t.requiresAttachment,
        isStandard: false,
        active: true,
        createdBy: profile?.uid ?? null,
      });
      setTab('mine');
      /* Drop straight into the builder on the copy — copying is only ever a
         step toward editing, so making them hunt for it afterwards is a stop
         for no reason. */
      setBuilder({
        id: copy.id,
        title: copy.title,
        description: copy.description || '',
        category: copy.category || '',
        requiresSignature: copy.requiresSignature ?? true,
        requiresAttachment: copy.requiresAttachment ?? false,
        definition: copy.definition || { blocks: [], fields: {} },
      });
      setError(null);
    } catch (ex) { setNotice(ex.message); }
  };

  const saveTemplate = async () => {
    if (!builder.title.trim()) return setError('عنوان النموذج مطلوب');
    if (!builder.definition.blocks.length) return setError('أضف بلوكاً واحداً على الأقل');

    setSaving(true);
    const payload = {
      title:              builder.title.trim(),
      description:        builder.description.trim() || null,
      category:           builder.category.trim() || null,
      definition:         builder.definition,
      requiresSignature:  builder.requiresSignature,
      requiresAttachment: builder.requiresAttachment,
      updatedAt:          serverTimestamp(),
    };
    try {
      if (builder.id) await db.form_templates.update(builder.id, payload);
      else            await db.form_templates.insert({ ...payload, createdBy: profile?.uid ?? null, active: true });
      setBuilder(null);
    } catch (ex) {
      setError(ex.message || 'تعذّر الحفظ');
    }
    setSaving(false);
  };

  const removeTemplate = async (t) => {
    if (t.isStandard) {
      setNotice('النماذج الجاهزة لا تُحذف — انسخها ثم عدّل النسخة.');
      return;
    }
    const used = assignments.some(a => a.templateId === t.id);
    if (used) {
      setNotice(`«${t.title}» مُسنَد لمتعهدين — عطّله بدل حذفه للاحتفاظ بسجل التسليمات.`);
      return;
    }
    if (!confirm(`حذف النموذج «${t.title}» نهائياً؟`)) return;
    try { await db.form_templates.delete(t.id); }
    catch (ex) { setNotice(ex.message); }
  };

  /* ── Bulk assign ──────────────────────────── */
  const openAssign = (t) => {
    const due = new Date();
    due.setDate(due.getDate() + 7);
    setAssign({
      template: t,
      catererIds: [],
      dueAt: due.toISOString().slice(0, 10),
      /* A centre-scoped form is only ever assigned per centre. */
      perCenter: t.definition?.scope === 'center',
      shared: {},     // one value applied to every selected caterer
      perCaterer: {}, // catererId → { fieldKey: value }, overriding shared
      step: 'who',
    });
  };

  /* Fields the admin owns on this template — what the system cannot answer and
     the caterer should not be asked for. */
  const visibleAssignments = useMemo(() => seasonAssignments.filter(a =>
    (!byCaterer  || a.catererId  === byCaterer) &&
    (!byStatus   || a.status     === byStatus) &&
    (!byTemplate || a.templateId === byTemplate)
  ), [seasonAssignments, byCaterer, byStatus, byTemplate]);

  /* Only documents actually assigned this season, each with how many copies
     are out — a list of every template would offer choices returning nothing. */
  const templateOptions = useMemo(() => {
    const ids = [...new Set(seasonAssignments.map(a => a.templateId).filter(Boolean))];
    return ids
      .map(id => ({ id, title: templateById[id]?.title || '—',
                    n: seasonAssignments.filter(a => a.templateId === id).length }))
      .sort((a, b) => a.title.localeCompare(b.title, 'ar'));
  }, [seasonAssignments, templateById]);

  /* Only caterers who actually have an assignment this season: a list of every
     caterer would offer choices that return nothing. */
  const catererOptions = useMemo(() => {
    const ids = [...new Set(seasonAssignments.map(a => a.catererId).filter(Boolean))];
    return ids
      .map(id => ({ id, name: catererById[id]?.name || '—',
                    n: seasonAssignments.filter(a => a.catererId === id).length }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [seasonAssignments, catererById]);

  const adminKeys = useMemo(
    () => (assign ? keysOwnedBy(assign.template.definition, 'admin') : []),
    [assign],
  );

  /* What the caterer attached, if anything, and what it should be called once
     it is on somebody's desk. A signature is a file too and is not the
     attachment — the same distinction the submit guard makes. */
  const attachmentOf = (a) => {
    const def = templateById[a.templateId]?.definition;
    if (!def) return null;
    const sigs = new Set([
      ...signatureKeysFor(def, 'caterer'),
      ...signatureKeysFor(def, 'admin'),
    ]);
    const key = [...visibleFieldKeys(def)]
      .find(k => def.fields?.[k]?.type === 'file' && !sigs.has(k) && a.data?.[k]);
    if (!key) return null;
    const url = a.data[key];
    const ext = (String(url).split('?')[0].split('.').pop() || 'pdf').toLowerCase();
    const name = [templateById[a.templateId]?.title, catererById[a.catererId]?.name]
      .filter(Boolean).join(' - ');
    return { url, filename: `${name || a.formNumber}.${ext}` };
  };

  /* An image cannot be typed into a table cell, so the per-caterer override
     table is offered for everything except the uploads. */
  const perCatererKeys = useMemo(
    () => adminKeys.filter(k => !['file', 'files', 'textarea'].includes(assign?.template.definition.fields[k]?.type)),
    [adminKeys, assign],
  );

  const [uploading, setUploading] = useState(null);

  /* The company's signature is chosen before any assignment exists, so it is
     filed under the template rather than an assignment id. It is the same
     image on every copy the batch produces, which is the point of asking for
     it once here instead of on each form. */
  const uploadShared = async (key, file, many = false) => {
    setUploading(key);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      /* A set of photographs must not overwrite itself into one. */
      const path = many
        ? `templates/${assign.template.id}/${key}-${Date.now()}-${Math.floor(performance.now() % 1000)}.${ext}`
        : `templates/${assign.template.id}/${key}.${ext}`;
      const url = await uploadFile('forms', path, file);
      setAssign(p => (many
        ? { ...p, shared: { ...p.shared, [key]: [...(p.shared[key] || []), url] } }
        : { ...p, shared: { ...p.shared, [key]: url } }));
    } catch (e) {
      setNotice(`تعذّر رفع الملف: ${e.message}`);
    } finally {
      setUploading(null);
    }
  };

  /* What each caterer's copy will actually carry: registry values first, then
     the shared value the admin typed, then any per-caterer override. */
  /* One row backs both screens, so removing it removes the caterer's copy
     too. That is the intent — but it is worth saying out loud before it
     happens, because a submitted filing is a signed document. */
  const removeAssignment = async (a) => {
    const who = catererById[a.catererId]?.name || 'المتعهد';
    const signed = ['submitted', 'accepted'].includes(a.status);
    const warn = signed
      ? `سيُحذف النموذج المُسلَّم من ${who} — ومعه توقيعه وما عبّأه. لا يمكن التراجع.`
      : `سيُحذف التكليف من ${who}، ولن يظهر في بوابته.`;
    if (!window.confirm(`${warn}\n\nمتأكد؟`)) return;
    try {
      await db.form_assignments.delete(a.id);
      setNotice(`حُذف تكليف ${who}.`);
    } catch (ex) { setNotice(ex.message); }
  };

  const valuesFor = (catererId) => {
    const def = assign.template.definition;
    const caterer = catererById[catererId];
    const centersOwned = activeSeason
      ? centers.filter(c => c.seasonId === activeSeason.id && c.catererId === catererId)
      : [];
    const system = resolveSources(def.fields, {
      caterer,
      center: withHead(centersOwned[0] || null),
      season: activeSeason,
      company,
      /* No row exists yet, but the deadline does — it is on the dialog. */
      assignment: { dueAt: assign.dueAt ? `${assign.dueAt}T23:59:59` : null },
    });
    return { ...system, ...assign.shared, ...(assign.perCaterer[catererId] || {}) };
  };

  const runAssign = async () => {
    const { template, catererIds, dueAt, perCenter } = assign;
    if (!activeSeason) return setNotice('لا يوجد موسم نشط');
    if (!catererIds.length) return setNotice('اختر متعهداً واحداً على الأقل');

    setAssigning(true);
    /* No unique constraint guards this in the database, because a form may
       legitimately be required twice in a season. The accidental case — a
       double click, or re-running the same bulk assign — is caught here by
       skipping anyone who still holds an unfinished copy. */
    const open = new Set(
      seasonAssignments
        .filter(a => a.templateId === template.id && a.status !== 'accepted')
        .map(a => `${a.catererId}|${a.centerId || ''}`),
    );

    const rows = [];       // what will be created
    const dupes = [];      // built, but already held open by that caterer
    let withoutCenters = 0;
    for (const catererId of catererIds) {
      const targets = perCenter
        ? centers.filter(c => c.seasonId === activeSeason.id && c.catererId === catererId).map(c => c.id)
        : [null];
      /* Without this the loop simply produces nothing for that caterer and the
         batch reports a success that never reached them. */
      if (perCenter && targets.length === 0) { withoutCenters++; continue; }
      for (const centerId of targets) {
        const duplicate = open.has(`${catererId}|${centerId || ''}`);
        /* The document is stored already filled. What reaches the caterer is
           finished work waiting for a signature, not a blank form. Values are
           resolved per center too, so a per-center copy carries that center's
           own facility and shakhis rather than the first one found. */
        const system = resolveSources(template.definition.fields, {
          caterer: catererById[catererId],
          center:  centerId ? withHead(centerById[centerId]) : null,
          season:  activeSeason,
          company,
          assignment: { dueAt: dueAt ? `${dueAt}T23:59:59` : null },
        });
        (duplicate ? dupes : rows).push({
          seasonId:   activeSeason.id,
          templateId: template.id,
          catererId,
          centerId,
          dueAt:      dueAt ? new Date(`${dueAt}T23:59:59`) : null,
          assignedBy: profile?.uid ?? null,
          status:     'pending',
          data: { ...system, ...assign.shared, ...(assign.perCaterer[catererId] || {}) },
        });
      }
    }

    /* Holding an open copy is usually a double click, and usually worth
       stopping. But the same form is sometimes owed twice in one season — a
       second handover, a centre reinspected — and refusing outright left the
       button looking broken with no way past it. So it asks. */
    let skipped = dupes.length;
    if (!rows.length && dupes.length) {
      const ok = window.confirm(
        `لدى ${dupes.length} جهة نسخة مفتوحة من «${template.title}» لم تُقبل بعد.\n\n` +
        'إسناد نسخة إضافية لهم؟');
      setAssigning(ok);
      if (!ok) { setAssigning(false); return; }
      rows.push(...dupes);
      skipped = 0;
    }

    if (!rows.length) {
      setAssigning(false);
      setNotice(
        withoutCenters
          ? `لا مراكز لـ ${withoutCenters} متعهد في هذا الموسم — وهذا النموذج لا يُسنَد إلا لمركز.`
          : 'لا شيء لإسناده.');
      return;
    }

    try {
      const created = await db.form_assignments.insertMany(rows);
      /* The event log is what later answers "were they responsive" — the gap
         between assignment and submission cannot come from a status column. */
      await db.form_events.insertMany(
        created.map(a => ({ assignmentId: a.id, event: 'assigned', actorUid: profile?.uid ?? null })),
      );
      setAssign(null);
      setNotice(
        `أُسند «${template.title}» إلى ${created.length} جهة` +
        (skipped ? ` · تُخطّي ${skipped} لديهم نسخة مفتوحة` : '') +
        (withoutCenters ? ` · ${withoutCenters} بلا مراكز في هذا الموسم` : '') + '.',
      );
      setTab('assignments');
    } catch (ex) {
      setNotice(ex.message || 'تعذّر الإسناد');
    }
    setAssigning(false);
  };

  /* ── Fill / review view ───────────────────── */
  /* Read from the live list rather than a snapshot, so a status change made
     inside the sheet is reflected the moment realtime delivers it. */
  const open = assignments.find(a => a.id === openId);
  if (open) {
    return (
      <FormFill
        assignment={open}
        template={templateById[open.templateId]}
        caterer={catererById[open.catererId]}
        center={centerById[open.centerId]}
        season={seasons.find(s => s.id === open.seasonId)}
        actorUid={profile?.uid}
        canReview
        onClose={() => setOpenId(null)}
      />
    );
  }

  /* ── Builder view ─────────────────────────── */
  if (builder) {
    return (
      <div className="space-y-4" dir="rtl">
        <Surface className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap sticky top-0 z-30">
          <div className="flex items-center gap-2.5 min-w-0">
            <button onClick={() => setBuilder(null)}
              className="w-9 h-9 rounded-[10px] border border-line bg-white flex items-center justify-center text-muted hover:text-ink hover:bg-[rgb(var(--c-bg))] transition-colors shrink-0">
              <X size={16} />
            </button>
            <div className="min-w-0">
              <h1 className="text-[13.5px] font-bold text-ink truncate">
                {builder.id ? 'تعديل النموذج' : 'نموذج جديد'}
              </h1>
              <p className="text-[10.5px] font-medium text-muted">
                {builder.definition.blocks.length} بلوك · {Object.keys(builder.definition.fields).length} حقل
              </p>
            </div>
          </div>
          <button
            onClick={saveTemplate}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-primary border border-primary text-white font-bold text-[12px] hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Save size={15} />}
            حفظ النموذج
          </button>
        </Surface>

        <Surface className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="عنوان النموذج" required>
            <input value={builder.title} onChange={e => setBuilder(p => ({ ...p, title: e.target.value }))}
              placeholder="تعيين ضابط اتصال" className={inputCls} />
          </Field>
          <Field label="التصنيف">
            <input value={builder.category} onChange={e => setBuilder(p => ({ ...p, category: e.target.value }))}
              placeholder="تشغيلي" list="form-categories" className={inputCls} />
            <datalist id="form-categories">
              {[...new Set(templates.map(t => t.category).filter(Boolean))].map(c => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label="وصف مختصر">
            <input value={builder.description} onChange={e => setBuilder(p => ({ ...p, description: e.target.value }))}
              placeholder="يظهر للمتعهد مع التكليف" className={inputCls} />
          </Field>
        </Surface>

        {error && (
          <div className="rounded-[11px] border px-3.5 py-2.5 text-[13px] font-bold"
            style={{ background: tint('#DC2626', 12), borderColor: tint('#DC2626', 28), color: '#DC2626' }}>{error}</div>
        )}

        <FormBuilder
          value={builder.definition}
          onChange={def => setBuilder(p => ({ ...p, definition: def }))}
        />
      </div>
    );
  }

  /* ── Main view ────────────────────────────── */
  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        kicker="إدارة المتعهدين"
        Icon={FileText}
        title="النماذج"
        gradient={{ from: 'rgb(var(--c-primary-400))', to: 'rgb(var(--c-primary))' }}
        right={
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-primary border border-primary text-white font-bold text-[12px] hover:opacity-90 transition-opacity"
          >
            <Plus size={15} weight="bold" />
            <span className="hidden sm:inline">نموذج جديد</span>
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="نماذج متاحة"  value={stats.templates} Icon={FileText}    color={COLORS.primary} />
        <StatTile label="في الانتظار"  value={stats.pending}   Icon={Clock}       color={COLORS.info} />
        <StatTile label="مُسلَّم"       value={stats.submitted} Icon={CheckCircle} color={COLORS.success} />
        <StatTile label="متأخر"        value={stats.overdue}   Icon={Warning}     color={COLORS.error} />
      </div>

      {notice && (
        <div className="rounded-[11px] border px-3.5 py-2.5 text-[13px] font-bold flex items-start gap-2"
          style={{ background: tint(COLORS.warning, 12), borderColor: tint(COLORS.warning, 28), color: COLORS.warning }}>
          <Warning size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} className="hover:opacity-70 transition-opacity"><X size={14} /></button>
        </div>
      )}

      <div className="flex gap-2">
        {[
          { key: 'library',     label: 'نماذج جاهزة', count: library.length },
          { key: 'mine',        label: 'قوالبي',      count: mine.length },
          { key: 'assignments', label: 'التكليفات',   count: seasonAssignments.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-[10px] text-[12.5px] font-bold border transition-colors flex items-center gap-2 ${
              tab === t.key
                ? 'bg-primary border-primary text-white'
                : 'bg-white text-ink border-line hover:bg-[rgb(var(--c-bg))]'
            }`}
          >
            {t.label}
            <span className={`px-1.5 py-[2px] rounded-md text-[10.5px] font-bold ${tab === t.key ? 'bg-white/20 text-white' : 'bg-[rgb(var(--c-bg))] text-muted'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab !== 'assignments' ? (
        <section className="space-y-3">
          {tab === 'library' && (
            <div className="rounded-[11px] border px-4 py-3 text-[12px] font-medium text-ink flex items-start gap-2"
              style={{ background: tint(COLORS.accent600, 12), borderColor: tint(COLORS.accent600, 28) }}>
              <Lock size={14} className="text-accent-600 mt-0.5 shrink-0" />
              <span className="leading-relaxed">
                نماذج متعارف عليها تأتي مع النظام. <b>لا تُحذف ولا تُعدَّل</b> — أسندها كما هي،
                أو انسخها إلى «قوالبي» وعدّل النسخة كما تشاء.
              </span>
            </div>
          )}

          <div className="relative max-w-xs">
            <div className="absolute inset-y-0 start-3 flex items-center pointer-events-none">
              <Search size={14} className="text-muted" />
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ابحث في القوالب" className={`${inputCls} ps-9`} />
          </div>

          {loading && <p className="text-center text-muted text-[13px] font-medium py-10">جارٍ التحميل...</p>}

          {!loading && visibleTemplates.length === 0 && (
            <Surface className="p-12 text-center">
              <FileText size={38} className="mx-auto text-muted/30 mb-3" />
              {tab === 'library' ? (
                <>
                  <h3 className="font-bold text-ink text-[13.5px] mb-1">المكتبة فارغة</h3>
                </>
              ) : (
                <>
                  <h3 className="font-bold text-ink text-[13.5px] mb-1">لا قوالب خاصة بك بعد</h3>
                  <button onClick={openNew}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-primary border border-primary text-white font-bold text-[12px] hover:opacity-90 transition-opacity">
                    <Plus size={15} weight="bold" /> نموذج جديد
                  </button>
                </>
              )}
            </Surface>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibleTemplates.map(t => {
              const def = t.definition || { blocks: [], fields: {} };
              const auto    = keysOwnedBy(def, 'system').length;
              const byAdmin = keysOwnedBy(def, 'admin').length;
              const byCat   = keysOwnedBy(def, 'caterer').length;
              const count = seasonAssignments.filter(a => a.templateId === t.id).length;
              const hue = templateTone(t.key || t.id);
              return (
                <div key={t.id}
                  className="group/card bg-white rounded-[14px] border overflow-hidden flex flex-col
                             shadow-[0_1px_2px_rgb(var(--c-ink)/0.04)] transition-shadow hover:shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)]"
                  style={{ borderColor: hue.line }}>
                  {/* The spine. Fixed to the template's key, so the form you
                      reached for last week is in the same colour today. */}
                  <span className="block h-1.5 shrink-0" style={{ background: hue.bar }} />
                  <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-ink text-[13.5px] leading-snug">{t.title}</h3>
                      {t.description && <p className="text-[11px] font-medium text-muted mt-1 line-clamp-2">{t.description}</p>}
                    </div>
                    {t.isStandard && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-[3px] rounded-md shrink-0 border"
                        style={{ background: hue.bg, color: hue.ink, borderColor: hue.line }}
                        title="نموذج جاهز — محمي من الحذف والتعديل">
                        <Lock size={10} weight="fill" /> جاهز
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    {t.category && (
                      <span className="inline-flex items-center px-2 py-[3px] rounded-md font-bold border"
                        style={{ background: hue.bg, color: hue.ink, borderColor: hue.line }}>
                        {t.category}
                      </span>
                    )}
                    {auto > 0    && <Tag tone="accent">{auto} تلقائي</Tag>}
                    {byAdmin > 0 && <Tag tone="primary">{byAdmin} تعبّيه الإدارة</Tag>}
                    {byCat > 0
                      ? <Tag>{byCat} يعبّيه المتعهد</Tag>
                      : <Tag>المتعهد يوقّع فقط</Tag>}
                    {count > 0 && <Tag tone="primary">{count} تكليف</Tag>}
                  </div>

                  {/* A library form offers use and copy; only a template the
                      customer owns offers edit and delete. */}
                  <div className="flex items-center gap-1.5 mt-auto pt-1 flex-wrap">
                    <Action onClick={() => setPreview(t)} Icon={Eye} tone="view">معاينة</Action>
                    <Action onClick={() => openAssign(t)} Icon={PaperPlaneTilt} tone="assign">إسناد</Action>
                    {t.isStandard ? (
                      <Action onClick={() => duplicate(t)} Icon={Copy} tone="copy">نسخة قابلة للتعديل</Action>
                    ) : (
                      <>
                        <Action onClick={() => openEdit(t)} Icon={Pencil} tone="edit">تعديل</Action>
                        <Action onClick={() => duplicate(t)} Icon={Copy} tone="copy">نسخ</Action>
                        <Action onClick={() => removeTemplate(t)} Icon={Trash2} tone="danger">حذف</Action>
                      </>
                    )}
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <Surface className="overflow-hidden">
          <div className="p-4 border-b space-y-3"
            style={{ background: tint(COLORS.primary, 12), borderColor: tint(COLORS.primary, 28) }}>
            <div className="flex items-center gap-3 flex-wrap">
              <IconTile Icon={FileText} size="md" />
              <h2 className="text-[15px] font-bold text-ink">
                {activeSeason ? `تكليفات ${seasonLabel(activeSeason)}` : 'التكليفات'}
              </h2>
              <span className="text-[12px] font-bold text-muted tabular-nums">
                {visibleAssignments.length === seasonAssignments.length
                  ? `${seasonAssignments.length}`
                  : `${visibleAssignments.length} من ${seasonAssignments.length}`}
              </span>
              {(byCaterer || byStatus || byTemplate) && (
                <button onClick={() => { setByCaterer(''); setByStatus(''); setByTemplate(''); }}
                  className="ms-auto text-[12px] font-bold text-primary hover:underline">
                  عرض الكل
                </button>
              )}
            </div>

            <div className="nsab-filters flex items-center gap-2 flex-wrap">
              <select value={byTemplate} onChange={e => setByTemplate(e.target.value)}
                className={`${inputCls} w-auto min-w-[240px]`}>
                <option value="">كل المستندات</option>
                {templateOptions.map(t => (
                  <option key={t.id} value={t.id}>{t.title} ({t.n})</option>
                ))}
              </select>

              <select value={byCaterer} onChange={e => setByCaterer(e.target.value)}
                className={`${inputCls} w-auto min-w-[220px]`}>
                <option value="">كل المتعهدين</option>
                {catererOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.n})</option>
                ))}
              </select>

              <select value={byStatus} onChange={e => setByStatus(e.target.value)}
                className={`${inputCls} w-auto min-w-[150px]`}>
                <option value="">كل الحالات</option>
                {FORM_STATUSES.map(st => (
                  <option key={st.value} value={st.value}>{st.label}</option>
                ))}
              </select>
            </div>
          </div>
          <DataTable>
            <table className="w-full text-sm">
              <thead className="text-muted text-[11px] border-b border-line bg-[rgb(var(--c-bg))]">
                <tr>
                  <th className="px-4 py-3 text-start font-bold">الرقم</th>
                  <th className="px-4 py-3 text-start font-bold">النموذج</th>
                  <th className="px-4 py-3 text-start font-bold">المتعهد</th>
                  <th className="px-4 py-3 text-start font-bold">المركز</th>
                  <th className="px-4 py-3 text-start font-bold">الموعد النهائي</th>
                  <th className="px-4 py-3 text-start font-bold">تاريخ التسليم</th>
                  <th className="px-4 py-3 text-start font-bold">الحالة</th>
                  <th className="px-4 py-3 text-start font-bold">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibleAssignments.length === 0 && (
                  <tr><td colSpan={8} className="p-10 text-center text-muted text-[13px] font-medium">
                    {seasonAssignments.length === 0
                      ? 'لا تكليفات بعد'
                      : 'لا تكليفات تطابق هذه التصفية'}
                  </td></tr>
                )}
                {visibleAssignments.map(a => {
                  const meta = STATUS_META[a.status] || STATUS_META.pending;
                  const late = isOverdue(a) && a.status !== 'accepted';
                  const tone = late ? LATE : formToneOf(a.status);
                  return (
                    <tr key={a.id} className="hover:bg-[rgb(var(--c-bg))] transition-colors"
                      style={{ borderInlineStart: `3px solid ${tone.bar}` }}>
                      <td className="px-4 py-3 text-[11.5px] text-muted" dir="ltr">{a.formNumber}</td>
                      <td className="px-4 py-3 text-[12px] text-ink font-bold">{templateById[a.templateId]?.title || '—'}</td>
                      <td className="px-4 py-3 text-[12px] text-ink max-w-[200px]">{catererById[a.catererId]?.name || '—'}</td>
                      <td className="px-4 py-3 text-[12px] text-muted">{centerById[a.centerId]?.code || '—'}</td>
                      <td className="px-4 py-3 text-[12px]">
                        {a.dueAt ? (
                          <span className="inline-block px-2 py-1 rounded-md border text-[11px] font-bold tabular-nums" dir="ltr"
                            style={late
                              ? { background: LATE.bg, color: LATE.ink, borderColor: LATE.line }
                              : { background: CALM.bg, color: CALM.ink, borderColor: CALM.line }}>
                            {new Date(a.dueAt).toISOString().slice(0, 10)}
                          </span>
                        ) : <span className="text-muted/40">—</span>}
                      </td>

                      {/* When the caterer actually sent it — the other half of
                          the deadline, and the only one that answers «هل
                          سلّم؟» without reading the status and the date and
                          doing the subtraction in your head. */}
                      <td className="px-4 py-3 text-[12px]">
                        {a.submittedAt ? (
                          <span className="inline-flex items-center gap-1 font-bold whitespace-nowrap" dir="ltr"
                            style={{ color: FORM_STATE.accepted.ink }}>
                            <CheckCircle size={12} weight="fill" />
                            {new Date(a.submittedAt).toISOString().slice(0, 10)}
                          </span>
                        ) : (
                          <span className="text-muted/40">لم يُسلَّم</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2 py-[3px]
                                           rounded-md whitespace-nowrap border"
                            style={{ background: tone.bg, color: tone.ink, borderColor: tone.line }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone.bar }} />
                            {meta.label}
                          </span>
                          {late && (
                            <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: LATE.ink }}>
                              متأخر {daysLate(a)} يوم
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Action onClick={() => setOpenId(a.id)} Icon={Eye} tone="view">
                            {['submitted'].includes(a.status) ? 'مراجعة' : 'فتح'}
                          </Action>
                          {/* Offered from submission onward, and to both
                              sides — the caterer prints the same sheet from
                              their portal, so a filing and its copy cannot
                              differ. */}
                          {isPrintable(a.status) && (
                            <Action
                              onClick={() => window.open(`/forms/print/${a.id}`, '_blank')}
                              Icon={Printer} tone="print"
                            >
                              طباعة
                            </Action>
                          )}
                          {(() => {
                            /* Shown only when there is a file to hand over, so
                               the button never promises a document that is not
                               there. */
                            const att = attachmentOf(a);
                            if (!att) return null;
                            return (
                              <a
                                href={asDownload(att.url, att.filename)}
                                download={att.filename}
                                style={{ background: ACTION.attach.bg, color: ACTION.attach.ink,
                                         borderColor: ACTION.attach.line }}
                                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-[8px] border
                                           transition-colors hover:brightness-95"
                              >
                                <DownloadSimple size={11} weight="bold" /> المرفق
                              </a>
                            );
                          })()}
                          {/* The office's alone. Deleting removes the caterer's
                              copy with it — there is one row, and the portal
                              reads the same one. */}
                          <Action onClick={() => removeAssignment(a)} Icon={Trash2} tone="danger">
                            حذف
                          </Action>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTable>
        </Surface>
      )}

      {/* ── Preview ────────────────────────────── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-[rgb(var(--c-ink)/0.45)] backdrop-blur-sm" onClick={() => setPreview(null)} />
          <div className="relative my-8 w-full max-w-3xl">
            <button onClick={() => setPreview(null)}
              className="absolute -top-2 end-0 w-9 h-9 rounded-[10px] bg-white border border-line flex items-center justify-center text-muted hover:text-ink shadow-[0_6px_20px_-6px_rgb(var(--c-ink)/0.16)] z-10">
              <X size={16} />
            </button>
            <FormDocument
              definition={preview.definition}
              mode="preview"
              title={preview.title}
              formNumber="FRM-••••"
            />
          </div>
        </div>
      )}

      {/* ── Assign step 2: the admin completes what the registry cannot ── */}
      {assign?.step === 'fill' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-[rgb(var(--c-ink)/0.45)] backdrop-blur-sm" onClick={() => setAssign(null)} />
          <div className="relative my-6 bg-white rounded-[18px] border border-line shadow-[0_24px_60px_-16px_rgb(var(--c-ink)/0.35)] w-full max-w-4xl" dir="rtl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b rounded-t-[18px]"
              style={{ background: tint(COLORS.primary, 12), borderColor: tint(COLORS.primary, 28) }}>
              <div className="flex items-center gap-2.5">
                <button onClick={() => setAssign(p => ({ ...p, step: 'who' }))}
                  className="w-9 h-9 rounded-[10px] border border-line bg-white flex items-center justify-center text-muted hover:text-ink transition-colors">
                  <CaretLeft size={15} />
                </button>
                <div>
                  <h2 className="font-bold text-ink text-[13.5px]">تعبئة ما لا يعرفه النظام</h2>
                </div>
              </div>
              <button onClick={() => setAssign(null)}
                className="w-8 h-8 rounded-[10px] border border-line bg-white flex items-center justify-center hover:bg-[rgb(var(--c-bg))] transition-colors">
                <X size={15} className="text-muted" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="rounded-[11px] border px-4 py-3 text-[12px] font-medium text-ink flex items-start gap-2"
                style={{ background: tint(COLORS.accent600, 12), borderColor: tint(COLORS.accent600, 28) }}>
                <Sparkle size={14} className="text-accent-600 mt-0.5 shrink-0" />
                <span className="leading-relaxed">
                  الحقول المسجّلة في النظام (اسم المتعهد، السجل التجاري، المركز، الموسم…) تُعبَّأ
                  <b> لكل متعهد ببياناته هو</b> تلقائياً. هنا تكمل الباقي فقط.
                </span>
              </div>

              {/* One value for everyone — the common case. Grouped under the
                  heading the sheet itself gives these blanks: «الاسم الرباعي»
                  on its own does not say which party it names, and the minute
                  has two. */}
              <div className="space-y-4">
                <p className="text-[12.5px] font-bold text-ink">قيمة موحّدة لجميع المتعهدين</p>
                {Object.entries(
                  adminKeys.reduce((acc, key) => {
                    const g = assign.template.definition.fields[key]?.group || '';
                    (acc[g] ||= []).push(key);
                    return acc;
                  }, {}),
                ).map(([group, keys]) => (
                  <div key={group} className="space-y-3">
                    {group && (
                      <p className="text-[11px] font-bold text-primary rounded-[10px] border px-3 py-2"
                        style={{ background: tint(COLORS.primary, 12), borderColor: tint(COLORS.primary, 28) }}>
                        {group}
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {keys.map(key => {
                        const def = assign.template.definition.fields[key] || {};
                        return (
                          <Field key={key} label={def.label || key} required={def.required}>
                            {def.type === 'files' ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {(assign.shared[key] || []).map((u, i) => (
                                  <span key={i} className="inline-flex items-center gap-1.5 pe-1 ps-2 py-1 rounded-[10px]
                                                           border border-line bg-white">
                                    <img src={u} alt="" className="h-8 w-8 object-cover rounded" />
                                    <button type="button" aria-label="إزالة"
                                      onClick={() => setAssign(p => ({
                                        ...p,
                                        shared: { ...p.shared, [key]: (p.shared[key] || []).filter((_, j) => j !== i) },
                                      }))}
                                      className="w-4 h-4 rounded text-muted hover:text-ink leading-none">×</button>
                                  </span>
                                ))}
                                <label className={`${inputCls} w-auto cursor-pointer text-muted flex items-center text-[12.5px]`}>
                                  <input type="file" accept={def.accept || 'image/*'} multiple className="hidden"
                                    onChange={e => {
                                      [...(e.target.files || [])].forEach(f => uploadShared(key, f, true));
                                      e.target.value = '';
                                    }} />
                                  {uploading === key ? 'جارٍ الرفع…' : '+ إضافة صورة'}
                                </label>
                              </div>
                            ) : def.type === 'textarea' ? (
                              <textarea rows={4}
                                value={assign.shared[key] ?? ''}
                                onChange={e => setAssign(p => ({ ...p, shared: { ...p.shared, [key]: e.target.value } }))}
                                placeholder="اكتب هنا…"
                                className={`${inputCls} resize-y leading-relaxed`} />
                            ) : def.type === 'select' ? (
                              <select
                                value={assign.shared[key] ?? ''}
                                onChange={e => setAssign(p => ({ ...p, shared: { ...p.shared, [key]: e.target.value } }))}
                                className={inputCls}>
                                <option value="">اختر</option>
                                {(def.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : def.type === 'file' ? (
                              <div className="flex items-center gap-3">
                                {assign.shared[key] && (
                                  <img src={assign.shared[key]} alt=""
                                    className="h-10 w-auto object-contain rounded-lg border border-line bg-white" />
                                )}
                                <label className={`${inputCls} cursor-pointer text-muted flex items-center`}>
                                  <input type="file" accept="image/*" className="hidden"
                                    onChange={e => e.target.files?.[0] && uploadShared(key, e.target.files[0])} />
                                  {uploading === key
                                    ? 'جارٍ الرفع…'
                                    : assign.shared[key] ? 'استبدال الصورة' : 'إرفاق صورة'}
                                </label>
                              </div>
                            ) : def.type === 'date' && def.calendar !== 'gregorian' ? (
                              <HijriDateInput
                                value={assign.shared[key] ?? ''}
                                onChange={v => setAssign(p => ({ ...p, shared: { ...p.shared, [key]: v } }))}
                              />
                            ) : (
                              <input
                                type={def.type === 'date' ? 'date' : 'text'}
                                value={assign.shared[key] ?? ''}
                                onChange={e => setAssign(p => ({ ...p, shared: { ...p.shared, [key]: e.target.value } }))}
                                placeholder={def.source ? 'يُعبَّأ من النظام إن وُجد' : '—'}
                                className={inputCls}
                                dir={['id', 'phone', 'email', 'number', 'date'].includes(def.type) ? 'ltr' : undefined}
                              />
                            )}
                          </Field>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Per-caterer, for anything that differs — a contract number does. */}
              <details className="rounded-[11px] border border-line">
                <summary className="px-4 py-2.5 text-[12.5px] font-bold text-ink cursor-pointer select-none">
                  تخصيص لكل متعهد على حدة
                </summary>
                <DataTable className="px-4 pb-4">
                  <table className="w-full text-[12px]">
                    <thead className="text-muted border-b border-line">
                      <tr>
                        <th className="px-2 py-2 text-start font-bold min-w-[180px]">المتعهد</th>
                        {perCatererKeys.map(k => (
                          <th key={k} className="px-2 py-2 text-start font-bold whitespace-nowrap">
                            {assign.template.definition.fields[k]?.label || k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {assign.catererIds.map(id => {
                        const resolved = valuesFor(id);
                        return (
                          <tr key={id}>
                            <td className="px-2 py-2 text-ink">{catererById[id]?.name}</td>
                            {perCatererKeys.map(k => (
                              <td key={k} className="px-2 py-2">
                                <input
                                  value={assign.perCaterer[id]?.[k] ?? ''}
                                  onChange={e => setAssign(p => ({
                                    ...p,
                                    perCaterer: {
                                      ...p.perCaterer,
                                      [id]: { ...(p.perCaterer[id] || {}), [k]: e.target.value },
                                    },
                                  }))}
                                  placeholder={resolved[k] || '—'}
                                  className="w-full px-2 py-1 border border-line rounded-[8px] text-[12px] outline-none focus:border-primary bg-white"
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </DataTable>
              </details>

              {/* Exactly what the first caterer will receive. */}
              {assign.catererIds[0] && (
                <div>
                  <p className="text-[12.5px] font-bold text-ink mb-2">
                    معاينة نسخة «{catererById[assign.catererIds[0]]?.name}»
                  </p>
                  <div className="bg-[rgb(var(--c-bg))] rounded-[11px] border border-line p-4 max-h-[420px] overflow-y-auto">
                    <FormDocument
                      definition={assign.template.definition}
                      mode="view"
                      values={valuesFor(assign.catererIds[0])}
                      title={assign.template.title}
                      formNumber="FRM-••••"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={runAssign}
                  disabled={assigning}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] bg-primary border border-primary text-white font-bold text-[13px] hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  {assigning
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <PaperPlaneTilt size={15} />}
                  إسناد إلى {assign.catererIds.length} متعهد
                </button>
                <button onClick={() => setAssign(p => ({ ...p, step: 'who' }))}
                  className="px-5 py-2.5 rounded-[10px] border border-line bg-white text-ink text-[13px] font-bold hover:bg-[rgb(var(--c-bg))] transition-colors">
                  رجوع
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign step 1 ──────────────────────── */}
      {assign?.step === 'who' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[rgb(var(--c-ink)/0.45)] backdrop-blur-sm" onClick={() => setAssign(null)} />
          <div className="relative bg-white rounded-[18px] border border-line shadow-[0_24px_60px_-16px_rgb(var(--c-ink)/0.35)] w-full max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
              style={{ background: tint(COLORS.primary, 12), borderColor: tint(COLORS.primary, 28) }}>
              <div className="flex items-center gap-2.5">
                <IconTile Icon={PaperPlaneTilt} size="md" />
                <div>
                  <h2 className="font-bold text-ink text-[13.5px]">إسناد «{assign.template.title}»</h2>
                  <p className="text-[10.5px] font-medium text-muted">موسم {activeSeason ? seasonLabel(activeSeason) : '—'}</p>
                </div>
              </div>
              <button onClick={() => setAssign(null)}
                className="w-8 h-8 rounded-[10px] border border-line bg-white flex items-center justify-center hover:bg-[rgb(var(--c-bg))] transition-colors">
                <X size={15} className="text-muted" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-3">
              <Field label="الموعد النهائي للتسليم" required
                hint="يظهر في النموذج نفسه وفي بوابة المتعهد، ومنه يُحتسب التأخير">
                <div className="relative">
                  <div className="absolute inset-y-0 start-3 flex items-center pointer-events-none">
                    <CalendarBlank size={14} className="text-primary" />
                  </div>
                  <input type="date" value={assign.dueAt}
                    onChange={e => setAssign(p => ({ ...p, dueAt: e.target.value }))}
                    className={`${inputCls} pe-9`} dir="ltr" />
                </div>
              </Field>

              {(() => {
                const locked = assign.template.definition?.scope === 'center';
                return (
                  <label className={`flex items-start gap-2.5 px-3 py-2.5 rounded-[11px] border transition-colors ${
                    locked ? 'cursor-default' : 'border-line cursor-pointer hover:bg-[rgb(var(--c-bg))]'
                  }`}
                    style={locked
                      ? { background: tint(COLORS.primary, 12), borderColor: tint(COLORS.primary, 28) }
                      : undefined}>
                    <input type="checkbox" checked={assign.perCenter} disabled={locked}
                      onChange={e => setAssign(p => ({ ...p, perCenter: e.target.checked }))}
                      className="accent-primary w-4 h-4 mt-0.5" />
                    <span className="text-[12px]">
                      <span className="text-ink font-bold block">نسخة لكل مركز</span>
                      {locked && (
                        <span className="text-[10.5px] font-medium text-muted block mt-0.5">
                          هذا النموذج يطبع بيانات المركز، فلا يُسنَد إلا لمركز
                        </span>
                      )}
                    </span>
                  </label>
                );
              })()}

              <Field label={`المتعهدون (${assign.catererIds.length} محدد)`} required>
                <div className="flex gap-1.5 mb-2">
                  <button onClick={() => setAssign(p => ({ ...p, catererIds: caterers.filter(c => c.status === 'active').map(c => c.id) }))}
                    className="px-2.5 py-1 rounded-[8px] border border-line bg-white text-[11px] font-bold text-muted hover:text-primary hover:bg-[rgb(var(--c-bg))] transition-colors">
                    تحديد الكل
                  </button>
                  <button onClick={() => setAssign(p => ({ ...p, catererIds: [] }))}
                    className="px-2.5 py-1 rounded-[8px] border border-line bg-white text-[11px] font-bold text-muted hover:text-primary hover:bg-[rgb(var(--c-bg))] transition-colors">
                    إلغاء التحديد
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-[11px] border border-line divide-y divide-line">
                  {caterers.filter(c => c.status !== 'archived').map(c => {
                    const owned = activeSeason
                      ? centers.filter(x => x.seasonId === activeSeason.id && x.catererId === c.id).length
                      : 0;
                    return (
                      <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-[rgb(var(--c-bg))] cursor-pointer text-[12px]">
                        <input
                          type="checkbox"
                          checked={assign.catererIds.includes(c.id)}
                          onChange={e => setAssign(p => ({
                            ...p,
                            catererIds: e.target.checked
                              ? [...p.catererIds, c.id]
                              : p.catererIds.filter(x => x !== c.id),
                          }))}
                          className="accent-primary w-4 h-4 shrink-0"
                        />
                        <span className="text-ink font-medium flex-1 min-w-0 truncate">{c.name}</span>
                        {assign.perCenter && (
                          <span className="text-[10px] font-bold flex items-center gap-1 shrink-0"
                            style={{ color: owned ? 'rgb(var(--c-muted))' : COLORS.warning }}>
                            <Building2 size={10} /> {owned}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                              </Field>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => (adminKeys.length
                    ? setAssign(p => ({ ...p, step: 'fill' }))
                    : runAssign())}
                  disabled={assigning || !assign.catererIds.length}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] bg-primary border border-primary text-white font-bold text-[13px] hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  {assigning
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <PaperPlaneTilt size={15} />}
                  {adminKeys.length ? `التالي — تعبئة ${adminKeys.length} حقل` : 'إسناد'}
                </button>
                <button onClick={() => setAssign(null)}
                  className="px-5 py-2.5 rounded-[10px] border border-line bg-white text-ink text-[13px] font-bold hover:bg-[rgb(var(--c-bg))] transition-colors">
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

const Tag = ({ children, tone }) => {
  const c = tone === 'accent' ? COLORS.accent600 : tone === 'primary' ? COLORS.primary : null;
  return (
    <span className="px-2 py-[3px] rounded-md border font-bold"
      style={c
        ? { background: tint(c, 9), borderColor: tint(c, 22), color: c }
        : { background: 'rgb(var(--c-bg))', borderColor: 'rgb(var(--c-line))', color: 'rgb(var(--c-muted))' }}>
      {children}
    </span>
  );
};

function Action({ onClick, Icon, tone, children }) {
  const t = actionTone(tone);
  return (
    <button onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.background = t.ink; e.currentTarget.style.color = '#fff';
                           e.currentTarget.style.borderColor = t.ink; }}
      onMouseLeave={e => { e.currentTarget.style.background = t.bg; e.currentTarget.style.color = t.ink;
                           e.currentTarget.style.borderColor = t.line; }}
      style={{ background: t.bg, color: t.ink, borderColor: t.line }}
      className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-[8px] border transition-colors">
      <Icon size={11} weight="bold" /> {children}
    </button>
  );
}
